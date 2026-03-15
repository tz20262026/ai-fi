import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPTS, ConsultantMode } from "@/lib/prompts";
import { db } from "@/lib/db";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const BINARY_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

async function extractText(file: File, bytes: ArrayBuffer): Promise<string | null> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value;
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const workbook = XLSX.read(bytes, { type: "array" });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      lines.push(`=== シート: ${sheetName} ===`);
      lines.push(XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]));
    }
    return lines.join("\n");
  }
  if (name.endsWith(".txt")) return Buffer.from(bytes).toString("utf-8");
  return null;
}

function buildHistoryContext(
  histories: { createdAt: string; companyName: string | null; parsedData: string; rawText: string }[]
): string {
  if (histories.length === 0) return "";
  const lines = ["【過去の分析履歴（最新3件）】"];
  for (const h of histories.slice(0, 3)) {
    const date = new Date(h.createdAt).toLocaleDateString("ja-JP");
    const name = h.companyName ?? "不明";
    let summary = "";
    try {
      const pd = JSON.parse(h.parsedData);
      const fsData = pd.financial_summary ?? {};
      const entries = Object.entries(fsData).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join("、");
      summary = entries ? `財務: ${entries}` : "";
    } catch {
      summary = h.rawText.slice(0, 200);
    }
    lines.push(`- ${date} / ${name}: ${summary}`);
  }
  lines.push("", "上記の過去データと今回の財務資料を比較し、以下を必ず含めてください：");
  lines.push("① 主要財務指標の前回比較・トレンド（改善/悪化/横ばい）");
  lines.push("② 前回から今回にかけて変化した重要ポイント");
  lines.push("③ 継続的な課題と新たに発生したリスク", "");
  return lines.join("\n");
}

async function runGeminiAnalysis(draftId: string, mode: ConsultantMode) {
  const draft = await db.analysis.findById(draftId);
  if (!draft || !draft.fileData) throw new Error("下書きが見つかりません");

  const histories = await db.analysis.findMany({
    where: { mode, status: "completed" },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const historyContext = buildHistoryContext(histories);
  const hasHistory = histories.length > 0;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const systemPrompt = SYSTEM_PROMPTS[mode];
  const historySection = historyContext ? `\n\n${historyContext}` : "";
  const userPrompt = hasHistory
    ? "以下の財務資料を分析してください。過去のデータとの比較・トレンド分析を含め、必ずJSONフォーマットと詳細レポートを作成してください。"
    : "以下の財務資料を分析してください。必ずJSONフォーマットを含む詳細なレポートを作成してください。";

  let result;
  if (draft.fileMimeType && BINARY_MIME_TYPES.includes(draft.fileMimeType)) {
    result = await model.generateContent([
      { text: systemPrompt + historySection + "\n\n" + userPrompt },
      { inlineData: { mimeType: draft.fileMimeType, data: draft.fileData } },
    ]);
  } else {
    result = await model.generateContent([
      { text: systemPrompt + historySection + "\n\n" + userPrompt + "\n\n【財務資料の内容】\n" + draft.fileData },
    ]);
  }

  const text = result.response.text();
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
  let parsedData = null;
  if (jsonMatch) {
    try { parsedData = JSON.parse(jsonMatch[1]); } catch { /* continue */ }
  }

  let companyName: string | null = draft.companyName;
  if (!companyName && parsedData?.company_name) companyName = parsedData.company_name;
  if (!companyName) {
    const match = text.match(/(?:会社名|企業名|社名)[：:]\s*([^\n・、。]{1,30})/);
    if (match) companyName = match[1].trim();
  }

  await db.analysis.update({
    where: { id: draftId },
    data: {
      status: "completed",
      rawText: text,
      parsedData: JSON.stringify(parsedData ?? {}),
      companyName,
      errorMessage: null,
      // Clear stored file data after successful analysis to save space
      fileData: null,
    },
  });

  return { text, parsedData, hasHistory, historyCount: histories.length };
}

export async function POST(req: NextRequest) {
  let draftId: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mode = formData.get("mode") as ConsultantMode;

    if (!file) return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });
    if (!mode || !SYSTEM_PROMPTS[mode]) return NextResponse.json({ error: "無効なモードです" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const isBinary = BINARY_MIME_TYPES.includes(file.type);

    // ── Step 1: Save draft immediately ──
    let fileData: string;
    if (isBinary) {
      fileData = Buffer.from(bytes).toString("base64");
    } else {
      const extracted = await extractText(file, bytes);
      if (!extracted || extracted.trim().length === 0) {
        return NextResponse.json({ error: "ファイルからテキストを抽出できませんでした" }, { status: 400 });
      }
      fileData = extracted;
    }

    const draft = await db.analysis.create({
      data: {
        status: "pending",
        mode,
        companyName: null,
        fileName: file.name,
        fileMimeType: isBinary ? file.type : "text/plain",
        fileData,
        rawText: "",
        parsedData: "{}",
        errorMessage: null,
      },
    });
    draftId = draft.id;

    // ── Step 2: Call Gemini ──
    const { text, parsedData, hasHistory, historyCount } = await runGeminiAnalysis(draftId, mode);

    return NextResponse.json({
      success: true,
      id: draftId,
      mode,
      rawText: text,
      parsedData,
      hasHistory,
      historyCount,
    });
  } catch (error: unknown) {
    console.error("Analyze error:", error);
    const message = error instanceof Error ? error.message : "分析中にエラーが発生しました";

    // Mark draft as error so user can retry later
    if (draftId) {
      await db.analysis.update({
        where: { id: draftId },
        data: { status: "error", errorMessage: message },
      });
    }

    return NextResponse.json({ error: message, draftId }, { status: 500 });
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPTS, ConsultantMode } from "@/lib/prompts";
import { buildHistoryContext, HistoryContextEntry } from "@/lib/historyContext";
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

function extractCompanyName(text: string, parsedData: Record<string, unknown> | null): string | null {
  if (parsedData && typeof parsedData.company_name === "string" && parsedData.company_name) {
    return parsedData.company_name;
  }
  const match = text.match(/(?:会社名|企業名|社名)[：:]\s*([^\n・、。]{1,30})/);
  return match ? match[1].trim() : null;
}

/**
 * 履歴の永続化はクライアント側(localStorage)が担う。
 * このAPIはファイル抽出→Gemini分析を行い、結果をレスポンスで返すだけのステートレスな処理。
 * 「過去履歴との比較」用データはクライアントがlocalStorageから読み出し、
 * リクエストの historyContext フィールド(JSON文字列)として送ってくる。
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mode = formData.get("mode") as ConsultantMode;
    const historyContextRaw = formData.get("historyContext") as string | null;

    if (!file) return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });
    if (!mode || !SYSTEM_PROMPTS[mode]) return NextResponse.json({ error: "無効なモードです" }, { status: 400 });

    let histories: HistoryContextEntry[] = [];
    if (historyContextRaw) {
      try {
        const parsed = JSON.parse(historyContextRaw);
        if (Array.isArray(parsed)) histories = parsed.slice(0, 3);
      } catch {
        /* 不正なJSONは無視して履歴なしとして続行 */
      }
    }

    const bytes = await file.arrayBuffer();
    const isBinary = BINARY_MIME_TYPES.includes(file.type);

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
    const fileMimeType = isBinary ? file.type : "text/plain";

    try {
      const historyContext = buildHistoryContext(histories);
      const hasHistory = histories.length > 0;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const systemPrompt = SYSTEM_PROMPTS[mode];
      const historySection = historyContext ? `\n\n${historyContext}` : "";
      const userPrompt = hasHistory
        ? "以下の財務資料を分析してください。過去のデータとの比較・トレンド分析を含め、必ずJSONフォーマットと詳細レポートを作成してください。"
        : "以下の財務資料を分析してください。必ずJSONフォーマットを含む詳細なレポートを作成してください。";

      let result;
      if (isBinary) {
        result = await model.generateContent([
          { text: systemPrompt + historySection + "\n\n" + userPrompt },
          { inlineData: { mimeType: fileMimeType, data: fileData } },
        ]);
      } else {
        result = await model.generateContent([
          { text: systemPrompt + historySection + "\n\n" + userPrompt + "\n\n【財務資料の内容】\n" + fileData },
        ]);
      }

      const text = result.response.text();
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      let parsedData: Record<string, unknown> | null = null;
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[1]);
        } catch {
          /* JSONとして解釈できなくても本文レポートは使えるので続行 */
        }
      }

      const companyName = extractCompanyName(text, parsedData);

      return NextResponse.json({
        success: true,
        mode,
        rawText: text,
        parsedData,
        companyName,
        fileName: file.name,
        hasHistory,
        historyCount: histories.length,
      });
    } catch (geminiError: unknown) {
      // Gemini呼び出し失敗時は、クライアント側で「再分析」できるよう抽出済みのファイルデータを返す
      const message = geminiError instanceof Error ? geminiError.message : "分析中にエラーが発生しました";
      return NextResponse.json(
        { error: message, mode, fileName: file.name, fileMimeType, fileData },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Analyze error:", error);
    const message = error instanceof Error ? error.message : "分析中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

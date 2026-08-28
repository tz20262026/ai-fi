import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPTS, ConsultantMode } from "@/lib/prompts";
import { HistoryContextEntry } from "@/lib/historyContext";
import { BINARY_MIME_TYPES, runGeminiAnalysis } from "@/lib/geminiAnalyze";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

// Gemini分析はファイルサイズ次第で時間がかかるため、実行時間の上限を延ばす
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB（クライアント側と揃える）

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
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "ファイルサイズは20MB以下にしてください" }, { status: 413 });
    }

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
      const analysis = await runGeminiAnalysis({ mode, fileData, fileMimeType, histories });
      return NextResponse.json({
        success: true,
        mode,
        fileName: file.name,
        ...analysis,
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

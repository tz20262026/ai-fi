import { NextRequest, NextResponse } from "next/server";
import { ConsultantMode, SYSTEM_PROMPTS } from "@/lib/prompts";
import { HistoryContextEntry } from "@/lib/historyContext";
import { runGeminiAnalysis } from "@/lib/geminiAnalyze";

// Gemini分析はファイルサイズ次第で時間がかかるため、実行時間の上限を延ばす
export const runtime = "nodejs";
export const maxDuration = 60;

interface RetryBody {
  mode: ConsultantMode;
  fileData: string;
  fileMimeType: string | null;
  historyContext?: HistoryContextEntry[];
}

/**
 * 再分析API。履歴(fileData等)はクライアント(localStorage)が保持しており、
 * リクエストボディでそのまま送られてくる。サーバー側での永続化は行わない。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<RetryBody>;
    const { mode, fileData, fileMimeType } = body;
    const histories = Array.isArray(body.historyContext) ? body.historyContext.slice(0, 3) : [];

    if (!fileData) {
      return NextResponse.json(
        { error: "ファイルデータが保存されていません。元のファイルを再アップロードしてください。" },
        { status: 400 }
      );
    }
    if (!mode || !SYSTEM_PROMPTS[mode]) {
      return NextResponse.json({ error: "無効なモードです" }, { status: 400 });
    }

    const analysis = await runGeminiAnalysis({
      mode,
      fileData,
      fileMimeType: fileMimeType ?? null,
      histories,
    });

    return NextResponse.json({ success: true, mode, ...analysis });
  } catch (error: unknown) {
    console.error("Retry error:", error);
    const message = error instanceof Error ? error.message : "再分析に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

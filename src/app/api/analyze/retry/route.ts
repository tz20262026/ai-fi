import { NextRequest, NextResponse } from "next/server";
import { ConsultantMode, SYSTEM_PROMPTS } from "@/lib/prompts";
import { HistoryContextEntry } from "@/lib/historyContext";
import { runGeminiAnalysis, toFriendlyErrorMessage } from "@/lib/geminiAnalyze";
import { checkAnalyzeRateLimit, getClientIp, isAuthenticated } from "@/lib/auth";

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
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // Gemini APIは呼ばれるたびに費用が発生するため、Cookie漏洩や連打による
  // 想定外コストを防ぐ簡易レート制限（IPベース）。新規分析(/api/analyze)と共通のカウンタを使う
  const { limited, retryAfterSec } = checkAnalyzeRateLimit(getClientIp(req));
  if (limited) {
    return NextResponse.json(
      { error: "短時間に分析リクエストが多すぎます。しばらく待ってから再度お試しください。", retryAfterSec },
      { status: 429 }
    );
  }

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

    try {
      const analysis = await runGeminiAnalysis({
        mode,
        fileData,
        fileMimeType: fileMimeType ?? null,
        histories,
      });
      return NextResponse.json({ success: true, mode, ...analysis });
    } catch (geminiError: unknown) {
      const message = toFriendlyErrorMessage(geminiError);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error("Retry error:", error);
    const message = error instanceof Error ? error.message : "再分析に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPTS, ConsultantMode } from "@/lib/prompts";
import { buildHistoryContext, HistoryContextEntry } from "@/lib/historyContext";

/**
 * Gemini分析の共通ロジック。
 * /api/analyze（新規分析）と /api/analyze/retry（再分析）の両方から呼ばれる。
 * 以前は2ファイルにほぼ同一のコードが重複していたのをここへ集約した。
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const GEMINI_MODEL = "gemini-2.5-flash";

/** Geminiへインラインデータ（base64）として渡す形式。それ以外はテキスト抽出してプロンプトへ差し込む */
export const BINARY_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export interface GeminiAnalysisResult {
  rawText: string;
  parsedData: Record<string, unknown> | null;
  companyName: string | null;
  hasHistory: boolean;
  historyCount: number;
}

/** レポート本文または構造化データから会社名を推定する */
export function extractCompanyName(
  text: string,
  parsedData: Record<string, unknown> | null
): string | null {
  if (parsedData && typeof parsedData.company_name === "string" && parsedData.company_name) {
    return parsedData.company_name;
  }
  const match = text.match(/(?:会社名|企業名|社名)[：:]\s*([^\n・、。]{1,30})/);
  return match ? match[1].trim() : null;
}

interface RunGeminiAnalysisArgs {
  mode: ConsultantMode;
  /** バイナリの場合はbase64文字列、テキストファイルの場合は抽出済みの本文 */
  fileData: string;
  /** バイナリなら元のMIMEタイプ、テキストなら "text/plain" */
  fileMimeType: string | null;
  histories: HistoryContextEntry[];
}

export async function runGeminiAnalysis({
  mode,
  fileData,
  fileMimeType,
  histories,
}: RunGeminiAnalysisArgs): Promise<GeminiAnalysisResult> {
  const historyContext = buildHistoryContext(histories);
  const hasHistory = histories.length > 0;

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const systemPrompt = SYSTEM_PROMPTS[mode];
  const historySection = historyContext ? `\n\n${historyContext}` : "";
  const userPrompt = hasHistory
    ? "以下の財務資料を分析してください。過去のデータとの比較・トレンド分析を含め、必ずJSONフォーマットと詳細レポートを作成してください。"
    : "以下の財務資料を分析してください。必ずJSONフォーマットを含む詳細なレポートを作成してください。";

  const isBinary = !!fileMimeType && BINARY_MIME_TYPES.includes(fileMimeType);
  const result = isBinary
    ? await model.generateContent([
        { text: systemPrompt + historySection + "\n\n" + userPrompt },
        { inlineData: { mimeType: fileMimeType!, data: fileData } },
      ])
    : await model.generateContent([
        {
          text:
            systemPrompt + historySection + "\n\n" + userPrompt + "\n\n【財務資料の内容】\n" + fileData,
        },
      ]);

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

  return {
    rawText: text,
    parsedData,
    companyName: extractCompanyName(text, parsedData),
    hasHistory,
    historyCount: histories.length,
  };
}

/**
 * Gemini SDKが投げる生のエラー（英語・HTTPステータス文言など）を、
 * 日本語UIにそのまま出しても不自然にならないよう、分かりやすいメッセージへ変換する。
 * キーワードの緩い部分一致で判定するため、SDKのメッセージ変化にもある程度追従できる。
 */
export function toFriendlyErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted") ||
    lower.includes("resource exhausted")
  ) {
    return "AIサービスの利用上限に達しています。しばらく時間をおいてから再度お試しください。";
  }
  if (lower.includes("safety") || lower.includes("blocked")) {
    return "ファイルの内容が安全基準に抵触したため分析を完了できませんでした。別のファイルでお試しください。";
  }
  if (lower.includes("timeout") || lower.includes("deadline")) {
    return "分析がタイムアウトしました。ファイルサイズを小さくするか、時間をおいて再度お試しください。";
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused")
  ) {
    return "ネットワークエラーが発生しました。通信環境を確認して再度お試しください。";
  }
  if (
    lower.includes("api key") ||
    lower.includes("permission") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return "AI分析サービスへの接続に問題が発生しました。時間をおいて再度お試しください。";
  }

  return raw || "分析中にエラーが発生しました";
}

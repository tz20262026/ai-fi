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

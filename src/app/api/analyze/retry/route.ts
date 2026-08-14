import { NextRequest, NextResponse } from "next/server";
import { ConsultantMode, SYSTEM_PROMPTS } from "@/lib/prompts";
import { buildHistoryContext, HistoryContextEntry } from "@/lib/historyContext";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const BINARY_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

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
    const historyContext = Array.isArray(body.historyContext) ? body.historyContext.slice(0, 3) : [];

    if (!fileData) {
      return NextResponse.json(
        { error: "ファイルデータが保存されていません。元のファイルを再アップロードしてください。" },
        { status: 400 }
      );
    }
    if (!mode || !SYSTEM_PROMPTS[mode]) {
      return NextResponse.json({ error: "無効なモードです" }, { status: 400 });
    }

    const historyContextText = buildHistoryContext(historyContext);
    const hasHistory = historyContext.length > 0;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const systemPrompt = SYSTEM_PROMPTS[mode];
    const historySection = historyContextText ? `\n\n${historyContextText}` : "";
    const userPrompt = hasHistory
      ? "以下の財務資料を分析してください。過去のデータとの比較・トレンド分析を含め、必ずJSONフォーマットと詳細レポートを作成してください。"
      : "以下の財務資料を分析してください。必ずJSONフォーマットを含む詳細なレポートを作成してください。";

    let result;
    const isBinary = !!fileMimeType && BINARY_MIME_TYPES.includes(fileMimeType);

    if (isBinary) {
      result = await model.generateContent([
        { text: systemPrompt + historySection + "\n\n" + userPrompt },
        { inlineData: { mimeType: fileMimeType!, data: fileData } },
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

    let companyName: string | null = null;
    if (parsedData && typeof parsedData.company_name === "string") companyName = parsedData.company_name;
    if (!companyName) {
      const match = text.match(/(?:会社名|企業名|社名)[：:]\s*([^\n・、。]{1,30})/);
      if (match) companyName = match[1].trim();
    }

    return NextResponse.json({
      success: true,
      mode,
      rawText: text,
      parsedData,
      companyName,
      hasHistory,
      historyCount: historyContext.length,
    });
  } catch (error: unknown) {
    console.error("Retry error:", error);
    const message = error instanceof Error ? error.message : "再分析に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

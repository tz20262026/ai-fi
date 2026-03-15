import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ConsultantMode, SYSTEM_PROMPTS } from "@/lib/prompts";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const BINARY_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "IDが必要です" }, { status: 400 });

    const draft = await db.analysis.findById(id);
    if (!draft) return NextResponse.json({ error: "レコードが見つかりません" }, { status: 404 });
    if (!draft.fileData) return NextResponse.json({ error: "ファイルデータが保存されていません。元のファイルを再アップロードしてください。" }, { status: 400 });

    const mode = draft.mode as ConsultantMode;
    if (!SYSTEM_PROMPTS[mode]) return NextResponse.json({ error: "無効なモードです" }, { status: 400 });

    // Mark as pending again
    await db.analysis.update({ where: { id }, data: { status: "pending", errorMessage: null } });

    // Fetch completed history for context
    const histories = await db.analysis.findMany({
      where: { mode, status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const systemPrompt = SYSTEM_PROMPTS[mode];
    const userPrompt = "以下の財務資料を分析してください。必ずJSONフォーマットを含む詳細なレポートを作成してください。";

    let result;
    const isBinary = draft.fileMimeType && BINARY_MIME_TYPES.includes(draft.fileMimeType);

    if (isBinary) {
      result = await model.generateContent([
        { text: systemPrompt + "\n\n" + userPrompt },
        { inlineData: { mimeType: draft.fileMimeType!, data: draft.fileData } },
      ]);
    } else {
      result = await model.generateContent([
        { text: systemPrompt + "\n\n" + userPrompt + "\n\n【財務資料の内容】\n" + draft.fileData },
      ]);
    }

    const text = result.response.text();
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    let parsedData = null;
    if (jsonMatch) {
      try { parsedData = JSON.parse(jsonMatch[1]); } catch { /* continue */ }
    }

    let companyName = draft.companyName;
    if (!companyName && parsedData?.company_name) companyName = parsedData.company_name;
    if (!companyName) {
      const match = text.match(/(?:会社名|企業名|社名)[：:]\s*([^\n・、。]{1,30})/);
      if (match) companyName = match[1].trim();
    }

    await db.analysis.update({
      where: { id },
      data: {
        status: "completed",
        rawText: text,
        parsedData: JSON.stringify(parsedData ?? {}),
        companyName,
        errorMessage: null,
        fileData: null,
      },
    });

    return NextResponse.json({
      success: true,
      id,
      mode,
      rawText: text,
      parsedData,
      hasHistory: histories.length > 0,
      historyCount: histories.length,
    });
  } catch (error: unknown) {
    console.error("Retry error:", error);
    const { id } = await req.json().catch(() => ({}));
    const message = error instanceof Error ? error.message : "再分析に失敗しました";
    if (id) await db.analysis.update({ where: { id }, data: { status: "error", errorMessage: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * 「過去の分析履歴と比較する」機能用のプロンプト構築ロジック。
 * 入力元は以前はサーバーDBだったが、現在はクライアント(localStorage)から
 * リクエストボディ経由で渡される履歴データを使う。ロジック自体は変更なし。
 */

export interface HistoryContextEntry {
  createdAt: string;
  companyName: string | null;
  parsedData: string;
  rawText: string;
}

export function buildHistoryContext(histories: HistoryContextEntry[]): string {
  if (!histories || histories.length === 0) return "";
  const lines = ["【過去の分析履歴（最新3件）】"];
  for (const h of histories.slice(0, 3)) {
    const date = new Date(h.createdAt).toLocaleDateString("ja-JP");
    const name = h.companyName ?? "不明";
    let summary = "";
    try {
      const pd = JSON.parse(h.parsedData);
      const fsData = pd.financial_summary ?? {};
      const entries = Object.entries(fsData)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${v}`)
        .join("、");
      summary = entries ? `財務: ${entries}` : "";
    } catch {
      summary = (h.rawText || "").slice(0, 200);
    }
    lines.push(`- ${date} / ${name}: ${summary}`);
  }
  lines.push("", "上記の過去データと今回の財務資料を比較し、以下を必ず含めてください：");
  lines.push("① 主要財務指標の前回比較・トレンド（改善/悪化/横ばい）");
  lines.push("② 前回から今回にかけて変化した重要ポイント");
  lines.push("③ 継続的な課題と新たに発生したリスク", "");
  return lines.join("\n");
}

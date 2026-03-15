import { CONSULTANT_MODES, ConsultantMode } from "@/lib/prompts";

interface Recommendation {
  title: string;
  detail: string;
  priority: "高" | "中" | "低";
}

interface ParsedData {
  financial_summary?: Record<string, string>;
  recommendations?: Recommendation[];
  credit_score?: string;
  investment_rating?: string;
  recovery_stage?: string;
  loan_opinion?: string;
  encouraging_message?: string;
  strengths?: string[];
  risk_factors?: string[];
  growth_catalysts?: string[];
  key_risks?: string[];
  support_programs?: string[];
}

interface PdfLayoutProps {
  mode: ConsultantMode;
  rawText: string;
  parsedData: ParsedData | null;
  companyName?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  高: "#ef4444",
  中: "#f59e0b",
  低: "#22c55e",
};

function formatKey(key: string): string {
  const map: Record<string, string> = {
    sales: "売上高", operating_profit: "営業利益", net_profit: "純利益",
    total_assets: "総資産", equity_ratio: "自己資本比率",
    debt_service_coverage: "債務償還年数", ebitda: "EBITDA",
    fcf: "フリーキャッシュフロー", revenue_growth: "売上成長率",
    operating_margin: "営業利益率", roe: "ROE",
    pre_disaster_sales: "被災前売上高", estimated_loss: "推定損害額",
    available_insurance: "保険金", subsidy_potential: "補助金活用額",
    recovery_timeline: "復興期間",
  };
  return map[key] || key;
}

export default function PdfLayout({ mode, rawText, parsedData, companyName }: PdfLayoutProps) {
  const config = CONSULTANT_MODES[mode];
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const recs = parsedData?.recommendations ?? [];
  const summary = parsedData?.financial_summary ?? {};
  const positiveItems = parsedData?.strengths ?? parsedData?.growth_catalysts ?? parsedData?.support_programs;
  const negativeItems = parsedData?.risk_factors ?? parsedData?.key_risks;

  const getMetaBadge = () => {
    if (mode === "bank") return parsedData?.credit_score ? `信用スコア: ${parsedData.credit_score}` : parsedData?.loan_opinion ?? null;
    if (mode === "investment") return parsedData?.investment_rating ?? null;
    if (mode === "disaster") return parsedData?.recovery_stage ?? null;
    return null;
  };
  const metaBadge = getMetaBadge();

  // Strip JSON blocks from rawText for clean display
  const cleanText = rawText.replace(/```json[\s\S]*?```/g, "").trim();

  return (
    <div
      style={{
        fontFamily: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif',
        backgroundColor: "#ffffff",
        color: "#1e293b",
        padding: "48px 52px",
        width: "794px", // A4 width at 96dpi
        minHeight: "1123px",
        boxSizing: "border-box",
        lineHeight: 1.7,
      }}
    >
      {/* Header bar */}
      <div style={{ borderBottom: "3px solid #1d4ed8", paddingBottom: "20px", marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#64748b", letterSpacing: "0.1em", marginBottom: "4px" }}>
              AI 財務アドバイザー　機密レポート
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>
              {config.icon} {config.label}　財務分析レポート
            </h1>
            {companyName && (
              <div style={{ fontSize: "15px", color: "#1d4ed8", fontWeight: "600", marginTop: "6px" }}>
                対象企業：{companyName}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right", fontSize: "12px", color: "#64748b" }}>
            <div>作成日：{today}</div>
            <div>分析モード：{config.label}</div>
            {metaBadge && (
              <div style={{
                marginTop: "6px", display: "inline-block",
                background: "#dbeafe", color: "#1d4ed8",
                padding: "2px 10px", borderRadius: "4px",
                fontWeight: "600", fontSize: "12px",
              }}>
                {metaBadge}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Financial summary */}
      {Object.keys(summary).length > 0 && (
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "bold", color: "#1e293b", borderLeft: "4px solid #1d4ed8", paddingLeft: "10px", margin: "0 0 14px 0" }}>
            財務サマリー
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            {Object.entries(summary).map(([k, v]) => (
              <div key={k} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "3px" }}>{formatKey(k)}</div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3 Recommendations */}
      {recs.length > 0 && (
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "bold", color: "#1e293b", borderLeft: "4px solid #f59e0b", paddingLeft: "10px", margin: "0 0 14px 0" }}>
            コンサルタントの提言
          </h2>
          {recs.slice(0, 3).map((rec, i) => (
            <div key={i} style={{ display: "flex", gap: "14px", marginBottom: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px 16px" }}>
              <div style={{ fontSize: "20px", flexShrink: 0 }}>{["💡", "🎯", "🚀"][i]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                  <span style={{ fontWeight: "700", fontSize: "13px" }}>{rec.title}</span>
                  <span style={{
                    fontSize: "10px", padding: "1px 7px", borderRadius: "4px",
                    background: PRIORITY_COLOR[rec.priority] + "20",
                    color: PRIORITY_COLOR[rec.priority],
                    border: `1px solid ${PRIORITY_COLOR[rec.priority]}50`,
                    fontWeight: "600",
                  }}>
                    優先度: {rec.priority}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.7 }}>{rec.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Strengths & Risks */}
      {(positiveItems?.length || negativeItems?.length) ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "28px" }}>
          {positiveItems && positiveItems.length > 0 && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "14px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a", marginBottom: "8px" }}>
                {mode === "disaster" ? "活用可能な支援制度" : mode === "investment" ? "成長触媒" : "強み"}
              </div>
              {positiveItems.map((item, i) => (
                <div key={i} style={{ fontSize: "11px", color: "#374151", marginBottom: "4px" }}>✓ {item}</div>
              ))}
            </div>
          )}
          {negativeItems && negativeItems.length > 0 && (
            <div style={{ background: "#fff7f7", border: "1px solid #fecaca", borderRadius: "8px", padding: "14px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#dc2626", marginBottom: "8px" }}>リスク要因</div>
              {negativeItems.map((item, i) => (
                <div key={i} style={{ fontSize: "11px", color: "#374151", marginBottom: "4px" }}>！ {item}</div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Encouraging message */}
      {mode === "disaster" && parsedData?.encouraging_message && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "14px 16px", marginBottom: "28px" }}>
          <div style={{ fontSize: "12px", color: "#c2410c", fontStyle: "italic" }}>
            「{parsedData.encouraging_message}」
          </div>
        </div>
      )}

      {/* Full report text */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: "bold", color: "#1e293b", borderLeft: "4px solid #64748b", paddingLeft: "10px", margin: "0 0 14px 0" }}>
          詳細分析レポート
        </h2>
        <div style={{ fontSize: "11.5px", color: "#374151", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
          {cleanText}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "10px", color: "#94a3b8" }}>
          AI財務アドバイザー　Powered by Gemini 2.5 Flash
        </div>
        <div style={{ fontSize: "10px", color: "#94a3b8" }}>
          ※ 本レポートはAIによる参考情報です。実際の意思決定は専門家にご相談ください。
        </div>
      </div>
    </div>
  );
}

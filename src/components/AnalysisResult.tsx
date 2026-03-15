"use client";

import { useState, useRef } from "react";
import { ChevronDown, ChevronUp, TrendingUp, AlertTriangle, Star, RefreshCw, Copy, Check, ArrowLeft, FileDown } from "lucide-react";
import { createPortal } from "react-dom";
import { CONSULTANT_MODES, ConsultantMode } from "@/lib/prompts";
import { cn } from "@/lib/utils";
import PdfLayout from "./PdfLayout";

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
  priority_actions?: string;
  loan_opinion?: string;
  target_multiple?: string;
  encouraging_message?: string;
  strengths?: string[];
  risk_factors?: string[];
  growth_catalysts?: string[];
  key_risks?: string[];
  support_programs?: string[];
  company_name?: string;
}

interface AnalysisResultProps {
  mode: ConsultantMode;
  rawText: string;
  parsedData: ParsedData | null;
  onReset: () => void;
}

const PRIORITY_CONFIG = {
  高: { color: "text-red-400 bg-red-400/10 border-red-400/30", dot: "bg-red-400" },
  中: { color: "text-amber-400 bg-amber-400/10 border-amber-400/30", dot: "bg-amber-400" },
  低: { color: "text-green-400 bg-green-400/10 border-green-400/30", dot: "bg-green-400" },
};

const CARD_ICONS = ["💡", "🎯", "🚀"];

function formatKey(key: string): string {
  const map: Record<string, string> = {
    sales: "売上高",
    operating_profit: "営業利益",
    net_profit: "純利益",
    total_assets: "総資産",
    equity_ratio: "自己資本比率",
    debt_service_coverage: "債務償還年数",
    ebitda: "EBITDA",
    fcf: "フリーキャッシュフロー",
    revenue_growth: "売上成長率",
    operating_margin: "営業利益率",
    roe: "ROE",
    pre_disaster_sales: "被災前売上高",
    estimated_loss: "推定損害額",
    available_insurance: "保険金",
    subsidy_potential: "補助金活用額",
    recovery_timeline: "復興期間",
  };
  return map[key] || key;
}

export default function AnalysisResult({ mode, rawText, parsedData, onReset }: AnalysisResultProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const config = CONSULTANT_MODES[mode];
  const recs: Recommendation[] = parsedData?.recommendations || [];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!pdfRef.current || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { generatePdf } = await import("@/lib/generatePdf");
      pdfRef.current.style.display = "block";
      await new Promise((r) => setTimeout(r, 100)); // ensure render
      const company = parsedData?.company_name ?? "report";
      const date = new Date().toISOString().slice(0, 10);
      await generatePdf("pdf-print-area", `財務分析_${company}_${date}.pdf`);
    } finally {
      if (pdfRef.current) pdfRef.current.style.display = "none";
      setPdfLoading(false);
    }
  };

  // Extract key metadata
  const getMetaBadge = () => {
    if (!parsedData) return null;
    if (mode === "bank") return parsedData.credit_score ? `信用スコア: ${parsedData.credit_score}` : null;
    if (mode === "investment") return parsedData.investment_rating as string;
    if (mode === "disaster") return parsedData.recovery_stage as string;
    return null;
  };

  const metaBadge = getMetaBadge();

  return (
    <div className="space-y-6">
      {/* Top action bar: 戻る & コピー & PDF */}
      <div className="flex items-center justify-between">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          戻る
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200",
              copied
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : "bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white"
            )}
          >
            {copied ? <><Check className="w-3.5 h-3.5" /> コピーしました！</> : <><Copy className="w-3.5 h-3.5" /> コピー</>}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 bg-red-600/20 border-red-500/40 text-red-400 hover:bg-red-600/30 hover:border-red-500/60 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pdfLoading ? (
              <><span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin inline-block" /> 生成中...</>
            ) : (
              <><FileDown className="w-3.5 h-3.5" /> PDFで保存</>
            )}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h2 className="text-white font-bold text-lg">分析レポート完成</h2>
            <p className="text-slate-400 text-sm">{config.label}モード</p>
          </div>
        </div>
        {metaBadge && (
          <span className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-semibold rounded-lg">
            {metaBadge}
          </span>
        )}
      </div>

      {/* Financial Summary */}
      {parsedData?.financial_summary && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-slate-300 font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            財務サマリー
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(parsedData.financial_summary).map(([key, val]) => (
              <div key={key} className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-1">{formatKey(key)}</p>
                <p className="text-white font-bold text-sm leading-tight">{String(val)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3 Recommendations */}
      {recs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-slate-300 font-semibold text-sm flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            コンサルタントの3つの提言
          </h3>
          {recs.slice(0, 3).map((rec, i) => {
            const pConfig = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG["中"];
            return (
              <div
                key={i}
                className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5 hover:border-slate-600/60 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl flex-shrink-0 mt-0.5">{CARD_ICONS[i]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-white font-semibold text-sm">{rec.title}</span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full border font-medium",
                        pConfig.color
                      )}>
                        優先度: {rec.priority}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">{rec.detail}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Strengths / Risk factors */}
      {parsedData && (() => {
        const positiveItems = parsedData.strengths ?? parsedData.growth_catalysts ?? parsedData.support_programs;
        const negativeItems = parsedData.risk_factors ?? parsedData.key_risks;
        const positiveLabel = mode === "disaster" ? "活用可能な支援制度" : mode === "investment" ? "成長触媒" : "強み";
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {positiveItems && positiveItems.length > 0 && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                <h4 className="text-emerald-400 font-semibold text-sm mb-2">{positiveLabel}</h4>
                <ul className="space-y-1">
                  {positiveItems.map((item, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {negativeItems && negativeItems.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                <h4 className="text-red-400 font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> リスク要因
                </h4>
                <ul className="space-y-1">
                  {negativeItems.map((item, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">!</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

      {/* Encouraging message for disaster mode */}
      {mode === "disaster" && parsedData?.encouraging_message && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-5">
          <p className="text-orange-300 text-sm leading-relaxed italic">
            &ldquo;{String(parsedData.encouraging_message)}&rdquo;
          </p>
        </div>
      )}

      {/* Raw text toggle */}
      <div className="border-t border-slate-700/50 pt-4">
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          詳細レポート全文を{showRaw ? "閉じる" : "表示"}
        </button>
        {showRaw && (
          <pre className="mt-3 bg-slate-900/70 border border-slate-700/30 rounded-xl p-4 text-xs text-slate-400 overflow-auto max-h-96 whitespace-pre-wrap leading-relaxed">
            {rawText}
          </pre>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 text-slate-300 hover:text-white rounded-xl transition-all duration-200"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-sm font-medium">別のファイルを分析する</span>
        </button>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200",
            copied
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
              : "bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30 hover:border-blue-500/60 hover:text-blue-300"
          )}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "完了" : "コピー"}
        </button>
        <button
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 bg-red-600/20 border-red-500/40 text-red-400 hover:bg-red-600/30 hover:border-red-500/60 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pdfLoading
            ? <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
            : <FileDown className="w-4 h-4" />}
          PDF
        </button>
      </div>

      {/* Hidden PDF render area (portal to body to avoid clipping) */}
      {typeof window !== "undefined" && createPortal(
        <div
          ref={pdfRef}
          id="pdf-print-area"
          style={{ display: "none", position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}
        >
          <PdfLayout
            mode={mode}
            rawText={rawText}
            parsedData={parsedData}
            companyName={parsedData?.company_name}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { X, History, Trash2, ChevronDown, ChevronUp, Building2, Calendar, FileText, RotateCcw, AlertCircle, Clock } from "lucide-react";
import { CONSULTANT_MODES, ConsultantMode } from "@/lib/prompts";
import { cn } from "@/lib/utils";

interface AnalysisRecord {
  id: string;
  createdAt: string;
  status: "pending" | "completed" | "error";
  mode: string;
  companyName: string | null;
  fileName: string | null;
  rawText: string;
  parsedData: string;
  errorMessage: string | null;
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (record: AnalysisRecord) => void;
  onRetryComplete: (data: { id: string; mode: string; rawText: string; parsedData: unknown; hasHistory: boolean; historyCount: number }) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_CONFIG = {
  completed: { label: "分析完了", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  pending:   { label: "分析待ち", color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  error:     { label: "未分析", color: "text-red-400 bg-red-400/10 border-red-400/30" },
};

function HistoryCard({
  record,
  onDelete,
  onRestore,
  onRetry,
}: {
  record: AnalysisRecord;
  onDelete: (id: string) => void;
  onRestore: (record: AnalysisRecord) => void;
  onRetry: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const modeConfig = CONSULTANT_MODES[record.mode as ConsultantMode];
  const statusConfig = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.error;
  const isCompleted = record.status === "completed";

  let summary: Record<string, string> = {};
  try {
    const pd = JSON.parse(record.parsedData);
    summary = pd.financial_summary ?? {};
  } catch { /* ignore */ }
  const summaryEntries = Object.entries(summary).slice(0, 3);

  const handleRetry = async () => {
    setRetrying(true);
    try { await onRetry(record.id); }
    finally { setRetrying(false); }
  };

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-colors",
      isCompleted
        ? "bg-slate-800/60 border-slate-700/50 hover:border-slate-600/60"
        : "bg-slate-800/40 border-amber-500/20 hover:border-amber-500/40"
    )}>
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">{modeConfig?.icon ?? "📊"}</span>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">
                {record.companyName ?? "社名不明"}
              </p>
              <p className="text-slate-500 text-xs">{modeConfig?.label ?? record.mode}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1", statusConfig.color)}>
              {record.status === "error" && <AlertCircle className="w-3 h-3" />}
              {record.status === "pending" && <Clock className="w-3 h-3" />}
              {statusConfig.label}
            </span>
            <button
              onClick={() => onDelete(record.id)}
              className="text-slate-600 hover:text-red-400 transition-colors p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Error message */}
        {record.errorMessage && (
          <p className="text-red-400/70 text-xs mb-2 leading-relaxed bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
            {record.errorMessage.slice(0, 120)}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(record.createdAt)}
          </span>
          {record.fileName && (
            <span className="flex items-center gap-1 truncate">
              <FileText className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{record.fileName}</span>
            </span>
          )}
        </div>

        {/* Financial chips (completed only) */}
        {summaryEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {summaryEntries.map(([k, v]) => (
              <span key={k} className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-md">{v}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {isCompleted ? (
            <button
              onClick={() => onRestore(record)}
              className="flex-1 text-xs py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg transition-all"
            >
              このレポートを表示
            </button>
          ) : (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 hover:text-amber-300 rounded-lg transition-all disabled:opacity-50"
            >
              {retrying ? (
                <><span className="w-3 h-3 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />再分析中...</>
              ) : (
                <><RotateCcw className="w-3 h-3" />未分析（再試行する）</>
              )}
            </button>
          )}
          {isCompleted && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {expanded && isCompleted && (
        <div className="border-t border-slate-700/40 p-4">
          <pre className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed max-h-48 overflow-auto">
            {record.rawText}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function HistoryPanel({ isOpen, onClose, onRestore, onRetryComplete }: HistoryPanelProps) {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<string>("all");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setRecords(data.analyses ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { if (isOpen) fetchHistory(); }, [isOpen, fetchHistory]);

  const handleDelete = async (id: string) => {
    if (!confirm("この履歴を削除しますか？")) return;
    await fetch("/api/history", { method: "DELETE", body: JSON.stringify({ id }), headers: { "Content-Type": "application/json" } });
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRetry = async (id: string) => {
    const res = await fetch("/api/analyze/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      // Update local status to error
      setRecords((prev) => prev.map((r) => r.id === id ? { ...r, status: "error", errorMessage: data.error } : r));
      alert(`再分析に失敗しました: ${data.error}`);
      return;
    }
    // Update local record to completed
    setRecords((prev) => prev.map((r) =>
      r.id === id ? { ...r, status: "completed", rawText: data.rawText, parsedData: JSON.stringify(data.parsedData ?? {}), errorMessage: null } : r
    ));
    onRetryComplete(data);
    onClose();
  };

  const pendingCount = records.filter((r) => r.status !== "completed").length;
  const filtered = filterMode === "all" ? records : records.filter((r) => r.mode === filterMode);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-700/50 z-50 flex flex-col shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <h2 className="text-white font-bold">過去の分析履歴</h2>
            {records.length > 0 && (
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{records.length}件</span>
            )}
            {pendingCount > 0 && (
              <span className="text-xs bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full">
                未分析 {pendingCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 py-3 border-b border-slate-700/30">
          {["all", "bank", "investment", "disaster"].map((m) => {
            const label = m === "all" ? "すべて" : (CONSULTANT_MODES[m as ConsultantMode]?.label ?? m);
            const count = m === "all" ? records.length : records.filter((r) => r.mode === m).length;
            return (
              <button
                key={m}
                onClick={() => setFilterMode(m)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-lg transition-all",
                  filterMode === m ? "bg-blue-600/30 text-blue-300 border border-blue-500/30" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {label} {count > 0 && <span className="opacity-60">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">まだ分析履歴がありません</p>
              <p className="text-slate-600 text-xs mt-1">分析を実行すると自動保存されます</p>
            </div>
          ) : (
            filtered.map((record) => (
              <HistoryCard
                key={record.id}
                record={record}
                onDelete={handleDelete}
                onRestore={(r) => { onRestore(r); onClose(); }}
                onRetry={handleRetry}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

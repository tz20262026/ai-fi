"use client";

import { useState, useCallback } from "react";
import { TrendingUp, Sparkles, History } from "lucide-react";
import PasswordGate from "@/components/PasswordGate";
import ModeSelector from "@/components/ModeSelector";
import FileUpload from "@/components/FileUpload";
import LoadingAnimation from "@/components/LoadingAnimation";
import AnalysisResult from "@/components/AnalysisResult";
import HistoryPanel from "@/components/HistoryPanel";
import { ConsultantMode } from "@/lib/prompts";

type AppState = "idle" | "loading" | "result" | "error";

interface AnalysisData {
  mode: ConsultantMode;
  rawText: string;
  parsedData: Record<string, unknown> | null;
  hasHistory?: boolean;
  historyCount?: number;
}

interface HistoryRecord {
  id: string;
  createdAt: string;
  mode: string;
  companyName: string | null;
  fileName: string | null;
  rawText: string;
  parsedData: string;
}

export default function Home() {
  const [mode, setMode] = useState<ConsultantMode>("bank");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [appState, setAppState] = useState<AppState>("idle");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setAppState("idle");
    setAnalysisData(null);
  }, []);

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setAppState("loading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("mode", mode);

      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || "分析に失敗しました");

      setAnalysisData({
        mode: data.mode,
        rawText: data.rawText,
        parsedData: data.parsedData,
        hasHistory: data.hasHistory,
        historyCount: data.historyCount,
      });
      setAppState("result");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "予期しないエラーが発生しました";
      setErrorMsg(message);
      setAppState("error");
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setAnalysisData(null);
    setAppState("idle");
    setErrorMsg("");
  };

  const handleRestoreHistory = (record: HistoryRecord) => {
    let parsedData = null;
    try { parsedData = JSON.parse(record.parsedData); } catch { /* ignore */ }
    setAnalysisData({
      mode: record.mode as ConsultantMode,
      rawText: record.rawText,
      parsedData,
    });
    setAppState("result");
  };

  return (
    <PasswordGate>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950">
        <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 py-10 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">AI財務アドバイザー</h1>
                <p className="text-slate-400 text-sm flex items-center gap-1.5 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Powered by Gemini 2.5 Flash
                </p>
              </div>
            </div>

            {/* History button */}
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600 text-slate-300 hover:text-white rounded-xl transition-all duration-200"
            >
              <History className="w-4 h-4" />
              <span className="text-sm font-medium">分析履歴</span>
            </button>
          </div>

          {/* History comparison badge */}
          {appState === "result" && analysisData?.hasHistory && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl">
              <span className="text-purple-400 text-sm">🧠</span>
              <p className="text-purple-300 text-sm">
                過去{analysisData.historyCount}件のデータと比較した<strong>トレンド分析</strong>が含まれています
              </p>
            </div>
          )}

          {/* Main card */}
          <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            {appState === "loading" ? (
              <LoadingAnimation mode={mode} />
            ) : appState === "result" && analysisData ? (
              <AnalysisResult
                mode={analysisData.mode}
                rawText={analysisData.rawText}
                parsedData={analysisData.parsedData as Parameters<typeof AnalysisResult>[0]["parsedData"]}
                onReset={handleReset}
              />
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-slate-300 font-semibold text-sm mb-3 uppercase tracking-wider">
                    コンサルタントモードを選択
                  </h2>
                  <ModeSelector selected={mode} onChange={setMode} />
                </div>

                <div className="border-t border-slate-700/50" />

                <div>
                  <h2 className="text-slate-300 font-semibold text-sm mb-3 uppercase tracking-wider">
                    財務資料をアップロード
                  </h2>
                  <FileUpload onFileSelect={handleFileSelect} disabled={false} />
                </div>

                {appState === "error" && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                    <strong>エラー:</strong> {errorMsg}
                  </div>
                )}

                <button
                  onClick={handleAnalyze}
                  disabled={!selectedFile}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25 text-base"
                >
                  {!selectedFile ? "ファイルを選択してください" : "AI分析を開始する →"}
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-slate-600 text-xs">
            このシステムはAIによる参考情報の提供を目的としています。実際の意思決定は専門家にご相談ください。
          </p>
        </div>
      </div>

      <HistoryPanel
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestoreHistory}
        onRetryComplete={(data) => {
          setAnalysisData({
            mode: data.mode as ConsultantMode,
            rawText: data.rawText,
            parsedData: data.parsedData as Record<string, unknown> | null,
            hasHistory: data.hasHistory,
            historyCount: data.historyCount,
          });
          setAppState("result");
        }}
      />
    </PasswordGate>
  );
}

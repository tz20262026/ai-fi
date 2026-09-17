"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  // 発生したエラーを開発者コンソールにも残しておく（監視ツール連携時の入口にもなる）
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative w-full max-w-md">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-500 rounded-2xl blur-xl opacity-20" />

        <div
          role="alert"
          className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl"
        >
          {/* Icon */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <AlertTriangle className="w-8 h-8 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight text-center">
              エラーが発生しました
            </h1>
            <p className="text-slate-400 text-sm mt-2 text-center">
              システムで予期しない問題が発生しました。
              <br />
              しばらく経ってから再度お試しください。
            </p>
          </div>

          {/* 開発環境のみ詳細を表示（本番では詳細を隠す） */}
          {process.env.NODE_ENV === "development" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6">
              <p className="text-red-400 text-xs font-mono break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-red-400/70 text-xs font-mono mt-1">
                  digest: {error.digest}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          >
            <RotateCw className="w-4 h-4" aria-hidden="true" />
            再試行
          </button>

          <p className="text-center text-slate-400 text-xs mt-6">
            Confidential · Finance AI System
          </p>
        </div>
      </div>
    </div>
  );
}

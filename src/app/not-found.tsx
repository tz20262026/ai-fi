import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative w-full max-w-md">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur-xl opacity-30" />

        <div className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <FileQuestion className="w-8 h-8 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight text-center">
              ページが見つかりません
            </h1>
            <p className="text-slate-400 text-sm mt-2 text-center">
              お探しのページは移動または削除された可能性があります。
            </p>
          </div>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            トップに戻る
          </Link>

          <p className="text-center text-slate-400 text-xs mt-6">
            Confidential · Finance AI System
          </p>
        </div>
      </div>
    </div>
  );
}

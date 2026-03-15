"use client";

import { useEffect, useState } from "react";
import { CONSULTANT_MODES, ConsultantMode } from "@/lib/prompts";

const STEPS = [
  "財務諸表を読み込んでいます...",
  "数値データを抽出しています...",
  "業界ベンチマークと比較分析中...",
  "リスク要因を評価しています...",
  "提言レポートを生成しています...",
];

interface LoadingAnimationProps {
  mode: ConsultantMode;
}

export default function LoadingAnimation({ mode }: LoadingAnimationProps) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const config = CONSULTANT_MODES[mode];

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 2400);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        return prev + Math.random() * 3;
      });
    }, 300);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 space-y-8">
      {/* Main animation */}
      <div className="relative w-32 h-32">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-slate-700/30" />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-cyan-500 animate-spin"
          style={{ animationDuration: "1.5s" }}
        />
        {/* Inner ring */}
        <div
          className="absolute inset-3 rounded-full border-4 border-transparent border-b-blue-400 border-l-cyan-400 animate-spin"
          style={{ animationDuration: "2.5s", animationDirection: "reverse" }}
        />
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl">{config.icon}</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-white tracking-tight">
          AIコンサルタントが分析中...
        </h3>
        <p className="text-blue-400 text-sm font-medium">
          {config.label}モードで解析しています
        </p>
      </div>

      {/* Step indicators */}
      <div className="w-full max-w-sm space-y-2">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 transition-all duration-500 ${
              i < step
                ? "opacity-100"
                : i === step
                ? "opacity-100"
                : "opacity-25"
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              i < step
                ? "bg-blue-500"
                : i === step
                ? "bg-blue-500/30 border-2 border-blue-500 animate-pulse"
                : "bg-slate-700"
            }`}>
              {i < step && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-sm transition-colors duration-300 ${
              i <= step ? "text-slate-200" : "text-slate-600"
            }`}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm space-y-1.5">
        <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 text-right">{Math.round(progress)}%</p>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/30 rounded-full animate-ping"
            style={{
              left: `${20 + i * 13}%`,
              top: `${30 + (i % 3) * 20}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: "2s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

import { CONSULTANT_MODES, ConsultantMode } from "@/lib/prompts";
import { cn } from "@/lib/utils";

interface ModeSelectorProps {
  selected: ConsultantMode;
  onChange: (mode: ConsultantMode) => void;
}

export default function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div role="group" aria-label="コンサルタントモード" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {(Object.keys(CONSULTANT_MODES) as ConsultantMode[]).map((mode) => {
        const config = CONSULTANT_MODES[mode];
        const isSelected = selected === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={isSelected}
            className={cn(
              // モバイルはスクロール短縮のため横並びの低いカード、sm以上は従来の縦積みカードを維持
              "relative flex flex-row sm:flex-col items-center gap-3 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 text-left sm:text-center group",
              isSelected
                ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60"
            )}
          >
            {isSelected && (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-xl" />
            )}
            <span className="text-2xl sm:text-3xl shrink-0">{config.icon}</span>
            <div className="min-w-0">
              <p className={cn(
                "font-semibold text-sm transition-colors",
                isSelected ? "text-blue-400" : "text-slate-300 group-hover:text-white"
              )}>
                {config.label}
              </p>
              {/* モバイルは1行に省略して縦の占有を抑え、sm以上は全文表示 */}
              <p className="text-xs text-slate-300 mt-0.5 truncate sm:whitespace-normal">{config.description}</p>
            </div>
            {isSelected && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
}

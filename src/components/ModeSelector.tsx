"use client";

import { CONSULTANT_MODES, ConsultantMode } from "@/lib/prompts";
import { cn } from "@/lib/utils";

interface ModeSelectorProps {
  selected: ConsultantMode;
  onChange: (mode: ConsultantMode) => void;
}

export default function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {(Object.keys(CONSULTANT_MODES) as ConsultantMode[]).map((mode) => {
        const config = CONSULTANT_MODES[mode];
        const isSelected = selected === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={cn(
              "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-center group",
              isSelected
                ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60"
            )}
          >
            {isSelected && (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-xl" />
            )}
            <span className="text-3xl">{config.icon}</span>
            <div>
              <p className={cn(
                "font-semibold text-sm transition-colors",
                isSelected ? "text-blue-400" : "text-slate-300 group-hover:text-white"
              )}>
                {config.label}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
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

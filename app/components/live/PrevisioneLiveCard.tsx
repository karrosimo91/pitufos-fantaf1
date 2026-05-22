"use client";
import type { LivePrevisioneStatus } from "../../lib/use-live-scoring";

export function PrevisioneLiveCard({ p }: { p: LivePrevisioneStatus }) {
  const isCorrect = p.correct === true;
  const isWrong = p.correct === false;

  const borderClass = isCorrect
    ? "border-green-500/30 bg-green-500/[0.06]"
    : isWrong
      ? "border-red-500/15 bg-red-500/[0.04]"
      : "border-white/[0.06] bg-white/[0.02]";

  return (
    <div className={`rounded-xl p-3 border transition-all ${borderClass}`}>
      <div className="text-[10px] font-bold text-white/50 mb-1">{p.label}</div>
      <div className={`font-[family-name:var(--font-jetbrains)] text-sm font-bold ${
        isCorrect ? "text-green-400" : isWrong ? "text-red-400" : "text-white/20"
      }`}>
        {p.key === "numeroDnf"
          ? `${p.prediction ?? "—"} ${isCorrect ? "✓" : isWrong ? "✗" : ""}`
          : `${p.prediction === true ? "SI" : p.prediction === false ? "NO" : "—"} ${isCorrect ? "✓" : isWrong ? "✗" : ""}`
        }
      </div>
      <div className={`font-[family-name:var(--font-jetbrains)] text-[11px] mt-0.5 ${
        isCorrect ? "text-green-400/60" : isWrong ? "text-red-400/40" : "text-white/10"
      }`}>
        {isCorrect ? `+${p.points} pts` : isWrong ? "0 pts" : ""}
      </div>
    </div>
  );
}

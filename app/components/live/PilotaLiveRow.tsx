"use client";
import { Crown, Zap } from "lucide-react";
import { getDriverByNumber } from "../../lib/drivers-data";
import type { LivePilotaScore } from "../../lib/use-live-scoring";
import type { ScoreBreakdown } from "../../lib/scoring";

export interface PilotaLiveRowProps {
  p: LivePilotaScore;
  primoPilota: number | null;
  chipPiloti: string | null;
  breakdownSections?: { label: string; breakdown: ScoreBreakdown }[];
  expanded?: boolean;
  onToggle?: () => void;
}

export function PilotaLiveRow({ p, primoPilota, chipPiloti, breakdownSections, expanded, onToggle }: PilotaLiveRowProps) {
  const driver = getDriverByNumber(p.driver_number);
  const isPrimo = p.driver_number === primoPilota;
  const isBoosted = chipPiloti === "boost" && p.moltiplicatore === 3;
  const isScudo = isPrimo && chipPiloti === "scudo";

  const borderClass = p.isDnf
    ? "border-red-500/20 bg-red-500/[0.03]"
    : isPrimo
      ? "border-[#E8002D]/40 bg-[#E8002D]/[0.04]"
      : isBoosted
        ? "border-amber-500/40 bg-amber-500/[0.04]"
        : "border-white/[0.06] bg-white/[0.02]";

  return (
    <div className={`relative rounded-xl mb-1.5 border transition-all ${borderClass}`}>
      <div className="flex items-center justify-between p-3 cursor-pointer" onClick={onToggle}>
        {isPrimo && (
          <div className="absolute -top-1.5 left-3 bg-[#E8002D] text-white text-[8px] font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
            <Crown size={8} /> CAP {isScudo ? "SCUDO" : "x2"}
          </div>
        )}
        {isBoosted && (
          <div className="absolute -top-1.5 left-3 bg-amber-500 text-black text-[8px] font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
            <Zap size={8} /> BOOST x3
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className={`font-[family-name:var(--font-jetbrains)] text-sm font-bold w-6 text-center ${
            p.isDnf ? "text-red-400" : p.position <= 3 ? "text-[#E8002D]" : "text-white/50"
          }`}>
            {p.isDnf ? "DNF" : `P${p.position}`}
          </div>
          {driver && (
            <div className="w-[3px] h-7 rounded-full" style={{ backgroundColor: `#${driver.teamColour || "555"}` }} />
          )}
          <div>
            <div className={`text-[13px] font-semibold ${p.isDnf ? "text-white/40 line-through" : ""}`}>
              {driver?.name || `#${p.driver_number}`}
            </div>
            <div className="text-[10px] text-white/30">{driver?.team || ""}</div>
          </div>
          {p.isFastestLap && (
            <span className="text-[8px] bg-purple-500/20 text-purple-400 font-bold px-1.5 py-0.5 rounded">FL</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className={`font-[family-name:var(--font-jetbrains)] text-base font-bold ${
            p.puntiFinali > 0 ? "text-green-400" : p.puntiFinali < 0 ? "text-red-400" : "text-white/15"
          }`}>
            {p.puntiFinali > 0 ? "+" : ""}{p.puntiFinali}
          </span>
          {p.moltiplicatore > 1 && (
            <span className="text-[10px] text-white/30">x{p.moltiplicatore}</span>
          )}
        </div>
      </div>

      {expanded && breakdownSections && breakdownSections.length > 0 && (
        <div className="px-3 pb-3 pt-0">
          <div className="bg-black/30 rounded-lg p-3 space-y-2">
            {breakdownSections.map((section, si) => (
              <div key={si}>
                {breakdownSections.length > 1 && (
                  <div className="text-[9px] tracking-[1.5px] text-white/25 uppercase font-bold mb-1">{section.label}</div>
                )}
                {section.breakdown.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <span className="text-white/40">{item.label}</span>
                    <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${
                      item.value > 0 ? "text-green-400" : item.value < 0 ? "text-red-400" : "text-white/15"
                    }`}>
                      {item.value > 0 ? "+" : ""}{item.value}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-white/30">Subtotale</span>
                  <span className="font-[family-name:var(--font-jetbrains)] font-bold text-white/40">
                    {section.breakdown.finalTotal > 0 ? "+" : ""}{section.breakdown.finalTotal}
                  </span>
                </div>
                {si < breakdownSections.length - 1 && <div className="border-t border-white/[0.06] my-1.5"></div>}
              </div>
            ))}
            <div className="border-t border-white/[0.08] my-1.5"></div>
            {(() => {
              const grandTotal = breakdownSections.reduce((s, sec) => s + sec.breakdown.finalTotal, 0);
              return (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-white/70 font-bold">Totale Weekend</span>
                  <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${
                    grandTotal > 0 ? "text-green-400" : grandTotal < 0 ? "text-red-400" : "text-white/15"
                  }`}>
                    {grandTotal > 0 ? "+" : ""}{grandTotal}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

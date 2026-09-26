"use client";
import { useEffect, useRef, useState } from "react";
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
  // Flash e chip delta quando cambiano i punti: prima il numero cambiava in
  // silenzio e non si capiva cosa fosse successo.
  const prevRef = useRef<number | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (prevRef.current !== null && prevRef.current !== p.puntiFinali) {
      setDelta(p.puntiFinali - prevRef.current);
      const t = setTimeout(() => setDelta(null), 4000);
      prevRef.current = p.puntiFinali;
      return () => clearTimeout(t);
    }
    prevRef.current = p.puntiFinali;
  }, [p.puntiFinali]);
  /* eslint-enable react-hooks/set-state-in-effect */
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
    <div className={`relative rounded-xl mb-1.5 border transition-all ${borderClass} ${delta != null ? (delta > 0 ? "flash-up" : "flash-dn") : ""}`}>
      <div className="flex items-center justify-between p-3 cursor-pointer" onClick={onToggle}>
        {isPrimo && (
          <div className="absolute -top-1.5 left-3 bg-[#E8002D] text-white text-[10px] font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
            <Crown size={9} /> CAP {isScudo ? "SCUDO" : "x2"}
          </div>
        )}
        {isBoosted && (
          <div className="absolute -top-1.5 left-3 bg-amber-500 text-black text-[10px] font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
            <Zap size={9} /> BOOST x3
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
            <div className="text-[11px] text-white/45">{driver?.team || ""}</div>
          </div>
          {p.isFastestLap && (
            <span className="text-[10px] bg-purple-500/20 text-purple-400 font-bold px-1.5 py-0.5 rounded">GV</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {delta != null && delta !== 0 && (
            <span className={`font-[family-name:var(--font-jetbrains)] text-[11px] font-bold px-1.5 py-0.5 rounded ${delta > 0 ? "bg-[#2ee59d]/15 text-[#2ee59d]" : "bg-[#E8002D]/15 text-[#E8002D]"}`}>
              {delta > 0 ? "▲ +" : "▼ "}{delta}
            </span>
          )}
          <span className={`font-[family-name:var(--font-jetbrains)] text-base font-bold ${
            p.puntiFinali > 0 ? "text-green-400" : p.puntiFinali < 0 ? "text-red-400" : "text-white/15"
          }`}>
            {p.puntiFinali > 0 ? "+" : ""}{p.puntiFinali}
          </span>
          {p.moltiplicatore > 1 && (
            <span className="text-[11px] text-white/45">x{p.moltiplicatore}</span>
          )}
        </div>
      </div>

      {expanded && breakdownSections && breakdownSections.length > 0 && (
        <div className="px-3 pb-3 pt-0">
          <div className="bg-black/30 rounded-lg p-3 space-y-2">
            {breakdownSections.map((section, si) => (
              <div key={si}>
                {breakdownSections.length > 1 && (
                  <div className="text-[11px] tracking-[1px] text-white/45 uppercase font-bold mb-1">{section.label}</div>
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
              // I subtotali per sessione sono i punti BASE. Il moltiplicatore
              // Capitano/Boost e i chip Halo/Scudo valgono sul totale weekend:
              // l'aggiustamento è la differenza tra il puntiFinali autorevole
              // (da calcolaPuntiWeekend) e la somma delle basi.
              const baseWeekend = breakdownSections.reduce((s, sec) => s + sec.breakdown.baseTotal, 0);
              const adjustment = p.puntiFinali - baseWeekend;
              const adjLabel = isScudo ? "Scudo Capitano"
                : isPrimo ? "Capitano x2"
                : isBoosted ? "Boost x3"
                : (chipPiloti === "halo" && p.puntiFinali === 0 && baseWeekend < 0) ? "Halo (min 0)"
                : null;
              return (
                <>
                  {adjustment !== 0 && adjLabel && (
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-amber-400/70">{adjLabel}</span>
                      <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${
                        adjustment > 0 ? "text-green-400" : "text-red-400"
                      }`}>
                        {adjustment > 0 ? "+" : ""}{adjustment}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[13px] mt-1">
                    <span className="text-white/70 font-bold">Totale Weekend</span>
                    <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${
                      p.puntiFinali > 0 ? "text-green-400" : p.puntiFinali < 0 ? "text-red-400" : "text-white/15"
                    }`}>
                      {p.puntiFinali > 0 ? "+" : ""}{p.puntiFinali}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

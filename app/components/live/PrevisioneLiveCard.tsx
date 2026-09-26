"use client";
import type { LivePrevisioneStatus } from "../../lib/use-live-scoring";
import type { PrevisioneViva } from "../../lib/previsioni-live";

/** Previsione viva: in attesa (neutra), presa (verde), sbagliata (rossa). */
export function PrevisioneLiveCard({ p, viva }: { p: LivePrevisioneStatus; viva: PrevisioneViva }) {
  const cls = viva.state === "presa"
    ? "border-[#2ee59d]/40 bg-[#2ee59d]/[0.06]"
    : viva.state === "sbagliata"
      ? "border-[#E8002D]/30 bg-[#E8002D]/[0.04]"
      : "border-[#1c1c26] bg-[#0e0e14]";
  const valueCls = viva.state === "presa" ? "text-[#2ee59d]" : viva.state === "sbagliata" ? "text-[#E8002D]" : "text-white/85";
  const value = p.key === "numeroDnf"
    ? (p.prediction ?? "—")
    : p.prediction === true ? "SÌ" : p.prediction === false ? "NO" : "—";
  const tag = viva.state === "presa" ? "PRESA" : viva.state === "sbagliata" ? "SBAGLIATA" : viva.state === "pending" ? "IN ATTESA" : "";

  return (
    <div className={`rounded-lg p-3 border ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold text-white/70 truncate">{p.label}</div>
        {tag && <span className={`font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1px] ${valueCls}`}>{tag}</span>}
      </div>
      <div className={`font-[family-name:var(--font-jetbrains)] text-[16px] font-extrabold mt-0.5 ${valueCls}`}>{value}</div>
      <div className={`text-[11px] mt-0.5 leading-snug ${viva.state === "pending" ? "text-white/55 italic" : valueCls}`}>{viva.payoff}</div>
    </div>
  );
}

"use client";
import type { GeneraleLiveRow } from "../../lib/classifica-generale-live";
import { SectionHead } from "../ui/SectionHead";

/**
 * Classifica Generale live: classifica di stagione della lega con il weekend
 * in corso sommato in tempo reale (`useClassificaGeneraleLive`).
 *
 * Mostra i distacchi, non i punti del weekend: quelli stanno nel sub-tab
 * WEEKEND. Per ogni riga il distacco da chi precede (come in Rivali: il
 * secondo quanto ha dal primo, il terzo dal secondo…) e dal leader, più la
 * freccia se la posizione è cambiata rispetto a inizio weekend.
 */
export function ClassificaGeneraleLive({ rows, loading }: { rows: GeneraleLiveRow[]; loading: boolean }) {
  if (loading && rows.length === 0) {
    return <div className="text-center py-8 text-white/45 text-sm">Caricamento classifica…</div>;
  }
  if (rows.length === 0) {
    return <div className="text-center py-8 text-white/45 text-sm">Nessuna classifica disponibile</div>;
  }

  return (
    <>
      <SectionHead title="Classifica Generale" right="LIVE" />
      <div className="text-[12px] text-white/55 mb-2">Stagione con il weekend in corso. Distacco da chi precede e dal leader, in tempo reale.</div>
      <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-hidden mb-4">
        {rows.map((entry, i) => {
          const delta = entry.positionBefore - entry.position;
          return (
            <div
              key={entry.userId}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 ${
                i < rows.length - 1 ? "border-b border-white/[0.04]" : ""
              } ${entry.isMe ? "bg-[#E8002D]/[0.05] border-l-[3px] border-l-[#E8002D]" : ""}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 shrink-0 text-center">
                  <div className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-bold tabular-nums leading-none ${
                    i === 0 ? "text-[#E8002D]" : entry.isMe ? "text-[#E8002D]" : "text-white/50"
                  }`}>
                    {entry.position}
                  </div>
                  {delta !== 0 && (
                    <div className={`font-[family-name:var(--font-jetbrains)] text-[10px] mt-0.5 leading-none ${delta > 0 ? "text-[#2ee59d]" : "text-[#E8002D]"}`}>
                      {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className={`text-[13px] font-semibold truncate ${entry.isMe ? "text-white" : ""}`}>
                    {entry.scuderiaName}
                  </div>
                  <div className={`text-[11px] truncate ${entry.isMe ? "text-[#E8002D]/70" : "text-white/45"}`}>
                    @{entry.tpName}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-[family-name:var(--font-jetbrains)] text-base font-bold tabular-nums leading-none ${
                  entry.isMe ? "text-white" : "text-white/70"
                }`}>
                  {entry.total}
                </div>
                <div className="font-[family-name:var(--font-jetbrains)] text-[10px] mt-1 tabular-nums leading-none">
                  {entry.gapAhead === null ? (
                    <span className="text-[#2ee59d]">LEADER</span>
                  ) : (
                    <>
                      <span className="text-[#E8002D]">−{entry.gapAhead}</span>
                      <span className="text-white/45"> da P{entry.position - 1}</span>
                      {entry.position > 2 && <span className="text-white/45"> · −{entry.gapLeader} dal 1°</span>}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

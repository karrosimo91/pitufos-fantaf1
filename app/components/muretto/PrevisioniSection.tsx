"use client";
import type { Previsioni } from "../../lib/types";
import type { RaceWeekendResults } from "../../lib/scoring";
import { PREVISIONI_PUNTI } from "../../lib/types";
import { eventKeyOf, type EventStats } from "../../lib/season-insights";
import { getRaceByRound } from "../../lib/races";
import { PREVISIONI_CONFIG, DNF_MAX } from "./previsioni-config";

/**
 * Le sei previsioni con il contesto che serve per decidere: quante volte
 * l'evento è successo quest'anno, cos'è successo all'ultimo GP, quanto vale
 * SÌ e quanto NO. A gara calcolata mostra l'esito e i punti presi.
 */
export function PrevisioniSection({
  previsioni, locked, stats, results, doppiaTarget, previsioniDettaglio,
  onSet, onSetDnf,
}: {
  previsioni: Previsioni;
  locked: boolean;
  stats: EventStats;
  /** Risultati ufficiali del round (se la gara è calcolata mostra l'esito) */
  results: RaceWeekendResults | null;
  doppiaTarget: string | null;
  /** Punti presi per previsione (dal calcolo), solo a gara calcolata */
  previsioniDettaglio?: Record<string, number> | null;
  onSet: (key: keyof Omit<Previsioni, "numeroDnf">, value: boolean | null) => void;
  onSetDnf: (n: number | null) => void;
}) {
  const raceDone = (results?.race?.length ?? 0) > 0;
  const lastRace = stats.last ? getRaceByRound(stats.last.round) : null;
  const completate = PREVISIONI_CONFIG.filter((p) => previsioni[p.key] !== null).length + (previsioni.numeroDnf !== null ? 1 : 0);

  return (
    <section className="mb-5">
      <div className="flex items-end justify-between mb-2">
        <h3 className="section-marker">Previsioni</h3>
        <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 tracking-[1px]">{completate} / 6</div>
      </div>
      <div className="text-[12px] text-white/55 mb-3">L&apos;evento raro paga di più: guarda quanto vale il SÌ e quanto il NO.</div>

      <div className="space-y-2.5">
        {PREVISIONI_CONFIG.map((p) => {
          const mine = previsioni[p.key];
          const happened = raceDone && results ? (results.events[eventKeyOf(p.key)] as boolean) : null;
          const correct = happened !== null && mine !== null && mine === happened;
          const wrong = happened !== null && mine !== null && mine !== happened;
          const pts = previsioniDettaglio?.[p.key];
          const isDoppia = doppiaTarget === p.key;
          const ctx = stats.races > 0
            ? `Quest'anno SÌ in ${stats.happened[p.key]} gare su ${stats.races}${stats.last && lastRace ? ` · a ${lastRace.circuit} ${stats.last.events[eventKeyOf(p.key)] ? "SÌ" : "NO"}` : ""}`
            : null;
          return (
            <div key={p.key} className={`hud-card p-3.5 ${correct ? "border-[#2ee59d]/40" : wrong ? "border-[#E8002D]/35" : ""}`}>
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[14px] tracking-[-0.2px]">{p.label}</h4>
                    {isDoppia && <span className="pill pill-accent">×2</span>}
                  </div>
                  <p className="text-[12px] text-white/60 mt-0.5">{p.desc}</p>
                  {ctx && <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/45 mt-1">{ctx}</p>}
                </div>
                {happened !== null && (
                  <div className="shrink-0 text-right">
                    <span className={`pill ${happened ? "pill-green" : "pill-muted"}`}>{happened ? "È SUCCESSO" : "NON SUCCESSO"}</span>
                    {pts != null && <div className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-bold mt-1 tabular-nums ${pts > 0 ? "text-[#2ee59d]" : "text-white/40"}`}>{pts > 0 ? `+${pts}` : "0"}</div>}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                {([true, false] as const).map((v) => {
                  const active = mine === v;
                  const val = v ? p.si : p.no;
                  const cls = active
                    ? correct ? "bg-[#2ee59d]/15 border-[#2ee59d]/50 text-[#2ee59d]"
                      : wrong ? "bg-[#E8002D]/12 border-[#E8002D]/40 text-[#E8002D]"
                      : "bg-white/[0.08] border-white/50 text-white"
                    : "bg-[#0e0e14] border-[#1c1c26] text-white/55";
                  return (
                    <button
                      key={String(v)}
                      type="button"
                      disabled={locked}
                      onClick={() => onSet(p.key, active ? null : v)}
                      className={`flex-1 py-2.5 rounded border font-[family-name:var(--font-jetbrains)] text-[13px] font-bold tracking-[1px] tap ${cls} ${locked ? "cursor-not-allowed" : ""}`}
                    >
                      {v ? "SÌ" : "NO"}
                      <span className="block text-[11px] font-normal mt-0.5 opacity-75 tabular-nums">+{isDoppia ? val * 2 : val} pt</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Numero ritiri */}
        {(() => {
          const mine = previsioni.numeroDnf;
          const real = raceDone && results ? results.events.total_dnf : null;
          const correct = real !== null && mine !== null && mine === real;
          const wrong = real !== null && mine !== null && mine !== real;
          const pts = previsioniDettaglio?.numeroDnf;
          const isDoppia = doppiaTarget === "numeroDnf";
          return (
            <div className={`hud-card p-3.5 ${correct ? "border-[#2ee59d]/40" : wrong ? "border-[#E8002D]/35" : ""}`}>
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[14px] tracking-[-0.2px]">Numero ritiri esatto</h4>
                    {isDoppia && <span className="pill pill-accent">×2</span>}
                  </div>
                  <p className="text-[12px] text-white/60 mt-0.5">Quanti piloti non arrivano al traguardo? +{isDoppia ? PREVISIONI_PUNTI.numeroDnf.esatto * 2 : PREVISIONI_PUNTI.numeroDnf.esatto} pt se indovini.</p>
                  {stats.dnfAvg !== null && (
                    <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/45 mt-1">
                      Media {stats.dnfAvg} ritiri a gara{stats.last && lastRace ? ` · a ${lastRace.circuit} ${stats.last.events.total_dnf}` : ""}
                    </p>
                  )}
                </div>
                {real !== null && (
                  <div className="shrink-0 text-right">
                    <span className="pill pill-muted">RITIRI · {real}</span>
                    {pts != null && <div className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-bold mt-1 tabular-nums ${pts > 0 ? "text-[#2ee59d]" : "text-white/40"}`}>{pts > 0 ? `+${pts}` : "0"}</div>}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: DNF_MAX + 1 }, (_, n) => n).map((n) => {
                  const active = mine === n;
                  const cls = active
                    ? correct ? "bg-[#2ee59d]/15 border-[#2ee59d]/50 text-[#2ee59d]"
                      : wrong ? "bg-[#E8002D]/12 border-[#E8002D]/40 text-[#E8002D]"
                      : "bg-white/[0.08] border-white/50 text-white"
                    : "bg-[#0e0e14] border-[#1c1c26] text-white/55";
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={locked}
                      onClick={() => onSetDnf(active ? null : n)}
                      className={`h-10 rounded border font-[family-name:var(--font-jetbrains)] font-extrabold text-[14px] tabular-nums tap ${cls}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </section>
  );
}

"use client";
import { useMemo, useState } from "react";
import { Share2, Crown, Zap, UserPlus, ChevronDown, ChevronUp, Shield } from "lucide-react";
import type { Race } from "../../lib/types";
import type { RaceWeekendResults } from "../../lib/scoring";
import type { PlayerFormazione, PlayerPrevisioni, WeekendClassificaEntry } from "../../lib/use-weekend-classifica";
import type { ProvisionalData } from "../../lib/provisional-scores";
import { buildRecap, recapShareText, type RecapDriver } from "../../lib/recap";
import { PUNTI_REALE } from "../../lib/classifica-reale";
import { getDriverByNumber } from "../../lib/drivers-data";
import { shareText } from "../../lib/share";
import { useToast } from "../ui/Toast";
import { chipLabel } from "../../lib/chip-labels";

function lastName(n: number): string {
  return getDriverByNumber(n)?.name.split(" ").pop() ?? `#${n}`;
}

/**
 * Il recap del weekend: tre timbri (quali sessioni sono ufficiali), lo
 * scontrino con ogni punto spiegato, migliore e peggiore scelta, i
 * rimpianti (capitano giusto, rosa perfetta, previsioni), condivisione.
 */
export function WeekendRecap({
  race, results, formazione, previsioniRow, penalita, prices, classifica, provisional, legaName, userId,
}: {
  race: Race;
  results: RaceWeekendResults;
  formazione: PlayerFormazione | null;
  previsioniRow: PlayerPrevisioni | undefined;
  penalita: number;
  prices: Map<number, number>;
  classifica: WeekendClassificaEntry[];
  provisional: ProvisionalData | null;
  legaName: string | null;
  userId?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState<number | null>(null);
  const raceDone = results.race.length > 0;

  const recap = useMemo(() => {
    if (!formazione) return null;
    return buildRecap(
      results, formazione.driver_numbers, formazione.primo_pilota,
      previsioniRow ? {
        safetyCar: previsioniRow.safety_car, virtualSafetyCar: previsioniRow.virtual_safety_car, redFlag: previsioniRow.red_flag,
        gommeWet: previsioniRow.gomme_wet, poleVince: previsioniRow.pole_vince, numeroDnf: previsioniRow.numero_dnf,
      } : { safetyCar: null, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null },
      { chipPiloti: formazione.chip_piloti, chipPilotiTarget: formazione.chip_piloti_target, sestoUomo: formazione.sesto_uomo },
      { chipAttivo: previsioniRow?.chip_attivo ?? null, chipTarget: previsioniRow?.chip_target ?? null },
      penalita, prices,
    );
  }, [results, formazione, previsioniRow, penalita, prices]);

  const idx = userId ? classifica.findIndex((c) => c.userId === userId) : -1;
  const position = idx >= 0 ? idx + 1 : null;
  const reale = raceDone && idx >= 0 ? (PUNTI_REALE[idx] ?? 0) : null;

  const stamps = useMemo(() => {
    const provSessions = new Set((provisional?.sessions ?? []).map((s) => s.sessionName));
    const list: { label: string; state: "ufficiale" | "provvisoria" | "attesa" }[] = [];
    const add = (label: string, official: boolean, provName: string) =>
      list.push({ label, state: official ? "ufficiale" : provSessions.has(provName) ? "provvisoria" : "attesa" });
    if (race.sprint) {
      add("Shootout", (results.sprint_shootout?.length ?? 0) > 0, "Sprint Qualifying");
      add("Sprint", (results.sprint?.length ?? 0) > 0, "Sprint");
    }
    add("Qualifiche", (results.qualifying?.length ?? 0) > 0, "Qualifying");
    add("Gara", raceDone, "Race");
    return list;
  }, [results, provisional, race.sprint, raceDone]);

  const onShare = async () => {
    const text = recapShareText(
      `${race.circuit} · weekend`, legaName,
      classifica.map((c) => ({ name: c.tpName, points: c.points })),
      recap && position ? {
        points: recap.total, position,
        best: recap.best ? `${lastName(recap.best.driver_number)} ${recap.best.puntiFinali > 0 ? "+" : ""}${recap.best.puntiFinali}` : undefined,
        worst: recap.worst ? `${lastName(recap.worst.driver_number)} ${recap.worst.puntiFinali > 0 ? "+" : ""}${recap.worst.puntiFinali}` : undefined,
      } : null,
    );
    const r = await shareText(`${race.name} · recap`, text);
    if (r === "copied") toast.show("Recap copiato", { kind: "success", detail: "Incollalo nel gruppo" });
    else if (r === "failed") toast.show("Condivisione non riuscita", { kind: "error" });
  };

  return (
    <div>
      {/* Tre timbri */}
      <div className="flex gap-1.5 mb-3">
        {stamps.map((s) => (
          <div key={s.label} className={`flex-1 rounded border px-2 py-2 text-center ${s.state === "ufficiale" ? "border-[#2ee59d]/40 bg-[#2ee59d]/[0.06]" : s.state === "provvisoria" ? "border-[#ffb000]/40 bg-[#ffb000]/[0.06]" : "border-[#1c1c26] bg-black/30"}`}>
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] font-bold tracking-[0.5px]">{s.label}</div>
            <div className={`font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1px] uppercase mt-0.5 ${s.state === "ufficiale" ? "text-[#2ee59d]" : s.state === "provvisoria" ? "text-[#ffb000]" : "text-white/40"}`}>
              {s.state === "ufficiale" ? "✓ ufficiale" : s.state === "provvisoria" ? "provvisoria" : "in attesa"}
            </div>
          </div>
        ))}
      </div>

      {!recap ? (
        <div className="hud-card p-6 text-center">
          <div className="text-[15px] font-bold">Non hai giocato questo weekend</div>
          <div className="text-[13px] text-white/55 mt-1">Nessuna formazione confermata per {race.circuit}. La classifica degli altri è nel tab Classifica.</div>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="hud-card hud-card-accent p-4 mb-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="hud-label mb-1">IL TUO WEEKEND A {race.circuit.toUpperCase()}</div>
                <div className="big-num">{recap.total > 0 ? "+" : ""}{recap.total}</div>
              </div>
              {position && (
                <div className="text-right">
                  <div className="font-[family-name:var(--font-jetbrains)] text-[26px] font-extrabold leading-none">{position}°<span className="text-[13px] text-white/50 font-normal"> su {classifica.length}</span></div>
                  {reale !== null && <div className="text-[12px] text-white/60 mt-1">{reale} pt Classifica Reale</div>}
                </div>
              )}
            </div>
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 tracking-[1px] uppercase mt-3">
              PILOTI <span className="text-white/85 ml-1">{recap.pilotiPoints}</span>
              <span className="mx-2 text-white/50">·</span>PREVISIONI <span className="text-white/85 ml-1">{recap.previsioniPoints}</span>
              {recap.penalitaCambi > 0 && (<><span className="mx-2 text-white/50">·</span>CAMBI <span className="text-[#ffb000] ml-1">−{recap.penalitaCambi}</span></>)}
            </div>
            <button onClick={onShare} className="btn-secondary w-full mt-3"><Share2 size={14} /> CONDIVIDI NEL GRUPPO</button>
          </div>

          {/* Migliore / peggiore */}
          {(recap.best || recap.worst) && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {recap.best && <Pick label="MIGLIORE SCELTA" d={recap.best} tone="up" />}
              {recap.worst && recap.worst.driver_number !== recap.best?.driver_number && <Pick label="PEGGIORE SCELTA" d={recap.worst} tone="down" />}
            </div>
          )}

          {/* Scontrino */}
          <h3 className="section-marker mb-2">Lo scontrino</h3>
          <div className="hud-card overflow-hidden mb-3">
            {recap.drivers.map((d) => {
              const isOpen = open === d.driver_number;
              return (
                <div key={d.driver_number} className="border-b border-[#1c1c26] last:border-b-0">
                  <button onClick={() => setOpen(isOpen ? null : d.driver_number)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left tap">
                    <div className="w-[3px] h-9 rounded shrink-0" style={{ backgroundColor: `#${d.teamColour}` }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[14px] truncate">{d.name}</span>
                        {d.role === "captain" && <Crown size={11} />}
                        {d.role === "boost" && <Zap size={11} className="text-[#ffb000]" />}
                        {d.role === "sesto" && <UserPlus size={11} />}
                        {d.haloApplicato && <Shield size={11} className="text-[#2ee59d]" />}
                      </div>
                      <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/50 mt-0.5">
                        {d.sessions.map((s) => `${s.label} ${s.breakdown.baseTotal > 0 ? "+" : ""}${s.breakdown.baseTotal}`).join(" · ")}
                        {d.adjustment ? ` · ${d.adjustment.label} ${d.adjustment.value > 0 ? "+" : ""}${d.adjustment.value}` : ""}
                      </div>
                    </div>
                    <span className={`font-[family-name:var(--font-jetbrains)] font-extrabold text-[17px] tabular-nums ${d.puntiFinali > 0 ? "text-[#2ee59d]" : d.puntiFinali < 0 ? "text-[#E8002D]" : "text-white/40"}`}>
                      {d.puntiFinali > 0 ? "+" : ""}{d.puntiFinali}
                    </span>
                    {isOpen ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
                  </button>
                  {isOpen && (
                    <div className="px-3.5 pb-3">
                      <div className="bg-black/30 rounded-lg p-3 space-y-2 text-[12px]">
                        {d.sessions.map((s) => (
                          <div key={s.label}>
                            <div className="hud-label mb-1">{s.label}</div>
                            {s.breakdown.items.map((it, i) => (
                              <div key={i} className="flex justify-between"><span className="text-white/60">{it.label}</span><span className={`font-[family-name:var(--font-jetbrains)] font-bold ${it.value > 0 ? "text-[#2ee59d]" : it.value < 0 ? "text-[#E8002D]" : "text-white/40"}`}>{it.value > 0 ? "+" : ""}{it.value}</span></div>
                            ))}
                          </div>
                        ))}
                        {d.sessions.length === 0 && <div className="text-white/50">Nessuna sessione in archivio per questo pilota</div>}
                        {d.adjustment && (
                          <div className="flex justify-between border-t border-dashed border-[#1c1c26] pt-2"><span className="text-[#ffb000]">{d.adjustment.label}</span><span className={`font-[family-name:var(--font-jetbrains)] font-bold ${d.adjustment.value > 0 ? "text-[#2ee59d]" : "text-[#E8002D]"}`}>{d.adjustment.value > 0 ? "+" : ""}{d.adjustment.value}</span></div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {recap.previsioni.map((p) => (
              <div key={p.key} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-[#1c1c26] last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">{p.label}{p.doppia ? " ×2" : ""}</div>
                  <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/50">
                    hai detto {p.key === "numeroDnf" ? (p.mine ?? "—") : p.mine === true ? "SÌ" : p.mine === false ? "NO" : "—"} · {p.key === "numeroDnf" ? `ritiri ${p.happened}` : p.happened ? "è successo" : "non è successo"}
                  </div>
                </div>
                <span className={`font-[family-name:var(--font-jetbrains)] font-extrabold text-[15px] tabular-nums ${p.points > 0 ? "text-[#2ee59d]" : "text-white/40"}`}>{p.points > 0 ? `+${p.points}` : "0"}</span>
              </div>
            ))}
            {recap.penalitaCambi > 0 && (
              <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-[#1c1c26]">
                <div className="flex-1 text-[13px] font-bold">Cambi extra</div>
                <span className="font-[family-name:var(--font-jetbrains)] font-extrabold text-[15px] text-[#ffb000] tabular-nums">−{recap.penalitaCambi}</span>
              </div>
            )}
            <div className="flex items-center gap-3 px-3.5 py-3 bg-white/[0.03]">
              <div className="flex-1 text-[14px] font-extrabold">Totale weekend</div>
              <span className="font-[family-name:var(--font-jetbrains)] font-extrabold text-[20px] tabular-nums">{recap.total > 0 ? "+" : ""}{recap.total}</span>
            </div>
          </div>

          {/* Rimpianti */}
          {raceDone && (
            <>
              <h3 className="section-marker mb-2">Se avessi…</h3>
              <div className="space-y-2 mb-3">
                {recap.captainWhatIf ? (
                  <Regret title={`Capitano ${lastName(recap.captainWhatIf.driver_number)}`} text={`Con ${recap.captainWhatIf.name} Primo Pilota avresti fatto ${recap.captainWhatIf.delta} punti in più.`} delta={recap.captainWhatIf.delta} />
                ) : formazione?.primo_pilota ? (
                  <Regret title="Capitano giusto" text={`${lastName(formazione.primo_pilota)} era la scelta migliore fra i tuoi.`} delta={0} />
                ) : null}
                {recap.perfect && (
                  <Regret
                    title={`Rosa perfetta · ${recap.perfect.points} pt`}
                    text={`Entro 100 Soldini: ${recap.perfect.drivers.map((n) => (n === recap.perfect!.captain ? `${lastName(n)} (C)` : lastName(n))).join(", ")}. ${recap.perfect.delta > 0 ? `Vale ${recap.perfect.delta} punti più della tua.` : "La tua era già la migliore possibile."}`}
                    delta={recap.perfect.delta}
                  />
                )}
                <Regret
                  title={`Previsioni ${recap.previsioniPoints} su ${recap.previsioniPossible}`}
                  text={recap.previsioniPoints === recap.previsioniPossible ? "Weekend perfetto sulle previsioni." : `Hai lasciato ${recap.previsioniPossible - recap.previsioniPoints} punti sul tavolo.`}
                  delta={recap.previsioniPossible - recap.previsioniPoints}
                />
              </div>
            </>
          )}

          {(formazione?.chip_piloti || previsioniRow?.chip_attivo) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {formazione?.chip_piloti && <span className="pill pill-amber">{chipLabel(formazione.chip_piloti)}</span>}
              {previsioniRow?.chip_attivo && <span className="pill pill-amber">{chipLabel(previsioniRow.chip_attivo)}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Pick({ label, d, tone }: { label: string; d: RecapDriver; tone: "up" | "down" }) {
  const top = d.sessions.length > 0 ? d.sessions.reduce((a, b) => (Math.abs(b.breakdown.baseTotal) > Math.abs(a.breakdown.baseTotal) ? b : a)) : null;
  const why = top ? top.breakdown.items.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a), top.breakdown.items[0]) : null;
  return (
    <div className={`hud-card p-3 ${tone === "up" ? "border-[#2ee59d]/35" : "border-[#E8002D]/35"}`}>
      <div className="hud-label mb-1">{label}</div>
      <div className="font-bold text-[14px] truncate">{d.name}</div>
      <div className={`font-[family-name:var(--font-jetbrains)] text-[20px] font-extrabold tabular-nums ${tone === "up" ? "text-[#2ee59d]" : "text-[#E8002D]"}`}>{d.puntiFinali > 0 ? "+" : ""}{d.puntiFinali}</div>
      {why && <div className="text-[11px] text-white/55 mt-0.5 truncate">{top?.label}: {why.label}</div>}
    </div>
  );
}

function Regret({ title, text, delta }: { title: string; text: string; delta: number }) {
  return (
    <div className="hud-card p-3.5 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[14px]">{title}</div>
        <div className="text-[12px] text-white/60 mt-0.5 leading-snug">{text}</div>
      </div>
      <span className={`font-[family-name:var(--font-jetbrains)] font-extrabold text-[15px] tabular-nums shrink-0 ${delta > 0 ? "text-[#ffb000]" : "text-[#2ee59d]"}`}>{delta > 0 ? `−${delta}` : "✓"}</span>
    </div>
  );
}

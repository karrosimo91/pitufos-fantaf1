"use client";
import { useMemo, useState } from "react";
import { X, Crown } from "lucide-react";
import type { RaceWeekendResults } from "../../lib/scoring";
import type { PlayerFormazione, PlayerPrevisioni, WeekendClassificaEntry } from "../../lib/use-weekend-classifica";
import type { LiveSnapshot } from "../../lib/build-live-results";
import { classifySession } from "../../lib/build-live-results";
import { buildPilotaBreakdown, computePlayerWeekendDetail, PREVISIONI_LABELS } from "../../lib/player-breakdown";
import { previsioneViva } from "../../lib/previsioni-live";
import { sessionEnded } from "../../lib/live-events";
import { poleDriverNumber } from "../../lib/official-results";
import { getDriverByNumber } from "../../lib/drivers-data";
import { chipLabel } from "../../lib/chip-labels";
import type { Previsioni } from "../../lib/types";
import { PilotaLiveRow } from "./PilotaLiveRow";
import { PrevisioneLiveCard } from "./PrevisioneLiveCard";
import { BottomSheet } from "../ui/BottomSheet";
import { LivePill } from "../ui/LivePill";
import { SectionHead } from "../ui/SectionHead";

function last(n: number): string {
  return getDriverByNumber(n)?.name.split(" ").pop() ?? `#${n}`;
}

/**
 * Dettaglio di un Team Principal nel weekend: stesso linguaggio del tab
 * "I miei" (riga pilota con spacchettamento, previsioni vive) più il
 * confronto con me. In live i numeri cambiano in tempo reale; a sessione
 * finita valgono le sessioni in archivio.
 */
export function PlayerDetailModal({
  player,
  entry,
  previsioniRow,
  snap,
  gridPositions,
  previousResults,
  sessionType,
  penalitaCambi = 0,
  classifica,
  formazioni,
  userId,
  live = false,
  onClose,
}: {
  player: PlayerFormazione;
  entry: WeekendClassificaEntry;
  previsioniRow?: PlayerPrevisioni;
  snap: LiveSnapshot;
  gridPositions: Map<number, number>;
  previousResults: RaceWeekendResults | null;
  sessionType: string;
  /** Penalità cambi extra, già tolta da `entry.points` */
  penalitaCambi?: number;
  /** Classifica weekend della lega: posizione del giocatore e confronto con me */
  classifica?: WeekendClassificaEntry[];
  /** Formazioni del round: per il "vs te" (piloti in comune, capitano) */
  formazioni?: PlayerFormazione[];
  userId?: string;
  /** Sessione in corso: i numeri si muovono */
  live?: boolean;
  onClose: () => void;
}) {
  const [expandedDriver, setExpandedDriver] = useState<number | null>(null);

  const detail = useMemo(
    () => computePlayerWeekendDetail(player, previsioniRow, snap, gridPositions, previousResults, sessionType),
    [player, previsioniRow, snap, gridPositions, previousResults, sessionType],
  );

  const isMe = !!userId && player.user_id === userId;
  const archivio = classifySession(sessionType) === "unknown";
  const ended = archivio || sessionEnded(snap.raceControl);
  const idx = classifica ? classifica.findIndex((c) => c.userId === entry.userId) : -1;
  const myEntry = userId && classifica ? classifica.find((c) => c.userId === userId) ?? null : null;
  const myForm = userId && formazioni ? formazioni.find((f) => f.user_id === userId) ?? null : null;
  const gapMe = myEntry && !isMe ? entry.points - myEntry.points : null;

  // Chi parte in pole (griglia → qualifica in archivio) e se è in testa ora
  let poleNumber: number | null = null;
  for (const [drv, gp] of gridPositions) if (gp === 1) { poleNumber = drv; break; }
  if (poleNumber == null) poleNumber = poleDriverNumber(detail.liveResults.race ?? [], previousResults?.qualifying ?? detail.liveResults.qualifying ?? []);
  const pole = {
    name: poleNumber != null ? last(poleNumber) : null,
    leading: poleNumber != null && !archivio ? snap.positions.get(poleNumber)?.position === 1 : null,
  };

  const vive = detail.previsioniStatus.map((p) => ({
    p,
    viva: previsioneViva({
      key: p.key as keyof Previsioni, prediction: p.prediction, happened: p.happened as unknown as boolean, ended, points: p.points,
      poleName: p.key === "poleVince" ? pole.name : undefined, poleLeading: p.key === "poleVince" ? pole.leading : undefined,
    }),
  }));
  const decided = vive.filter((v) => v.viva.state !== "pending").length;

  // vs te: piloti in comune e diversi, capitano
  const shared = myForm && !isMe ? player.driver_numbers.filter((n) => myForm.driver_numbers.includes(n)) : [];
  const onlyHim = myForm && !isMe ? player.driver_numbers.filter((n) => !myForm.driver_numbers.includes(n)) : [];
  const onlyMe = myForm && !isMe ? myForm.driver_numbers.filter((n) => !player.driver_numbers.includes(n)) : [];

  const chips: string[] = [];
  if (player.chip_piloti) {
    const target = player.chip_piloti === "boost" && player.chip_piloti_target ? ` · ${last(player.chip_piloti_target)}`
      : player.chip_piloti === "sesto" && player.sesto_uomo ? ` · ${last(player.sesto_uomo)}` : "";
    chips.push(`${chipLabel(player.chip_piloti)}${target}`);
  }
  if (detail.isRace && previsioniRow?.chip_attivo) {
    const t = previsioniRow.chip_target ? PREVISIONI_LABELS[previsioniRow.chip_target as keyof Previsioni] : null;
    chips.push(`${chipLabel(previsioniRow.chip_attivo)}${t ? ` · ${t}` : ""}`);
  }

  const pointsCls = entry.points > 0 ? "text-[#2ee59d]" : entry.points < 0 ? "text-[#E8002D]" : "text-white/70";

  return (
    <BottomSheet
      onClose={onClose}
      header={
        <>
          <div className="min-w-0">
            <div className="font-bold text-base truncate">{entry.tpName}{isMe ? " · tu" : ""}</div>
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/50 uppercase tracking-[0.5px] truncate">{entry.scuderiaName}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className={`font-[family-name:var(--font-jetbrains)] text-[22px] font-extrabold tabular-nums leading-none ${pointsCls}`}>
                {entry.points > 0 ? "+" : ""}{entry.points}
              </div>
              {idx >= 0 && classifica && (
                <div className="hud-label mt-1">{idx + 1}° su {classifica.length}</div>
              )}
            </div>
            <button onClick={onClose} className="text-white/40 p-1" aria-label="Chiudi"><X size={20} /></button>
          </div>
        </>
      }
    >
      <div className="space-y-1">
        {/* Riepilogo */}
        <div className="hud-card hud-card-accent p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 tracking-[1px] uppercase">
              PILOTI <span className="text-white/85 ml-1">{detail.pilotiPoints}</span>
              {detail.isRace && (<><span className="mx-2 text-white/50">·</span>PREVISIONI <span className="text-white/85 ml-1">{detail.previsioniPoints}</span></>)}
              {penalitaCambi > 0 && (<><span className="mx-2 text-white/50">·</span>CAMBI <span className="text-[#ffb000] ml-1">−{penalitaCambi}</span></>)}
            </div>
            {live && !ended && <LivePill />}
          </div>
          {gapMe !== null && (
            <div className="mt-2.5 pt-2.5 border-t border-dashed border-[#1c1c26] text-[13px] text-white/80">
              <span className="hud-label mr-2">VS TE</span>
              {gapMe > 0
                ? <><span className="text-[#E8002D] font-bold">+{gapMe}</span> su di te</>
                : gapMe < 0
                  ? <><span className="text-[#2ee59d] font-bold">−{-gapMe}</span> dietro di te</>
                  : <span className="font-bold">pari punti</span>}
              {myForm && (
                <span className="text-[12px] text-white/65">
                  {" · "}{shared.length} in comune
                  {onlyHim.length > 0 && <> · lui: <span className="text-white/85">{onlyHim.map(last).join(", ")}</span></>}
                  {onlyMe.length > 0 && <> · tu: <span className="text-white/85">{onlyMe.map(last).join(", ")}</span></>}
                  {player.primo_pilota && myForm.primo_pilota && (player.primo_pilota === myForm.primo_pilota
                    ? <> · stesso capitano</>
                    : <> · capitano {last(player.primo_pilota)} vs {last(myForm.primo_pilota)}</>)}
                </span>
              )}
            </div>
          )}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {chips.map((c) => <span key={c} className="pill pill-amber">{c}</span>)}
            </div>
          )}
        </div>

        {/* Piloti */}
        <SectionHead title="Piloti" right={player.chip_piloti === "sesto" && player.sesto_uomo ? `${detail.piloti.length} · SESTO UOMO` : `${detail.piloti.length} / 5`} />
        {detail.piloti.length === 0 && <div className="hud-card p-4 text-[13px] text-white/55">In attesa delle prime posizioni…</div>}
        {detail.piloti.map((p) => (
          <PilotaLiveRow
            key={p.driver_number}
            p={p}
            primoPilota={player.primo_pilota}
            chipPiloti={player.chip_piloti}
            breakdownSections={buildPilotaBreakdown(p.driver_number, previousResults, detail.liveResults, sessionType)}
            expanded={expandedDriver === p.driver_number}
            onToggle={() => setExpandedDriver(expandedDriver === p.driver_number ? null : p.driver_number)}
          />
        ))}
        {detail.piloti.length > 0 && (
          <div className="text-[11px] text-white/45 flex items-center gap-1 pt-0.5">
            <Crown size={10} /> Primo Pilota x2 · tocca un pilota per il dettaglio per sessione
          </div>
        )}

        {/* Previsioni: contano in gara (live o in archivio) */}
        {detail.isRace && (
          <>
            <SectionHead title="Previsioni" right={previsioniRow ? `${decided} / ${vive.length} DECISE` : "NESSUNA"} />
            {previsioniRow ? (
              <div className="grid grid-cols-2 gap-1.5">
                {vive.map(({ p, viva }) => <PrevisioneLiveCard key={p.key} p={p} viva={viva} />)}
              </div>
            ) : (
              <div className="hud-card p-4 text-[13px] text-white/55">Nessuna previsione confermata per questo weekend.</div>
            )}
          </>
        )}

        {/* Totale */}
        <div className="hud-card flex items-center gap-3 px-3.5 py-3 mt-5 bg-white/[0.03]">
          <div className="flex-1">
            <div className="text-[14px] font-extrabold">Totale weekend</div>
            {penalitaCambi > 0 && <div className="text-[11px] text-white/50">penalità cambi extra già tolta</div>}
          </div>
          <span className={`font-[family-name:var(--font-jetbrains)] font-extrabold text-[20px] tabular-nums ${pointsCls}`}>
            {entry.points > 0 ? "+" : ""}{entry.points}
          </span>
        </div>
      </div>
    </BottomSheet>
  );
}

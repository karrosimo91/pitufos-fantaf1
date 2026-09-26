"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveScoring } from "../lib/use-live-scoring";
import { useWeekendClassifica } from "../lib/use-weekend-classifica";
import type { ChipPilotiConfig, ChipPrevisioniConfig } from "../lib/scoring";
import type { Previsioni } from "../lib/types";
import { saveProvisionalScores } from "../lib/provisional-scores";
import { buildPilotaBreakdown } from "../lib/player-breakdown";
import { PilotaLiveRow } from "./live/PilotaLiveRow";
import { PrevisioneLiveCard } from "./live/PrevisioneLiveCard";
import { RaceControlMessage } from "./live/RaceControlMessage";
import { ClassificaWeekendList } from "./live/ClassificaWeekendList";
import { ClassificaGeneraleLive } from "./live/ClassificaGeneraleLive";
import { PlayerDetailModal } from "./live/PlayerDetailModal";
import { FormazioniSvelate } from "./live/FormazioniSvelate";
import { SessionBar } from "./live/SessionBar";
import { LiveHero } from "./live/LiveHero";
import { EventiPerTe } from "./live/EventiPerTe";
import { buildMockLiveData, MOCK_CLASSIFICA } from "./live/mock-data";
import { buildLiveWeekendResults, detectLiveEvents, classifySession } from "../lib/build-live-results";
import { translateRaceControl, sessionEnded } from "../lib/live-events";
import { previsioneViva } from "../lib/previsioni-live";
import { poleDriverNumber } from "../lib/official-results";
import { getDriverByNumber } from "../lib/drivers-data";
import { SectionHead } from "./ui/SectionHead";

type SubTab = "dashboard" | "weekend" | "formazioni" | "generale";

export default function LiveTab({
  sessionKey, sessionType, meetingKey, round, userId, legaId, raceName,
  driverNumbers, primoPilota, chipPiloti, chipPrevisioni, previsioni, qualifyingPole, debug = false,
}: {
  sessionKey: number;
  sessionType: string;
  meetingKey?: number;
  round: number;
  userId?: string;
  legaId?: string;
  raceName: string;
  driverNumbers: number[];
  primoPilota: number | null;
  chipPiloti: ChipPilotiConfig | null;
  chipPrevisioni: ChipPrevisioniConfig | null;
  previsioni: Previsioni;
  qualifyingPole?: number | null;
  debug?: boolean;
}) {
  // Hook unificato: formazioni/previsioni di tutti + WS + previousResults + grid + ritiri
  const data = useWeekendClassifica({ round, sessionType, sessionKey, meetingKey, legaId, userId, debug });

  // Punteggio personale dallo STESSO snapshot della classifica (ritiri
  // ufficiali inclusi: prima il numero in alto li ignorava).
  const realLive = useLiveScoring(
    data.ws,
    debug ? null : sessionKey, sessionType, driverNumbers, primoPilota,
    chipPiloti, chipPrevisioni, previsioni, qualifyingPole, data.gridPositions,
    data.previousResults, data.retiredDrivers,
  );
  const mockLive = useMemo(() => buildMockLiveData(driverNumbers, primoPilota, chipPiloti), [driverNumbers, primoPilota, chipPiloti]);
  const live = debug ? mockLive : realLive;
  const myPenalita = userId ? data.penalitaByUser.get(userId) ?? 0 : 0;

  const classifica = debug ? MOCK_CLASSIFICA : data.classifica;
  const kind = classifySession(sessionType);
  const isRace = kind === "race";
  const isSprint = kind === "sprint";
  const ended = sessionEnded(data.ws.raceControl);

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [expandedDriver, setExpandedDriver] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("dashboard");

  const liveWeekendPoints = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of classifica) m.set(c.userId, c.points);
    return m;
  }, [classifica]);

  // Provvisori per TUTTI i giocatori (non solo la lega mostrata), throttle 30 s.
  const lastSaveRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const all = data.classificaAll;
  useEffect(() => {
    if (debug || all.length === 0) return;
    const doSave = () => {
      lastSaveRef.current = Date.now();
      saveProvisionalScores(round, sessionType, all.map((c) => ({ userId: c.userId, scuderiaName: c.scuderiaName, tpName: c.tpName, points: c.points })));
    };
    const SAVE_INTERVAL_MS = 30_000;
    const since = Date.now() - lastSaveRef.current;
    if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
    if (since >= SAVE_INTERVAL_MS) doSave();
    else trailingTimerRef.current = setTimeout(doSave, SAVE_INTERVAL_MS - since);
    return () => { if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current); };
  }, [all, debug, round, sessionType]);

  const snap = useMemo(
    () => ({ positions: data.ws.positions, raceControl: data.ws.raceControl, fastestLap: data.ws.fastestLap, stints: data.ws.stints, retiredDrivers: data.retiredDrivers }),
    [data.ws.positions, data.ws.raceControl, data.ws.fastestLap, data.ws.stints, data.retiredDrivers],
  );

  const myLiveResults = useMemo(() => {
    const events = detectLiveEvents(snap);
    return buildLiveWeekendResults(sessionType, snap, events, data.gridPositions, data.previousResults, qualifyingPole);
  }, [snap, sessionType, data.gridPositions, data.previousResults, qualifyingPole]);

  // Eventi tradotti con l'impatto per me
  const eventCards = useMemo(() => translateRaceControl(data.ws.raceControl, {
    driverNumbers, primoPilota,
    chipPiloti: chipPiloti?.chipPiloti ?? null, chipPilotiTarget: chipPiloti?.chipPilotiTarget ?? null,
    previsioni: isRace ? previsioni : null, isRace, isSprint,
  }), [data.ws.raceControl, driverNumbers, primoPilota, chipPiloti, previsioni, isRace, isSprint]);

  // Chi parte in pole (griglia → qualifica in archivio) e se è in testa ora
  const gridPositions = data.gridPositions;
  const previousResults = data.previousResults;
  const wsPositions = data.ws.positions;
  const pole = useMemo(() => {
    let n: number | null = null;
    for (const [drv, gp] of gridPositions) if (gp === 1) { n = drv; break; }
    if (n == null) n = qualifyingPole ?? null;
    if (n == null && previousResults) n = poleDriverNumber([], previousResults.qualifying ?? []);
    return { number: n, name: n != null ? getDriverByNumber(n)?.name.split(" ").pop() ?? `#${n}` : null, leading: n != null ? (wsPositions.get(n)?.position === 1) : null };
  }, [gridPositions, qualifyingPole, previousResults, wsPositions]);

  const selectedFormazione = selectedPlayer ? data.formazioni.find((f) => f.user_id === selectedPlayer) : null;
  const selectedEntry = selectedPlayer ? classifica.find((c) => c.userId === selectedPlayer) : null;
  const selectedPrev = selectedPlayer ? data.previsioniByUser.get(selectedPlayer) : undefined;
  const decided = live.previsioniStatus.filter((p) => previsioneViva({ key: p.key as keyof Previsioni, prediction: p.prediction, happened: p.happened as unknown as boolean, ended, points: p.points }).state !== "pending").length;

  return (
    <div>
      {!debug && (
        <SessionBar
          sessionType={sessionType}
          currentLap={data.ws.currentLap}
          raceControl={data.ws.raceControl}
          lastDataAt={data.ws.lastDataAt}
          connected={data.ws.connected}
          mode={data.ws.mode}
        />
      )}

      <LiveHero
        points={live.totalPoints - myPenalita}
        piloti={live.totalPiloti}
        previsioni={live.totalPrevisioni}
        penalita={myPenalita}
        isRace={isRace}
        classifica={classifica}
        userId={userId}
        connected={live.connected}
        mode={(live as { mode?: "init" | "mqtt" | "polling" }).mode}
        ended={ended}
      />

      <div className="flex gap-1 mb-4">
        {([["dashboard", "I MIEI"], ["weekend", "WEEKEND"], ["formazioni", "FORMAZIONI"], ["generale", "GENERALE"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`flex-1 py-2 rounded font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1px] font-bold border tap ${subTab === id ? "bg-white/[0.08] border-white/45 text-white" : "bg-[#0e0e14] border-[#1c1c26] text-white/55"}`}>
            {label}
          </button>
        ))}
      </div>

      {subTab === "dashboard" && (
        <>
          <SectionHead title="I tuoi piloti" right={`${live.piloti.length} / 5`} className="mt-0" />
          {live.piloti.length === 0 && <div className="hud-card p-4 text-[13px] text-white/55">In attesa delle prime posizioni…</div>}
          {live.piloti.map((p) => (
            <PilotaLiveRow
              key={p.driver_number}
              p={p}
              primoPilota={primoPilota}
              chipPiloti={chipPiloti?.chipPiloti ?? null}
              breakdownSections={buildPilotaBreakdown(p.driver_number, data.previousResults, myLiveResults, sessionType)}
              expanded={expandedDriver === p.driver_number}
              onToggle={() => setExpandedDriver(expandedDriver === p.driver_number ? null : p.driver_number)}
            />
          ))}

          {isRace && live.previsioniStatus.length > 0 && (
            <>
              <SectionHead title="Previsioni vive" right={`${decided} / 6 DECISE`} />
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {live.previsioniStatus.map((p) => (
                  <PrevisioneLiveCard
                    key={p.key}
                    p={p}
                    viva={previsioneViva({
                      key: p.key as keyof Previsioni, prediction: p.prediction, happened: p.happened as unknown as boolean, ended, points: p.points,
                      poleName: p.key === "poleVince" ? pole.name : undefined, poleLeading: p.key === "poleVince" ? pole.leading : undefined,
                    })}
                  />
                ))}
              </div>
            </>
          )}

          <SectionHead title="Eventi per te" right={`${eventCards.length}`} />
          <EventiPerTe cards={eventCards} />

          {live.raceControlFeed.length > 0 && (
            <details className="mt-4">
              <summary className="hud-label cursor-pointer">Feed Race Control completo ({live.raceControlFeed.length})</summary>
              <div className="hud-card max-h-[300px] overflow-y-auto p-1 mt-2">
                {live.raceControlFeed.slice(0, 40).map((rc, i) => <RaceControlMessage key={i} rc={rc} />)}
              </div>
            </details>
          )}
        </>
      )}

      {subTab === "weekend" && <ClassificaWeekendList classifica={classifica} onSelect={setSelectedPlayer} />}

      {subTab === "formazioni" && (
        <FormazioniSvelate formazioni={data.formazioni} previsioniByUser={data.previsioniByUser} userId={userId} raceName={raceName} members={data.memberIds} />
      )}

      {subTab === "generale" && (
        <ClassificaGeneraleLive legaId={legaId} round={round} liveWeekendPoints={liveWeekendPoints} userId={userId} />
      )}

      {selectedFormazione && selectedEntry && (
        <PlayerDetailModal
          player={selectedFormazione}
          entry={selectedEntry}
          previsioniRow={selectedPrev}
          snap={snap}
          gridPositions={data.gridPositions}
          previousResults={data.previousResults}
          sessionType={sessionType}
          penalitaCambi={data.penalitaByUser.get(selectedFormazione.user_id) ?? 0}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

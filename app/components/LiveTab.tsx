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
import { buildMockLiveData, MOCK_CLASSIFICA } from "./live/mock-data";
import { buildLiveWeekendResults, detectLiveEvents } from "../lib/build-live-results";
import { HudCard } from "./ui/HudCard";
import { SectionHead } from "./ui/SectionHead";
import { ConnectedPill } from "./ui/LivePill";

export default function LiveTab({
  sessionKey,
  sessionType,
  meetingKey,
  round,
  userId,
  legaId,
  driverNumbers,
  primoPilota,
  chipPiloti,
  chipPrevisioni,
  previsioni,
  qualifyingPole,
  debug = false,
}: {
  sessionKey: number;
  sessionType: string;
  meetingKey?: number;
  round: number;
  userId?: string;
  legaId?: string;
  driverNumbers: number[];
  primoPilota: number | null;
  chipPiloti: ChipPilotiConfig | null;
  chipPrevisioni: ChipPrevisioniConfig | null;
  previsioni: Previsioni;
  qualifyingPole?: number | null;
  debug?: boolean;
}) {
  // Hook unificato: fetch formazioni/previsioni della lega + WS + previousResults + grid
  const data = useWeekendClassifica({ round, sessionType, sessionKey, meetingKey, legaId, userId, debug });

  // Punteggio personale provvisorio: riusa la STESSA connessione WebSocket della
  // classifica (data.ws) cosicché il punteggio in alto e la riga "me" in classifica
  // siano sempre calcolati dallo stesso snapshot live.
  const realLive = useLiveScoring(
    data.ws,
    debug ? null : sessionKey, sessionType, driverNumbers, primoPilota,
    chipPiloti, chipPrevisioni, previsioni, qualifyingPole, data.gridPositions,
    data.previousResults,
  );
  const mockLive = useMemo(() => buildMockLiveData(driverNumbers, primoPilota, chipPiloti), [driverNumbers, primoPilota, chipPiloti]);
  const live = debug ? mockLive : realLive;

  const classifica = debug ? MOCK_CLASSIFICA : data.classifica;
  const isRace = sessionType.toLowerCase().includes("race") && !sessionType.toLowerCase().includes("sprint qualifying");

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [expandedDriver, setExpandedDriver] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<"dashboard" | "gara" | "generale">("dashboard");

  // Punti del weekend live per giocatore (per la Classifica Generale live)
  const liveWeekendPoints = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of classifica) m.set(c.userId, c.points);
    return m;
  }, [classifica]);

  // Salva punteggi provvisori (accumula sessioni weekend) — con throttle: al
  // massimo una scrittura ogni 30s, anche se le posizioni live cambiano di
  // continuo. Evita di martellare Supabase (e riduce la race tra più client).
  const lastSaveRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debug || classifica.length === 0) return;

    const doSave = () => {
      lastSaveRef.current = Date.now();
      saveProvisionalScores(
        round,
        sessionType,
        classifica.map((c) => ({
          userId: c.userId,
          scuderiaName: c.scuderiaName,
          tpName: c.tpName,
          points: c.points,
        })),
      );
    };

    const SAVE_INTERVAL_MS = 30_000;
    const since = Date.now() - lastSaveRef.current;
    if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
    if (since >= SAVE_INTERVAL_MS) {
      doSave();
    } else {
      // Rimanda alla fine della finestra di throttle, con i dati più recenti.
      trailingTimerRef.current = setTimeout(doSave, SAVE_INTERVAL_MS - since);
    }

    return () => {
      if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
    };
  }, [classifica, debug, round, sessionType]);

  // Snapshot per il modale (evita ricalcolo)
  const snap = useMemo(
    () => ({ positions: data.ws.positions, raceControl: data.ws.raceControl, fastestLap: data.ws.fastestLap, stints: data.ws.stints, retiredDrivers: data.retiredDrivers }),
    [data.ws.positions, data.ws.raceControl, data.ws.fastestLap, data.ws.stints, data.retiredDrivers],
  );

  // Costruisce live results per il breakdown dei miei piloti
  const myLiveResults = useMemo(() => {
    const events = detectLiveEvents(snap);
    return buildLiveWeekendResults(sessionType, snap, events, data.gridPositions, data.previousResults, qualifyingPole);
  }, [snap, sessionType, data.gridPositions, data.previousResults, qualifyingPole]);

  const selectedFormazione = selectedPlayer ? data.formazioni.find((f) => f.user_id === selectedPlayer) : null;
  const selectedEntry = selectedPlayer ? classifica.find((c) => c.userId === selectedPlayer) : null;
  const selectedPrev = selectedPlayer ? data.previsioniByUser.get(selectedPlayer) : undefined;

  return (
    <div>
      <HudCard
        label="PUNTEGGIO PROVVISORIO"
        meta={<ConnectedPill connected={live.connected} mode={(live as { mode?: "init" | "mqtt" | "polling" }).mode} />}
        className="mb-4"
      >
        <div className="big-num">{live.totalPoints}</div>
        <div className="flex items-baseline justify-between mt-3">
          <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/30 tracking-[1.5px] uppercase">
            PILOTI <span className="text-white/60 ml-1">{live.totalPiloti}</span>
            {isRace && (
              <>
                <span className="mx-2 text-white/15">·</span>
                PREVISIONI <span className="text-white/60 ml-1">{live.totalPrevisioni}</span>
              </>
            )}
          </div>
        </div>
      </HudCard>

      {/* Sotto-tab del Live */}
      <div className="flex gap-1 mb-4">
        {([
          ["dashboard", "DASHBOARD"],
          ["gara", "CLASSIFICA GARA"],
          ["generale", "GENERALE"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex-1 py-2 rounded font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[1.2px] font-bold transition-all border ${
              subTab === id
                ? "bg-[#E8002D]/12 border-[#E8002D]/45 text-[#E8002D]"
                : "bg-[#0e0e14] border-[#1c1c26] text-white/40 hover:text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── DASHBOARD: tuoi piloti + previsioni + race control ─── */}
      {subTab === "dashboard" && (
        <>
          <SectionHead title="I tuoi piloti" right={`${live.piloti.length} / 5`} className="mt-2" />
          {live.piloti.map((p) => {
            const sections = buildPilotaBreakdown(
              p.driver_number,
              data.previousResults,
              myLiveResults,
              sessionType,
            );
            return (
              <PilotaLiveRow
                key={p.driver_number}
                p={p}
                primoPilota={primoPilota}
                chipPiloti={chipPiloti?.chipPiloti ?? null}
                breakdownSections={sections}
                expanded={expandedDriver === p.driver_number}
                onToggle={() => setExpandedDriver(expandedDriver === p.driver_number ? null : p.driver_number)}
              />
            );
          })}

          {isRace && live.previsioniStatus.length > 0 && (
            <>
              <SectionHead title="Previsioni live" right={`${live.previsioniStatus.filter(p => p.correct !== null).length} / 6`} />
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {live.previsioniStatus.map((p) => (
                  <PrevisioneLiveCard key={p.key} p={p} />
                ))}
              </div>
            </>
          )}

          {live.raceControlFeed.length > 0 && (
            <>
              <SectionHead title="Race Control" right="FEED" />
              <div className="hud-card max-h-[300px] overflow-y-auto p-1">
                {live.raceControlFeed.slice(0, 30).map((rc, i) => (
                  <RaceControlMessage key={i} rc={rc} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ─── CLASSIFICA GARA: classifica live del weekend ─── */}
      {subTab === "gara" && (
        <ClassificaWeekendList classifica={classifica} onSelect={setSelectedPlayer} />
      )}

      {/* ─── CLASSIFICA GENERALE: stagione + delta live ─── */}
      {subTab === "generale" && (
        <ClassificaGeneraleLive legaId={legaId} liveWeekendPoints={liveWeekendPoints} userId={userId} />
      )}

      {/* Modale dettaglio giocatore (overlay, indipendente dal sotto-tab) */}
      {selectedFormazione && selectedEntry && (
        <PlayerDetailModal
          player={selectedFormazione}
          entry={selectedEntry}
          previsioniRow={selectedPrev}
          snap={snap}
          gridPositions={data.gridPositions}
          previousResults={data.previousResults}
          sessionType={sessionType}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

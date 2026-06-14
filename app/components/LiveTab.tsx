"use client";
import { useEffect, useMemo, useState } from "react";
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

  // Salva punteggi provvisori (accumula sessioni weekend)
  useEffect(() => {
    if (debug || classifica.length === 0) return;
    saveProvisionalScores(
      round,
      sessionType,
      classifica.map((c) => {
        const f = data.formazioni.find((x) => x.user_id === c.userId);
        return {
          userId: c.userId,
          scuderiaName: c.scuderiaName,
          tpName: c.tpName,
          points: c.points,
          piloti: f ? (() => {
            const dns = [...f.driver_numbers];
            if (f.chip_piloti === "sesto" && f.sesto_uomo && !dns.includes(f.sesto_uomo)) dns.push(f.sesto_uomo);
            return dns.map((dn) => ({
              driver_number: dn,
              position: data.ws.positions.get(dn)?.position ?? 22,
              puntiFinali: 0,
              isDnf: false,
            }));
          })() : [],
        };
      }),
    );
  }, [classifica, debug, round, sessionType, data.formazioni, data.ws.positions]);

  // Snapshot per il modale (evita ricalcolo)
  const snap = useMemo(
    () => ({ positions: data.ws.positions, raceControl: data.ws.raceControl, fastestLap: data.ws.fastestLap, stints: data.ws.stints }),
    [data.ws.positions, data.ws.raceControl, data.ws.fastestLap, data.ws.stints],
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

      <ClassificaWeekendList classifica={classifica} onSelect={setSelectedPlayer} />

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
    </div>
  );
}

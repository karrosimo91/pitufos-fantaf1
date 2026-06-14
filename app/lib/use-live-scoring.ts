"use client";
import { useMemo } from "react";
import type { LiveRaceControl } from "./use-live-ws";
import type { useLiveWebSocket } from "./use-live-ws";
import {
  calcolaPuntiWeekend,
  type RaceWeekendResults,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "./scoring";
import { PREVISIONI_PUNTI, type Previsioni } from "./types";
import {
  buildLiveWeekendResults,
  detectLiveEvents,
  classifySession,
} from "./build-live-results";

// ─── Tipi esposti ───

export interface LivePilotaScore {
  driver_number: number;
  position: number;
  puntiBase: number;
  moltiplicatore: number;
  puntiFinali: number;
  isDnf: boolean;
  isFastestLap: boolean;
}

export interface LivePrevisioneStatus {
  key: string;
  label: string;
  prediction: boolean | number | null;
  happened: boolean | null;
  correct: boolean | null;
  points: number;
}

// ─── Hook principale ───

export function useLiveScoring(
  ws: ReturnType<typeof useLiveWebSocket>,
  sessionKey: number | null,
  sessionType: string,
  myDriverNumbers: number[],
  primoPilota: number | null,
  chipPiloti: ChipPilotiConfig | null,
  chipPrevisioni: ChipPrevisioniConfig | null,
  myPrevisioni: Previsioni,
  qualifyingPole?: number | null,
  gridPositions?: Map<number, number>,
  previousResults?: RaceWeekendResults | null,
) {
  // Riusa la connessione WebSocket condivisa (passata dall'esterno) invece di
  // aprirne una propria: una sola connessione per sessione evita che due client
  // MQTT con lo stesso token si sconnettano a vicenda e garantisce che il
  // punteggio personale e la classifica siano calcolati dallo stesso snapshot.
  const { positions, raceControl, fastestLap, stints, connected, mode } = ws;

  return useMemo(() => {
    const empty = {
      piloti: [] as LivePilotaScore[],
      totalPiloti: 0,
      previsioniStatus: [] as LivePrevisioneStatus[],
      totalPrevisioni: 0,
      totalPoints: 0,
      raceControlFeed: [] as LiveRaceControl[],
      events: { safetyCar: false, virtualSafetyCar: false, redFlag: false, wetTyres: false, totalDnf: 0 },
      connected,
      mode,
    };
    if (!sessionKey || positions.size === 0) return empty;

    const snap = { positions, raceControl, fastestLap, stints };
    const events = detectLiveEvents(snap);
    const kind = classifySession(sessionType);
    const isRace = kind === "race";

    const virtualResults = buildLiveWeekendResults(
      sessionType,
      snap,
      events,
      gridPositions ?? new Map(),
      previousResults ?? null,
      qualifyingPole,
    );

    // Previsioni: si calcolano solo in gara. Per le altre sessioni passiamo previsioni nulle.
    const previsioniPerCalcolo: Previsioni = isRace ? myPrevisioni : {
      safetyCar: null, virtualSafetyCar: null, redFlag: null,
      gommeWet: null, poleVince: null, numeroDnf: null,
    };

    const calc = calcolaPuntiWeekend(
      myDriverNumbers,
      primoPilota,
      previsioniPerCalcolo,
      virtualResults,
      chipPiloti ?? undefined,
      isRace ? (chipPrevisioni ?? undefined) : undefined,
    );

    // Arricchisci con info live per la UI (position, DNF, FL)
    const piloti: LivePilotaScore[] = calc.pilotiDettaglio.map((d) => ({
      driver_number: d.driver_number,
      position: positions.get(d.driver_number)?.position ?? 22,
      puntiBase: d.puntiBase,
      moltiplicatore: d.moltiplicatore,
      puntiFinali: d.puntiFinali,
      isDnf: events.dnfDrivers.has(d.driver_number),
      isFastestLap: fastestLap?.driver_number === d.driver_number,
    }));

    // Costruisci LivePrevisioneStatus solo in gara
    const previsioniStatus: LivePrevisioneStatus[] = [];
    if (isRace) {
      const e = virtualResults.events;
      const prevItems: { key: keyof Previsioni; label: string; happened: boolean; puntiSi: number; puntiNo: number }[] = [
        { key: "safetyCar", label: "Safety Car", happened: e.safety_car, puntiSi: PREVISIONI_PUNTI.safetyCar.si, puntiNo: PREVISIONI_PUNTI.safetyCar.no },
        { key: "virtualSafetyCar", label: "Virtual Safety Car", happened: e.virtual_safety_car, puntiSi: PREVISIONI_PUNTI.virtualSafetyCar.si, puntiNo: PREVISIONI_PUNTI.virtualSafetyCar.no },
        { key: "redFlag", label: "Red Flag", happened: e.red_flag, puntiSi: PREVISIONI_PUNTI.redFlag.si, puntiNo: PREVISIONI_PUNTI.redFlag.no },
        { key: "gommeWet", label: "Gomme Wet", happened: e.wet_tyres, puntiSi: PREVISIONI_PUNTI.gommeWet.si, puntiNo: PREVISIONI_PUNTI.gommeWet.no },
        { key: "poleVince", label: "Pole vince", happened: e.pole_won, puntiSi: PREVISIONI_PUNTI.poleVince.si, puntiNo: PREVISIONI_PUNTI.poleVince.no },
      ];

      for (const p of prevItems) {
        const prediction = myPrevisioni[p.key] as boolean | null;
        const points = calc.previsioniDettaglio[p.key] ?? 0;
        let correct: boolean | null = null;
        if (prediction !== null) {
          correct = prediction === p.happened;
        }
        previsioniStatus.push({
          key: p.key,
          label: p.label,
          prediction,
          happened: p.happened,
          correct,
          points,
        });
      }

      const dnfPred = myPrevisioni.numeroDnf;
      const dnfPoints = calc.previsioniDettaglio.numeroDnf ?? 0;
      const dnfCorrect = dnfPred !== null ? dnfPred === e.total_dnf : null;
      previsioniStatus.push({
        key: "numeroDnf",
        label: "Numero DNF",
        prediction: dnfPred,
        happened: e.total_dnf as unknown as boolean,
        correct: dnfCorrect,
        points: dnfPoints,
      });
    }

    return {
      piloti,
      totalPiloti: calc.pilotiPoints,
      previsioniStatus,
      totalPrevisioni: isRace ? calc.previsioniPoints : 0,
      totalPoints: calc.total,
      raceControlFeed: [...raceControl].reverse(),
      events: {
        safetyCar: events.safetyCar,
        virtualSafetyCar: events.virtualSafetyCar,
        redFlag: events.redFlag,
        wetTyres: events.wetTyres,
        totalDnf: events.totalDnf,
      },
      connected,
      mode,
    };
  }, [sessionKey, sessionType, positions, raceControl, fastestLap, stints, connected, mode,
    myDriverNumbers, primoPilota, chipPiloti, chipPrevisioni, myPrevisioni,
    qualifyingPole, gridPositions, previousResults]);
}

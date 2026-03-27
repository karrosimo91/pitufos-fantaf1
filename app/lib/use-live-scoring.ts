"use client";
import { useMemo } from "react";
import { useLiveWebSocket, type LiveRaceControl } from "./use-live-ws";
import {
  calcolaQualifica,
  calcolaSprintShootout,
  calcolaSprint,
  calcolaGara,
  calcolaPuntiPrevisioni,
  type DriverResult,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "./scoring";
import { PREVISIONI_PUNTI } from "./types";

// ─── Tipi ───

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
  prediction: boolean | number | null; // la previsione del giocatore
  happened: boolean | null;            // null = in attesa
  correct: boolean | null;
  points: number;
}

export interface LiveClassificaEntry {
  user_id: string;
  name: string;
  points: number;
}

// ─── Helper: rileva eventi da race control ───

function detectEvents(raceControl: LiveRaceControl[]) {
  let safetyCar = false;
  let virtualSafetyCar = false;
  let redFlag = false;
  const dnfDrivers = new Set<number>();

  for (const rc of raceControl) {
    const msg = (rc.message || "").toUpperCase();
    const flag = (rc.flag || "").toUpperCase();

    if (msg.includes("SAFETY CAR") && !msg.includes("VIRTUAL")) safetyCar = true;
    if (msg.includes("VIRTUAL SAFETY CAR") || msg.includes("VSC")) virtualSafetyCar = true;
    if (flag === "RED" || (msg.includes("RED FLAG") && !msg.includes("CHEQUERED"))) redFlag = true;
    if (msg.includes("RETIRED") || msg.includes("OUT OF THE RACE") || msg.includes("DID NOT FINISH")) {
      if (rc.driver_number) dnfDrivers.add(rc.driver_number);
    }
  }

  return { safetyCar, virtualSafetyCar, redFlag, dnfDrivers, totalDnf: dnfDrivers.size };
}

function detectWetTyres(stints: { compound: string }[]) {
  return stints.some((s) => {
    const c = (s.compound || "").toUpperCase();
    return c === "WET" || c === "INTERMEDIATE";
  });
}

// ─── Hook principale ───

export function useLiveScoring(
  sessionKey: number | null,
  sessionType: string, // "Race", "Qualifying", "Sprint", "Sprint Qualifying"
  myDriverNumbers: number[],
  primoPilota: number | null,
  chipPiloti: ChipPilotiConfig | null,
  chipPrevisioni: ChipPrevisioniConfig | null,
  myPrevisioni: {
    safetyCar: boolean | null;
    virtualSafetyCar: boolean | null;
    redFlag: boolean | null;
    gommeWet: boolean | null;
    poleVince: boolean | null;
    numeroDnf: number | null;
  },
  qualifyingPole?: number | null, // driver_number del pole sitter (per "pole vince")
) {
  const { positions, raceControl, fastestLap, stints, connected } = useLiveWebSocket(sessionKey);

  const result = useMemo(() => {
    if (!sessionKey || positions.size === 0) {
      return {
        piloti: [] as LivePilotaScore[],
        totalPiloti: 0,
        previsioniStatus: [] as LivePrevisioneStatus[],
        totalPrevisioni: 0,
        totalPoints: 0,
        raceControlFeed: [] as LiveRaceControl[],
        events: { safetyCar: false, virtualSafetyCar: false, redFlag: false, wetTyres: false, totalDnf: 0 },
        connected,
      };
    }

    const events = detectEvents(raceControl);
    const wetTyres = detectWetTyres(stints);
    const isRace = sessionType.toLowerCase().includes("race") && !sessionType.toLowerCase().includes("sprint");
    const isSprint = sessionType.toLowerCase() === "sprint" || (sessionType.toLowerCase().includes("race") && sessionType.toLowerCase().includes("sprint"));
    const isSprintQualifying = sessionType.toLowerCase().includes("sprint") && sessionType.toLowerCase().includes("qualifying");
    const isQualifying = sessionType.toLowerCase() === "qualifying";

    // Calcola punti per i miei piloti
    const piloti: LivePilotaScore[] = myDriverNumbers.map((driverNum) => {
      const pos = positions.get(driverNum);
      const position = pos?.position ?? 22;
      const isDnf = events.dnfDrivers.has(driverNum);
      const isFastestLap = fastestLap?.driver_number === driverNum;

      // Calcola punti base a seconda del tipo di sessione
      let puntiBase = 0;

      if (isQualifying) {
        puntiBase = calcolaQualifica(position, isDnf);
      } else if (isSprintQualifying) {
        puntiBase = calcolaSprintShootout(position, isDnf);
      } else if (isSprint) {
        const driverResult: DriverResult = {
          driver_number: driverNum, position, dnf: isDnf, fastest_lap: isFastestLap,
        };
        puntiBase = calcolaSprint(driverResult);
      } else if (isRace) {
        const driverResult: DriverResult = {
          driver_number: driverNum, position, dnf: isDnf,
          fastest_lap: isFastestLap, driver_of_the_day: false, penalty: false,
        };
        puntiBase = calcolaGara(driverResult);
      }

      // Moltiplicatori
      const isPrimo = driverNum === primoPilota;
      const isBoosted = chipPiloti?.chipPiloti === "boost" && chipPiloti.chipPilotiTarget === driverNum && !isPrimo;

      let moltiplicatore = 1;
      if (isPrimo) moltiplicatore = 2;
      if (isBoosted) moltiplicatore = 3;

      let puntiFinali: number;

      // Scudo Capitano
      if (isPrimo && chipPiloti?.chipPiloti === "scudo") {
        puntiFinali = puntiBase > 0 ? puntiBase * 2 : puntiBase;
      } else {
        puntiFinali = puntiBase * moltiplicatore;
      }

      // Halo
      if (chipPiloti?.chipPiloti === "halo" && puntiFinali < 0) {
        puntiFinali = 0;
      }

      return { driver_number: driverNum, position, puntiBase, moltiplicatore, puntiFinali, isDnf, isFastestLap };
    });

    const totalPiloti = piloti.reduce((sum, p) => sum + p.puntiFinali, 0);

    // Previsioni (solo durante gara)
    const poleWon = isRace && qualifyingPole
      ? (positions.get(qualifyingPole)?.position === 1)
      : null; // non determinabile ancora

    const previsioniStatus: LivePrevisioneStatus[] = [];
    let totalPrevisioni = 0;

    if (isRace) {
      const prevItems: { key: string; label: string; prediction: boolean | null; happened: boolean | null; puntiSi: number; puntiNo: number }[] = [
        { key: "safetyCar", label: "Safety Car", prediction: myPrevisioni.safetyCar, happened: events.safetyCar || null, puntiSi: PREVISIONI_PUNTI.safetyCar.si, puntiNo: PREVISIONI_PUNTI.safetyCar.no },
        { key: "virtualSafetyCar", label: "Virtual Safety Car", prediction: myPrevisioni.virtualSafetyCar, happened: events.virtualSafetyCar || null, puntiSi: PREVISIONI_PUNTI.virtualSafetyCar.si, puntiNo: PREVISIONI_PUNTI.virtualSafetyCar.no },
        { key: "redFlag", label: "Red Flag", prediction: myPrevisioni.redFlag, happened: events.redFlag || null, puntiSi: PREVISIONI_PUNTI.redFlag.si, puntiNo: PREVISIONI_PUNTI.redFlag.no },
        { key: "gommeWet", label: "Gomme Wet", prediction: myPrevisioni.gommeWet, happened: wetTyres || null, puntiSi: PREVISIONI_PUNTI.gommeWet.si, puntiNo: PREVISIONI_PUNTI.gommeWet.no },
        { key: "poleVince", label: "Pole vince", prediction: myPrevisioni.poleVince, happened: poleWon, puntiSi: PREVISIONI_PUNTI.poleVince.si, puntiNo: PREVISIONI_PUNTI.poleVince.no },
      ];

      for (const p of prevItems) {
        let correct: boolean | null = null;
        let points = 0;

        if (p.prediction !== null && p.happened !== null) {
          // Evento accaduto: se ha previsto SI ed è accaduto, o NO e non è accaduto
          if (p.happened) {
            // Evento è accaduto
            correct = p.prediction === true;
            points = correct ? p.puntiSi : 0;
          } else {
            // Evento non ancora accaduto (potrebbe ancora accadere) — mostriamo provvisorio
            correct = null; // in attesa
          }
        }

        // Chip previsione sicura/doppia
        if (chipPrevisioni?.chipAttivo === "sicura" && chipPrevisioni.chipTarget === p.key && correct === false) {
          points = p.prediction ? p.puntiSi : p.puntiNo;
        }
        if (chipPrevisioni?.chipAttivo === "doppia" && chipPrevisioni.chipTarget === p.key) {
          points *= 2;
        }

        previsioniStatus.push({ key: p.key, label: p.label, prediction: p.prediction, happened: p.happened, correct, points });
        totalPrevisioni += points;
      }

      // Numero DNF
      const dnfCorrect = myPrevisioni.numeroDnf !== null ? myPrevisioni.numeroDnf === events.totalDnf : null;
      let dnfPoints = dnfCorrect ? PREVISIONI_PUNTI.numeroDnf.esatto : 0;
      if (chipPrevisioni?.chipAttivo === "sicura" && chipPrevisioni.chipTarget === "numeroDnf" && !dnfCorrect) {
        dnfPoints = PREVISIONI_PUNTI.numeroDnf.esatto;
      }
      if (chipPrevisioni?.chipAttivo === "doppia" && chipPrevisioni.chipTarget === "numeroDnf") {
        dnfPoints *= 2;
      }

      previsioniStatus.push({
        key: "numeroDnf", label: "Numero DNF",
        prediction: myPrevisioni.numeroDnf, happened: events.totalDnf as unknown as boolean,
        correct: dnfCorrect, points: dnfPoints,
      });
      totalPrevisioni += dnfPoints;
    }

    return {
      piloti,
      totalPiloti,
      previsioniStatus,
      totalPrevisioni,
      totalPoints: totalPiloti + totalPrevisioni,
      raceControlFeed: [...raceControl].reverse(), // più recenti in alto
      events: { safetyCar: events.safetyCar, virtualSafetyCar: events.virtualSafetyCar, redFlag: events.redFlag, wetTyres, totalDnf: events.totalDnf },
      connected,
    };
  }, [sessionKey, sessionType, positions, raceControl, fastestLap, stints, connected,
    myDriverNumbers, primoPilota, chipPiloti, chipPrevisioni, myPrevisioni, qualifyingPole]);

  return result;
}

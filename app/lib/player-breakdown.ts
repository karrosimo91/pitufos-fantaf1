import {
  calcolaPuntiWeekend,
  getScoreBreakdown,
  type RaceWeekendResults,
  type ScoreBreakdown,
  type DriverResult,
} from "./scoring";
import type { Previsioni } from "./types";
import type { LivePilotaScore } from "./use-live-scoring";
import type { PlayerFormazione, PlayerPrevisioni } from "./use-weekend-classifica";
import {
  buildLiveWeekendResults,
  detectLiveEvents,
  classifySession,
  type LiveSnapshot,
} from "./build-live-results";

export interface PilotaBreakdown {
  driver_number: number;
  sections: { label: string; breakdown: ScoreBreakdown }[];
}

const SESSION_LABEL: Record<string, string> = {
  qualifying: "Qualifica",
  sprint_shootout: "Sprint Shootout",
  sprint: "Sprint",
  race: "Gara",
};

/**
 * Costruisce breakdown completo del weekend (sessioni precedenti + sessione corrente live)
 * per un singolo pilota di un giocatore. Riusa getScoreBreakdown() per ogni sessione.
 */
export function buildPilotaBreakdown(
  driverNum: number,
  isPrimo: boolean,
  chipPiloti: string | null,
  chipPilotiTarget: number | null,
  previousResults: RaceWeekendResults | null,
  liveResults: RaceWeekendResults,
  currentSessionType: string,
): { label: string; breakdown: ScoreBreakdown }[] {
  const sections: { label: string; breakdown: ScoreBreakdown }[] = [];
  const isBoosted = chipPiloti === "boost" && chipPilotiTarget === driverNum && !isPrimo;
  const chipForBreakdown = isBoosted
    ? "boost"
    : (isPrimo && chipPiloti === "scudo") ? "scudo"
    : chipPiloti === "halo" ? "halo"
    : null;
  const currentKind = classifySession(currentSessionType);

  const pushSection = (label: string, result: DriverResult, kind: "qualifying" | "sprint_shootout" | "sprint" | "race") => {
    sections.push({ label, breakdown: getScoreBreakdown(result, kind, isPrimo, chipForBreakdown) });
  };

  // Sessioni precedenti dal DB
  if (previousResults) {
    if (currentKind !== "qualifying" && previousResults.qualifying?.length) {
      const r = previousResults.qualifying.find((x) => x.driver_number === driverNum);
      if (r) pushSection("Qualifica", r, "qualifying");
    }
    if (currentKind !== "sprint_shootout" && previousResults.sprint_shootout?.length) {
      const r = previousResults.sprint_shootout.find((x) => x.driver_number === driverNum);
      if (r) pushSection("Sprint Shootout", r, "sprint_shootout");
    }
    if (currentKind !== "sprint" && previousResults.sprint?.length) {
      const r = previousResults.sprint.find((x) => x.driver_number === driverNum);
      if (r) pushSection("Sprint", r, "sprint");
    }
    if (currentKind !== "race" && previousResults.race?.length) {
      const r = previousResults.race.find((x) => x.driver_number === driverNum);
      if (r) pushSection("Gara", r, "race");
    }
  }

  // Sessione corrente (live) — pesco da liveResults
  if (currentKind !== "unknown") {
    const arr = currentKind === "qualifying" ? liveResults.qualifying
      : currentKind === "sprint_shootout" ? liveResults.sprint_shootout
      : currentKind === "sprint" ? liveResults.sprint
      : liveResults.race;
    const r = arr?.find((x) => x.driver_number === driverNum)
      ?? { driver_number: driverNum, position: 22, dnf: false };
    pushSection(`${SESSION_LABEL[currentKind]} (live)`, r, currentKind);
  }

  return sections;
}

export interface PlayerWeekendDetail {
  piloti: LivePilotaScore[];
  totalPoints: number;
  events: RaceWeekendResults["events"];
  liveResults: RaceWeekendResults;
}

/**
 * Calcola il dettaglio weekend di un giocatore (piloti + punteggi) usando calcolaPuntiWeekend
 * con risultati live virtuali. Riusa la stessa logica della classifica.
 */
export function computePlayerWeekendDetail(
  formazione: PlayerFormazione,
  previsioniRow: PlayerPrevisioni | undefined,
  snap: LiveSnapshot,
  gridPositions: Map<number, number>,
  previousResults: RaceWeekendResults | null,
  sessionType: string,
  qualifyingPole?: number | null,
): PlayerWeekendDetail {
  const events = detectLiveEvents(snap);
  const liveResults = buildLiveWeekendResults(sessionType, snap, events, gridPositions, previousResults, qualifyingPole);
  const isRace = classifySession(sessionType) === "race";

  const previsioniIn: Previsioni = isRace && previsioniRow
    ? {
      safetyCar: previsioniRow.safety_car,
      virtualSafetyCar: previsioniRow.virtual_safety_car,
      redFlag: previsioniRow.red_flag,
      gommeWet: previsioniRow.gomme_wet,
      poleVince: previsioniRow.pole_vince,
      numeroDnf: previsioniRow.numero_dnf,
    }
    : { safetyCar: null, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null };

  const calc = calcolaPuntiWeekend(
    formazione.driver_numbers,
    formazione.primo_pilota,
    previsioniIn,
    liveResults,
    {
      chipPiloti: formazione.chip_piloti,
      chipPilotiTarget: formazione.chip_piloti_target,
      sestoUomo: formazione.sesto_uomo,
    },
    isRace && previsioniRow?.chip_attivo
      ? { chipAttivo: previsioniRow.chip_attivo, chipTarget: previsioniRow.chip_target }
      : undefined,
  );

  const piloti: LivePilotaScore[] = calc.pilotiDettaglio.map((d) => ({
    driver_number: d.driver_number,
    position: snap.positions.get(d.driver_number)?.position ?? 22,
    puntiBase: d.puntiBase,
    moltiplicatore: d.moltiplicatore,
    puntiFinali: d.puntiFinali,
    isDnf: events.dnfDrivers.has(d.driver_number),
    isFastestLap: snap.fastestLap?.driver_number === d.driver_number,
  }));

  return { piloti, totalPoints: calc.total, events: liveResults.events, liveResults };
}

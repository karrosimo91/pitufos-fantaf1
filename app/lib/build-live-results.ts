import type { RaceWeekendResults, DriverResult } from "./scoring";
import type { LivePosition, LiveRaceControl, LiveStint } from "./use-live-ws";

export interface LiveSnapshot {
  positions: Map<number, LivePosition>;
  raceControl: LiveRaceControl[];
  fastestLap: { driver_number: number; duration: number } | null;
  stints: LiveStint[];
}

export interface LiveEvents {
  safetyCar: boolean;
  virtualSafetyCar: boolean;
  redFlag: boolean;
  wetTyres: boolean;
  dnfDrivers: Set<number>;
  totalDnf: number;
}

export type SessionKind = "qualifying" | "sprint_shootout" | "sprint" | "race" | "unknown";

export function classifySession(sessionType: string): SessionKind {
  const s = sessionType.toLowerCase();
  if (s === "qualifying") return "qualifying";
  if (s.includes("sprint") && s.includes("qualifying")) return "sprint_shootout";
  if (s === "sprint" || (s.includes("race") && s.includes("sprint"))) return "sprint";
  if (s.includes("race")) return "race";
  return "unknown";
}

export function detectLiveEvents(snap: LiveSnapshot): LiveEvents {
  let safetyCar = false;
  let virtualSafetyCar = false;
  let redFlag = false;
  const dnfDrivers = new Set<number>();

  for (const rc of snap.raceControl) {
    const msg = (rc.message || "").toUpperCase();
    const flag = (rc.flag || "").toUpperCase();
    if (msg.includes("SAFETY CAR") && !msg.includes("VIRTUAL")) safetyCar = true;
    if (msg.includes("VIRTUAL SAFETY CAR") || msg.includes("VSC")) virtualSafetyCar = true;
    if (flag === "RED" || (msg.includes("RED FLAG") && !msg.includes("CHEQUERED"))) redFlag = true;
    if (msg.includes("RETIRED") || msg.includes("OUT OF THE RACE") || msg.includes("DID NOT FINISH")) {
      if (rc.driver_number) dnfDrivers.add(rc.driver_number);
    }
  }

  const wetTyres = snap.stints.some((s) => {
    const c = (s.compound || "").toUpperCase();
    return c === "WET" || c === "INTERMEDIATE";
  });

  return { safetyCar, virtualSafetyCar, redFlag, wetTyres, dnfDrivers, totalDnf: dnfDrivers.size };
}

function buildLiveDriverResults(
  snap: LiveSnapshot,
  events: LiveEvents,
  gridPositions: Map<number, number>,
  withGrid: boolean,
): DriverResult[] {
  const results: DriverResult[] = [];
  for (const [driverNum, posData] of snap.positions) {
    const dr: DriverResult = {
      driver_number: driverNum,
      position: posData.position,
      dnf: events.dnfDrivers.has(driverNum),
      fastest_lap: snap.fastestLap?.driver_number === driverNum,
      driver_of_the_day: false,
      penalty: false,
    };
    if (withGrid) dr.grid_position = gridPositions.get(driverNum);
    results.push(dr);
  }
  return results;
}

/**
 * Fonde i dati live della sessione corrente con i risultati delle sessioni precedenti
 * per produrre un RaceWeekendResults compatibile con calcolaPuntiWeekend().
 *
 * Pole_won viene calcolato confrontando la pole della qualifica con la P1 live (solo in gara).
 */
export function buildLiveWeekendResults(
  sessionType: string,
  snap: LiveSnapshot,
  events: LiveEvents,
  gridPositions: Map<number, number>,
  previousResults: RaceWeekendResults | null,
  qualifyingPole?: number | null,
): RaceWeekendResults {
  const kind = classifySession(sessionType);
  const isMainRace = kind === "race";

  const liveResults = buildLiveDriverResults(snap, events, gridPositions, isMainRace);

  const poleWon = isMainRace && qualifyingPole != null
    ? snap.positions.get(qualifyingPole)?.position === 1
    : (previousResults?.events.pole_won ?? false);

  return {
    qualifying: kind === "qualifying" ? liveResults : (previousResults?.qualifying ?? []),
    sprint_shootout: kind === "sprint_shootout" ? liveResults : previousResults?.sprint_shootout,
    sprint: kind === "sprint" ? liveResults : previousResults?.sprint,
    race: isMainRace ? liveResults : (previousResults?.race ?? []),
    events: {
      safety_car: isMainRace ? events.safetyCar : (previousResults?.events.safety_car ?? false),
      virtual_safety_car: isMainRace ? events.virtualSafetyCar : (previousResults?.events.virtual_safety_car ?? false),
      red_flag: isMainRace ? events.redFlag : (previousResults?.events.red_flag ?? false),
      wet_tyres: isMainRace ? events.wetTyres : (previousResults?.events.wet_tyres ?? false),
      pole_won: poleWon,
      total_dnf: isMainRace ? events.totalDnf : (previousResults?.events.total_dnf ?? 0),
    },
  };
}

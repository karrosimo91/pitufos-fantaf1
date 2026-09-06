import type { RaceWeekendResults, DriverResult } from "./scoring";
import type { LivePosition, LiveRaceControl, LiveStint } from "./use-live-ws";
import { extractPenalizedDrivers, carNumberFromMessage } from "./penalties";

export interface LiveSnapshot {
  positions: Map<number, LivePosition>;
  raceControl: LiveRaceControl[];
  fastestLap: { driver_number: number; duration: number } | null;
  stints: LiveStint[];
  // Ritirati secondo `session_result` di OpenF1 (flag dnf/dsq), via
  // /api/live-retired. I messaggi race_control non coprono tutti i ritiri:
  // OpenF1 non ne emette uno per ogni macchina che si ferma, quindi senza
  // questa fonte il malus −10 non arriva mai per quei piloti.
  retiredDrivers?: Set<number>;
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
      // Come per le penalità: OpenF1 lascia spesso `driver_number` a null nei
      // messaggi dei commissari, il numero auto è nel testo ("CAR 18 ...").
      const num = rc.driver_number ?? carNumberFromMessage(rc.message || "");
      if (num) dnfDrivers.add(num);
    }
  }

  // Ritiri ufficiali da session_result: si sommano a quelli dedotti dai
  // messaggi, non li sostituiscono (una fonte può vedere ciò che l'altra
  // manca).
  for (const num of snap.retiredDrivers ?? []) dnfDrivers.add(num);

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
  includeMissingDnf: boolean,
): DriverResult[] {
  // Penalità live da race_control (stesso rilevamento del post-gara):
  // legge il numero auto dal testo del messaggio. Rilevante solo in gara.
  const penalizedDrivers = withGrid ? extractPenalizedDrivers(snap.raceControl) : new Set<number>();

  const results: DriverResult[] = [];
  for (const [driverNum, posData] of snap.positions) {
    const dr: DriverResult = {
      driver_number: driverNum,
      position: posData.position,
      dnf: events.dnfDrivers.has(driverNum),
      fastest_lap: snap.fastestLap?.driver_number === driverNum,
      driver_of_the_day: false,
      penalty: penalizedDrivers.has(driverNum),
    };
    if (withGrid) dr.grid_position = gridPositions.get(driverNum);
    results.push(dr);
  }

  // Un pilota ritirato può NON comparire in `positions`: il feed `v1/position`
  // smette di emettere per quella macchina, quindi chi si collega dopo il
  // ritiro (o chi resta senza lo snapshot REST iniziale) non lo vede mai.
  // Senza una riga nei risultati `calcolaPuntiPilotaBase` non trova nulla e il
  // malus sparisce in silenzio: il pilota vale 0 invece di −10, mentre
  // `total_dnf` lo conta comunque. Aggiungiamo la riga mancante.
  // Solo per gara e sprint, le uniche sessioni dove il ritiro ha un malus.
  if (includeMissingDnf) {
    let nextPos = snap.positions.size;
    for (const driverNum of events.dnfDrivers) {
      if (snap.positions.has(driverNum)) continue;
      // La posizione è irrilevante: con `dnf: true` né calcolaGara né
      // calcolaSprint la usano (niente punti posizione, niente delta griglia).
      const dr: DriverResult = {
        driver_number: driverNum,
        position: ++nextPos,
        dnf: true,
        fastest_lap: false,
        driver_of_the_day: false,
        penalty: penalizedDrivers.has(driverNum),
      };
      if (withGrid) dr.grid_position = gridPositions.get(driverNum);
      results.push(dr);
    }
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

  const liveResults = buildLiveDriverResults(
    snap,
    events,
    gridPositions,
    isMainRace,
    isMainRace || kind === "sprint",
  );

  // Pole = chi parte 1° in griglia. Se non ci viene passato esplicitamente,
  // lo deduciamo dalla griglia di partenza (disponibile live in gara). Così la
  // previsione "Pole vince" si valuta in tempo reale: pole_won = pole è ora P1.
  let poleDriver: number | null = qualifyingPole ?? null;
  if (poleDriver == null) {
    for (const [drv, gp] of gridPositions) {
      if (gp === 1) { poleDriver = drv; break; }
    }
  }
  const poleWon = isMainRace && poleDriver != null
    ? snap.positions.get(poleDriver)?.position === 1
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

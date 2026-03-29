import {
  PUNTI_QUALIFICA,
  PUNTI_GARA,
  PUNTI_SPRINT,
  PUNTI_SPRINT_SHOOTOUT,
  PREVISIONI_PUNTI,
  type Previsioni,
} from "./types";

// ─── Risultati di una sessione ───

export interface DriverResult {
  driver_number: number;
  position: number;
  grid_position?: number; // solo per gara
  dnf?: boolean;
  fastest_lap?: boolean;
  driver_of_the_day?: boolean;
  penalty?: boolean;
}

export interface RaceWeekendResults {
  qualifying: DriverResult[];
  race: DriverResult[];
  sprint_shootout?: DriverResult[];
  sprint?: DriverResult[];
  events: {
    safety_car: boolean;
    virtual_safety_car: boolean;
    red_flag: boolean;
    wet_tyres: boolean;
    pole_won: boolean;
    total_dnf: number;
  };
}

// ─── Configurazione chip piloti ───

export interface ChipPilotiConfig {
  chipPiloti: string | null;       // "boost" | "halo" | "scudo" | "sesto" | "wildcard" | null
  chipPilotiTarget: number | null; // driver_number target per boost
  sestoUomo: number | null;        // driver_number del 6° pilota
}

// ─── Configurazione chip previsioni ───

export interface ChipPrevisioniConfig {
  chipAttivo: string | null;  // "sicura" | "doppia" | "tardiva" | null
  chipTarget: string | null;  // key della previsione target (es. "safetyCar")
}

// ─── Calcolo punteggio qualifica ───

export function calcolaQualifica(position: number, nc = false): number {
  if (nc) return -5;
  return PUNTI_QUALIFICA[position] ?? -1;
}

// ─── Calcolo punteggio sprint shootout ───

export function calcolaSprintShootout(position: number, nc = false): number {
  if (nc) return -3;
  return PUNTI_SPRINT_SHOOTOUT[position] ?? -1;
}

// ─── Calcolo punteggio sprint ───

export function calcolaSprint(result: DriverResult): number {
  if (result.dnf) return -5;
  let punti = PUNTI_SPRINT[result.position] ?? 0;
  if (result.fastest_lap) punti += 2;
  return punti;
}

// ─── Calcolo punteggio gara ───

export function calcolaGara(result: DriverResult): number {
  let punti = 0;

  if (result.dnf) {
    punti -= 10;
  } else {
    punti += PUNTI_GARA[result.position] ?? 0;

    // Posizioni guadagnate/perse vs griglia
    if (result.grid_position) {
      const diff = result.grid_position - result.position;
      if (diff > 0) {
        punti += diff * 1; // +1 per posizione guadagnata
      } else if (diff < 0) {
        punti += diff * 1; // -1 per posizione persa
      }
    }
  }

  if (result.fastest_lap) punti += 3;
  if (result.driver_of_the_day) punti += 5;
  if (result.penalty) punti -= 5;

  return punti;
}

// ─── Breakdown punteggio pilota ───

export interface ScoreBreakdown {
  items: { label: string; value: number }[];
  baseTotal: number;
  moltiplicatore: number;
  finalTotal: number;
}

export function getScoreBreakdown(
  result: DriverResult,
  sessionType: "qualifying" | "sprint_shootout" | "sprint" | "race",
  isPrimoPilota: boolean,
  chipPiloti: string | null,
): ScoreBreakdown {
  const items: { label: string; value: number }[] = [];
  let baseTotal = 0;

  if (sessionType === "qualifying") {
    if (result.dnf) {
      items.push({ label: "NC/DSQ", value: -5 });
      baseTotal = -5;
    } else {
      const pts = PUNTI_QUALIFICA[result.position] ?? -1;
      items.push({ label: `Posizione (P${result.position})`, value: pts });
      baseTotal = pts;
    }
  } else if (sessionType === "sprint_shootout") {
    if (result.dnf) {
      items.push({ label: "NC", value: -3 });
      baseTotal = -3;
    } else {
      const pts = PUNTI_SPRINT_SHOOTOUT[result.position] ?? -1;
      items.push({ label: `Posizione (P${result.position})`, value: pts });
      baseTotal = pts;
    }
  } else if (sessionType === "sprint") {
    if (result.dnf) {
      items.push({ label: "DNF Sprint", value: -5 });
      baseTotal = -5;
    } else {
      const pts = PUNTI_SPRINT[result.position] ?? 0;
      items.push({ label: `Posizione (P${result.position})`, value: pts });
      baseTotal = pts;
    }
    if (result.fastest_lap) {
      items.push({ label: "Giro veloce", value: 2 });
      baseTotal += 2;
    }
  } else if (sessionType === "race") {
    if (result.dnf) {
      items.push({ label: "DNF/Ritiro", value: -10 });
      baseTotal = -10;
    } else {
      const pts = PUNTI_GARA[result.position] ?? 0;
      items.push({ label: `Posizione (P${result.position})`, value: pts });
      baseTotal = pts;

      if (result.grid_position) {
        const diff = result.grid_position - result.position;
        if (diff > 0) {
          items.push({ label: `Pos. guadagnate (+${diff})`, value: diff });
          baseTotal += diff;
        } else if (diff < 0) {
          items.push({ label: `Pos. perse (${diff})`, value: diff });
          baseTotal += diff;
        }
      }
    }
    if (result.fastest_lap) {
      items.push({ label: "Giro veloce", value: 3 });
      baseTotal += 3;
    }
    if (result.driver_of_the_day) {
      items.push({ label: "Driver of the Day", value: 5 });
      baseTotal += 5;
    }
    if (result.penalty) {
      items.push({ label: "Penalità", value: -5 });
      baseTotal -= 5;
    }
  }

  // Moltiplicatore
  const isBoosted = chipPiloti === "boost";
  let moltiplicatore = 1;
  if (isPrimoPilota) moltiplicatore = 2;
  if (isBoosted) moltiplicatore = 3;

  let finalTotal: number;
  if (isPrimoPilota && chipPiloti === "scudo") {
    finalTotal = baseTotal > 0 ? baseTotal * 2 : baseTotal;
  } else {
    finalTotal = baseTotal * moltiplicatore;
  }
  if (chipPiloti === "halo" && finalTotal < 0) finalTotal = 0;

  return { items, baseTotal, moltiplicatore, finalTotal };
}

// ─── Calcolo punteggio totale pilota nel weekend ───

function calcolaPuntiPilotaBase(
  driverNumber: number,
  results: RaceWeekendResults
): number {
  let punti = 0;

  const qualResult = results.qualifying.find((r) => r.driver_number === driverNumber);
  if (qualResult) punti += calcolaQualifica(qualResult.position, qualResult.dnf);

  if (results.sprint_shootout) {
    const ssResult = results.sprint_shootout.find((r) => r.driver_number === driverNumber);
    if (ssResult) punti += calcolaSprintShootout(ssResult.position, ssResult.dnf);
  }

  if (results.sprint) {
    const sprintResult = results.sprint.find((r) => r.driver_number === driverNumber);
    if (sprintResult) punti += calcolaSprint(sprintResult);
  }

  const raceResult = results.race.find((r) => r.driver_number === driverNumber);
  if (raceResult) punti += calcolaGara(raceResult);

  return punti;
}

// ─── Calcolo punteggio previsioni ───

export function calcolaPuntiPrevisioni(
  previsioni: Previsioni,
  events: RaceWeekendResults["events"],
  chipPrevisioni?: ChipPrevisioniConfig
): { total: number; dettaglio: Record<string, number> } {
  const dettaglio: Record<string, number> = {};
  let total = 0;

  const prevKeys: { key: keyof Omit<Previsioni, "numeroDnf">; eventKey: keyof typeof events; punti: { si: number; no: number } }[] = [
    { key: "safetyCar", eventKey: "safety_car", punti: PREVISIONI_PUNTI.safetyCar },
    { key: "virtualSafetyCar", eventKey: "virtual_safety_car", punti: PREVISIONI_PUNTI.virtualSafetyCar },
    { key: "redFlag", eventKey: "red_flag", punti: PREVISIONI_PUNTI.redFlag },
    { key: "gommeWet", eventKey: "wet_tyres", punti: PREVISIONI_PUNTI.gommeWet },
    { key: "poleVince", eventKey: "pole_won", punti: PREVISIONI_PUNTI.poleVince },
  ];

  for (const p of prevKeys) {
    const valore = previsioni[p.key];
    if (valore === null) {
      dettaglio[p.key] = 0;
      continue;
    }

    const corretto = valore === (events[p.eventKey] as boolean);
    let pts = corretto ? (valore ? p.punti.si : p.punti.no) : 0;

    // Chip: Previsione Sicura — vale comunque
    if (chipPrevisioni?.chipAttivo === "sicura" && chipPrevisioni.chipTarget === p.key && !corretto) {
      pts = valore ? p.punti.si : p.punti.no;
    }

    // Chip: Previsione Doppia — punti x2
    if (chipPrevisioni?.chipAttivo === "doppia" && chipPrevisioni.chipTarget === p.key) {
      pts *= 2;
    }

    dettaglio[p.key] = pts;
    total += pts;
  }

  // Numero DNF
  if (previsioni.numeroDnf !== null) {
    let pts = previsioni.numeroDnf === events.total_dnf ? PREVISIONI_PUNTI.numeroDnf.esatto : 0;

    if (chipPrevisioni?.chipAttivo === "sicura" && chipPrevisioni.chipTarget === "numeroDnf" && pts === 0) {
      pts = PREVISIONI_PUNTI.numeroDnf.esatto;
    }
    if (chipPrevisioni?.chipAttivo === "doppia" && chipPrevisioni.chipTarget === "numeroDnf") {
      pts *= 2;
    }

    dettaglio.numeroDnf = pts;
    total += pts;
  } else {
    dettaglio.numeroDnf = 0;
  }

  return { total, dettaglio };
}

// ─── Punteggio totale weekend di un giocatore ───

export interface PilotaDettaglio {
  driver_number: number;
  puntiBase: number;
  moltiplicatore: number; // 1, 2 (primo pilota), o 3 (boost)
  puntiFinali: number;
  haloApplicato: boolean;
  isSestoUomo: boolean;
}

export function calcolaPuntiWeekend(
  driverNumbers: number[],
  primoPilota: number | null,
  previsioni: Previsioni,
  results: RaceWeekendResults,
  chipPiloti?: ChipPilotiConfig,
  chipPrevisioni?: ChipPrevisioniConfig
): {
  pilotiPoints: number;
  previsioniPoints: number;
  total: number;
  pilotiDettaglio: PilotaDettaglio[];
  previsioniDettaglio: Record<string, number>;
} {
  // Lista piloti da valutare (5 base + eventuale sesto uomo)
  const allDrivers = [...driverNumbers];
  if (chipPiloti?.chipPiloti === "sesto" && chipPiloti.sestoUomo && !allDrivers.includes(chipPiloti.sestoUomo)) {
    allDrivers.push(chipPiloti.sestoUomo);
  }

  const pilotiDettaglio: PilotaDettaglio[] = allDrivers.map((num) => {
    const puntiBase = calcolaPuntiPilotaBase(num, results);
    const isPrimo = num === primoPilota;
    const isBoosted = chipPiloti?.chipPiloti === "boost" && chipPiloti.chipPilotiTarget === num && !isPrimo;
    const isSestoUomo = chipPiloti?.chipPiloti === "sesto" && chipPiloti.sestoUomo === num;

    let moltiplicatore = 1;
    if (isPrimo) moltiplicatore = 2;
    if (isBoosted) moltiplicatore = 3;

    let puntiFinali: number;

    // Chip: Scudo Capitano — Primo Pilota x2 solo bonus, malus x1
    if (isPrimo && chipPiloti?.chipPiloti === "scudo") {
      puntiFinali = puntiBase > 0 ? puntiBase * 2 : puntiBase;
    } else {
      puntiFinali = puntiBase * moltiplicatore;
    }

    // Chip: Halo — minimo 0 punti se negativo
    let haloApplicato = false;
    if (chipPiloti?.chipPiloti === "halo" && puntiFinali < 0) {
      puntiFinali = 0;
      haloApplicato = true;
    }

    return { driver_number: num, puntiBase, moltiplicatore, puntiFinali, haloApplicato, isSestoUomo };
  });

  const pilotiPoints = pilotiDettaglio.reduce((sum, d) => sum + d.puntiFinali, 0);

  // Punti previsioni (con chip)
  const prev = calcolaPuntiPrevisioni(previsioni, results.events, chipPrevisioni);

  // Bonus All-in Previsioni: tutte e 6 giuste
  // (per ora segnaposto, punteggio da definire)
  const tutteGiuste = Object.values(prev.dettaglio).every((pts) => pts > 0);
  const bonusAllIn = tutteGiuste ? 0 : 0; // TODO: definire punteggio bonus

  return {
    pilotiPoints,
    previsioniPoints: prev.total + bonusAllIn,
    total: pilotiPoints + prev.total + bonusAllIn,
    pilotiDettaglio,
    previsioniDettaglio: prev.dettaglio,
  };
}

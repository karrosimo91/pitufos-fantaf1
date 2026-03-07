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
  let punti = 0;

  if (result.dnf) return -10;

  punti += PUNTI_SPRINT[result.position] ?? 0;
  if (result.fastest_lap) punti += 2;

  return punti;
}

// ─── Calcolo punteggio gara ───

export function calcolaGara(result: DriverResult): number {
  let punti = 0;

  if (result.dnf) {
    punti -= 15;
  } else {
    punti += PUNTI_GARA[result.position] ?? 0;

    // Posizioni guadagnate/perse vs griglia
    if (result.grid_position) {
      const diff = result.grid_position - result.position;
      if (diff > 0) {
        punti += diff * 1; // +1 per posizione guadagnata
      } else if (diff < 0) {
        punti += diff * 0.5; // -0.5 per posizione persa
      }
    }
  }

  if (result.fastest_lap) punti += 3;
  if (result.driver_of_the_day) punti += 5;
  if (result.penalty) punti -= 5;

  return punti;
}

// ─── Calcolo punteggio totale pilota nel weekend ───

export function calcolaPuntiPilotaWeekend(
  driverNumber: number,
  results: RaceWeekendResults,
  isPrimoPilota: boolean
): number {
  let punti = 0;

  // Qualifica
  const qualResult = results.qualifying.find((r) => r.driver_number === driverNumber);
  if (qualResult) {
    punti += calcolaQualifica(qualResult.position, qualResult.dnf);
  }

  // Sprint shootout (se presente)
  if (results.sprint_shootout) {
    const ssResult = results.sprint_shootout.find((r) => r.driver_number === driverNumber);
    if (ssResult) {
      punti += calcolaSprintShootout(ssResult.position, ssResult.dnf);
    }
  }

  // Sprint (se presente)
  if (results.sprint) {
    const sprintResult = results.sprint.find((r) => r.driver_number === driverNumber);
    if (sprintResult) {
      punti += calcolaSprint(sprintResult);
    }
  }

  // Gara
  const raceResult = results.race.find((r) => r.driver_number === driverNumber);
  if (raceResult) {
    punti += calcolaGara(raceResult);
  }

  // Primo Pilota: x2
  if (isPrimoPilota) {
    punti *= 2;
  }

  return punti;
}

// ─── Calcolo punteggio previsioni ───

export function calcolaPuntiPrevisioni(
  previsioni: Previsioni,
  events: RaceWeekendResults["events"]
): { total: number; dettaglio: Record<string, number> } {
  const dettaglio: Record<string, number> = {};
  let total = 0;

  // Safety Car
  if (previsioni.safetyCar !== null) {
    const corretto = previsioni.safetyCar === events.safety_car;
    const pts = corretto
      ? previsioni.safetyCar
        ? PREVISIONI_PUNTI.safetyCar.si
        : PREVISIONI_PUNTI.safetyCar.no
      : 0;
    dettaglio.safetyCar = pts;
    total += pts;
  }

  // VSC
  if (previsioni.virtualSafetyCar !== null) {
    const corretto = previsioni.virtualSafetyCar === events.virtual_safety_car;
    const pts = corretto
      ? previsioni.virtualSafetyCar
        ? PREVISIONI_PUNTI.virtualSafetyCar.si
        : PREVISIONI_PUNTI.virtualSafetyCar.no
      : 0;
    dettaglio.virtualSafetyCar = pts;
    total += pts;
  }

  // Red Flag
  if (previsioni.redFlag !== null) {
    const corretto = previsioni.redFlag === events.red_flag;
    const pts = corretto
      ? previsioni.redFlag
        ? PREVISIONI_PUNTI.redFlag.si
        : PREVISIONI_PUNTI.redFlag.no
      : 0;
    dettaglio.redFlag = pts;
    total += pts;
  }

  // Gomme Wet
  if (previsioni.gommeWet !== null) {
    const corretto = previsioni.gommeWet === events.wet_tyres;
    const pts = corretto
      ? previsioni.gommeWet
        ? PREVISIONI_PUNTI.gommeWet.si
        : PREVISIONI_PUNTI.gommeWet.no
      : 0;
    dettaglio.gommeWet = pts;
    total += pts;
  }

  // Pole vince
  if (previsioni.poleVince !== null) {
    const corretto = previsioni.poleVince === events.pole_won;
    const pts = corretto
      ? previsioni.poleVince
        ? PREVISIONI_PUNTI.poleVince.si
        : PREVISIONI_PUNTI.poleVince.no
      : 0;
    dettaglio.poleVince = pts;
    total += pts;
  }

  // Numero DNF
  if (previsioni.numeroDnf !== null) {
    const pts = previsioni.numeroDnf === events.total_dnf ? PREVISIONI_PUNTI.numeroDnf.esatto : 0;
    dettaglio.numeroDnf = pts;
    total += pts;
  }

  return { total, dettaglio };
}

// ─── Punteggio totale weekend di un giocatore ───

export function calcolaPuntiWeekend(
  driverNumbers: number[],
  primoPilota: number | null,
  previsioni: Previsioni,
  results: RaceWeekendResults
): {
  pilotiPoints: number;
  previsioniPoints: number;
  total: number;
  pilotiDettaglio: { driver_number: number; points: number }[];
  previsioniDettaglio: Record<string, number>;
} {
  // Punti piloti
  const pilotiDettaglio = driverNumbers.map((num) => ({
    driver_number: num,
    points: calcolaPuntiPilotaWeekend(num, results, num === primoPilota),
  }));
  const pilotiPoints = pilotiDettaglio.reduce((sum, d) => sum + d.points, 0);

  // Punti previsioni
  const prev = calcolaPuntiPrevisioni(previsioni, results.events);

  return {
    pilotiPoints,
    previsioniPoints: prev.total,
    total: pilotiPoints + prev.total,
    pilotiDettaglio,
    previsioniDettaglio: prev.dettaglio,
  };
}

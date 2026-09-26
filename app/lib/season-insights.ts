// Derivazioni pure dai risultati ufficiali di stagione: forma dei piloti,
// frequenza degli eventi per le previsioni, chi ha corso l'ultimo GP.
// Nessun fetch qui: testabile.

import { calcolaPuntiPilotaBase, type RaceWeekendResults } from "./scoring";
import type { Previsioni } from "./types";

export interface RoundResults {
  round: number;
  data: RaceWeekendResults;
}

/** Punti base (senza capitano/chip) di un pilota in ogni round in archivio, dal più recente. */
export function driverFormByRound(rows: RoundResults[], driverNumber: number): { round: number; points: number; raced: boolean }[] {
  return rows
    .filter((r) => hasAnySession(r.data))
    .map((r) => ({
      round: r.round,
      points: calcolaPuntiPilotaBase(driverNumber, r.data),
      raced: driverRaced(r.data, driverNumber),
    }))
    .sort((a, b) => b.round - a.round);
}

export function hasAnySession(d: RaceWeekendResults): boolean {
  return (d.qualifying?.length ?? 0) > 0 || (d.race?.length ?? 0) > 0 || (d.sprint?.length ?? 0) > 0 || (d.sprint_shootout?.length ?? 0) > 0;
}

/** Il pilota compare in almeno una sessione del weekend (e non è "dns" ovunque). */
export function driverRaced(d: RaceWeekendResults, driverNumber: number): boolean {
  const sessions = [d.qualifying, d.sprint_shootout, d.sprint, d.race];
  let seen = false;
  for (const s of sessions) {
    const r = s?.find((x) => x.driver_number === driverNumber);
    if (!r) continue;
    if (!r.dns) return true;
    seen = true;
  }
  return seen ? false : false;
}

/** Ultimo round in archivio con almeno una sessione, e i piloti che vi hanno corso. */
export function lastRacedRound(rows: RoundResults[]): { round: number; drivers: Set<number> } | null {
  const withData = rows.filter((r) => hasAnySession(r.data)).sort((a, b) => b.round - a.round);
  if (withData.length === 0) return null;
  const top = withData[0];
  const drivers = new Set<number>();
  for (const s of [top.data.qualifying, top.data.sprint_shootout, top.data.sprint, top.data.race]) {
    for (const r of s ?? []) if (!r.dns) drivers.add(r.driver_number);
  }
  return { round: top.round, drivers };
}

export type PrevisioneKey = keyof Omit<Previsioni, "numeroDnf">;

const EVENT_KEY: Record<PrevisioneKey, keyof RaceWeekendResults["events"]> = {
  safetyCar: "safety_car",
  virtualSafetyCar: "virtual_safety_car",
  redFlag: "red_flag",
  gommeWet: "wet_tyres",
  poleVince: "pole_won",
};

export interface EventStats {
  /** Gare in archivio con la gara calcolata */
  races: number;
  /** Quante volte l'evento è successo */
  happened: Record<PrevisioneKey, number>;
  /** Esito dell'ultima gara in archivio */
  last: { round: number; events: RaceWeekendResults["events"] } | null;
  /** Media ritiri per gara (una cifra decimale) e distribuzione */
  dnfAvg: number | null;
  dnfCounts: Map<number, number>;
}

/** Frequenza degli eventi previsione sulle gare già calcolate. */
export function computeEventStats(rows: RoundResults[]): EventStats {
  const raced = rows.filter((r) => (r.data.race?.length ?? 0) > 0).sort((a, b) => a.round - b.round);
  const happened: Record<PrevisioneKey, number> = { safetyCar: 0, virtualSafetyCar: 0, redFlag: 0, gommeWet: 0, poleVince: 0 };
  const dnfCounts = new Map<number, number>();
  let dnfSum = 0;
  for (const r of raced) {
    for (const k of Object.keys(EVENT_KEY) as PrevisioneKey[]) {
      if (r.data.events[EVENT_KEY[k]] === true) happened[k] += 1;
    }
    const n = r.data.events.total_dnf ?? 0;
    dnfSum += n;
    dnfCounts.set(n, (dnfCounts.get(n) ?? 0) + 1);
  }
  const last = raced.length > 0 ? { round: raced[raced.length - 1].round, events: raced[raced.length - 1].data.events } : null;
  return {
    races: raced.length,
    happened,
    last,
    dnfAvg: raced.length > 0 ? Math.round((dnfSum / raced.length) * 10) / 10 : null,
    dnfCounts,
  };
}

export function eventKeyOf(k: PrevisioneKey): keyof RaceWeekendResults["events"] {
  return EVENT_KEY[k];
}

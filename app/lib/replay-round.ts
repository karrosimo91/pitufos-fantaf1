// Replay di una gara: l'andamento della classifica dei giocatori giro per giro.
//
// Perché esiste: durante la gara il live calcola i punti nel browser e non
// conserva niente nel tempo (`provisional_weekend` tiene solo l'ultimo stato).
// OpenF1 però pubblica gli stream storici completi di ogni sessione, tutti con
// un orario: `position`, `race_control`, `laps`, `stints`. Filtrandoli a un
// istante t e passandoli alle stesse funzioni del live (`detectLiveEvents` →
// `buildLiveWeekendResults` → `computePlayerScoresFrom`) si ottiene la
// classifica che il live avrebbe mostrato in quel momento. Un fotogramma per
// giro, e il video è fatto.
//
// Approssimazioni note (le stesse del live, più una):
//   - il momento del ritiro: `session_result` dice chi si è ritirato ma non
//     quando; lo si colloca alla fine dell'ultimo giro registrato per quel
//     pilota (al massimo un giro di scarto). I ritiri annunciati da
//     race_control hanno invece l'orario esatto;
//   - Driver of the Day, penalità post-gara e override manuali entrano solo
//     nel calcolo ufficiale: il fotogramma finale del replay può non
//     coincidere con `weekend_scores`, che va mostrato a parte;
//   - le gomme wet si leggono dagli stint per giro (`lap_start`), non per
//     orario: OpenF1 non dà un orario agli stint.

import type { RaceWeekendResults, DriverResult } from "./scoring";
import type { LivePosition, LiveRaceControl, LiveStint } from "./use-live-ws";
import { detectLiveEvents, buildLiveWeekendResults, type LiveSnapshot } from "./build-live-results";
import { computePlayerScoresFrom, type RoundScoringInputs } from "./score-round";
import type { OfficialRow } from "./official-results";

// ─── Dati grezzi OpenF1 (già scaricati per la sessione gara) ───

export interface RawLap {
  driver_number?: number | null;
  lap_number?: number | null;
  date_start?: string | null;
  lap_duration?: number | null;
}

export interface RawStint {
  driver_number?: number | null;
  compound?: string | null;
  lap_start?: number | null;
  lap_end?: number | null;
}

export interface ReplayRawData {
  positions: { driver_number?: number | null; position?: number | null; date?: string | null }[];
  raceControl: LiveRaceControl[];
  laps: RawLap[];
  stints: RawStint[];
  /** `session_result` finale: serve solo per i flag dnf/dsq/dns */
  sessionResult: OfficialRow[];
}

export interface ReplayInputs {
  raw: ReplayRawData;
  /** driver_number → casella di partenza */
  grid: Map<number, number>;
  /** Sessioni precedenti del weekend già in archivio (qualifica, sprint) */
  previousResults: RaceWeekendResults | null;
  scoring: RoundScoringInputs;
  /** Piloti rimossi dal weekend (0 punti, non contano nei ritiri) */
  forzaMaggiore?: Set<number>;
}

// ─── Fotogrammi ───

export interface ReplayPlayer {
  user_id: string;
  name: string;
  scuderia: string;
  rank: number;
  points: number;
  piloti: number;
  previsioni: number;
  penalita: number;
  primo_pilota: number | null;
}

export interface ReplayDriver {
  number: number;
  position: number;
  dnf: boolean;
}

export interface ReplayFrame {
  /** 0 = prima del via (solo sessioni precedenti), poi 1..total_laps */
  lap: number;
  /** Istante del fotogramma (ISO); l'ultimo usa tutti i dati della sessione */
  at: string | null;
  label: string;
  events: RaceWeekendResults["events"];
  drivers: ReplayDriver[];
  players: ReplayPlayer[];
}

export interface ReplayResult {
  total_laps: number;
  frames: ReplayFrame[];
}

const ms = (iso: string | null | undefined): number => {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
};

/**
 * Orario di ogni fotogramma. Il giro N "finisce" quando il leader inizia il
 * giro N+1 (il primo `date_start` registrato per quel giro). L'ultimo giro
 * usa tutti i dati della sessione: comprende anche i messaggi dei commissari
 * arrivati dopo la bandiera a scacchi.
 */
export function buildFrameTimes(laps: RawLap[]): { totalLaps: number; times: number[] } {
  const lapStart = new Map<number, number>();
  let totalLaps = 0;
  for (const l of laps ?? []) {
    const n = l.lap_number ?? 0;
    const t = ms(l.date_start);
    if (!n || n < 1 || !Number.isFinite(t)) continue;
    totalLaps = Math.max(totalLaps, n);
    const prev = lapStart.get(n);
    if (prev === undefined || t < prev) lapStart.set(n, t);
  }
  if (totalLaps === 0) return { totalLaps: 0, times: [Infinity] };

  const times: number[] = [];
  const start = lapStart.get(1);
  times.push(start !== undefined ? start - 1 : -Infinity);
  for (let n = 1; n <= totalLaps; n++) {
    if (n === totalLaps) { times.push(Infinity); break; }
    const next = lapStart.get(n + 1);
    // Giro senza orario (buco nei dati): si tiene l'istante del giro prima.
    times.push(next !== undefined ? next : times[times.length - 1]);
  }
  return { totalLaps, times };
}

/**
 * Istante in cui ogni ritirato "sparisce": fine dell'ultimo giro registrato.
 * Chi non ha giri (non partito) è ritirato dal via.
 */
export function retirementTimes(sessionResult: OfficialRow[], laps: RawLap[], forzaMaggiore: Set<number>): Map<number, number> {
  const lastLapEnd = new Map<number, { lap: number; end: number }>();
  for (const l of laps ?? []) {
    const d = l.driver_number ?? 0;
    const n = l.lap_number ?? 0;
    const t = ms(l.date_start);
    if (!d || !n || !Number.isFinite(t)) continue;
    const end = t + Math.max(0, l.lap_duration ?? 0) * 1000;
    const prev = lastLapEnd.get(d);
    if (!prev || n > prev.lap) lastLapEnd.set(d, { lap: n, end });
  }
  const out = new Map<number, number>();
  for (const r of sessionResult ?? []) {
    const d = r.driver_number ?? 0;
    if (!d || forzaMaggiore.has(d)) continue;
    if (!(r.dnf || r.dsq || r.dns)) continue;
    out.set(d, lastLapEnd.get(d)?.end ?? -Infinity);
  }
  return out;
}

/** Stato della sessione all'istante t, nella forma che il live si aspetta. */
export function snapshotAt(
  raw: ReplayRawData,
  t: number,
  lap: number,
  retiredAt: Map<number, number>,
  forzaMaggiore: Set<number>,
): LiveSnapshot {
  const positions = new Map<number, LivePosition>();
  const lastDate = new Map<number, number>();
  for (const p of raw.positions ?? []) {
    const d = p.driver_number ?? 0;
    const pos = p.position ?? 0;
    const time = ms(p.date);
    if (!d || !pos || !Number.isFinite(time) || time > t || forzaMaggiore.has(d)) continue;
    const prev = lastDate.get(d);
    if (prev === undefined || time >= prev) {
      lastDate.set(d, time);
      positions.set(d, { driver_number: d, position: pos, date: p.date as string });
    }
  }

  const raceControl = (raw.raceControl ?? []).filter((rc) => {
    const time = ms(rc.date);
    return Number.isFinite(time) && time <= t;
  });

  let fastestLap: LiveSnapshot["fastestLap"] = null;
  for (const l of raw.laps ?? []) {
    const d = l.driver_number ?? 0;
    const dur = l.lap_duration ?? 0;
    const start = ms(l.date_start);
    if (!d || dur <= 0 || !Number.isFinite(start) || start + dur * 1000 > t) continue;
    if (!fastestLap || dur < fastestLap.duration) fastestLap = { driver_number: d, duration: dur };
  }

  const stints: LiveStint[] = (raw.stints ?? [])
    .filter((s) => (s.lap_start ?? 1) <= lap && lap > 0 && !!s.driver_number)
    .map((s) => ({ driver_number: s.driver_number as number, compound: s.compound ?? "", date: "" }));

  const retiredDrivers = new Set<number>();
  for (const [d, when] of retiredAt) if (when <= t) retiredDrivers.add(d);

  return { positions, raceControl, fastestLap, stints, retiredDrivers };
}

/** Forza maggiore: riga a 0 punti (dns), fuori dal conteggio ritiri. */
function applyForzaMaggiore(results: RaceWeekendResults, forzaMaggiore: Set<number>): RaceWeekendResults {
  if (forzaMaggiore.size === 0) return results;
  const race: DriverResult[] = results.race
    .filter((r) => !forzaMaggiore.has(r.driver_number))
    .map((r) => ({ ...r }));
  let next = race.length;
  for (const d of forzaMaggiore) {
    race.push({ driver_number: d, position: ++next, dnf: false, dns: true });
  }
  return {
    ...results,
    race,
    events: { ...results.events, total_dnf: race.filter((r) => r.dnf).length },
  };
}

function toPlayers(inputs: RoundScoringInputs, results: RaceWeekendResults, countPrevisioni: boolean): ReplayPlayer[] {
  const scores = computePlayerScoresFrom(inputs, results, countPrevisioni);
  return scores.map((s, i) => {
    const f = inputs.formazioni.find((x) => x.user_id === s.user_id);
    return {
      user_id: s.user_id,
      name: s.name,
      scuderia: s.scuderia,
      rank: i + 1,
      points: s.weekend_points,
      piloti: s.piloti_points,
      previsioni: s.previsioni_points,
      penalita: s.penalita_cambi,
      primo_pilota: f?.primo_pilota ?? null,
    };
  });
}

/**
 * Costruisce i fotogrammi: 0 (prima del via: sessioni precedenti, niente
 * previsioni) e poi uno per giro fino alla bandiera a scacchi.
 */
export function buildReplay(input: ReplayInputs): ReplayResult {
  const fm = input.forzaMaggiore ?? new Set<number>();
  const { totalLaps, times } = buildFrameTimes(input.raw.laps);
  const retiredAt = retirementTimes(input.raw.sessionResult, input.raw.laps, fm);

  const frames: ReplayFrame[] = [];

  // Fotogramma 0: la classifica "dopo la qualifica" (sessioni precedenti del
  // weekend, niente previsioni), con lo schieramento in griglia. Il live al
  // giro di formazione mostra già i punti della posizione in griglia come se
  // fosse l'arrivo: per un replay è solo rumore.
  const emptyEvents: RaceWeekendResults["events"] = {
    safety_car: false, virtual_safety_car: false, red_flag: false, wet_tyres: false, pole_won: false, total_dnf: 0,
  };
  const before: RaceWeekendResults = {
    qualifying: input.previousResults?.qualifying ?? [],
    sprint_shootout: input.previousResults?.sprint_shootout,
    sprint: input.previousResults?.sprint,
    race: [],
    events: input.previousResults?.events ?? emptyEvents,
  };
  frames.push({
    lap: 0,
    at: Number.isFinite(times[0]) ? new Date(times[0]).toISOString() : null,
    label: "Griglia di partenza",
    events: emptyEvents,
    drivers: Array.from(input.grid.entries())
      .filter(([d]) => !fm.has(d))
      .map(([number, position]) => ({ number, position, dnf: false }))
      .sort((a, b) => a.position - b.position),
    players: toPlayers(input.scoring, before, false),
  });

  for (let lap = 1; lap < times.length; lap++) {
    const t = times[lap];
    const snap = snapshotAt(input.raw, t, lap, retiredAt, fm);
    const events = detectLiveEvents(snap);
    const results = applyForzaMaggiore(
      buildLiveWeekendResults("Race", snap, events, input.grid, input.previousResults),
      fm,
    );
    const drivers: ReplayDriver[] = results.race
      .filter((r) => !r.dns)
      .map((r) => ({ number: r.driver_number, position: r.position, dnf: !!r.dnf }))
      .sort((a, b) => (a.dnf === b.dnf ? a.position - b.position : a.dnf ? 1 : -1));

    const isFinal = lap === times.length - 1;
    frames.push({
      lap,
      at: Number.isFinite(t) ? new Date(t).toISOString() : null,
      label: isFinal ? "Bandiera a scacchi" : `Giro ${lap}/${totalLaps}`,
      events: results.events,
      drivers,
      players: toPlayers(input.scoring, results, true),
    });
  }
  return { total_laps: totalLaps, frames };
}

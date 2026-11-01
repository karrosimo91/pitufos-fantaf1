// Ritiri dedotti dai giri: una macchina che smette di chiudere giri mentre
// gli altri continuano è ferma.
//
// Perché serve: i ritiri live arrivano da due fonti OpenF1 che durante la
// gara possono tacere entrambe. `race_control` non annuncia quasi mai una
// macchina che si ferma, e `session_result` (via /api/live-retired) non
// garantisce i flag dnf durante la sessione: senza una terza fonte il
// ritirato restava in classifica nella sua ultima posizione, senza −10 e
// fuori dal conteggio "Numero DNF".
//
// La regola usa solo tempi relativi fra macchine (nessun orologio locale),
// quindi regge bandiera rossa (si fermano tutti, nessuno viene segnato) e
// safety car (giri più lenti per tutti, la soglia segue il passo).
// Una macchina che riparte (box lungo per riparazioni) torna in gara da sola
// al giro successivo: è un dato provvisorio, il conteggio ufficiale resta
// quello del post-gara.

export interface LapProgress {
  /** Ultimo giro registrato */
  lap: number;
  /** Istante (ms) più recente visto per la macchina: fine dell'ultimo giro chiuso o inizio dell'ultimo aperto */
  seenAt: number;
  /** Primo istante (ms) visto per la macchina: dice da quanto osserviamo la gara */
  firstSeenAt: number;
  /** Durata (s) dell'ultimo giro chiuso, se nota */
  lastDuration: number | null;
}

export interface RawLapLike {
  driver_number?: number | null;
  lap_number?: number | null;
  date_start?: string | null;
  lap_duration?: number | null;
}

/** Aggiorna (in una copia) l'avanzamento per pilota con nuovi giri. Restituisce null se non cambia nulla. */
export function mergeLapProgress(prev: Map<number, LapProgress>, laps: RawLapLike[]): Map<number, LapProgress> | null {
  let next: Map<number, LapProgress> | null = null;
  for (const l of laps) {
    const d = Number(l.driver_number ?? 0);
    const n = Number(l.lap_number ?? 0);
    if (!d || !n) continue;
    const start = l.date_start ? Date.parse(l.date_start) : NaN;
    const dur = l.lap_duration && l.lap_duration > 0 ? l.lap_duration : null;
    const seen = Number.isFinite(start) ? start + (dur ?? 0) * 1000 : NaN;
    const cur = (next ?? prev).get(d);
    const seenAt = Math.max(cur?.seenAt ?? -Infinity, Number.isFinite(seen) ? seen : -Infinity);
    const firstSeenAt = Math.min(cur?.firstSeenAt ?? Infinity, Number.isFinite(seen) ? seen : Infinity);
    const lap = Math.max(cur?.lap ?? 0, n);
    const lastDuration = cur && n < cur.lap ? cur.lastDuration : (dur ?? cur?.lastDuration ?? null);
    if (cur && cur.lap === lap && cur.seenAt === seenAt && cur.firstSeenAt === firstSeenAt && cur.lastDuration === lastDuration) continue;
    if (!next) next = new Map(prev);
    next.set(d, { lap, seenAt, firstSeenAt, lastDuration });
  }
  return next;
}

const MIN_STOP_MS = 240_000; // mai meno di 4 minuti senza giri
const LAP_FACTOR = 3;        // o 3 giri "tipici" se il passo è più lento
const MIN_LEADER_LAP = 3;    // nei primi giri non si segna nessuno

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Piloti fermi: nessun giro da più di max(4 min, 3 × giro tipico) mentre
 * l'ultima macchina vista è andata avanti. `entrants` sono i piloti in gara
 * (le posizioni): chi ne fa parte e non ha mai un giro registrato è fermo
 * se l'osservazione copre già la soglia (es. ritirato al primo giro), così
 * collegarsi a gara in corso non segna nessuno per errore.
 */
export function detectStoppedDrivers(progress: Map<number, LapProgress>, entrants: Iterable<number>): Set<number> {
  const out = new Set<number>();
  let leaderLap = 0;
  let newest = -Infinity;
  let oldest = Infinity;
  const durations: number[] = [];
  for (const p of progress.values()) {
    leaderLap = Math.max(leaderLap, p.lap);
    if (Number.isFinite(p.seenAt)) newest = Math.max(newest, p.seenAt);
    if (Number.isFinite(p.firstSeenAt)) oldest = Math.min(oldest, p.firstSeenAt);
    if (p.lastDuration) durations.push(p.lastDuration);
  }
  if (leaderLap < MIN_LEADER_LAP || !Number.isFinite(newest)) return out;

  const typical = median(durations);
  const threshold = Math.max(MIN_STOP_MS, typical ? typical * 1000 * LAP_FACTOR : 0);

  // Copertura: da quanto osserviamo la gara. Serve per chi non ha orari
  // (nessun giro, o solo il primo che OpenF1 spesso lascia senza date_start).
  const covered = newest - oldest > threshold;
  for (const [d, p] of progress) {
    if (Number.isFinite(p.seenAt)) {
      if (newest - p.seenAt > threshold) out.add(d);
    } else if (covered && p.lap < leaderLap - 1) {
      out.add(d);
    }
  }
  if (covered) {
    for (const d of entrants) if (!progress.has(d)) out.add(d);
  }
  return out;
}

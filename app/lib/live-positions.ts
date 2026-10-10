// Posizioni live: fusione dei record `position` (REST e MQTT) in una mappa
// pilota → ultima posizione nota. Logica pura, testata a parte dal hook.

export interface LivePositionRow {
  driver_number?: number | null;
  position?: number | null;
  date?: string | null;
}

export interface LivePositionEntry {
  driver_number: number;
  position: number;
  date: string;
}

/** Istante di un record in ms, NaN se la data manca o non si legge. */
export function positionTime(date?: string | null): number {
  if (!date) return NaN;
  return Date.parse(date);
}

/**
 * Un record nuovo sostituisce quello noto? Si confrontano gli istanti, non
 * le stringhe: REST e MQTT non garantiscono lo stesso formato ("+00:00",
 * "Z", con o senza microsecondi) e il confronto lessicografico poteva
 * scartare un aggiornamento vero. Senza data leggibile, o a parità, il
 * nuovo vince: i messaggi arrivano in ordine e tenersi il vecchio è
 * l'errore peggiore (classifica ferma).
 */
export function isNewerPosition(existing: LivePositionEntry | undefined, incoming: LivePositionRow): boolean {
  if (!existing) return true;
  const a = positionTime(existing.date);
  const b = positionTime(incoming.date);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  return b >= a;
}

/**
 * Applica una lista di record alla mappa. Restituisce la STESSA mappa se
 * niente è cambiato (così React non ricalcola), una nuova altrimenti.
 */
export function mergePositions(
  prev: Map<number, LivePositionEntry>,
  rows: LivePositionRow[],
): Map<number, LivePositionEntry> {
  let next: Map<number, LivePositionEntry> | null = null;
  for (const r of rows) {
    const d = r.driver_number ?? 0;
    const pos = r.position ?? 0;
    if (!d || !pos) continue;
    const cur = (next ?? prev).get(d);
    if (!isNewerPosition(cur, r)) continue;
    if (cur && cur.position === pos && cur.date === (r.date ?? "")) continue;
    if (!next) next = new Map(prev);
    next.set(d, { driver_number: d, position: pos, date: r.date ?? "" });
  }
  return next ?? prev;
}

/** Data più recente fra le posizioni note (per chiedere a REST solo il seguito). */
export function latestPositionDate(positions: Map<number, LivePositionEntry>): string | null {
  let best: string | null = null;
  let bestT = -Infinity;
  for (const p of positions.values()) {
    const t = positionTime(p.date);
    if (Number.isFinite(t) && t > bestT) { bestT = t; best = p.date; }
  }
  return best;
}

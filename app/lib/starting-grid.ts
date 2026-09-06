// Griglia di partenza reale: da dove prendere il riferimento per il calcolo
// delle posizioni guadagnate/perse.
//
// Perché serve: la posizione di qualifica NON è la posizione di partenza.
// Le penalità in griglia (cambio motore/cambio, impeding, ecc.) arretrano il
// pilota dopo la qualifica. Il regolamento assegna +1/-1 per posizione
// "guadagnata/persa vs griglia", quindi il delta va calcolato sulla griglia
// effettiva: chi qualifica P7, parte P20 e arriva P8 ha guadagnato 12
// posizioni, non perso 1.
//
// Le fonti, in ordine di affidabilità:
//   1. `starting_grid` di OpenF1 — la griglia ufficiale. Verificato a Monza
//      2026: risponde 200 con array VUOTO anche a gara in corso e token
//      valido, quindi non ci si può contare.
//   2. Risultati Jolpica/Ergast (campo `grid`) — ufficiali e affidabili, ma
//      disponibili solo a gara conclusa: buoni per il post-gara, inutili live.
//   3. Prime posizioni registrate nella sessione gara di OpenF1 — il feed
//      `position` parte dallo schieramento, quindi la prima posizione di ogni
//      pilota è la sua casella in griglia. Approssimazione buona e disponibile
//      live, l'unica che copre la gara in corso.
//   4. Posizioni di qualifica — ultimo fallback, ignora le penalità: è il
//      comportamento sbagliato che stiamo correggendo, meglio di niente ma da
//      segnalare sempre nei log.

export interface GridEntry {
  driver_number?: number | null;
  position?: number | null;
}

export type GridSourceName =
  | "starting_grid"
  | "jolpica_results"
  | "race_first_positions"
  | "qualifying"
  | "none";

export interface GridSourceResult {
  grid: Map<number, number>;
  source: GridSourceName;
}

function toMap(entries: GridEntry[] | null | undefined): Map<number, number> {
  const map = new Map<number, number>();
  for (const e of entries ?? []) {
    if (e?.driver_number && e?.position) map.set(e.driver_number, e.position);
  }
  return map;
}

/**
 * Prova le fonti nell'ordine dato e restituisce la prima non vuota.
 */
export function resolveGrid(
  sources: { name: Exclude<GridSourceName, "none">; entries: GridEntry[] | null | undefined }[],
): GridSourceResult {
  for (const { name, entries } of sources) {
    const grid = toMap(entries);
    if (grid.size > 0) return { grid, source: name };
  }
  return { grid: new Map(), source: "none" };
}

/**
 * Griglia da `starting_grid` con fallback sulla qualifica.
 * Scorciatoia per i percorsi che hanno solo queste due fonti.
 */
export function buildGridMap(
  startingGrid: GridEntry[] | null | undefined,
  qualifying: GridEntry[] | null | undefined,
): GridSourceResult {
  return resolveGrid([
    { name: "starting_grid", entries: startingGrid },
    { name: "qualifying", entries: qualifying },
  ]);
}

/**
 * Ricava la griglia dal feed `position` della sessione GARA: per ogni pilota
 * la posizione registrata per prima (`date` più vecchia), cioè la casella di
 * partenza. Il feed emette lo schieramento prima del via, quindi funziona
 * anche a gara in corso.
 */
export function gridFromRacePositions(
  positions: { driver_number?: number | null; position?: number | null; date?: string | null }[] | null | undefined,
): GridEntry[] {
  const first = new Map<number, { position: number; time: number }>();
  for (const p of positions ?? []) {
    if (!p?.driver_number || !p?.position) continue;
    const time = p.date ? new Date(p.date).getTime() : 0;
    const prev = first.get(p.driver_number);
    if (!prev || time < prev.time) {
      first.set(p.driver_number, { position: p.position, time });
    }
  }
  return Array.from(first.entries()).map(([driver_number, v]) => ({
    driver_number,
    position: v.position,
  }));
}

export interface JolpicaResult {
  grid?: string | number;
  position?: string | number;
  Driver?: { permanentNumber?: string | number };
}

/**
 * Griglia dai risultati Jolpica/Ergast (campo `grid`, ufficiale).
 * `grid: 0` significa partenza dalla pit lane: la trattiamo come ultima
 * casella, perché è di fatto quello che è.
 */
export function gridFromJolpicaResults(results: JolpicaResult[] | null | undefined): GridEntry[] {
  const rows = results ?? [];
  const lastPlace = rows.length;
  const out: GridEntry[] = [];
  for (const r of rows) {
    const num = Number(r?.Driver?.permanentNumber);
    const grid = Number(r?.grid);
    if (!num || Number.isNaN(grid)) continue;
    out.push({ driver_number: num, position: grid > 0 ? grid : lastPlace });
  }
  return out;
}

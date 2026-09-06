// Griglia di partenza reale (endpoint OpenF1 `starting_grid`).
//
// Perché serve: la posizione di qualifica NON è la posizione di partenza.
// Le penalità in griglia (cambio motore/cambio, impeding, ecc.) arretrano il
// pilota dopo la qualifica. Il regolamento assegna +1/-1 per posizione
// "guadagnata/persa vs griglia", quindi il delta va calcolato sulla griglia
// effettiva: chi qualifica P7, parte P20 e arriva P8 ha guadagnato 12
// posizioni, non perso 1.
//
// `starting_grid` può non essere ancora popolato (fetch anticipato, dato
// mancante per una sessione vecchia): in quel caso si torna alla qualifica
// come approssimazione, che resta meglio di nessun delta.

export interface StartingGridEntry {
  driver_number?: number | null;
  position?: number | null;
}

export interface GridSourceResult {
  grid: Map<number, number>;
  /** "starting_grid" = griglia reale; "qualifying" = fallback; "none" = nessun dato. */
  source: "starting_grid" | "qualifying" | "none";
}

/**
 * Costruisce la mappa driver_number → posizione in griglia.
 * Priorità a `starting_grid`; fallback sulle posizioni di qualifica.
 */
export function buildGridMap(
  startingGrid: StartingGridEntry[] | null | undefined,
  qualifying: { driver_number: number; position: number }[] | null | undefined,
): GridSourceResult {
  const grid = new Map<number, number>();

  for (const entry of startingGrid ?? []) {
    if (entry?.driver_number && entry?.position) {
      grid.set(entry.driver_number, entry.position);
    }
  }
  if (grid.size > 0) return { grid, source: "starting_grid" };

  for (const q of qualifying ?? []) {
    if (q?.driver_number && q?.position) {
      grid.set(q.driver_number, q.position);
    }
  }
  if (grid.size > 0) return { grid, source: "qualifying" };

  return { grid, source: "none" };
}

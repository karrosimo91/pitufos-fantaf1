// Classifica Reale: punti F1 (25-18-15-12-10-8-6-4-2-1) assegnati ogni
// weekend in base alla classifica dei giocatori per punteggio weekend.
//
// Unica implementazione per server (post-gara, recalc-penalties, reset-round)
// e client (statistiche): prima ognuno ordinava per conto suo e i pari merito
// finivano decisi dall'ordine casuale delle righe del DB, cioè in modo
// diverso a ogni calcolo. Con un criterio deterministico due calcoli dello
// stesso round danno sempre gli stessi punti, e i ricalcoli possono
// sottrarre esattamente quello che era stato dato.
//
// Pari merito (proposta da confermare in CDA, facile da cambiare qui): a
// parità di punti weekend vince chi ha fatto più punti con i piloti, poi chi
// ne ha fatti di più con le previsioni; se anche quelli sono pari, ordine
// stabile per id, così il risultato non dipende da come arriva la lista.

export const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export interface RigaWeekend {
  user_id: string;
  total_points: number | string | null;
  piloti_points?: number | string | null;
  previsioni_points?: number | string | null;
}

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

/** Ordinamento della classifica weekend: punteggio, poi piloti, poi previsioni, poi id. */
export function ordinaClassificaWeekend<T extends RigaWeekend>(righe: T[]): T[] {
  return [...righe].sort((a, b) =>
    num(b.total_points) - num(a.total_points) ||
    num(b.piloti_points) - num(a.piloti_points) ||
    num(b.previsioni_points) - num(a.previsioni_points) ||
    a.user_id.localeCompare(b.user_id),
  );
}

/** user_id → punti Classifica Reale del weekend (0 fuori dai primi 10). */
export function puntiClassificaReale(righe: RigaWeekend[]): Map<string, number> {
  const out = new Map<string, number>();
  ordinaClassificaWeekend(righe).forEach((r, i) => out.set(r.user_id, PUNTI_REALE[i] ?? 0));
  return out;
}

// Penalità cambi di mercato: fonte unica per post-gara, review e live.
//
// Regolamento: 2 cambi gratis per round, dal 3° in poi −10 punti weekend
// ciascuno. Con il chip Wildcard i cambi sono illimitati e senza penalità.

export const CAMBI_GRATIS = 2;
export const PENALITA_CAMBIO_EXTRA = 10;

/** Punti da togliere al weekend (numero ≥ 0). */
export function penalitaCambi(numCambi: number, chipPiloti: string | null | undefined): number {
  if (chipPiloti === "wildcard") return 0;
  return Math.max(0, numCambi - CAMBI_GRATIS) * PENALITA_CAMBIO_EXTRA;
}

/**
 * user_id → penalità, solo per chi ne ha una. `formazioni` sono le formazioni
 * confermate del round, `cambi` le righe di `mercato_cambi` dello stesso round.
 * Chi ha cambi ma nessuna formazione confermata non gioca il round: escluso.
 */
export function penalitaCambiPerUser(
  formazioni: { user_id: string; chip_piloti: string | null }[],
  cambi: { user_id: string }[],
): Record<string, number> {
  const count = new Map<string, number>();
  for (const c of cambi) count.set(c.user_id, (count.get(c.user_id) ?? 0) + 1);

  const out: Record<string, number> = {};
  for (const f of formazioni) {
    const p = penalitaCambi(count.get(f.user_id) ?? 0, f.chip_piloti);
    if (p > 0) out[f.user_id] = p;
  }
  return out;
}

// Etichette leggibili dei chip (Aggiornamenti). Centralizzato per evitare le
// copie sparse in /gara, /classifica e nei componenti live.

export const CHIP_PILOTI_LABELS: Record<string, string> = {
  boost: "Boost Mode x3",
  halo: "Halo",
  scudo: "Scudo Capitano",
  sesto: "Sesto Uomo",
  wildcard: "Wildcard",
};

export const CHIP_PREVISIONI_LABELS: Record<string, string> = {
  doppia: "Prev. Doppia",
};

// Include anche chip storici rimossi (es. "sicura") per mostrare correttamente
// gli usi già salvati nelle gare passate.
export const CHIP_LABELS: Record<string, string> = {
  ...CHIP_PILOTI_LABELS,
  ...CHIP_PREVISIONI_LABELS,
  sicura: "Prev. Sicura",
};

/** Etichetta leggibile di un chip; ritorna l'id grezzo se sconosciuto, "—" se assente. */
export function chipLabel(id: string | null | undefined): string {
  if (!id) return "—";
  return CHIP_LABELS[id] ?? id;
}

// Aggiornamenti dalla fabbrica (chip): metadati e regole in una frase, usati
// da Muretto, Mercato (Wildcard) e Info. Le etichette leggibili stanno in
// chip-labels.ts; qui c'è la spiegazione per il giocatore.

import { PAUSA_ESTIVA_ROUND } from "./store";

export interface ChipRule {
  id: string;
  label: string;
  /** Una riga sotto il nome */
  desc: string;
  /** Regola completa, per il foglio "?" */
  rule: string;
  /** Serve un bersaglio (pilota o previsione) */
  needsTarget?: "pilota" | "sesto" | "previsione";
}

export const CHIP_PILOTI_RULES: ChipRule[] = [
  {
    id: "boost", label: "Boost Mode", desc: "Un pilota (non il Primo Pilota) fa x3",
    rule: "Scegli un pilota diverso dal Primo Pilota: per tutto il weekend i suoi punti valgono x3, bonus e malus. Se lo vendi o lo fai capitano, il Boost perde il bersaglio e va riassegnato.",
    needsTarget: "pilota",
  },
  {
    id: "halo", label: "Halo", desc: "Nessun pilota va sotto zero",
    rule: "Se uno dei tuoi piloti chiude il weekend in negativo, il suo punteggio diventa 0. Vale per tutti i piloti della rosa, Primo Pilota e Sesto Uomo compresi.",
  },
  {
    id: "scudo", label: "Scudo Capitano", desc: "Primo Pilota x2 solo sui bonus",
    rule: "Il Primo Pilota raddoppia solo se chiude il weekend in positivo. Se va in negativo, il malus resta x1 (un ritiro vale −10 invece di −20).",
  },
  {
    id: "sesto", label: "Sesto Uomo", desc: "Un 6° pilota per un weekend",
    rule: "Aggiungi un sesto pilota, qualsiasi, solo per questo weekend: fa punti come gli altri (x1), non costa Soldini e non conta come cambio. Il lunedì sparisce.",
    needsTarget: "sesto",
  },
  {
    id: "wildcard", label: "Wildcard", desc: "Cambi illimitati senza penalità",
    rule: "Per questo round i cambi di mercato sono illimitati e senza il −10 dal terzo in poi. Se poi lo togli, le penalità dei cambi già fatti tornano.",
  },
];

export const CHIP_PREVISIONI_RULES: ChipRule[] = [
  {
    id: "doppia", label: "Previsione Doppia", desc: "Una previsione vale x2",
    rule: "Scegli una delle sei previsioni: se la indovini prende il doppio dei punti. Se la sbagli resta 0.",
    needsTarget: "previsione",
  },
];

export function chipRule(id: string | null | undefined): ChipRule | undefined {
  if (!id) return undefined;
  return [...CHIP_PILOTI_RULES, ...CHIP_PREVISIONI_RULES].find((c) => c.id === id);
}

/** "prima" o "dopo" la pausa estiva per un round. */
export function halfOf(round: number): "prima" | "dopo" {
  return round < PAUSA_ESTIVA_ROUND ? "prima" : "dopo";
}

/** Ultimo round della metà stagione a cui appartiene `round`. */
export function halfEndRound(round: number, seasonEnd = 24): number {
  return halfOf(round) === "prima" ? PAUSA_ESTIVA_ROUND - 1 : seasonEnd;
}

/** Usi rimasti di un chip nella metà stagione di `round`: 1 se libero, 0 se già usato. */
export function chipRemaining(round: number, usedRound: number | null): 0 | 1 {
  return usedRound != null ? 0 : 1;
}

/**
 * Chip ancora disponibili nella metà stagione di `round`, dato l'elenco degli
 * usi confermati (chip, round). Un uso nell'altra metà non conta: i contatori
 * si azzerano alla pausa estiva.
 */
export function remainingChips(all: ChipRule[], used: { chip: string; round: number }[], round: number): ChipRule[] {
  const usedHere = new Set(used.filter((u) => halfOf(u.round) === halfOf(round)).map((u) => u.chip));
  return all.filter((c) => !usedHere.has(c.id));
}

/**
 * Testo dello stato di un chip nel round: disponibile, già usato in questa
 * metà, o scadenza. `usedRound` è il round in cui è già stato usato nella
 * stessa metà (null se libero).
 */
export function chipStatusText(round: number, usedRound: number | null, seasonEnd = 24): string {
  if (usedRound != null) {
    return halfOf(round) === "prima"
      ? `Usato al R${usedRound} · torna dopo la pausa estiva`
      : `Usato al R${usedRound} · esaurito per quest'anno`;
  }
  const scade = halfOf(round) === "prima" ? PAUSA_ESTIVA_ROUND - 1 : seasonEnd;
  const left = scade - round + 1;
  return left <= 1 ? "Ultimo GP per usarlo" : `Scade tra ${left} GP`;
}

// Correzioni manuali ai risultati ufficiali OpenF1.
//
// Quando servono: OpenF1 a volte NON recepisce le decisioni FIA successive
// alla gara. Monaco 2026: la Corte d'Appello (3/9) ha reintegrato le due
// penalità di Gasly, che torna 7°, con Hadjar 3°; OpenF1 ha invece lasciato
// la classifica intermedia (penalità cancellate, Gasly 3°). Il ricalcolo del
// 13/9 ha così sovrascritto l'archivio, che era giusto, con il dato sbagliato.
//
// Qui si fissano le posizioni finali per round: vengono applicate a ogni
// calcolo (post-gara e audit), quindi sopravvivono ai ricalcoli. Ogni voce
// deve avere una fonte verificabile.

import type { DriverResult } from "./scoring";

export interface RaceOverride {
  /** driver_number → posizione finale ufficiale */
  positions: Record<number, number>;
  fonte: string;
}

export const RACE_OVERRIDES: Record<number, RaceOverride> = {
  8: {
    // Monaco 2026, decisione Corte d'Appello FIA del 3/9/2026 (appello McLaren
    // e Red Bull): penalità di Gasly reintegrate. Classifica finale:
    // 3° Hadjar, 4° Piastri, 5° Lawson, 6° Lindblad, 7° Gasly.
    positions: { 6: 3, 81: 4, 30: 5, 41: 6, 10: 7 },
    fonte: "FIA International Court of Appeal, 3 settembre 2026 (formula1.com, motorsport.com)",
  },
};

/**
 * Applica le posizioni forzate alle righe gara. Ritorna le righe corrette e
 * l'elenco delle modifiche fatte (per il log), vuoto se non c'è override o
 * se OpenF1 è già allineato.
 */
export function applyRaceOverrides(
  round: number,
  race: DriverResult[],
): { race: DriverResult[]; modifiche: string[] } {
  const ov = RACE_OVERRIDES[round];
  if (!ov) return { race, modifiche: [] };
  const modifiche: string[] = [];
  const out = race.map((r) => {
    const pos = ov.positions[r.driver_number];
    if (pos === undefined || r.position === pos) return r;
    modifiche.push(`#${r.driver_number}: P${r.position ?? "-"} → P${pos}`);
    return { ...r, position: pos, dnf: false, dns: false };
  });
  return { race: out, modifiche };
}

// ─── Penalità post-gara ───
//
// Il ricalcolo penalità legge `race_control`, che è il feed della sessione:
// le decisioni dei commissari prese DOPO la bandiera a scacchi (Messico 2026,
// ore dopo la gara) non ci finiscono mai. OpenF1 aggiorna la classifica in
// `session_result`, ma la penalità in sé si perde: -5 da aggiungere qui.
export interface PenaltyOverride {
  /** numeri pilota penalizzati in gara/post gara (-5, una volta sola) */
  drivers: number[];
  fonte: string;
}

// Verificate il 6/11/2026 incrociando stampa e archivio: in tutti i casi la
// posizione in weekend_results è già quella dopo la penalità, mancava il -5.
export const RACE_PENALTY_OVERRIDES: Record<number, PenaltyOverride> = {
  6: {
    // Miami: Leclerc drive-through convertito in +20 s (P6 → P8); Verstappen
    // +5 s per la linea d'uscita box, indagine chiusa a fine gara (resta P5).
    drivers: [16, 3],
    fonte: "FIA stewards, Miami GP 2026 (formula1.com, motorsport.com, motorsportweek.com 4/5/2026)",
  },
  9: {
    // Barcellona: Colapinto +10 s bandiera gialla (P8 → P10).
    drivers: [43],
    fonte: "FIA stewards, Barcelona GP 2026 (racingnews365.com, the-race.com)",
  },
  11: {
    // Silverstone: Sainz penalità di un giro, sdoppiamento sotto SC (P12 → P17).
    drivers: [55],
    fonte: "FIA stewards, British GP 2026 (racingnews365.com, the-race.com)",
  },
  17: {
    // Baku: Bortoleto +10 s sorpasso in regime di bandiera gialla (P13 → P15).
    // Colapinto: penalità convertita in griglia per Sepang → 0, esclusa.
    drivers: [5],
    fonte: "FIA stewards, Azerbaijan GP 2026 (formula1.com, racingnews365.com)",
  },
  21: {
    // Messico: Gasly stop&go convertito in +30 s e Colapinto +10 s per
    // bandiere gialle (Colapinto P8 → P15); Piastri +10 s collisione con
    // Lindblad (P7 → P13).
    drivers: [10, 43, 81],
    fonte: "FIA stewards, Mexico City GP 1/11/2026 (formula1.com, 2/11/2026)",
  },
};

/**
 * Piloti penalizzati del round: quelli rilevati da race_control più gli
 * override manuali post-gara.
 */
export function withPenaltyOverrides(round: number, fromRaceControl: Set<number>): Set<number> {
  const ov = RACE_PENALTY_OVERRIDES[round];
  if (!ov) return fromRaceControl;
  return new Set([...fromRaceControl, ...ov.drivers]);
}

// ─── Forza maggiore ───
//
// Regola CDA: un pilota che non parte (DNS) è un ritiro, -10 in gara e -5 in
// sprint, esattamente come un DNF. L'unica eccezione è la forza maggiore
// decisa dal CDA (pilota rimosso dal weekend: infortunio, sostituzione di
// sedile), che vale 0. OpenF1 non distingue i due casi (marca `dns` anche il
// guasto in griglia), quindi l'eccezione è una lista manuale per round.
export const FORZA_MAGGIORE: Record<number, number[]> = {
  // Zandvoort 2026: Hadjar infortunato, sostituito da Lawson (decisione CDA)
  14: [6],
};

export function isForzaMaggiore(round: number, driverNumber: number): boolean {
  return (FORZA_MAGGIORE[round] ?? []).includes(driverNumber);
}

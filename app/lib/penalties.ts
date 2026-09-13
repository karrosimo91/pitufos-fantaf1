// Rilevamento penalità di gara dai messaggi `race_control` di OpenF1.
//
// IMPORTANTE: nei messaggi dei commissari OpenF1 lascia quasi sempre
// `driver_number` a null — il numero della macchina è scritto SOLO nel testo
// (es. "...PENALTY FOR CAR 44 (HAM)..."). Per questo NON ci si può affidare
// al campo `driver_number`: bisogna estrarre il numero dal testo del messaggio.
//
// Regolamento: la penalità vale -5 una sola volta per pilota (gestito a monte
// usando un Set), indipendentemente da quante penalità riceve nello stesso GP.
// Esclusi: penalità in griglia (0 punti) e reprimand. Esclusi anche i messaggi
// di processo (NOTED / UNDER INVESTIGATION / ...) che non sono penalità inflitte.

export interface RaceControlMessage {
  message?: string | null;
  driver_number?: number | null;
}

// Messaggi che NON sono una penalità inflitta (solo annotazioni/indagini)
const NON_PENALTY_MARKERS = [
  "NOTED",
  "UNDER INVESTIGATION",
  "WILL BE INVESTIGATED",
  "NO FURTHER",
  "UNDER REVIEW",
];

// Esclusioni esplicite: griglia (vale 0 punti) e reprimand (non è -5)
const EXCLUDED_MARKERS = ["GRID", "REPRIMAND"];

// Marcatori che identificano una penalità di gara effettiva
const PENALTY_MARKERS = [
  "PENALTY",
  "DRIVE THROUGH",
  "DRIVE-THROUGH",
  "STOP AND GO",
  "STOP/GO",
];

/** True se il messaggio rappresenta una penalità di gara effettiva. */
export function isRacePenaltyMessage(message: string): boolean {
  const msg = message.toUpperCase();
  if (EXCLUDED_MARKERS.some((m) => msg.includes(m))) return false;
  if (NON_PENALTY_MARKERS.some((m) => msg.includes(m))) return false;
  return PENALTY_MARKERS.some((m) => msg.includes(m));
}

/** Estrae il numero di macchina dal testo "CAR <n>", se presente. */
export function carNumberFromMessage(message: string): number | null {
  const m = message.toUpperCase().match(/\bCAR\s+(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Dato l'elenco dei messaggi race_control, restituisce l'insieme dei numeri
 * pilota che hanno ricevuto almeno una penalità di gara.
 */
export function extractPenalizedDrivers(raceControl: RaceControlMessage[]): Set<number> {
  const penalized = new Set<number>();
  for (const rc of raceControl) {
    const text = rc.message || "";
    if (!isRacePenaltyMessage(text)) continue;
    // Preferisci il campo driver_number se valorizzato, altrimenti dal testo.
    const num = rc.driver_number ?? carNumberFromMessage(text);
    if (num) penalized.add(num);
  }
  return penalized;
}

// ─── Penalità in griglia (regola 4 qualifica) ───
//
// Servono per la regola "senza tempo = -5, salvo penalità a priori": chi
// sa già di partire dal fondo (cambio motore, cambio, pit lane) spesso non
// gira in qualifica, e quel -5 non deve colpirlo. I messaggi dei commissari
// lo dicono ("10 GRID PLACE PENALTY FOR CAR 18", "CAR 5 ... BACK OF THE GRID",
// "CAR 77 WILL START FROM THE PIT LANE"); il numero auto sta nel testo.
const GRID_PENALTY_MARKERS = [
  "GRID PENALTY",
  "GRID PLACE",
  "GRID POSITION PENALTY",
  "BACK OF THE GRID",
  "START FROM THE PIT LANE",
  "PIT LANE START",
  "START FROM THE BACK",
];

/** True se il messaggio comunica una penalità in griglia o partenza dal fondo. */
export function isGridPenaltyMessage(message: string): boolean {
  const msg = message.toUpperCase();
  if (NON_PENALTY_MARKERS.some((m) => msg.includes(m))) return false;
  return GRID_PENALTY_MARKERS.some((m) => msg.includes(m));
}

/** Piloti con almeno una penalità in griglia nei messaggi dati (tutte le sessioni del weekend). */
export function extractGridPenalizedDrivers(raceControl: RaceControlMessage[]): Set<number> {
  const out = new Set<number>();
  for (const rc of raceControl ?? []) {
    const text = rc.message || "";
    if (!isGridPenaltyMessage(text)) continue;
    const num = rc.driver_number ?? carNumberFromMessage(text);
    if (num) out.add(num);
  }
  return out;
}

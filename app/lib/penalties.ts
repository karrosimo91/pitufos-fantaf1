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

// ─── Penalità post-gara: rilevamento indiretto ───
//
// Le decisioni prese dopo la bandiera a scacchi non arrivano in race_control,
// ma OpenF1 aggiorna la classifica di session_result. Il feed `position` invece
// resta fermo all'ordine sotto la bandiera. Una penalità post-gara fa SCENDERE
// solo chi la prende (chi sta dietro sale), quindi un classificato che finisce
// più indietro in session_result che nell'ultimo record di `position` è un
// sospetto penalizzato. Non vede le penalità che non cambiano la posizione
// (distacco più largo della penalità): per quelle resta l'override manuale.

export interface PositionFeedRow {
  driver_number?: number | null;
  position?: number | null;
  date?: string | null;
}

export interface PostRaceSuspect {
  driver_number: number;
  sotto_bandiera: number;
  classifica: number;
}

/** Ultima posizione di ogni pilota nel feed `position` (ordine sotto la bandiera). */
export function finalFeedPositions(feed: PositionFeedRow[]): Map<number, number> {
  const last = new Map<number, { pos: number; t: number }>();
  for (const r of feed) {
    if (r.driver_number == null || r.position == null) continue;
    const t = r.date ? Date.parse(r.date) : 0;
    const prev = last.get(r.driver_number);
    if (!prev || t >= prev.t) last.set(r.driver_number, { pos: r.position, t });
  }
  return new Map([...last].map(([n, v]) => [n, v.pos]));
}

/**
 * Classificati non ritirati e non già penalizzati che in classifica ufficiale
 * stanno più indietro che sotto la bandiera.
 */
export function suspectPostRacePenalties(
  race: { driver_number: number; position: number | null; dnf?: boolean; dns?: boolean; penalty?: boolean }[],
  feed: PositionFeedRow[],
): PostRaceSuspect[] {
  const finale = finalFeedPositions(feed);
  const out: PostRaceSuspect[] = [];
  for (const r of race) {
    if (r.position == null || r.dnf || r.dns || r.penalty) continue;
    const flag = finale.get(r.driver_number);
    if (flag != null && r.position > flag) {
      out.push({ driver_number: r.driver_number, sotto_bandiera: flag, classifica: r.position });
    }
  }
  return out.sort((a, b) => a.classifica - b.classifica);
}

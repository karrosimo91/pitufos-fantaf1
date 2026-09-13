// Risultati ufficiali OpenF1 (`session_result`): controlli di prontezza e
// conversione in DriverResult.
//
// Perché esiste: OpenF1 pubblica `session_result` con ritardo rispetto alla
// bandiera a scacchi. Finché è vuoto, i percorsi di calcolo ripiegavano sul
// feed `position`, che NON porta i flag dnf/dsq/dns: il round finiva in
// archivio con zero ritiri, punteggi sbagliati e nessun errore visibile
// (successo davvero a Madrid 2026, round 16, salvato alle 15:21 UTC con
// `session_result` ancora vuoto).
//
// Regola adesso: se i risultati ufficiali non ci sono o sono incompleti, non
// si calcola e non si salva niente, e si dice il perché. Meglio nessun
// punteggio che un punteggio finto.
//
// Nota sulle fonti: si usa solo OpenF1. Jolpica/Ergast numera i round
// saltando le gare cancellate (il nostro round 16, Madrid, per loro è il 14),
// quindi interrogarla col nostro numero significa prendere i dati di un'altra
// gara senza accorgersene.

import type { DriverResult } from "./scoring";

export interface OfficialRow {
  driver_number?: number | null;
  position?: number | null;
  dnf?: boolean | null;
  dsq?: boolean | null;
  dns?: boolean | null;
}

export type ReadinessResult = { ok: true } | { ok: false; error: string };

export interface ReadinessInput {
  /** Nome sessione per i messaggi ("Race", "Qualifying"...) */
  sessionName: string;
  /** `date_end` della sessione secondo OpenF1 */
  dateEnd?: string | null;
  /** Righe di `session_result` */
  rows: OfficialRow[];
  /** Piloti attesi (da `/drivers`); 0 o assente = sconosciuto */
  expectedDrivers?: number;
  /** Iniettabile nei test */
  now?: number;
}

/** Soglia minima di piloti quando OpenF1 non dice quanti ne siano attesi. */
export const MIN_DRIVERS_ATTESI = 15;

export function checkResultsReady(input: ReadinessInput): ReadinessResult {
  const nome = input.sessionName || "Sessione";
  const now = input.now ?? Date.now();

  // 1. La sessione deve essere finita: a metà gara `session_result` esiste ma
  //    è provvisorio (posizioni di quel momento, ritiri non ancora tutti).
  if (input.dateEnd) {
    const end = new Date(input.dateEnd).getTime();
    if (Number.isFinite(end) && now < end) {
      return {
        ok: false,
        error: `${nome} non ancora conclusa (termina alle ${new Date(end).toISOString()}). Nessun dato salvato, nessun punteggio calcolato.`,
      };
    }
  }

  // 2. I risultati ufficiali devono esserci.
  const presenti = new Set(
    (input.rows ?? []).map((r) => r?.driver_number).filter((n): n is number => !!n),
  ).size;
  if (presenti === 0) {
    return {
      ok: false,
      error: `OpenF1 non ha ancora pubblicato i risultati ufficiali di ${nome} (session_result vuoto). Riprova più tardi: nessun dato salvato, nessun punteggio calcolato.`,
    };
  }

  // 3. E devono essere completi: una pubblicazione a metà darebbe classifica
  //    e ritiri parziali, cioè di nuovo punteggi sbagliati.
  const attesi = input.expectedDrivers && input.expectedDrivers > 0 ? input.expectedDrivers : MIN_DRIVERS_ATTESI;
  if (presenti < attesi) {
    return {
      ok: false,
      error: `Risultati ufficiali di ${nome} incompleti: OpenF1 ne ha ${presenti} su ${attesi} piloti. Riprova più tardi: nessun dato salvato, nessun punteggio calcolato.`,
    };
  }

  return { ok: true };
}

/** Righe utili: solo quelle con un numero di pilota, l'ultima vince. */
function byDriver(rows: OfficialRow[]): OfficialRow[] {
  const map = new Map<number, OfficialRow>();
  for (const r of rows ?? []) {
    if (r?.driver_number) map.set(r.driver_number, r);
  }
  return Array.from(map.values());
}

/**
 * Qualifica e Sprint Shootout.
 * Qui `dnf` vale "NC / squalificato / senza tempo": -5 in qualifica, -3 in
 * sprint shootout (vedi scoring.ts). `dns` resta distinto: 0 punti.
 */
export function mapQualifyingResults(rows: OfficialRow[]): DriverResult[] {
  return byDriver(rows).map((r) => ({
    driver_number: r.driver_number as number,
    position: r.position as number,
    dnf: !!(r.dnf || r.dsq),
    dns: !!r.dns,
  }));
}

/**
 * Numero di ritiri della gara per la previsione "numero DNF esatto".
 *
 * ATTENZIONE (incoerenza nota, lasciata com'era di proposito): qui il DNS
 * viene contato, mentre per i punti del singolo pilota il DNS vale 0 e non
 * -10 (vedi `scoring.ts`, caso Hadjar round 14). Correggerlo cambierebbe
 * punti già assegnati, quindi la modifica va portata prima al CDA.
 */
export function countDnf(rows: OfficialRow[]): number {
  return byDriver(rows).filter((r) => r.dnf || r.dsq || r.dns).length;
}

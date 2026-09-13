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

import type { DriverResult, RaceWeekendResults } from "./scoring";

export interface OfficialRow {
  driver_number?: number | null;
  position?: number | null;
  dnf?: boolean | null;
  dsq?: boolean | null;
  dns?: boolean | null;
  /** Gara: tempo totale. Qualifica: array [Q1, Q2, Q3], null dove non c'è tempo. */
  duration?: number | null | (number | null)[];
  number_of_laps?: number | null;
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
 * "Senza tempo" in qualifica: nessun tempo valido in nessuna fase.
 * OpenF1 in `session_result` di qualifica mette `duration` come array
 * [Q1, Q2, Q3] con null dove il pilota non ha un tempo; per la gara è un
 * numero. Tolleriamo entrambe le forme. Un DNS non è "senza tempo": non ha
 * preso parte, vale 0.
 */
export function hasNoTime(row: OfficialRow): boolean {
  if (row.dns) return false;
  const d = row.duration;
  if (d === undefined) return false; // campo assente: non possiamo dirlo, non inventiamo
  if (Array.isArray(d)) return d.every((v) => v == null || v <= 0);
  return d == null || d <= 0;
}

export interface QualifyingMapOptions {
  /**
   * Piloti con penalità in griglia "a priori" (cambio motore, pit lane...):
   * per loro il "senza tempo" NON vale -5, restano i punti del piazzamento.
   */
  esenti?: Set<number>;
}

/**
 * Qualifica e Sprint Shootout.
 * `dnf` qui vale "NC / squalificato / senza tempo": -5 in qualifica, -3 in
 * sprint shootout (vedi scoring.ts). `dns` resta distinto: 0 punti.
 * Il "senza tempo" scatta solo se il pilota non è esente (regola 4).
 */
export function mapQualifyingResults(rows: OfficialRow[], opts: QualifyingMapOptions = {}): DriverResult[] {
  const esenti = opts.esenti ?? new Set<number>();
  return byDriver(rows).map((r) => {
    const num = r.driver_number as number;
    const noTime = hasNoTime(r);
    const esente = noTime && esenti.has(num);
    const out: DriverResult = {
      driver_number: num,
      position: r.position as number,
      dnf: !!(r.dnf || r.dsq || (noTime && !esente)),
      dns: !!r.dns,
    };
    if (noTime) out.no_time = true;
    if (esente) out.esente_penalita = true;
    return out;
  });
}

/**
 * Previsione "Pole vince la gara": la pole è chi PARTE primo in griglia,
 * non chi ha fatto il miglior tempo in qualifica (se il poleman ha una
 * penalità in griglia, la pole di fatto passa a chi parte davanti). Senza
 * griglia si ricade sul primo della qualifica.
 */
export function poleDriverNumber(race: DriverResult[], qualifying: DriverResult[]): number | null {
  const fromGrid = race.find((r) => r.grid_position === 1);
  if (fromGrid) return fromGrid.driver_number;
  const fromQuali = qualifying.find((q) => q.position === 1 && !q.dnf && !q.dns);
  return fromQuali?.driver_number ?? null;
}

export function poleWon(race: DriverResult[], qualifying: DriverResult[]): boolean {
  const pole = poleDriverNumber(race, qualifying);
  if (pole == null) return false;
  const winner = race.find((r) => r.position === 1 && !r.dnf && !r.dns);
  return !!winner && winner.driver_number === pole;
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

// ─── Coerenza interna prima del salvataggio ───

/**
 * Controlli che un RaceWeekendResults deve superare prima di finire in
 * archivio. Sono le incoerenze che abbiamo trovato davvero nei dati salvati:
 *   - round 2 (Cina): 7 righe piloti ritirate ma `total_dnf` 0, perché
 *     eventi e piloti erano stati calcolati da fonti diverse in momenti
 *     diversi; la previsione "numero DNF" veniva valutata su un numero falso;
 *   - round 16 (Madrid): 22 piloti tutti classificati e zero ritiri, dato
 *     preso dal feed `position` al posto dei risultati ufficiali.
 * Un archivio incoerente produce punteggi sbagliati senza che nessuno se ne
 * accorga, quindi si rifiuta il salvataggio e si spiega cosa non torna.
 */
export function validateWeekendResults(results: RaceWeekendResults): string[] {
  const errori: string[] = [];
  const race = results.race ?? [];

  if (race.length > 0) {
    const senzaNumero = race.filter((r) => !r.driver_number).length;
    if (senzaNumero > 0) errori.push(`${senzaNumero} righe gara senza numero pilota`);

    const numeri = race.map((r) => r.driver_number).filter(Boolean);
    if (new Set(numeri).size !== numeri.length) errori.push("numero pilota duplicato nei risultati gara");

    // Ritiri: gli eventi devono raccontare la stessa storia delle righe piloti.
    const ritirati = race.filter((r) => r.dnf).length;
    const nonPartiti = race.filter((r) => r.dns).length;
    const attesi = ritirati + nonPartiti; // stessa regola di countDnf()
    if (results.events.total_dnf !== attesi) {
      errori.push(`total_dnf=${results.events.total_dnf} ma le righe gara hanno ${ritirati} ritiri e ${nonPartiti} DNS (atteso ${attesi})`);
    }

    // Classificati: posizioni tutte diverse e senza buchi in testa.
    const classificati = race.filter((r) => !r.dnf && !r.dns && r.position != null).map((r) => r.position as number);
    if (new Set(classificati).size !== classificati.length) errori.push("due piloti classificati nella stessa posizione");
    if (classificati.length > 0 && !classificati.includes(1)) errori.push("nessun pilota in prima posizione");
  }

  return errori;
}

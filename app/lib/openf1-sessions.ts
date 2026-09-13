// Abbinamento round → sessioni OpenF1.
//
// Perché per data e non per posizione: il codice prendeva il meeting con
// `meetings[round - 1]`, cioè si fidava che la lista OpenF1 avesse le gare
// nello stesso ordine e nello stesso numero del nostro calendario. Ha
// funzionato finché OpenF1 non ha toccato il calendario 2026: Bahrain e Jeddah
// sono rimaste in lista come cancellate (e va bene, occupano ancora il loro
// posto), ma poi è comparsa una gara in più a Kuala Lumpur, infilata fra Baku
// e Singapore. Da lì in avanti l'indice punta alla gara sbagliata, senza
// nessun errore: si calcolerebbe Singapore con i dati di Kuala Lumpur.
//
// La data della gara invece è un fatto: il nostro `races.ts` ha l'orario di
// partenza di ogni GP e OpenF1 espone `date_start` di ogni sessione. Si cerca
// la sessione "Race" che parte entro poche ore dal nostro orario; se non c'è,
// o ce n'è più d'una, ci si ferma con un errore leggibile invece di tirare a
// indovinare.

import { RACES_2026 } from "./races";
import type { Race } from "./types";

export interface OpenF1Session {
  session_key: number;
  meeting_key: number;
  session_name?: string | null;
  session_type?: string | null;
  date_start?: string | null;
  date_end?: string | null;
  location?: string | null;
  is_cancelled?: boolean | null;
}

export type SessionKind = "race" | "sprint" | "qualifying" | "sprint_shootout";

/** Tolleranza sull'orario di partenza: copre ritardi e drift negli annunci. */
export const RACE_MATCH_TOLERANCE_MS = 36 * 60 * 60 * 1000;

export type RaceSessionMatch =
  | { ok: true; session: OpenF1Session }
  | { ok: false; error: string };

export function isRaceSession(s: OpenF1Session): boolean {
  return (s.session_name ?? "").trim().toLowerCase() === "race";
}

/**
 * Trova la sessione gara di un round confrontando `date_start` con l'orario
 * di gara del nostro calendario. Deterministica: una sola sessione o errore.
 */
export function findRaceSessionForRound(
  round: number,
  sessions: OpenF1Session[],
  races: Race[] = RACES_2026,
): RaceSessionMatch {
  const race = races.find((r) => r.round === round);
  if (!race) return { ok: false, error: `Round ${round} non presente nel calendario dell'app` };

  const target = new Date(race.date).getTime();
  const candidates = (sessions ?? []).filter((s) => {
    if (!isRaceSession(s) || !s.date_start) return false;
    const t = new Date(s.date_start).getTime();
    return Number.isFinite(t) && Math.abs(t - target) <= RACE_MATCH_TOLERANCE_MS;
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      error: `Nessuna sessione gara OpenF1 entro 36 ore da ${race.date} (round ${round}, ${race.name}). Nessun dato salvato.`,
    };
  }
  if (candidates.length > 1) {
    const list = candidates.map((c) => `${c.session_key}@${c.date_start}`).join(", ");
    return {
      ok: false,
      error: `Più sessioni gara OpenF1 vicine a ${race.date} (round ${round}): ${list}. Ambiguità, nessun dato salvato.`,
    };
  }
  return { ok: true, session: candidates[0] };
}

/**
 * Le altre sessioni del weekend, riconosciute per nome come fa OpenF1:
 *   Sprint Qualifying → type "Qualifying", name "Sprint Qualifying"
 *   Sprint            → type "Race",       name "Sprint"
 *   Qualifying        → type "Qualifying", name "Qualifying"
 *   Race              → type "Race",       name "Race"
 */
export function findSessionInMeeting(
  sessions: OpenF1Session[],
  meetingKey: number,
  kind: SessionKind,
): OpenF1Session | null {
  const own = (sessions ?? []).filter((s) => s.meeting_key === meetingKey);
  const byName = (pred: (n: string) => boolean) =>
    own.find((s) => pred((s.session_name ?? "").trim().toLowerCase())) ?? null;

  switch (kind) {
    case "race":
      return byName((n) => n === "race");
    case "sprint":
      return byName((n) => n === "sprint");
    case "qualifying":
      return byName((n) => n === "qualifying");
    case "sprint_shootout":
      return byName((n) => n.includes("sprint") && (n.includes("quali") || n.includes("shootout")));
  }
}

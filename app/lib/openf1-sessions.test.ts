import { describe, it, expect } from "vitest";
import { findRaceSessionForRound, findSessionInMeeting, type OpenF1Session } from "./openf1-sessions";
import { RACES_2026 } from "./races";

// Estratto reale del calendario OpenF1 2026 (13 settembre 2026): Bahrain e
// Jeddah cancellate ma in lista, Kuala Lumpur (meeting 1308) infilata fra Baku
// e Singapore. È esattamente il caso che rompe `meetings[round - 1]`.
const SESSIONS: OpenF1Session[] = [
  { session_key: 11234, meeting_key: 1279, session_name: "Race", session_type: "Race", date_start: "2026-03-08T04:00:00+00:00", location: "Melbourne" },
  { session_key: 11240, meeting_key: 1280, session_name: "Sprint", session_type: "Race", date_start: "2026-03-14T03:00:00+00:00", location: "Shanghai" },
  { session_key: 11239, meeting_key: 1280, session_name: "Sprint Qualifying", session_type: "Qualifying", date_start: "2026-03-13T07:30:00+00:00", location: "Shanghai" },
  { session_key: 11244, meeting_key: 1280, session_name: "Qualifying", session_type: "Qualifying", date_start: "2026-03-14T07:00:00+00:00", location: "Shanghai" },
  { session_key: 11245, meeting_key: 1280, session_name: "Race", session_type: "Race", date_start: "2026-03-15T07:00:00+00:00", location: "Shanghai" },
  { session_key: 11261, meeting_key: 1282, session_name: "Race", session_type: "Race", date_start: "2026-04-12T15:00:00+00:00", location: "Sakhir", is_cancelled: true },
  { session_key: 11269, meeting_key: 1283, session_name: "Race", session_type: "Race", date_start: "2026-04-19T17:00:00+00:00", location: "Jeddah", is_cancelled: true },
  { session_key: 11299, meeting_key: 1286, session_name: "Race", session_type: "Race", date_start: "2026-06-07T13:00:00+00:00", location: "Monte Carlo" },
  { session_key: 11361, meeting_key: 1293, session_name: "Race", session_type: "Race", date_start: "2026-09-06T13:00:00+00:00", location: "Monza" },
  { session_key: 11369, meeting_key: 1294, session_name: "Race", session_type: "Race", date_start: "2026-09-13T13:00:00+00:00", location: "Madrid" },
  { session_key: 11377, meeting_key: 1295, session_name: "Race", session_type: "Race", date_start: "2026-09-26T11:00:00+00:00", location: "Baku" },
  { session_key: 11731, meeting_key: 1308, session_name: "Race", session_type: "Race", date_start: "2026-10-04T07:00:00+00:00", location: "Kuala Lumpur" },
  { session_key: 11383, meeting_key: 1296, session_name: "Sprint", session_type: "Race", date_start: "2026-10-10T09:00:00+00:00", location: "Marina Bay" },
  { session_key: 11388, meeting_key: 1296, session_name: "Race", session_type: "Race", date_start: "2026-10-11T12:00:00+00:00", location: "Marina Bay" },
];

describe("findRaceSessionForRound", () => {
  it("round 16 è Madrid (11369), non Barcellona", () => {
    const r = findRaceSessionForRound(16, SESSIONS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.session.session_key).toBe(11369);
  });

  it("round 8 (Monaco, ricalcolo postumo penalità) resta Monte Carlo", () => {
    const r = findRaceSessionForRound(8, SESSIONS);
    expect(r.ok && r.session.location).toBe("Monte Carlo");
  });

  it("round 18 è Singapore anche con Kuala Lumpur infilata prima", () => {
    // Con meetings[round - 1] qui sarebbe uscita Kuala Lumpur.
    const r = findRaceSessionForRound(18, SESSIONS);
    expect(r.ok && r.session.session_key).toBe(11388);
  });

  it("ignora la Sprint anche se è di tipo Race", () => {
    const r = findRaceSessionForRound(2, SESSIONS);
    expect(r.ok && r.session.session_key).toBe(11245);
  });

  it("le gare cancellate si abbinano comunque alla loro data (round 4 Bahrain)", () => {
    const r = findRaceSessionForRound(4, SESSIONS);
    expect(r.ok && r.session.is_cancelled).toBe(true);
  });

  it("se non c'è nessuna gara vicina alla data, errore esplicito", () => {
    const r = findRaceSessionForRound(10, SESSIONS); // Spielberg non è nell'estratto
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Nessuna sessione gara");
  });

  it("due gare nella stessa finestra: ambiguità, non si sceglie a caso", () => {
    const doppia = [...SESSIONS, { ...SESSIONS[9], session_key: 99999, date_start: "2026-09-13T15:00:00+00:00" }];
    const r = findRaceSessionForRound(16, doppia);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Ambiguità");
  });

  it("round fuori calendario: errore", () => {
    expect(findRaceSessionForRound(99, SESSIONS).ok).toBe(false);
  });

  it("copre l'intero calendario dell'app senza collisioni (finestra di 36h)", () => {
    // Due GP del nostro calendario non devono mai cadere nella stessa finestra.
    const times = RACES_2026.map((r) => new Date(r.date).getTime()).sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThan(2 * 36 * 60 * 60 * 1000);
    }
  });
});

describe("findSessionInMeeting", () => {
  it("riconosce le sessioni del weekend sprint per nome", () => {
    expect(findSessionInMeeting(SESSIONS, 1280, "sprint_shootout")?.session_key).toBe(11239);
    expect(findSessionInMeeting(SESSIONS, 1280, "sprint")?.session_key).toBe(11240);
    expect(findSessionInMeeting(SESSIONS, 1280, "qualifying")?.session_key).toBe(11244);
    expect(findSessionInMeeting(SESSIONS, 1280, "race")?.session_key).toBe(11245);
  });

  it("non confonde meeting diversi", () => {
    expect(findSessionInMeeting(SESSIONS, 1294, "sprint")).toBeNull();
  });
});

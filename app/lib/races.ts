import type { Race } from "./types";

export const RACES_2026: Race[] = [
  { round: 1, name: "Australian Grand Prix", circuit: "Albert Park", flag: "\u{1F1E6}\u{1F1FA}", date: "2026-03-08T04:00:00Z", sprint: false },
  { round: 2, name: "Chinese Grand Prix", circuit: "Shanghai", flag: "\u{1F1E8}\u{1F1F3}", date: "2026-03-15T07:00:00Z", sprint: true },
  { round: 3, name: "Japanese Grand Prix", circuit: "Suzuka", flag: "\u{1F1EF}\u{1F1F5}", date: "2026-03-29T05:00:00Z", sprint: false },
  { round: 4, name: "Bahrain Grand Prix", circuit: "Sakhir", flag: "\u{1F1E7}\u{1F1ED}", date: "2026-04-12T15:00:00Z", sprint: false },
  { round: 5, name: "Saudi Arabian Grand Prix", circuit: "Jeddah", flag: "\u{1F1F8}\u{1F1E6}", date: "2026-04-19T17:00:00Z", sprint: false },
  { round: 6, name: "Miami Grand Prix", circuit: "Miami", flag: "\u{1F1FA}\u{1F1F8}", date: "2026-05-03T20:00:00Z", sprint: true },
  { round: 7, name: "Canadian Grand Prix", circuit: "Montr\u00E9al", flag: "\u{1F1E8}\u{1F1E6}", date: "2026-05-24T20:00:00Z", sprint: true },
  { round: 8, name: "Monaco Grand Prix", circuit: "Monte Carlo", flag: "\u{1F1F2}\u{1F1E8}", date: "2026-06-07T13:00:00Z", sprint: false },
  { round: 9, name: "Barcelona Grand Prix", circuit: "Catalunya", flag: "\u{1F1EA}\u{1F1F8}", date: "2026-06-14T13:00:00Z", sprint: false },
  { round: 10, name: "Austrian Grand Prix", circuit: "Spielberg", flag: "\u{1F1E6}\u{1F1F9}", date: "2026-06-28T13:00:00Z", sprint: false },
  { round: 11, name: "British Grand Prix", circuit: "Silverstone", flag: "\u{1F1EC}\u{1F1E7}", date: "2026-07-05T14:00:00Z", sprint: true },
  { round: 12, name: "Belgian Grand Prix", circuit: "Spa", flag: "\u{1F1E7}\u{1F1EA}", date: "2026-07-19T13:00:00Z", sprint: false },
  { round: 13, name: "Hungarian Grand Prix", circuit: "Budapest", flag: "\u{1F1ED}\u{1F1FA}", date: "2026-07-26T13:00:00Z", sprint: false },
  { round: 14, name: "Dutch Grand Prix", circuit: "Zandvoort", flag: "\u{1F1F3}\u{1F1F1}", date: "2026-08-23T13:00:00Z", sprint: true },
  { round: 15, name: "Italian Grand Prix", circuit: "Monza", flag: "\u{1F1EE}\u{1F1F9}", date: "2026-09-06T13:00:00Z", sprint: false },
  { round: 16, name: "Spanish Grand Prix", circuit: "Madrid", flag: "\u{1F1EA}\u{1F1F8}", date: "2026-09-13T13:00:00Z", sprint: false },
  { round: 17, name: "Azerbaijan Grand Prix", circuit: "Baku", flag: "\u{1F1E6}\u{1F1FF}", date: "2026-09-26T11:00:00Z", sprint: false },
  { round: 18, name: "Singapore Grand Prix", circuit: "Marina Bay", flag: "\u{1F1F8}\u{1F1EC}", date: "2026-10-11T12:00:00Z", sprint: true },
  { round: 19, name: "United States Grand Prix", circuit: "Austin", flag: "\u{1F1FA}\u{1F1F8}", date: "2026-10-25T20:00:00Z", sprint: false },
  { round: 20, name: "Mexico City Grand Prix", circuit: "Mexico City", flag: "\u{1F1F2}\u{1F1FD}", date: "2026-11-01T20:00:00Z", sprint: false },
  { round: 21, name: "Brazilian Grand Prix", circuit: "S\u00E3o Paulo", flag: "\u{1F1E7}\u{1F1F7}", date: "2026-11-08T17:00:00Z", sprint: false },
  { round: 22, name: "Las Vegas Grand Prix", circuit: "Las Vegas", flag: "\u{1F1FA}\u{1F1F8}", date: "2026-11-22T04:00:00Z", sprint: false },
  { round: 23, name: "Qatar Grand Prix", circuit: "Lusail", flag: "\u{1F1F6}\u{1F1E6}", date: "2026-11-29T16:00:00Z", sprint: false },
  { round: 24, name: "Abu Dhabi Grand Prix", circuit: "Abu Dhabi", flag: "\u{1F1E6}\u{1F1EA}", date: "2026-12-06T13:00:00Z", sprint: false },
];

export function getNextRace(): Race {
  const now = new Date();
  return RACES_2026.find((r) => new Date(r.date) > now) || RACES_2026[0];
}

export function getUpcomingRaces(count = 5): Race[] {
  const now = new Date();
  return RACES_2026.filter((r) => new Date(r.date) > now).slice(0, count);
}

export function getPastRaces(): Race[] {
  const now = new Date();
  return RACES_2026.filter((r) => new Date(r.date) <= now);
}

export function getCurrentRound(): number {
  return getNextRace().round;
}

export function getRaceByRound(round: number): Race | undefined {
  return RACES_2026.find((r) => r.round === round);
}

// ─── Sessioni weekend ───

export interface Session {
  name: string;
  shortName: string;
  day: string; // "Venerdì", "Sabato", "Domenica"
  dateTime: string; // ISO string
  type: "practice" | "qualifying" | "sprint_shootout" | "sprint" | "race";
}

/** Genera le sessioni del weekend basandosi sulla data della gara */
export function getWeekendSessions(race: Race): Session[] {
  const raceDate = new Date(race.date);
  const raceDay = raceDate.getDay(); // 0=dom

  // Calcola venerdì e sabato relativi alla gara (domenica)
  const friday = new Date(raceDate);
  friday.setDate(raceDate.getDate() - 2);
  const saturday = new Date(raceDate);
  saturday.setDate(raceDate.getDate() - 1);

  if (race.sprint) {
    // Weekend Sprint: FP1 (ven), Sprint Shootout (ven), Sprint (sab), Qualifica (sab), Gara (dom)
    return [
      { name: "Prove Libere 1", shortName: "FP1", day: "Venerdì", dateTime: setTime(friday, 13, 30), type: "practice" },
      { name: "Sprint Shootout", shortName: "SQ", day: "Venerdì", dateTime: setTime(friday, 17, 30), type: "sprint_shootout" },
      { name: "Sprint Race", shortName: "Sprint", day: "Sabato", dateTime: setTime(saturday, 12, 0), type: "sprint" },
      { name: "Qualifiche", shortName: "Quali", day: "Sabato", dateTime: setTime(saturday, 16, 0), type: "qualifying" },
      { name: "Gran Premio", shortName: "Gara", day: "Domenica", dateTime: race.date, type: "race" },
    ];
  }

  // Weekend normale: FP1 (ven), FP2 (ven), FP3 (sab), Qualifica (sab), Gara (dom)
  return [
    { name: "Prove Libere 1", shortName: "FP1", day: "Venerdì", dateTime: setTime(friday, 13, 30), type: "practice" },
    { name: "Prove Libere 2", shortName: "FP2", day: "Venerdì", dateTime: setTime(friday, 17, 0), type: "practice" },
    { name: "Prove Libere 3", shortName: "FP3", day: "Sabato", dateTime: setTime(saturday, 12, 30), type: "practice" },
    { name: "Qualifiche", shortName: "Quali", day: "Sabato", dateTime: setTime(saturday, 16, 0), type: "qualifying" },
    { name: "Gran Premio", shortName: "Gara", day: "Domenica", dateTime: race.date, type: "race" },
  ];
}

function setTime(date: Date, hours: number, minutes: number): string {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/** Calcola la deadline: prima delle qualifiche (normali) o Sprint Shootout (sprint) */
export function getDeadline(race: Race): string {
  const sessions = getWeekendSessions(race);
  if (race.sprint) {
    const sq = sessions.find((s) => s.type === "sprint_shootout");
    return sq?.dateTime || race.date;
  }
  const quali = sessions.find((s) => s.type === "qualifying");
  return quali?.dateTime || race.date;
}

/** Controlla se siamo dopo la deadline */
export function isAfterDeadline(race: Race): boolean {
  return new Date() >= new Date(getDeadline(race));
}

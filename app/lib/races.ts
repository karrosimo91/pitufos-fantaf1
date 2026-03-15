import type { Race } from "./types";

export const RACES_2026: Race[] = [
  { round: 1,  name: "Australian Grand Prix",     circuit: "Albert Park",  flag: "🇦🇺", countryCode: "au", date: "2026-03-08T04:00:00Z", deadline: "2026-03-07T05:00:00Z", sprint: false },
  { round: 2,  name: "Chinese Grand Prix",        circuit: "Shanghai",     flag: "🇨🇳", countryCode: "cn", date: "2026-03-15T07:00:00Z", deadline: "2026-03-13T07:30:00Z", sprint: true },
  { round: 3,  name: "Japanese Grand Prix",        circuit: "Suzuka",       flag: "🇯🇵", countryCode: "jp", date: "2026-03-29T05:00:00Z", deadline: "2026-03-28T06:00:00Z", sprint: false },
  { round: 4,  name: "Bahrain Grand Prix",         circuit: "Sakhir",       flag: "🇧🇭", countryCode: "bh", date: "2026-04-12T15:00:00Z", deadline: "2026-04-11T16:00:00Z", sprint: false },
  { round: 5,  name: "Saudi Arabian Grand Prix",   circuit: "Jeddah",       flag: "🇸🇦", countryCode: "sa", date: "2026-04-19T17:00:00Z", deadline: "2026-04-18T17:00:00Z", sprint: false },
  { round: 6,  name: "Miami Grand Prix",           circuit: "Miami",        flag: "🇺🇸", countryCode: "us", date: "2026-05-03T20:00:00Z", deadline: "2026-05-01T20:30:00Z", sprint: true },
  { round: 7,  name: "Canadian Grand Prix",        circuit: "Montréal",     flag: "🇨🇦", countryCode: "ca", date: "2026-05-24T20:00:00Z", deadline: "2026-05-22T20:30:00Z", sprint: true },
  { round: 8,  name: "Monaco Grand Prix",          circuit: "Monte Carlo",  flag: "🇲🇨", countryCode: "mc", date: "2026-06-07T13:00:00Z", deadline: "2026-06-06T14:00:00Z", sprint: false },
  { round: 9,  name: "Barcelona Grand Prix",       circuit: "Catalunya",    flag: "🇪🇸", countryCode: "es", date: "2026-06-14T13:00:00Z", deadline: "2026-06-13T14:00:00Z", sprint: false },
  { round: 10, name: "Austrian Grand Prix",        circuit: "Spielberg",    flag: "🇦🇹", countryCode: "at", date: "2026-06-28T13:00:00Z", deadline: "2026-06-27T14:00:00Z", sprint: false },
  { round: 11, name: "British Grand Prix",         circuit: "Silverstone",  flag: "🇬🇧", countryCode: "gb", date: "2026-07-05T14:00:00Z", deadline: "2026-07-03T15:30:00Z", sprint: true },
  { round: 12, name: "Belgian Grand Prix",         circuit: "Spa",          flag: "🇧🇪", countryCode: "be", date: "2026-07-19T13:00:00Z", deadline: "2026-07-18T14:00:00Z", sprint: false },
  { round: 13, name: "Hungarian Grand Prix",       circuit: "Budapest",     flag: "🇭🇺", countryCode: "hu", date: "2026-07-26T13:00:00Z", deadline: "2026-07-25T14:00:00Z", sprint: false },
  { round: 14, name: "Dutch Grand Prix",           circuit: "Zandvoort",    flag: "🇳🇱", countryCode: "nl", date: "2026-08-23T13:00:00Z", deadline: "2026-08-21T14:30:00Z", sprint: true },
  { round: 15, name: "Italian Grand Prix",         circuit: "Monza",        flag: "🇮🇹", countryCode: "it", date: "2026-09-06T13:00:00Z", deadline: "2026-09-05T14:00:00Z", sprint: false },
  { round: 16, name: "Spanish Grand Prix",         circuit: "Madrid",       flag: "🇪🇸", countryCode: "es", date: "2026-09-13T13:00:00Z", deadline: "2026-09-12T14:00:00Z", sprint: false },
  { round: 17, name: "Azerbaijan Grand Prix",      circuit: "Baku",         flag: "🇦🇿", countryCode: "az", date: "2026-09-26T11:00:00Z", deadline: "2026-09-25T12:00:00Z", sprint: false },
  { round: 18, name: "Singapore Grand Prix",       circuit: "Marina Bay",   flag: "🇸🇬", countryCode: "sg", date: "2026-10-11T12:00:00Z", deadline: "2026-10-09T12:30:00Z", sprint: true },
  { round: 19, name: "United States Grand Prix",   circuit: "Austin",       flag: "🇺🇸", countryCode: "us", date: "2026-10-25T20:00:00Z", deadline: "2026-10-24T21:00:00Z", sprint: false },
  { round: 20, name: "Mexico City Grand Prix",     circuit: "Mexico City",  flag: "🇲🇽", countryCode: "mx", date: "2026-11-01T20:00:00Z", deadline: "2026-10-31T21:00:00Z", sprint: false },
  { round: 21, name: "Brazilian Grand Prix",       circuit: "São Paulo",    flag: "🇧🇷", countryCode: "br", date: "2026-11-08T17:00:00Z", deadline: "2026-11-07T18:00:00Z", sprint: false },
  { round: 22, name: "Las Vegas Grand Prix",       circuit: "Las Vegas",    flag: "🇺🇸", countryCode: "us", date: "2026-11-22T04:00:00Z", deadline: "2026-11-21T04:00:00Z", sprint: false },
  { round: 23, name: "Qatar Grand Prix",           circuit: "Lusail",       flag: "🇶🇦", countryCode: "qa", date: "2026-11-29T16:00:00Z", deadline: "2026-11-28T18:00:00Z", sprint: false },
  { round: 24, name: "Abu Dhabi Grand Prix",       circuit: "Abu Dhabi",    flag: "🇦🇪", countryCode: "ae", date: "2026-12-06T13:00:00Z", deadline: "2026-12-05T14:00:00Z", sprint: false },
];

/** Giorno dopo la gara (mezzanotte UTC del lunedì) */
function raceEndDate(race: Race): Date {
  const d = new Date(race.date);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getNextRace(): Race {
  const now = new Date();
  return RACES_2026.find((r) => raceEndDate(r) > now) || RACES_2026[0];
}

export function getUpcomingRaces(count = 5): Race[] {
  const now = new Date();
  return RACES_2026.filter((r) => raceEndDate(r) > now).slice(0, count);
}

export function getPastRaces(): Race[] {
  const now = new Date();
  return RACES_2026.filter((r) => raceEndDate(r) <= now);
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

/** Deadline: prima delle qualifiche (normali) o Sprint Shootout (sprint) */
export function getDeadline(race: Race): string {
  return race.deadline;
}

/** Controlla se siamo dopo la deadline */
export function isAfterDeadline(race: Race): boolean {
  return new Date() >= new Date(getDeadline(race));
}

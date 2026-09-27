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
  // Bahrain GP recuperato a Sepang (Malesia), 2-4 ottobre 2026: gara domenica 15:00 locali (UTC+8),
  // qualifiche sabato 16:00 locali. Inserito come round 18: i round successivi scalano di uno (25 slot).
  { round: 18, name: "Bahrain Grand Prix",         circuit: "Sepang",       flag: "🇲🇾", countryCode: "my", date: "2026-10-04T07:00:00Z", deadline: "2026-10-03T08:00:00Z", sprint: false },
  { round: 19, name: "Singapore Grand Prix",       circuit: "Marina Bay",   flag: "🇸🇬", countryCode: "sg", date: "2026-10-11T12:00:00Z", deadline: "2026-10-09T12:30:00Z", sprint: true },
  { round: 20, name: "United States Grand Prix",   circuit: "Austin",       flag: "🇺🇸", countryCode: "us", date: "2026-10-25T20:00:00Z", deadline: "2026-10-24T21:00:00Z", sprint: false },
  { round: 21, name: "Mexico City Grand Prix",     circuit: "Mexico City",  flag: "🇲🇽", countryCode: "mx", date: "2026-11-01T20:00:00Z", deadline: "2026-10-31T21:00:00Z", sprint: false },
  { round: 22, name: "Brazilian Grand Prix",       circuit: "São Paulo",    flag: "🇧🇷", countryCode: "br", date: "2026-11-08T17:00:00Z", deadline: "2026-11-07T18:00:00Z", sprint: false },
  { round: 23, name: "Las Vegas Grand Prix",       circuit: "Las Vegas",    flag: "🇺🇸", countryCode: "us", date: "2026-11-22T04:00:00Z", deadline: "2026-11-21T04:00:00Z", sprint: false },
  { round: 24, name: "Qatar Grand Prix",           circuit: "Lusail",       flag: "🇶🇦", countryCode: "qa", date: "2026-11-29T16:00:00Z", deadline: "2026-11-28T18:00:00Z", sprint: false },
  { round: 25, name: "Abu Dhabi Grand Prix",       circuit: "Abu Dhabi",    flag: "🇦🇪", countryCode: "ae", date: "2026-12-06T13:00:00Z", deadline: "2026-12-05T14:00:00Z", sprint: false },
];

/** Ultimo round in calendario (slot, cancellati compresi): 25 dal 27/09/2026, con Sepang al 18. */
export const LAST_ROUND = RACES_2026[RACES_2026.length - 1].round;
export const TOTAL_ROUNDS = RACES_2026.length;

/** Giorno dopo la gara (mezzanotte UTC del lunedì): da qui il round successivo diventa "corrente". */
export function raceEndDate(race: Race): Date {
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

// ─── Fasi del round ───
//
// "prepara": formazione aperta, si arriva alla deadline.
// "weekend": dalla deadline alla mezzanotte UTC dopo la gara (sessioni in
//            corso o appena concluse, il round è ancora quello corrente).
// "recap":   gara finita e round passato: resta consultabile finché non
//            chiude la formazione del round successivo.
export type RoundPhase = "prepara" | "weekend" | "recap";

export function getRacePhase(race: Race, now: Date = new Date()): RoundPhase {
  if (now < new Date(race.deadline)) return "prepara";
  if (now < raceEndDate(race)) return "weekend";
  return "recap";
}

/** Ultimo GP concluso (mezzanotte UTC dopo la gara già passata). */
export function getLastCompletedRace(now: Date = new Date()): Race | null {
  const past = RACES_2026.filter((r) => raceEndDate(r) <= now);
  return past.length > 0 ? past[past.length - 1] : null;
}

/**
 * Il round il cui recap è ancora "attuale": l'ultimo GP concluso, finché non
 * chiude la formazione del round successivo. Dal lunedì alla deadline
 * successiva la Home e la pagina Gara mostrano ancora il weekend appena fatto
 * invece di un vuoto "nessuna sessione live".
 */
export function getRecapRace(now: Date = new Date()): Race | null {
  const last = getLastCompletedRace(now);
  if (!last) return null;
  const next = RACES_2026.find((r) => r.round > last.round);
  if (next && now >= new Date(next.deadline)) return null;
  return last;
}

const GIORNI = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];
const MESI = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];

/** "VEN 9 OTT · 14:30" nell'ora locale del browser. */
export function formatDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} · ${hh}:${mm}`;
}

/** "LUN 02:00" nell'ora locale (per "riapre lunedì alle 02:00"). */
export function formatWeekdayTimeLocal(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${GIORNI[date.getDay()]} ${hh}:${mm}`;
}

/** "tra 2 g 4 h", "tra 3 h 12 min", "tra 45 min", "adesso"; null se passato. */
export function formatRelative(targetIso: string, now: Date = new Date()): string | null {
  const diff = new Date(targetIso).getTime() - now.getTime();
  if (diff <= 0) return null;
  const min = Math.floor(diff / 60_000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `tra ${d} g ${h % 24} h`;
  if (h >= 1) return `tra ${h} h ${min % 60} min`;
  if (min >= 1) return `tra ${min} min`;
  return "adesso";
}

/** Millisecondi alla deadline (negativo se passata). */
export function msToDeadline(race: Race, now: Date = new Date()): number {
  return new Date(race.deadline).getTime() - now.getTime();
}

/** Nome breve del GP per etichette ("Baku", "Singapore"): la città del circuito. */
export function raceShortName(race: Race): string {
  return race.circuit;
}

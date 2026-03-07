import type { Driver } from "./types";

const OPENF1_BASE = "https://api.openf1.org/v1";
const JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1";

// ─── OpenF1 ───

export async function getDrivers(sessionKey?: string): Promise<Driver[]> {
  const params = sessionKey ? `?session_key=${sessionKey}` : "?session_key=latest";
  const res = await fetch(`${OPENF1_BASE}/drivers${params}`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  return res.json();
}

export async function getSessions(year = 2025) {
  const res = await fetch(`${OPENF1_BASE}/sessions?year=${year}`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  return res.json();
}

export async function getMeetings(year = 2025) {
  const res = await fetch(`${OPENF1_BASE}/meetings?year=${year}`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  return res.json();
}

// ─── Jolpica ───

export async function getCalendar() {
  const res = await fetch(`${JOLPICA_BASE}/current.json`, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.MRData?.RaceTable?.Races || [];
}

export async function getDriverStandings() {
  const res = await fetch(`${JOLPICA_BASE}/current/driverstandings.json`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
}

export async function getConstructorStandings() {
  const res = await fetch(`${JOLPICA_BASE}/current/constructorstandings.json`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
}

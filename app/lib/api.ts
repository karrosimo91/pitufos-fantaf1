import type { Driver } from "./types";

// Fonte dati unica: OpenF1. Jolpica/Ergast non si usa — numera i round
// saltando le gare cancellate, quindi col nostro numero di round risponde con
// un'altra gara (2026: le due gare cancellate ci sfasano di due).
const OPENF1_BASE = "https://api.openf1.org/v1";

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

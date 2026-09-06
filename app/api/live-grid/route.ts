import { NextRequest, NextResponse } from "next/server";
import { buildGridMap } from "../../lib/starting-grid";

const OPENF1 = "https://api.openf1.org/v1";

async function getToken(): Promise<string | null> {
  const username = process.env.OPENF1_USERNAME;
  const password = process.env.OPENF1_PASSWORD;
  if (!username || !password) return null;

  try {
    const res = await fetch("https://api.openf1.org/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "password", username, password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/live-grid?meeting_key=123
 * Griglia di partenza reale (`starting_grid` della gara), che include le
 * penalità in griglia. Fallback sulle posizioni di qualifica se il dato non è
 * ancora pubblicato. Autenticato con token OpenF1.
 */
export async function GET(request: NextRequest) {
  const meetingKey = request.nextUrl.searchParams.get("meeting_key");
  if (!meetingKey) {
    return NextResponse.json({ grid: {} }, { status: 400 });
  }

  try {
    const token = await getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const opts = { headers, cache: "no-store" as RequestCache };

    const sessRes = await fetch(`${OPENF1}/sessions?meeting_key=${meetingKey}`, opts);
    if (!sessRes.ok) return NextResponse.json({ grid: {} });

    const sessions = await sessRes.json();
    const name = (s: { session_name?: string }) => s.session_name?.toLowerCase() ?? "";
    const raceSession = sessions.find((s: { session_name?: string }) => name(s) === "race");
    const qualiSession = sessions.find((s: { session_name?: string }) => name(s) === "qualifying");

    // Fonte primaria: starting_grid della gara (penalità in griglia incluse)
    let startingGrid: { driver_number?: number | null; position?: number | null }[] = [];
    if (raceSession) {
      const sgRes = await fetch(`${OPENF1}/starting_grid?session_key=${raceSession.session_key}`, opts);
      if (sgRes.ok) startingGrid = await sgRes.json();
    }

    // Fallback: posizioni di qualifica
    let qualiPositions: { driver_number: number; position: number }[] = [];
    if (qualiSession) {
      const posRes = await fetch(`${OPENF1}/position?session_key=${qualiSession.session_key}`, opts);
      if (posRes.ok) qualiPositions = await posRes.json();
    }

    const { grid: gridMap, source } = buildGridMap(startingGrid, qualiPositions);
    const grid: Record<number, number> = {};
    for (const [driverNumber, position] of gridMap) {
      grid[driverNumber] = position;
    }

    return NextResponse.json({ grid, source });
  } catch {
    return NextResponse.json({ grid: {} });
  }
}

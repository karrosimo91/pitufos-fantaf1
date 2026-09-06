import { NextRequest, NextResponse } from "next/server";
import { buildGridMap } from "../../lib/starting-grid";
import { RACES_2026 } from "../../lib/races";

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
 * Risolve il meeting_key di un round come fa /api/fetch-risultati:
 * meeting della stagione in ordine di data, escludendo i test pre-stagione.
 */
async function meetingKeyForRound(round: number, opts: RequestInit): Promise<string | null> {
  const year = new Date().getFullYear();
  const res = await fetch(`${OPENF1}/meetings?year=${year}`, opts);
  if (!res.ok) return null;
  const all = await res.json();
  const meetings = all
    .filter((m: { meeting_name?: string }) => !m.meeting_name?.toLowerCase().includes("testing"))
    .sort((a: { date_start: string }, b: { date_start: string }) =>
      new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
  return meetings[round - 1]?.meeting_key?.toString() ?? null;
}

/**
 * GET /api/live-grid?meeting_key=123  (oppure ?round=15)
 * Griglia di partenza reale (`starting_grid` della gara), che include le
 * penalità in griglia. Fallback sulle posizioni di qualifica se il dato non è
 * ancora pubblicato. Autenticato con token OpenF1.
 *
 * La response include `source` ("starting_grid" | "qualifying" | "none"):
 * serve a capire al volo se il delta posizioni sta usando la griglia vera o il
 * fallback. `debug=1` aggiunge il conteggio delle righe delle due fonti.
 */
export async function GET(request: NextRequest) {
  const roundParam = request.nextUrl.searchParams.get("round");
  const debug = request.nextUrl.searchParams.get("debug") === "1";
  let meetingKey = request.nextUrl.searchParams.get("meeting_key");

  if (!meetingKey && !roundParam) {
    return NextResponse.json({ grid: {} }, { status: 400 });
  }

  try {
    const token = await getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const opts = { headers, cache: "no-store" as RequestCache };

    if (!meetingKey && roundParam) {
      const round = Number(roundParam);
      if (!RACES_2026.some((r) => r.round === round)) {
        return NextResponse.json({ grid: {}, error: "round non valido" }, { status: 400 });
      }
      meetingKey = await meetingKeyForRound(round, opts);
      if (!meetingKey) {
        return NextResponse.json({ grid: {}, error: "meeting non trovato per il round" }, { status: 404 });
      }
    }

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

    if (debug) {
      return NextResponse.json({
        grid,
        source,
        debug: {
          meeting_key: meetingKey,
          race_session_key: raceSession?.session_key ?? null,
          quali_session_key: qualiSession?.session_key ?? null,
          starting_grid_rows: startingGrid.length,
          quali_position_rows: qualiPositions.length,
          token: token ? "ok" : "assente",
        },
      });
    }

    return NextResponse.json({ grid, source });
  } catch {
    return NextResponse.json({ grid: {} });
  }
}

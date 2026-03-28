import { NextRequest, NextResponse } from "next/server";

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
 * Grid positions dalla qualifica. Autenticato con token OpenF1.
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
    const qualiSession = sessions.find((s: { session_name?: string }) =>
      s.session_name?.toLowerCase() === "qualifying"
    );
    if (!qualiSession) return NextResponse.json({ grid: {} });

    const posRes = await fetch(`${OPENF1}/position?session_key=${qualiSession.session_key}`, opts);
    if (!posRes.ok) return NextResponse.json({ grid: {} });

    const posData = await posRes.json();

    const grid: Record<number, number> = {};
    for (const p of posData) {
      if (p.driver_number && p.position) {
        grid[p.driver_number] = p.position;
      }
    }

    return NextResponse.json({ grid });
  } catch {
    return NextResponse.json({ grid: {} });
  }
}

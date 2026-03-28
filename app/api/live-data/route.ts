import { NextRequest, NextResponse } from "next/server";

const OPENF1 = "https://api.openf1.org/v1";

/**
 * GET /api/live-data?session_key=123
 * Proxy server-side per fetch dati live OpenF1 (evita CORS).
 * Restituisce posizioni, race_control, laps, stints per una sessione.
 */
export async function GET(request: NextRequest) {
  const sessionKey = request.nextUrl.searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key richiesto" }, { status: 400 });
  }

  // Ottieni token
  const username = process.env.OPENF1_USERNAME;
  const password = process.env.OPENF1_PASSWORD;
  let headers: Record<string, string> = {};

  if (username && password) {
    try {
      const tokenRes = await fetch("https://api.openf1.org/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "password", username, password }),
      });
      if (tokenRes.ok) {
        const { access_token } = await tokenRes.json();
        if (access_token) headers = { Authorization: `Bearer ${access_token}` };
      }
    } catch { /* continua senza auth */ }
  }

  const opts = { headers, cache: "no-store" as RequestCache };

  try {
    const [posRes, rcRes, lapRes, stintRes] = await Promise.all([
      fetch(`${OPENF1}/position?session_key=${sessionKey}`, opts),
      fetch(`${OPENF1}/race_control?session_key=${sessionKey}`, opts),
      fetch(`${OPENF1}/laps?session_key=${sessionKey}`, opts),
      fetch(`${OPENF1}/stints?session_key=${sessionKey}`, opts),
    ]);

    const positions = posRes.ok ? await posRes.json() : [];
    const raceControl = rcRes.ok ? await rcRes.json() : [];
    const laps = lapRes.ok ? await lapRes.json() : [];
    const stints = stintRes.ok ? await stintRes.json() : [];

    return NextResponse.json({ positions, raceControl, laps, stints });
  } catch {
    return NextResponse.json({ positions: [], raceControl: [], laps: [], stints: [] });
  }
}

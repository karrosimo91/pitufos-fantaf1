import { NextResponse } from "next/server";

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
 * GET /api/live-session
 * Controlla se c'è una sessione F1 attiva. Autenticato con token OpenF1.
 */
export async function GET() {
  try {
    const token = await getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const year = new Date().getFullYear();

    const res = await fetch(`${OPENF1}/sessions?year=${year}`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ session: null });
    }

    const sessions = await res.json();
    const now = new Date();

    // Buffer pre-sessione molto stretto (2 min): copre eventuali drift d'orario
    // negli annunci OpenF1 ma NON blocca il mercato 30 min prima.
    // Buffer post-sessione più ampio (30 min): le sessioni possono finire in
    // ritardo (red flag, safety car finale) e i dati live arrivano ancora per un po'.
    const PRE_BUFFER_MS = 2 * 60 * 1000;
    const POST_BUFFER_MS = 30 * 60 * 1000;

    for (const s of sessions) {
      if (!s.date_start || !s.date_end) continue;

      const start = new Date(s.date_start);
      const end = new Date(s.date_end);
      const liveStart = new Date(start.getTime() - PRE_BUFFER_MS);
      const liveEnd = new Date(end.getTime() + POST_BUFFER_MS);

      if (now >= liveStart && now <= liveEnd) {
        return NextResponse.json({
          session: {
            sessionKey: s.session_key,
            sessionType: s.session_type || "",
            sessionName: s.session_name || "",
            meetingKey: s.meeting_key,
          },
        });
      }
    }

    return NextResponse.json({ session: null });
  } catch {
    return NextResponse.json({ session: null });
  }
}

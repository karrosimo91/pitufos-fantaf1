import { NextResponse } from "next/server";

const OPENF1 = "https://api.openf1.org/v1";

/**
 * GET /api/live-session
 * Controlla se c'è una sessione F1 attiva in questo momento.
 * Chiamata server-side per evitare CORS.
 */
export async function GET() {
  try {
    const year = new Date().getFullYear();
    const res = await fetch(`${OPENF1}/sessions?year=${year}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ session: null });
    }

    const sessions = await res.json();
    const now = new Date();

    // Trova sessione in corso (finestra: 30 min prima → 30 min dopo)
    for (const s of sessions) {
      if (!s.date_start || !s.date_end) continue;

      const start = new Date(s.date_start);
      const end = new Date(s.date_end);
      const liveStart = new Date(start.getTime() - 30 * 60 * 1000);
      const liveEnd = new Date(end.getTime() + 30 * 60 * 1000);

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

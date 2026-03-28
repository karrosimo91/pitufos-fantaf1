import { NextRequest, NextResponse } from "next/server";

const OPENF1 = "https://api.openf1.org/v1";

/**
 * GET /api/live-grid?meeting_key=123
 * Restituisce le posizioni dalla qualifica per calcolare pos guadagnate/perse.
 * Proxy server-side per evitare CORS.
 */
export async function GET(request: NextRequest) {
  const meetingKey = request.nextUrl.searchParams.get("meeting_key");
  if (!meetingKey) {
    return NextResponse.json({ grid: {} }, { status: 400 });
  }

  try {
    // Trova sessione qualifica
    const sessRes = await fetch(`${OPENF1}/sessions?meeting_key=${meetingKey}`, { cache: "no-store" });
    if (!sessRes.ok) return NextResponse.json({ grid: {} });

    const sessions = await sessRes.json();
    const qualiSession = sessions.find((s: { session_name?: string }) =>
      s.session_name?.toLowerCase() === "qualifying"
    );
    if (!qualiSession) return NextResponse.json({ grid: {} });

    // Fetch posizioni qualifica
    const posRes = await fetch(`${OPENF1}/position?session_key=${qualiSession.session_key}`, { cache: "no-store" });
    if (!posRes.ok) return NextResponse.json({ grid: {} });

    const posData = await posRes.json();

    // Prendi l'ultima posizione per ogni pilota
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

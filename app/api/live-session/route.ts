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

    // Buffer pre-sessione molto stretto (2 min): copre solo drift d'orario
    // negli annunci OpenF1, NON blocca il mercato troppo presto.
    // Buffer post-sessione più ampio (30 min): le sessioni possono finire in
    // ritardo (red flag, safety car finale) e i dati live arrivano ancora.
    const PRE_BUFFER_MS = 2 * 60 * 1000;
    const POST_BUFFER_MS = 30 * 60 * 1000;

    // Priorità di selezione (fix bug "punteggio bloccato durante sprint"):
    //   1. la sessione DAVVERO in corso ora (now ∈ [start, end])
    //   2. quella nel POST-buffer (appena finita)
    //   3. quella nel PRE-buffer (sta per iniziare)
    // Se ne avessimo prese una nel buffer mentre già è iniziata la successiva,
    // il filtro MQTT scartava i messaggi della nuova session_key e i punteggi
    // restavano stale.
    type SessionPayload = { session_key: number; session_type: string; session_name: string; meeting_key: number };
    let activeNow: SessionPayload | null = null;
    let postBuffered: SessionPayload | null = null;
    let preBuffered: SessionPayload | null = null;

    for (const s of sessions) {
      if (!s.date_start || !s.date_end) continue;

      // Le prove libere (FP1/FP2/FP3) NON attivano il "live": niente punteggio,
      // niente blocco. Il live parte solo da Qualifica / Sprint Shootout in poi.
      const sType = (s.session_type || "").toLowerCase();
      if (sType.includes("practice")) continue;

      const start = new Date(s.date_start);
      const end = new Date(s.date_end);

      const payload: SessionPayload = {
        session_key: s.session_key,
        session_type: s.session_type || "",
        session_name: s.session_name || "",
        meeting_key: s.meeting_key,
      };

      if (now >= start && now <= end) {
        // Vera "live" — priorità massima, prendi questa e basta
        activeNow = payload;
        break;
      }
      if (now > end && now <= new Date(end.getTime() + POST_BUFFER_MS)) {
        // La sessione più recente nel post-buffer (sovrascrive se ne ho trovate prima)
        postBuffered = payload;
      }
      if (now < start && now >= new Date(start.getTime() - PRE_BUFFER_MS)) {
        // La prossima sessione nel pre-buffer
        if (!preBuffered) preBuffered = payload;
      }
    }

    const chosen = activeNow ?? postBuffered ?? preBuffered;

    if (chosen) {
      return NextResponse.json({
        session: {
          sessionKey: chosen.session_key,
          sessionType: chosen.session_type,
          sessionName: chosen.session_name,
          meetingKey: chosen.meeting_key,
        },
      });
    }

    return NextResponse.json({ session: null });
  } catch {
    return NextResponse.json({ session: null });
  }
}

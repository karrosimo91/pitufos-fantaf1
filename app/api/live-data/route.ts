import { NextRequest, NextResponse } from "next/server";
import { OPENF1, getOpenF1Token, fetchOpenF1 } from "../../lib/openf1-server";

/**
 * GET /api/live-data?session_key=123[&since=ISO]
 * Proxy server-side per fetch dati live OpenF1 (evita CORS).
 * Restituisce posizioni, race_control, laps, stints per una sessione.
 *
 * `since`: riallineamento parziale. Posizioni e giri solo dall'istante
 * indicato in poi (`date>=`), race control e stint completi (sono piccoli).
 * La risposta porta `partial: true` e il client FONDE invece di sostituire.
 * Serve al live quando la WebSocket si riconnette o le posizioni sono ferme:
 * chiedere ogni volta l'intera sessione (migliaia di righe a fine gara, da
 * ogni telefono) è quello che fa scattare il 429 di OpenF1.
 *
 * `positionsOk`: false se la chiamata alle posizioni è fallita (429 anche
 * dopo i tentativi): il client non deve considerare la classifica verificata.
 */
export async function GET(request: NextRequest) {
  const sessionKey = request.nextUrl.searchParams.get("session_key");
  const sinceParam = request.nextUrl.searchParams.get("since");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key richiesto" }, { status: 400 });
  }

  // `since` in ISO con "Z" (niente "+00:00" nell'URL, che qualche server legge
  // come spazio) e un secondo di margine: le date OpenF1 hanno i microsecondi,
  // `toISOString` si ferma ai millisecondi.
  let since: string | null = null;
  if (sinceParam) {
    const t = Date.parse(sinceParam);
    if (Number.isFinite(t)) since = new Date(t - 1000).toISOString();
  }
  const dateFilter = since ? `&date>=${encodeURIComponent(since)}` : "";
  const lapFilter = since ? `&date_start>=${encodeURIComponent(since)}` : "";

  try {
    // Un token per tutte le chiamate (prima ne chiedevamo uno a richiesta).
    const token = await getOpenF1Token();
    const [pos, rc, laps, stints] = await Promise.all([
      fetchOpenF1(`${OPENF1}/position?session_key=${sessionKey}${dateFilter}`, { token }),
      fetchOpenF1(`${OPENF1}/race_control?session_key=${sessionKey}`, { token }),
      fetchOpenF1(`${OPENF1}/laps?session_key=${sessionKey}${lapFilter}`, { token }),
      fetchOpenF1(`${OPENF1}/stints?session_key=${sessionKey}`, { token }),
    ]);

    // Se OpenF1 rifiuta il filtro per data (4xx non di rate limit) si ricade
    // sulla lista completa: meglio pesante che ferma.
    let positions = pos.data;
    let positionsOk = pos.ok;
    if (!pos.ok && since && pos.status >= 400 && pos.status < 500 && pos.status !== 429) {
      const full = await fetchOpenF1(`${OPENF1}/position?session_key=${sessionKey}`, { token });
      positions = full.data;
      positionsOk = full.ok;
    }

    return NextResponse.json({
      positions,
      raceControl: rc.data,
      laps: laps.data,
      stints: stints.data,
      partial: !!since,
      positionsOk,
    });
  } catch {
    return NextResponse.json({ positions: [], raceControl: [], laps: [], stints: [], partial: !!since, positionsOk: false });
  }
}

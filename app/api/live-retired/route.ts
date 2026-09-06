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
 * GET /api/live-retired?session_key=123  (aggiungi &debug=1 per la diagnostica)
 *
 * Ritirati della sessione secondo `session_result` di OpenF1 (flag dnf/dsq).
 *
 * Perché serve: il live rileva i ritiri solo dai messaggi `race_control`
 * ("RETIRED", "OUT OF THE RACE"...), ma OpenF1 non emette un messaggio per
 * ogni ritiro — molti passano in silenzio e il malus −10 non arriva mai a chi
 * ha quel pilota. `session_result` porta i flag ufficiali e viene aggiornato
 * durante la sessione, quindi è la fonte giusta anche a gara in corso.
 *
 * Nota: `dns` (non partito) NON è un ritiro e resta fuori — vale 0 punti, non
 * −10, come da regolamento (caso Hadjar round 14).
 */
export async function GET(request: NextRequest) {
  const sessionKey = request.nextUrl.searchParams.get("session_key");
  const debug = request.nextUrl.searchParams.get("debug") === "1";
  if (!sessionKey) {
    return NextResponse.json({ retired: [] }, { status: 400 });
  }

  try {
    const token = await getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${OPENF1}/session_result?session_key=${sessionKey}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ retired: [], ...(debug ? { debug: { status: res.status, token: token ? "ok" : "assente" } } : {}) });
    }

    const rows: { driver_number?: number | null; dnf?: boolean; dsq?: boolean; dns?: boolean }[] = await res.json();
    const retired = rows
      .filter((r) => r?.driver_number && (r.dnf || r.dsq))
      .map((r) => r.driver_number as number);

    if (debug) {
      return NextResponse.json({
        retired,
        debug: {
          status: res.status,
          token: token ? "ok" : "assente",
          session_result_rows: rows.length,
          dnf_rows: rows.filter((r) => r?.dnf).length,
          dsq_rows: rows.filter((r) => r?.dsq).length,
          dns_rows: rows.filter((r) => r?.dns).length,
        },
      });
    }

    return NextResponse.json({ retired });
  } catch {
    return NextResponse.json({ retired: [] });
  }
}

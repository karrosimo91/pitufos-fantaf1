import { NextResponse } from "next/server";

let cachedToken: { access_token: string; expires_at: number } | null = null;

/**
 * GET /api/openf1-token
 * Genera (o restituisce dalla cache) un token OAuth2 per OpenF1 Sponsor.
 * Il client lo usa per connettersi al WebSocket MQTT.
 */
export async function GET() {
  // Restituisci token cachato se ancora valido (con 5 min di margine)
  if (cachedToken && Date.now() < cachedToken.expires_at - 5 * 60 * 1000) {
    return NextResponse.json({ access_token: cachedToken.access_token });
  }

  const username = process.env.OPENF1_USERNAME;
  const password = process.env.OPENF1_PASSWORD;

  if (!username || !password) {
    return NextResponse.json({ error: "Credenziali OpenF1 non configurate" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.openf1.org/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        username,
        password,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "Errore OpenF1 token: " + text }, { status: res.status });
    }

    const data = await res.json();
    const access_token = data.access_token;
    const expires_in = data.expires_in || 3600; // default 1h

    cachedToken = {
      access_token,
      expires_at: Date.now() + expires_in * 1000,
    };

    return NextResponse.json({ access_token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: "Errore fetch token: " + message }, { status: 500 });
  }
}

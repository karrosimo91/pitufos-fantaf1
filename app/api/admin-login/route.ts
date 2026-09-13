import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_MS,
  adminCredentialsConfigured,
  checkAdminCredentials,
  createAdminToken,
  isAdminRequest,
} from "../../lib/admin-auth";

/**
 * POST /api/admin-login  { user, pass } → cookie di sessione httpOnly (12h)
 * GET  /api/admin-login  → 200 se la sessione è valida, 401 altrimenti
 * DELETE /api/admin-login → logout
 *
 * Le credenziali stanno in ADMIN_USER / ADMIN_PASS su Vercel, mai nel client.
 */
export async function POST(request: NextRequest) {
  if (!adminCredentialsConfigured()) {
    return NextResponse.json(
      { error: "Login admin non configurato: impostare ADMIN_USER, ADMIN_PASS e ADMIN_API_KEY nelle variabili d'ambiente" },
      { status: 503 },
    );
  }
  const body = await request.json().catch(() => ({}));
  if (!checkAdminCredentials(body?.user, body?.pass)) {
    return NextResponse.json({ error: "Credenziali errate" }, { status: 401 });
  }
  const token = createAdminToken();
  if (!token) return NextResponse.json({ error: "Impossibile creare la sessione" }, { status: 500 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  });
  return res;
}

export async function GET(request: NextRequest) {
  return isAdminRequest(request)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

// Autenticazione admin lato server.
//
// Prima la pagina /admin aveva utente, password e ADMIN_API_KEY scritti nel
// codice client: finivano nel JavaScript scaricato da ogni giocatore, e con la
// chiave chiunque poteva chiamare reset-round o post-gara. Adesso:
//   - le credenziali stanno solo nelle variabili d'ambiente di Vercel
//     (ADMIN_USER, ADMIN_PASS);
//   - il login (/api/admin-login) rilascia un cookie httpOnly firmato con
//     ADMIN_API_KEY, valido 12 ore;
//   - le route admin accettano il cookie, oppure ancora `admin_key` nel body
//     per gli script (curl): la chiave non viaggia più nel browser.
// Dopo il deploy va ruotata ADMIN_API_KEY su Vercel: quella vecchia è nel
// bundle e nella storia di git.

import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "pitufos_admin";
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string | null {
  return process.env.ADMIN_API_KEY || null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** True se ADMIN_USER e ADMIN_PASS sono configurate lato server. */
export function adminCredentialsConfigured(): boolean {
  return !!(process.env.ADMIN_USER && process.env.ADMIN_PASS && secret());
}

export function checkAdminCredentials(user: unknown, pass: unknown): boolean {
  const u = process.env.ADMIN_USER;
  const p = process.env.ADMIN_PASS;
  if (!u || !p || typeof user !== "string" || typeof pass !== "string") return false;
  return safeEqual(user, u) && safeEqual(pass, p);
}

/** Token di sessione: scadenza + firma. */
export function createAdminToken(now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const exp = String(now + ADMIN_SESSION_TTL_MS);
  return `${exp}.${sign(exp, key)}`;
}

export function verifyAdminToken(token: string | undefined | null, now = Date.now()): boolean {
  const key = secret();
  if (!key || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < now) return false;
  return safeEqual(sig, sign(exp, key));
}

/**
 * Richiesta autorizzata se porta il cookie di sessione valido oppure la
 * chiave admin (body o query) uguale a ADMIN_API_KEY.
 */
export function isAdminRequest(request: NextRequest, adminKey?: unknown): boolean {
  const key = secret();
  if (!key) return false;
  if (typeof adminKey === "string" && adminKey.length > 0 && safeEqual(adminKey, key)) return true;
  return verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

"use client";
// Codice lega arrivato da un link d'invito (/registrati?lega=CODICE o
// /login?lega=CODICE): si conserva finché l'utente non è loggato, poi il
// Muretto lo consuma e lo iscrive alla lega.

const KEY = "pitufos_pending_lega";

export function savePendingLega(code: string) {
  try { localStorage.setItem(KEY, code.toUpperCase().trim()); } catch { /* storage non disponibile */ }
}

export function takePendingLega(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v) localStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}

export function inviteLink(code: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://pitufos-fantaf1.vercel.app";
  return `${base}/registrati?lega=${encodeURIComponent(code)}`;
}

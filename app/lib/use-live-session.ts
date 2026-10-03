"use client";
import { useState, useEffect, useCallback } from "react";

export interface LiveSession {
  sessionKey: number;
  sessionType: string;
  sessionName: string;
  meetingKey: number;
}

const POLL_MS = 60_000;

/**
 * Hook che rileva se c'è una sessione F1 attiva.
 * Chiama il nostro API route /api/live-session (server-side, no CORS).
 *
 * `enabled` (= utente loggato) arriva in modo asincrono: al mount è false.
 * Per questo NON va catturato in una callback con dipendenze vuote: la
 * versione precedente restava congelata su "disabilitato" e il live non si
 * accendeva mai (Sepang 2026, qualifica). Qui il polling parte/riparte
 * dall'effetto quando `enabled` cambia e lo stato "spento" è derivato.
 */
export function useLiveSession(enabled = true) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/live-session", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        if (cancelled) return;
        setSession(data.session || null);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void check();
    const interval = setInterval(check, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [enabled, tick]);

  const active = enabled ? session : null;

  return {
    isLive: !!active,
    session: active,
    loading: enabled ? loading : false,
    refresh,
  };
}

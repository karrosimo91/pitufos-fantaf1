"use client";
import { useState, useEffect, useCallback } from "react";

export interface LiveSession {
  sessionKey: number;
  sessionType: string;
  sessionName: string;
  meetingKey: number;
}

/**
 * Hook che rileva se c'è una sessione F1 attiva.
 * Chiama il nostro API route /api/live-session (server-side, no CORS).
 */
export function useLiveSession() {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/live-session", { cache: "no-store" });
      if (!res.ok) { setLoading(false); return; }

      const data = await res.json();
      setSession(data.session || null);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
    const interval = setInterval(checkSession, 60_000);
    return () => clearInterval(interval);
  }, [checkSession]);

  return {
    isLive: !!session,
    session,
    loading,
    refresh: checkSession,
  };
}

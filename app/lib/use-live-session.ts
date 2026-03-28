"use client";
import { useState, useEffect, useCallback } from "react";

const OPENF1 = "https://api.openf1.org/v1";

export interface LiveSession {
  sessionKey: number;
  sessionType: string; // "Race", "Qualifying", "Sprint", "Sprint Qualifying"
  sessionName: string;
  meetingKey: number;
}

/**
 * Hook che rileva se c'è una sessione F1 attiva in questo momento.
 * Fa polling REST ogni 60 sec su /sessions per la stagione corrente.
 * I dati live OpenF1 sono disponibili da 30 min prima a 30 min dopo la sessione.
 */
export function useLiveSession() {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      // Fetch sessioni anno corrente
      const year = new Date().getFullYear();
      const res = await fetch(`${OPENF1}/sessions?year=${year}`, { cache: "no-store" });
      if (!res.ok) { setLoading(false); return; }

      const sessions = await res.json();
      const now = new Date();

      // Trova sessione in corso (date_start <= now <= date_end + 30min)
      for (const s of sessions) {
        if (!s.date_start || !s.date_end) continue;

        const start = new Date(s.date_start);
        const end = new Date(s.date_end);

        // Finestra live: 30 min prima dell'inizio, 30 min dopo la fine
        const liveStart = new Date(start.getTime() - 30 * 60 * 1000);
        const liveEnd = new Date(end.getTime() + 30 * 60 * 1000);

        if (now >= liveStart && now <= liveEnd) {
          setSession({
            sessionKey: s.session_key,
            sessionType: s.session_type || "",
            sessionName: s.session_name || "",
            meetingKey: s.meeting_key,
          });
          setLoading(false);
          return;
        }
      }

      setSession(null);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
    const interval = setInterval(checkSession, 60_000); // ogni 60 sec
    return () => clearInterval(interval);
  }, [checkSession]);

  return {
    isLive: !!session,
    session,
    loading,
    refresh: checkSession,
  };
}

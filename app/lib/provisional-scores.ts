"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";

const STORAGE_KEY = "lp_provisional_scores";

export interface ProvisionalScore {
  userId: string;
  scuderiaName: string;
  tpName: string;
  points: number;
  piloti: { driver_number: number; position: number; puntiFinali: number; isDnf: boolean }[];
}

export interface ProvisionalData {
  round: number;
  sessionName: string;
  timestamp: string;
  scores: ProvisionalScore[];
}

/**
 * Salva i punteggi provvisori in localStorage.
 * Chiamato dal LiveTab ogni volta che i dati si aggiornano.
 */
export function saveProvisionalScores(data: ProvisionalData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded, skip */ }
}

/**
 * Legge i punteggi provvisori da localStorage.
 */
export function loadProvisionalScores(): ProvisionalData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Cancella i punteggi provvisori.
 */
export function clearProvisionalScores() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* skip */ }
}

/**
 * Hook: controlla se ci sono punteggi provvisori da mostrare.
 * Ritorna i dati provvisori SOLO se:
 * - Non c'è sessione live attiva (la sessione è finita)
 * - Non ci sono ancora risultati ufficiali per quel round (weekend_results)
 */
export function useProvisionalScores(isLive: boolean, currentRound: number) {
  const [provisional, setProvisional] = useState<ProvisionalData | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    // Se live è attivo, non mostrare provvisori (si vedono quelli live)
    if (isLive) {
      setProvisional(null);
      setLoading(false);
      return;
    }

    const data = loadProvisionalScores();
    if (!data || data.round !== currentRound) {
      setProvisional(null);
      setLoading(false);
      return;
    }

    // Controlla se esistono già risultati ufficiali
    if (isSupabaseConfigured) {
      const supabase = createClient();
      if (supabase) {
        const { data: wr } = await supabase
          .from("weekend_scores")
          .select("round")
          .eq("round", currentRound)
          .limit(1);

        if (wr && wr.length > 0) {
          // Risultati ufficiali esistono, cancella provvisori
          clearProvisionalScores();
          setProvisional(null);
          setLoading(false);
          return;
        }
      }
    }

    setProvisional(data);
    setLoading(false);
  }, [isLive, currentRound]);

  useEffect(() => {
    check();
  }, [check]);

  return { provisional, loading, refresh: check };
}

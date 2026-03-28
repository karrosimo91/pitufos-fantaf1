"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";

const STORAGE_KEY = "lp_provisional_scores";

export interface ProvisionalPilotScore {
  driver_number: number;
  position: number;
  puntiFinali: number;
  isDnf: boolean;
}

export interface ProvisionalScore {
  userId: string;
  scuderiaName: string;
  tpName: string;
  points: number;
  piloti: ProvisionalPilotScore[];
}

export interface SessionScores {
  sessionName: string;
  scores: Record<string, number>; // userId → punti di quella sessione
}

export interface ProvisionalData {
  round: number;
  timestamp: string;
  currentSessionName: string;
  // Punteggio totale weekend per giocatore (somma di tutte le sessioni)
  scores: ProvisionalScore[];
  // Storico punti per sessione (per mostrare il breakdown)
  sessions: SessionScores[];
}

/**
 * Salva i punteggi provvisori accumulando le sessioni del weekend.
 * Se la sessione è già stata salvata, aggiorna. Se è nuova, aggiunge.
 */
export function saveProvisionalScores(
  round: number,
  sessionName: string,
  currentScores: ProvisionalScore[],
) {
  try {
    const existing = loadProvisionalScores();

    // Se è un round diverso, resetta tutto
    if (existing && existing.round !== round) {
      clearProvisionalScores();
    }

    const prev = (existing && existing.round === round) ? existing : null;
    const prevSessions = prev?.sessions || [];

    // Punti di questa sessione per userId
    const currentSessionScores: Record<string, number> = {};
    for (const s of currentScores) {
      currentSessionScores[s.userId] = s.points;
    }

    // Aggiorna o aggiungi la sessione corrente
    const sessionIdx = prevSessions.findIndex((s) => s.sessionName === sessionName);
    const updatedSessions = [...prevSessions];
    if (sessionIdx >= 0) {
      updatedSessions[sessionIdx] = { sessionName, scores: currentSessionScores };
    } else {
      updatedSessions.push({ sessionName, scores: currentSessionScores });
    }

    // Calcola totale weekend per ogni giocatore (somma tutte le sessioni)
    const totalMap = new Map<string, number>();
    for (const sess of updatedSessions) {
      for (const [userId, pts] of Object.entries(sess.scores)) {
        totalMap.set(userId, (totalMap.get(userId) || 0) + pts);
      }
    }

    // Costruisci scores finali con i totali
    const finalScores: ProvisionalScore[] = currentScores.map((s) => ({
      ...s,
      points: totalMap.get(s.userId) || s.points,
    }));
    // Aggiungi giocatori che erano in sessioni precedenti ma non nella corrente
    for (const [userId, pts] of totalMap) {
      if (!finalScores.find((s) => s.userId === userId)) {
        const prevScore = prev?.scores.find((s) => s.userId === userId);
        if (prevScore) {
          finalScores.push({ ...prevScore, points: pts });
        }
      }
    }

    // Ordina per punti
    finalScores.sort((a, b) => b.points - a.points);

    const data: ProvisionalData = {
      round,
      timestamp: new Date().toISOString(),
      currentSessionName: sessionName,
      scores: finalScores,
      sessions: updatedSessions,
    };

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
 * - Non ci sono ancora risultati ufficiali per quel round
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

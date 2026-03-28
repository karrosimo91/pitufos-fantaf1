"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";

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
  scores: ProvisionalScore[];
  sessions: SessionScores[];
}

/**
 * Salva i punteggi provvisori su Supabase, accumulando sessioni del weekend.
 */
export async function saveProvisionalScores(
  round: number,
  sessionName: string,
  currentScores: ProvisionalScore[],
) {
  if (!isSupabaseConfigured) return;
  const supabase = createClient();
  if (!supabase) return;

  try {
    // Leggi dati esistenti per questo round
    const { data: existing } = await supabase
      .from("provisional_weekend")
      .select("data")
      .eq("round", round)
      .maybeSingle();

    const prev: ProvisionalData | null = existing?.data || null;
    const prevSessions = (prev && prev.round === round) ? prev.sessions || [] : [];

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

    // Costruisci scores finali
    const finalScores: ProvisionalScore[] = currentScores.map((s) => ({
      ...s,
      points: totalMap.get(s.userId) || s.points,
    }));
    for (const [userId, pts] of totalMap) {
      if (!finalScores.find((s) => s.userId === userId)) {
        const prevScore = prev?.scores.find((s) => s.userId === userId);
        if (prevScore) finalScores.push({ ...prevScore, points: pts });
      }
    }
    finalScores.sort((a, b) => b.points - a.points);

    const data: ProvisionalData = {
      round,
      timestamp: new Date().toISOString(),
      currentSessionName: sessionName,
      scores: finalScores,
      sessions: updatedSessions,
    };

    await supabase
      .from("provisional_weekend")
      .upsert({ round, session_name: sessionName, data, updated_at: new Date().toISOString() }, { onConflict: "round" });
  } catch {
    // Non bloccante
  }
}

/**
 * Cancella i punteggi provvisori per un round.
 */
export async function clearProvisionalScores(round: number) {
  if (!isSupabaseConfigured) return;
  const supabase = createClient();
  if (!supabase) return;

  await supabase.from("provisional_weekend").delete().eq("round", round);
}

/**
 * Hook: legge punteggi provvisori da Supabase.
 * Ritorna i dati SOLO se non c'è sessione live e non ci sono risultati ufficiali.
 */
export function useProvisionalScores(isLive: boolean, currentRound: number) {
  const [provisional, setProvisional] = useState<ProvisionalData | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (isLive) {
      setProvisional(null);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }

    // Controlla se esistono risultati ufficiali
    const { data: wr } = await supabase
      .from("weekend_scores")
      .select("round")
      .eq("round", currentRound)
      .limit(1);

    if (wr && wr.length > 0) {
      // Risultati ufficiali esistono, cancella provvisori
      await supabase.from("provisional_weekend").delete().eq("round", currentRound);
      setProvisional(null);
      setLoading(false);
      return;
    }

    // Leggi provvisori
    const { data } = await supabase
      .from("provisional_weekend")
      .select("data")
      .eq("round", currentRound)
      .maybeSingle();

    setProvisional(data?.data || null);
    setLoading(false);
  }, [isLive, currentRound]);

  useEffect(() => {
    check();
    // Refresh ogni 30 sec per vedere aggiornamenti da altri client
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [check]);

  return { provisional, loading, refresh: check };
}

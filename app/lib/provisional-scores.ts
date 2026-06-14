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
 * Fonde la sessione corrente nelle sessioni del weekend e calcola i totali.
 *
 * IMPORTANTE: `currentCumulative` (userId → punti) è il TOTALE cumulativo del
 * weekend già calcolato dal live (qualifica + sprint + gara insieme), NON i punti
 * della sola sessione corrente. Per non contare due volte le sessioni precedenti
 * salviamo come "scores" della sessione il DELTA = cumulativo attuale − somma
 * delle altre sessioni. Così la somma di tutte le sessioni riproduce esattamente
 * il cumulativo (niente doppio conteggio), ed è idempotente sui re-save.
 *
 * Funzione pura → testabile.
 */
export function computeProvisionalTotals(
  prevSessions: SessionScores[],
  sessionName: string,
  currentCumulative: Record<string, number>,
): { sessions: SessionScores[]; totals: Map<string, number> } {
  // Cumulativo derivante dalle ALTRE sessioni (esclusa quella corrente)
  const priorCumulative = new Map<string, number>();
  for (const sess of prevSessions) {
    if (sess.sessionName === sessionName) continue;
    for (const [uid, pts] of Object.entries(sess.scores)) {
      priorCumulative.set(uid, (priorCumulative.get(uid) || 0) + pts);
    }
  }

  // Delta della sessione corrente = cumulativo attuale − cumulativo precedente
  const currentDelta: Record<string, number> = {};
  for (const [uid, cum] of Object.entries(currentCumulative)) {
    currentDelta[uid] = cum - (priorCumulative.get(uid) || 0);
  }

  const idx = prevSessions.findIndex((s) => s.sessionName === sessionName);
  const sessions = [...prevSessions];
  if (idx >= 0) sessions[idx] = { sessionName, scores: currentDelta };
  else sessions.push({ sessionName, scores: currentDelta });

  const totals = new Map<string, number>();
  for (const sess of sessions) {
    for (const [uid, pts] of Object.entries(sess.scores)) {
      totals.set(uid, (totals.get(uid) || 0) + pts);
    }
  }
  return { sessions, totals };
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

    // Il punteggio del live è il TOTALE cumulativo del weekend per ogni giocatore.
    const currentCumulative: Record<string, number> = {};
    for (const s of currentScores) {
      currentCumulative[s.userId] = s.points;
    }

    const { sessions: updatedSessions, totals: totalMap } = computeProvisionalTotals(
      prevSessions,
      sessionName,
      currentCumulative,
    );

    // Costruisci scores finali (totale = cumulativo, niente doppio conteggio)
    const finalScores: ProvisionalScore[] = currentScores.map((s) => ({
      ...s,
      points: totalMap.get(s.userId) ?? s.points,
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    check();
    // Refresh ogni 30 sec per vedere aggiornamenti da altri client
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [check]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { provisional, loading, refresh: check };
}

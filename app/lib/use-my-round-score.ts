"use client";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";
import { ordinaClassificaWeekend, PUNTI_REALE } from "./classifica-reale";

export interface RoundScoreRow {
  user_id: string;
  total_points: number;
  piloti_points: number;
  previsioni_points: number;
  real_points: number | null;
}

export interface RoundStanding {
  userId: string;
  total: number;
  piloti: number;
  previsioni: number;
  /** Punti Classifica Reale del weekend (colonna se c'è, altrimenti dalla posizione) */
  real: number;
  position: number;
}

/**
 * Punteggi ufficiali di un round per i membri di una lega (`weekend_scores`,
 * read-all), ordinati con la stessa regola del server. `mine` è la riga
 * dell'utente, con la sua posizione nel weekend.
 */
export function useRoundStandings(round: number | null, legaId: string | null, userId?: string | null) {
  const [standings, setStandings] = useState<RoundStanding[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setStandings([]);
    setLoaded(false);
    if (!round || !isSupabaseConfigured) { setLoaded(true); return; }
    const supabase = createClient();
    if (!supabase) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      let memberIds: string[] | null = null;
      if (legaId) {
        const { data: members } = await supabase.from("lega_members").select("user_id").eq("lega_id", legaId);
        memberIds = (members ?? []).map((m) => m.user_id);
      }
      if (cancelled) return;
      let q = supabase
        .from("weekend_scores")
        .select("user_id, total_points, piloti_points, previsioni_points, real_points")
        .eq("round", round);
      if (memberIds) q = q.in("user_id", memberIds);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) console.warn("[round-standings]", error);
      const rows = ordinaClassificaWeekend((data ?? []) as RoundScoreRow[]);
      setStandings(rows.map((r, i) => ({
        userId: r.user_id,
        total: Number(r.total_points ?? 0),
        piloti: Number(r.piloti_points ?? 0),
        previsioni: Number(r.previsioni_points ?? 0),
        real: r.real_points != null ? Number(r.real_points) : (PUNTI_REALE[i] ?? 0),
        position: i + 1,
      })));
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [round, legaId]);

  const mine = userId ? standings.find((s) => s.userId === userId) ?? null : null;
  return { standings, mine, players: standings.length, loaded };
}

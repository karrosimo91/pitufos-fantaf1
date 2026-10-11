"use client";
import { useEffect, useMemo, useState } from "react";
import { useClassificaLega } from "./store";
import { createClient, isSupabaseConfigured } from "./supabase";
import { buildClassificaGeneraleLive, buildDuelliLive, type DuelloLive, type GeneraleLiveRow } from "./classifica-generale-live";

/**
 * Classifica Generale live della lega (stagione + weekend in corso) con
 * distacchi e duelli fra posizioni adiacenti. Un'unica istanza per il LiveTab:
 * la usano il sub-tab GENERALE e il sub-tab DUELLI.
 *
 * `enabled` false (formazione non ancora chiusa) non legge niente: la generale
 * live rivelerebbe i punti del weekend degli altri.
 */
export function useClassificaGeneraleLive(opts: {
  legaId?: string;
  round: number;
  liveWeekendPoints: Map<string, number>;
  userId?: string;
  enabled?: boolean;
}): { rows: GeneraleLiveRow[]; duelli: DuelloLive[]; loading: boolean } {
  const { legaId, round, liveWeekendPoints, userId, enabled = true } = opts;
  const { classifica: season, loading } = useClassificaLega(enabled ? legaId ?? null : null, null);
  const roundSalvato = useRoundScores(enabled ? round : 0);

  const rows = useMemo(
    () => buildClassificaGeneraleLive(season, roundSalvato, liveWeekendPoints, userId),
    [season, roundSalvato, liveWeekendPoints, userId],
  );
  const duelli = useMemo(() => buildDuelliLive(rows), [rows]);

  return { rows, duelli, loading };
}

/** user_id → punti del round già sommati in classifica_totale (weekend_scores è read-all). */
function useRoundScores(round: number): Map<string, number> {
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!round || !isSupabaseConfigured) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("weekend_scores")
        .select("user_id, total_points")
        .eq("round", round);
      if (cancelled) return;
      if (error) { console.warn("[classifica-generale-live] weekend_scores", error); return; }
      const m = new Map<string, number>();
      for (const r of data ?? []) m.set(r.user_id, Number(r.total_points ?? 0));
      setScores(m);
    })();
    return () => { cancelled = true; };
  }, [round]);
  return scores;
}

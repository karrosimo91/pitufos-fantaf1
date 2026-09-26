"use client";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";
import type { RaceWeekendResults } from "./scoring";

export interface WeekendResultsRow {
  round: number;
  data: RaceWeekendResults;
  updated_at: string | null;
}

/**
 * Tutti i risultati ufficiali in archivio (`weekend_results`, read-all).
 * Una sola lettura, riusata da forma piloti, contesto previsioni, recap.
 */
export function useAllWeekendResults() {
  const [rows, setRows] = useState<WeekendResultsRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoaded(true); return; }
    const supabase = createClient();
    if (!supabase) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("weekend_results")
        .select("round, data, updated_at")
        .order("round", { ascending: true });
      if (cancelled) return;
      if (error) console.warn("[weekend-results] all", error);
      setRows(((data ?? []) as WeekendResultsRow[]).filter((r) => !!r.data));
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  return { rows, loaded };
}

/** Risultati ufficiali di un round (null se non in archivio). */
export function useWeekendResults(round: number | null) {
  const [row, setRow] = useState<WeekendResultsRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setRow(null);
    setLoaded(false);
    if (!round || !isSupabaseConfigured) { setLoaded(true); return; }
    const supabase = createClient();
    if (!supabase) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("weekend_results")
        .select("round, data, updated_at")
        .eq("round", round)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.warn("[weekend-results] round", round, error);
      setRow((data as WeekendResultsRow | null) ?? null);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [round]);

  const results = row?.data ?? null;
  return {
    results,
    updatedAt: row?.updated_at ?? null,
    loaded,
    /** La gara è in archivio (previsioni calcolate). */
    raceArchived: (results?.race?.length ?? 0) > 0,
    /** Almeno una sessione in archivio. */
    anyArchived: !!results && ((results.qualifying?.length ?? 0) > 0 || (results.sprint_shootout?.length ?? 0) > 0 || (results.sprint?.length ?? 0) > 0 || (results.race?.length ?? 0) > 0),
  };
}

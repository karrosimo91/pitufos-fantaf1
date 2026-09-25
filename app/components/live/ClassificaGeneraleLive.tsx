"use client";
import { useEffect, useMemo, useState } from "react";
import { useClassificaLega } from "../../lib/store";
import { createClient, isSupabaseConfigured } from "../../lib/supabase";
import { SectionHead } from "../ui/SectionHead";

const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/**
 * Classifica Generale live: classifica di stagione della lega + il punteggio
 * del weekend in corso (ancora non salvato ufficialmente) sommato in tempo reale.
 *
 * `liveWeekendPoints` mappa userId → punti del weekend live (da useWeekendClassifica),
 * cumulativi: comprendono anche le sessioni del weekend già in archivio.
 * Il totale di stagione invece include già il round in corso appena il post-gara
 * ne ha calcolato una sessione (es. la qualifica): sommarli direttamente contava
 * due volte quella sessione. Quindi dal totale si toglie quanto il round ha già
 * dato (`weekend_scores`) e si aggiunge il cumulativo live.
 */
export function ClassificaGeneraleLive({
  legaId,
  round,
  liveWeekendPoints,
  userId,
}: {
  legaId?: string;
  round: number;
  liveWeekendPoints: Map<string, number>;
  userId?: string;
}) {
  const { classifica: season, loading } = useClassificaLega(legaId ?? null, null);
  const roundSalvato = useRoundScores(round);

  const rows = useMemo(() => {
    return season
      .map((e) => {
        const live = liveWeekendPoints.get(e.user_id) ?? 0;
        const giaInTotale = roundSalvato.get(e.user_id) ?? 0;
        return {
          userId: e.user_id,
          scuderiaName: e.scuderia_name,
          tpName: e.team_principal_name,
          liveWeekend: live,
          total: e.total_points - giaInTotale + live,
          isMe: e.user_id === userId,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [season, liveWeekendPoints, roundSalvato, userId]);

  if (loading && rows.length === 0) {
    return <div className="text-center py-8 text-white/20 text-sm">Caricamento classifica…</div>;
  }
  if (rows.length === 0) {
    return <div className="text-center py-8 text-white/20 text-sm">Nessuna classifica disponibile</div>;
  }

  return (
    <>
      <SectionHead title="Classifica Generale" right="LIVE" />
      <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-hidden mb-4">
        {rows.map((entry, i) => (
          <div
            key={entry.userId}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 ${
              i < rows.length - 1 ? "border-b border-white/[0.04]" : ""
            } ${entry.isMe ? "bg-[#E8002D]/[0.05] border-l-[3px] border-l-[#E8002D]" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-bold w-5 text-center ${
                i === 0 ? "text-[#E8002D]" : entry.isMe ? "text-[#E8002D]" : "text-white/30"
              }`}>
                {i + 1}
              </div>
              <div>
                <div className={`text-[13px] font-semibold ${entry.isMe ? "text-white" : ""}`}>
                  {entry.scuderiaName}
                </div>
                <div className={`text-[10px] ${entry.isMe ? "text-[#E8002D]/50" : "text-white/25"}`}>
                  @{entry.tpName}
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              {entry.liveWeekend !== 0 && (
                <span className={`font-[family-name:var(--font-jetbrains)] text-[9px] ${
                  entry.liveWeekend > 0 ? "text-green-400/70" : "text-red-400/70"
                }`}>
                  {entry.liveWeekend > 0 ? "+" : ""}{entry.liveWeekend}
                </span>
              )}
              <span className={`font-[family-name:var(--font-jetbrains)] text-base font-bold ${
                entry.isMe ? "text-white" : "text-white/70"
              }`}>
                {entry.total}
              </span>
              {i < 10 && (
                <span className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/15">
                  +{PUNTI_REALE[i]} CR
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
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

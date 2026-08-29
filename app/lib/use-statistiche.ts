"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";
import { RACES_2026 } from "./races";
import type { RaceWeekendResults } from "./scoring";
import { PREVISIONI_PUNTI } from "./types";

// ═══════════════════════════════════════════════════════════════
// Hook dati per /statistiche — un solo fetch per lega, poi tutto
// derivato con useMemo. Legge solo tabelle con RLS read-all
// (weekend_scores, weekend_results, formazioni, previsioni).
// ═══════════════════════════════════════════════════════════════

export interface StatsPlayer {
  userId: string;
  tpName: string;
  scuderiaName: string;
}

interface ScoreRow {
  user_id: string;
  round: number;
  total_points: number;
  piloti_points: number;
  previsioni_points: number;
}

interface FormazioneRow {
  user_id: string;
  round: number;
  driver_numbers: number[] | null;
  primo_pilota: number | null;
  chip_piloti: string | null;
  sesto_uomo: number | null;
}

interface PrevisioneRow {
  user_id: string;
  round: number;
  safety_car: boolean | null;
  virtual_safety_car: boolean | null;
  red_flag: boolean | null;
  gomme_wet: boolean | null;
  pole_vince: boolean | null;
  numero_dnf: number | null;
  chip_attivo: string | null;
}

export const PREVISIONI_META = [
  { key: "safety_car", label: "Safety Car", event: "safety_car" },
  { key: "virtual_safety_car", label: "Virtual SC", event: "virtual_safety_car" },
  { key: "red_flag", label: "Red Flag", event: "red_flag" },
  { key: "gomme_wet", label: "Gomme Wet", event: "wet_tyres" },
  { key: "pole_vince", label: "Pole vince", event: "pole_won" },
] as const;

export interface StatsRaw {
  loading: boolean;
  error: string | null;
  players: StatsPlayer[];
  scores: ScoreRow[];
  results: Map<number, RaceWeekendResults>;
  formazioni: FormazioneRow[];
  previsioni: PrevisioneRow[];
}

export function useStatisticheData(
  legaId: string | null,
  roundStart: number,
  roundEnd: number,
): StatsRaw {
  const [state, setState] = useState<StatsRaw>({
    loading: true,
    error: null,
    players: [],
    scores: [],
    results: new Map(),
    formazioni: [],
    previsioni: [],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = legaId && isSupabaseConfigured ? createClient() : null;
      if (!supabase || !legaId) {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
        return;
      }
      setState((s) => (s.loading && !s.error ? s : { ...s, loading: true, error: null }));

      // 1) Membri della lega (nomi + user_id) via la RPC già usata dal rank
      const { data: classifica, error: cErr } = await supabase.rpc("classifica_lega", { p_lega_id: legaId });
      if (cancelled) return;
      if (cErr) {
        setState((s) => ({ ...s, loading: false, error: cErr.message }));
        return;
      }
      const players: StatsPlayer[] = (classifica || []).map(
        (e: { user_id: string; team_principal_name: string; scuderia_name: string }) => ({
          userId: e.user_id,
          tpName: e.team_principal_name,
          scuderiaName: e.scuderia_name,
        }),
      );
      const memberIds = players.map((p) => p.userId);
      if (memberIds.length === 0) {
        setState({ loading: false, error: null, players: [], scores: [], results: new Map(), formazioni: [], previsioni: [] });
        return;
      }

      // 2) Il resto in parallelo, sempre limitato ai round della lega
      const [scoresRes, resultsRes, formRes, prevRes] = await Promise.all([
        supabase
          .from("weekend_scores")
          .select("user_id, round, total_points, piloti_points, previsioni_points")
          .in("user_id", memberIds)
          .gte("round", roundStart)
          .lte("round", roundEnd),
        supabase
          .from("weekend_results")
          .select("round, data")
          .gte("round", roundStart)
          .lte("round", roundEnd),
        supabase
          .from("formazioni")
          .select("user_id, round, driver_numbers, primo_pilota, chip_piloti, sesto_uomo")
          .eq("confirmed", true)
          .in("user_id", memberIds)
          .gte("round", roundStart)
          .lte("round", roundEnd),
        supabase
          .from("previsioni")
          .select("user_id, round, safety_car, virtual_safety_car, red_flag, gomme_wet, pole_vince, numero_dnf, chip_attivo")
          .eq("confirmed", true)
          .in("user_id", memberIds)
          .gte("round", roundStart)
          .lte("round", roundEnd),
      ]);

      if (cancelled) return;

      const results = new Map<number, RaceWeekendResults>();
      for (const r of (resultsRes.data || []) as { round: number; data: RaceWeekendResults }[]) {
        if (r.data) results.set(r.round, r.data);
      }

      setState({
        loading: false,
        error: scoresRes.error?.message || null,
        players,
        scores: (scoresRes.data || []) as ScoreRow[],
        results,
        formazioni: (formRes.data || []) as FormazioneRow[],
        previsioni: (prevRes.data || []) as PrevisioneRow[],
      });
    })().catch((err) => {
      if (!cancelled) setState((s) => ({ ...s, loading: false, error: String(err) }));
    });

    return () => {
      cancelled = true;
    };
  }, [legaId, roundStart, roundEnd]);

  return state;
}

// ─── Derivazioni ───

export interface SeasonPoint {
  userId: string;
  /** Punti cumulati round per round (null finché il giocatore non ha punteggi) */
  cumulative: (number | null)[];
  /** Posizione in classifica round per round */
  positions: (number | null)[];
  perRound: (ScoreRow | undefined)[];
}

/** Punti "Classifica Reale": ogni weekend i primi 10 prendono punti F1. */
export const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/** Riepilogo stagionale di un singolo Team Principal. */
export interface PlayerSummary {
  userId: string;
  tpName: string;
  scuderiaName: string;
  /** Weekend con un punteggio calcolato */
  gp: number;
  points: number;
  avg: number | null;
  best: { round: number; points: number } | null;
  worst: { round: number; points: number } | null;
  /** Weekend chiusi al primo posto / sul podio / in top 10 */
  wins: number;
  podiums: number;
  top10: number;
  /** Quante volte è arrivato in ogni posizione weekend (index 0 = P1) */
  placements: number[];
  /** Punti della Classifica Reale (25-18-15… per weekend) */
  realPoints: number;
  /** Posizione attuale nella classifica somma punti */
  position: number | null;
  /** Posizione al round precedente, per la freccia di tendenza */
  prevPosition: number | null;
}

export interface StatsDerived {
  rounds: number[];
  roundLabels: string[];
  season: Map<string, SeasonPoint>;
  /** Riepilogo per partecipante, ordinato per punti totali */
  summaries: PlayerSummary[];
  /** Vincitore di ogni weekend */
  roundWinners: { round: number; userId: string; points: number }[];
  /** Miglior e peggior weekend della lega */
  bestWeekend: { userId: string; round: number; points: number } | null;
  worstWeekend: { userId: string; round: number; points: number } | null;
  /** Accuratezza previsioni per evento (tutta la lega) */
  previsioniAccuracy: { key: string; label: string; correct: number; total: number }[];
  /** Accuratezza previsioni per giocatore */
  playerAccuracy: { userId: string; correct: number; total: number; dnfHits: number; dnfTotal: number }[];
  /** Chip già usati per giocatore */
  chipUsage: { userId: string; piloti: string[]; previsioni: string[] }[];
  /** Eventi della stagione (sui round con risultati gara) */
  events: { key: string; label: string; happened: number; total: number }[];
  totalDnf: number;
  racesWithResults: number;
}

export function deriveStats(raw: StatsRaw, roundStart: number, roundEnd: number): StatsDerived {
  const rounds = [...new Set(raw.scores.map((s) => s.round))].sort((a, b) => a - b);
  const roundLabels = rounds.map((r) => `R${r}`);

  // Indice punteggi: userId → round → riga
  const byUser = new Map<string, Map<number, ScoreRow>>();
  for (const s of raw.scores) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, new Map());
    byUser.get(s.user_id)!.set(s.round, s);
  }

  // Cumulati
  const cumByUser = new Map<string, (number | null)[]>();
  for (const p of raw.players) {
    const rowsByRound = byUser.get(p.userId);
    let acc = 0;
    let started = false;
    const vals: (number | null)[] = rounds.map((r) => {
      const row = rowsByRound?.get(r);
      if (row) {
        acc += Number(row.total_points);
        started = true;
      }
      return started ? acc : null;
    });
    cumByUser.set(p.userId, vals);
  }

  // Posizioni round per round (dal cumulato)
  const posByUser = new Map<string, (number | null)[]>();
  for (const p of raw.players) posByUser.set(p.userId, rounds.map(() => null));
  rounds.forEach((_, i) => {
    const standings = raw.players
      .map((p) => ({ userId: p.userId, v: cumByUser.get(p.userId)![i] }))
      .filter((e): e is { userId: string; v: number } => e.v !== null)
      .sort((a, b) => b.v - a.v);
    standings.forEach((e, idx) => {
      posByUser.get(e.userId)![i] = idx + 1;
    });
  });

  const season = new Map<string, SeasonPoint>();
  for (const p of raw.players) {
    season.set(p.userId, {
      userId: p.userId,
      cumulative: cumByUser.get(p.userId)!,
      positions: posByUser.get(p.userId)!,
      perRound: rounds.map((r) => byUser.get(p.userId)?.get(r)),
    });
  }

  // Record weekend
  let bestWeekend: StatsDerived["bestWeekend"] = null;
  let worstWeekend: StatsDerived["worstWeekend"] = null;
  for (const s of raw.scores) {
    const pts = Number(s.total_points);
    if (!bestWeekend || pts > bestWeekend.points) bestWeekend = { userId: s.user_id, round: s.round, points: pts };
    if (!worstWeekend || pts < worstWeekend.points) worstWeekend = { userId: s.user_id, round: s.round, points: pts };
  }

  // Classifica di ogni weekend: posizione + punti "Classifica Reale"
  const roundWinners: { round: number; userId: string; points: number }[] = [];
  const placements = new Map<string, number[]>();
  const realPoints = new Map<string, number>();
  for (const p of raw.players) {
    placements.set(p.userId, []);
    realPoints.set(p.userId, 0);
  }
  for (const r of rounds) {
    const standing = raw.players
      .map((p) => ({ userId: p.userId, row: byUser.get(p.userId)?.get(r) }))
      .filter((e): e is { userId: string; row: ScoreRow } => !!e.row)
      .sort((a, b) => Number(b.row.total_points) - Number(a.row.total_points));
    if (standing.length === 0) continue;
    roundWinners.push({ round: r, userId: standing[0].userId, points: Number(standing[0].row.total_points) });
    standing.forEach((e, idx) => {
      const arr = placements.get(e.userId)!;
      arr[idx] = (arr[idx] ?? 0) + 1;
      realPoints.set(e.userId, realPoints.get(e.userId)! + (PUNTI_REALE[idx] ?? 0));
    });
  }

  // Accuratezza previsioni — solo sui round con gara calcolata
  const accByKey = new Map<string, { correct: number; total: number }>();
  const accByPlayer = new Map<string, { correct: number; total: number; dnfHits: number; dnfTotal: number }>();
  for (const meta of PREVISIONI_META) accByKey.set(meta.key, { correct: 0, total: 0 });

  for (const pr of raw.previsioni) {
    const res = raw.results.get(pr.round);
    if (!res || res.race.length === 0) continue;
    if (!accByPlayer.has(pr.user_id)) accByPlayer.set(pr.user_id, { correct: 0, total: 0, dnfHits: 0, dnfTotal: 0 });
    const pa = accByPlayer.get(pr.user_id)!;

    for (const meta of PREVISIONI_META) {
      const answer = pr[meta.key as keyof PrevisioneRow] as boolean | null;
      if (answer === null || answer === undefined) continue;
      const happened = res.events[meta.event as keyof RaceWeekendResults["events"]] as boolean;
      const k = accByKey.get(meta.key)!;
      k.total += 1;
      pa.total += 1;
      if (answer === happened) {
        k.correct += 1;
        pa.correct += 1;
      }
    }
    if (pr.numero_dnf !== null && pr.numero_dnf !== undefined) {
      pa.dnfTotal += 1;
      if (pr.numero_dnf === res.events.total_dnf) pa.dnfHits += 1;
    }
  }

  const previsioniAccuracy = PREVISIONI_META.map((m) => ({
    key: m.key,
    label: m.label,
    ...accByKey.get(m.key)!,
  }));

  const playerAccuracy = raw.players
    .map((p) => ({ userId: p.userId, ...(accByPlayer.get(p.userId) ?? { correct: 0, total: 0, dnfHits: 0, dnfTotal: 0 }) }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.correct / b.total - a.correct / a.total);

  // Chip usati
  const chipUsage = raw.players.map((p) => ({
    userId: p.userId,
    piloti: [...new Set(raw.formazioni.filter((f) => f.user_id === p.userId && f.chip_piloti).map((f) => f.chip_piloti!))],
    previsioni: [...new Set(raw.previsioni.filter((f) => f.user_id === p.userId && f.chip_attivo).map((f) => f.chip_attivo!))],
  }));

  // Eventi stagione
  const raceRounds = [...raw.results.entries()]
    .filter(([r, d]) => r >= roundStart && r <= roundEnd && d.race.length > 0)
    .map(([, d]) => d);
  const countEvent = (k: keyof RaceWeekendResults["events"]) => raceRounds.filter((d) => d.events[k] === true).length;
  const events = [
    { key: "safety_car", label: "Safety Car", happened: countEvent("safety_car"), total: raceRounds.length },
    { key: "virtual_safety_car", label: "Virtual SC", happened: countEvent("virtual_safety_car"), total: raceRounds.length },
    { key: "red_flag", label: "Red Flag", happened: countEvent("red_flag"), total: raceRounds.length },
    { key: "wet_tyres", label: "Gomme Wet", happened: countEvent("wet_tyres"), total: raceRounds.length },
    { key: "pole_won", label: "Pole vince", happened: countEvent("pole_won"), total: raceRounds.length },
  ];
  const totalDnf = raceRounds.reduce((a, d) => a + (d.events.total_dnf || 0), 0);

  // Riepilogo per partecipante
  const lastIdx = rounds.length - 1;
  const summaries: PlayerSummary[] = raw.players
    .map((p) => {
      const sp = season.get(p.userId)!;
      const scored = sp.perRound
        .map((row, i) => (row ? { round: rounds[i], points: Number(row.total_points) } : null))
        .filter((x): x is { round: number; points: number } => x !== null);
      const total = scored.reduce((a, b) => a + b.points, 0);
      const pl = placements.get(p.userId) ?? [];
      return {
        userId: p.userId,
        tpName: p.tpName,
        scuderiaName: p.scuderiaName,
        gp: scored.length,
        points: total,
        avg: scored.length > 0 ? Math.round((total / scored.length) * 10) / 10 : null,
        best: scored.length > 0 ? scored.reduce((a, b) => (b.points > a.points ? b : a)) : null,
        worst: scored.length > 0 ? scored.reduce((a, b) => (b.points < a.points ? b : a)) : null,
        wins: pl[0] ?? 0,
        podiums: (pl[0] ?? 0) + (pl[1] ?? 0) + (pl[2] ?? 0),
        top10: pl.slice(0, 10).reduce((a, b) => a + (b ?? 0), 0),
        placements: pl,
        realPoints: realPoints.get(p.userId) ?? 0,
        position: lastIdx >= 0 ? sp.positions[lastIdx] : null,
        prevPosition: lastIdx >= 1 ? sp.positions[lastIdx - 1] : null,
      };
    })
    .sort((a, b) => b.points - a.points);

  return {
    rounds,
    roundLabels,
    season,
    summaries,
    roundWinners,
    bestWeekend,
    worstWeekend,
    previsioniAccuracy,
    playerAccuracy,
    chipUsage,
    events,
    totalDnf,
    racesWithResults: raceRounds.length,
  };
}

/** Nome del GP per un round, per le etichette dei record. */
export function raceLabel(round: number): string {
  const r = RACES_2026.find((x) => x.round === round);
  return r ? `R${round} ${r.flag}` : `R${round}`;
}

/** Punti massimi teorici delle previsioni in un weekend (per il "quanto hai raccolto"). */
export const PREVISIONI_MAX_WEEKEND =
  Math.max(PREVISIONI_PUNTI.safetyCar.si, PREVISIONI_PUNTI.safetyCar.no) +
  Math.max(PREVISIONI_PUNTI.virtualSafetyCar.si, PREVISIONI_PUNTI.virtualSafetyCar.no) +
  Math.max(PREVISIONI_PUNTI.redFlag.si, PREVISIONI_PUNTI.redFlag.no) +
  Math.max(PREVISIONI_PUNTI.gommeWet.si, PREVISIONI_PUNTI.gommeWet.no) +
  Math.max(PREVISIONI_PUNTI.poleVince.si, PREVISIONI_PUNTI.poleVince.no) +
  PREVISIONI_PUNTI.numeroDnf.esatto;


/** Wrapper: dati grezzi + derivazioni memoizzate. */
export function useStatistiche(legaId: string | null, roundStart = 1, roundEnd = 24) {
  const raw = useStatisticheData(legaId, roundStart, roundEnd);
  const derived = useMemo(() => deriveStats(raw, roundStart, roundEnd), [raw, roundStart, roundEnd]);
  return { ...raw, ...derived };
}

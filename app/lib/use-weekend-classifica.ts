"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";
import {
  calcolaPuntiWeekend,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
  type RaceWeekendResults,
} from "./scoring";
import type { Previsioni } from "./types";
import { useLiveWebSocket } from "./use-live-ws";
import {
  buildLiveWeekendResults,
  detectLiveEvents,
  classifySession,
} from "./build-live-results";

export interface PlayerFormazione {
  user_id: string;
  scuderia_name: string;
  tp_name: string;
  driver_numbers: number[];
  primo_pilota: number | null;
  chip_piloti: string | null;
  chip_piloti_target: number | null;
  sesto_uomo: number | null;
}

export interface PlayerPrevisioni {
  safety_car: boolean | null;
  virtual_safety_car: boolean | null;
  red_flag: boolean | null;
  gomme_wet: boolean | null;
  pole_vince: boolean | null;
  numero_dnf: number | null;
  chip_attivo: string | null;
  chip_target: string | null;
}

export interface WeekendClassificaEntry {
  userId: string;
  scuderiaName: string;
  tpName: string;
  points: number;
  isMe: boolean;
}

function rowToPrevisioni(row: PlayerPrevisioni): Previsioni {
  return {
    safetyCar: row.safety_car,
    virtualSafetyCar: row.virtual_safety_car,
    redFlag: row.red_flag,
    gommeWet: row.gomme_wet,
    poleVince: row.pole_vince,
    numeroDnf: row.numero_dnf,
  };
}

function rowToChipPiloti(row: PlayerFormazione): ChipPilotiConfig {
  return {
    chipPiloti: row.chip_piloti,
    chipPilotiTarget: row.chip_piloti_target,
    sestoUomo: row.sesto_uomo,
  };
}

function rowToChipPrev(row: PlayerPrevisioni | undefined): ChipPrevisioniConfig | undefined {
  if (!row?.chip_attivo) return undefined;
  return { chipAttivo: row.chip_attivo, chipTarget: row.chip_target };
}

/**
 * Hook per la classifica weekend live: fonde dati WebSocket + risultati sessioni precedenti
 * + formazioni/previsioni della lega e usa calcolaPuntiWeekend per ogni player.
 */
export function useWeekendClassifica(opts: {
  round: number;
  sessionType: string;
  sessionKey: number | null;
  meetingKey?: number;
  legaId?: string;
  userId?: string;
  debug?: boolean;
}) {
  const { round, sessionType, sessionKey, meetingKey, legaId, userId, debug = false } = opts;

  const [previousResults, setPreviousResults] = useState<RaceWeekendResults | null>(null);
  const [gridPositions, setGridPositions] = useState<Map<number, number>>(new Map());
  const [formazioni, setFormazioni] = useState<PlayerFormazione[]>([]);
  const [previsioni, setPrevisioni] = useState<Map<string, PlayerPrevisioni>>(new Map());

  // Fetch sessioni precedenti del weekend
  useEffect(() => {
    if (debug || !round || !isSupabaseConfigured) return;
    const supabase = createClient();
    if (!supabase) return;
    const abort = new AbortController();
    (async () => {
      try {
        const { data, error } = await supabase
          .from("weekend_results")
          .select("data")
          .eq("round", round)
          .abortSignal(abort.signal)
          .maybeSingle();
        if (error) {
          if (error.name !== "AbortError") console.warn("[weekend-classifica] previousResults", error);
          return;
        }
        if (data?.data) setPreviousResults(data.data as RaceWeekendResults);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") console.warn("[weekend-classifica] previousResults", err);
      }
    })();
    return () => abort.abort();
  }, [round, debug]);

  // Fetch grid (solo per gara)
  useEffect(() => {
    if (debug || !meetingKey) return;
    const isRaceSession = sessionType.toLowerCase().includes("race") && !sessionType.toLowerCase().includes("sprint");
    if (!isRaceSession) return;
    const abort = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/live-grid?meeting_key=${meetingKey}`, { cache: "no-store", signal: abort.signal });
        if (!res.ok) {
          console.warn("[weekend-classifica] /api/live-grid not ok", res.status);
          return;
        }
        const { grid } = await res.json();
        const gridMap = new Map<number, number>();
        for (const [driverStr, pos] of Object.entries(grid)) {
          gridMap.set(Number(driverStr), pos as number);
        }
        setGridPositions(gridMap);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") console.warn("[weekend-classifica] grid", err);
      }
    })();
    return () => abort.abort();
  }, [meetingKey, sessionType, debug]);

  // Fetch formazioni + previsioni + profili della lega
  useEffect(() => {
    if (debug || !round || !isSupabaseConfigured) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        let memberIds: string[] | null = null;
        if (legaId) {
          const { data: members } = await supabase
            .from("lega_members")
            .select("user_id")
            .eq("lega_id", legaId);
          if (members) memberIds = members.map((m) => m.user_id);
        }
        if (cancelled) return;

        let query = supabase
          .from("formazioni")
          .select("user_id, driver_numbers, primo_pilota, chip_piloti, chip_piloti_target, sesto_uomo")
          .eq("round", round)
          .eq("confirmed", true);
        if (memberIds) query = query.in("user_id", memberIds);

        const { data: formData, error: formErr } = await query;
        if (formErr) {
          console.warn("[weekend-classifica] formazioni", formErr);
          return;
        }
        if (!formData || cancelled) return;

        const userIds = formData.map((f) => f.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, scuderia_name, team_principal_name")
          .in("id", userIds);
        if (cancelled) return;

        const profileMap = new Map<string, { scuderia: string; tp: string }>();
        for (const p of profiles ?? []) {
          profileMap.set(p.id, { scuderia: p.scuderia_name || "—", tp: p.team_principal_name || "—" });
        }

        setFormazioni(formData.map((f) => ({
          user_id: f.user_id,
          driver_numbers: (f.driver_numbers ?? []).map(Number),
          primo_pilota: f.primo_pilota,
          chip_piloti: f.chip_piloti,
          chip_piloti_target: f.chip_piloti_target,
          sesto_uomo: f.sesto_uomo,
          scuderia_name: profileMap.get(f.user_id)?.scuderia ?? "—",
          tp_name: profileMap.get(f.user_id)?.tp ?? "—",
        })));

        const { data: prevData, error: prevErr } = await supabase
          .from("previsioni")
          .select("user_id, safety_car, virtual_safety_car, red_flag, gomme_wet, pole_vince, numero_dnf, chip_attivo, chip_target")
          .eq("round", round)
          .eq("confirmed", true);
        if (prevErr) {
          console.warn("[weekend-classifica] previsioni", prevErr);
          return;
        }
        if (!prevData || cancelled) return;
        const prevMap = new Map<string, PlayerPrevisioni>();
        for (const p of prevData) {
          prevMap.set(p.user_id, {
            safety_car: p.safety_car,
            virtual_safety_car: p.virtual_safety_car,
            red_flag: p.red_flag,
            gomme_wet: p.gomme_wet,
            pole_vince: p.pole_vince,
            numero_dnf: p.numero_dnf,
            chip_attivo: p.chip_attivo,
            chip_target: p.chip_target,
          });
        }
        setPrevisioni(prevMap);
      } catch (err) {
        console.warn("[weekend-classifica] fetch", err);
      }
    })();
    return () => { cancelled = true; };
  }, [round, debug, legaId]);

  // Dati WebSocket della sessione corrente
  const ws = useLiveWebSocket(debug ? null : sessionKey);

  // Costruisce classifica live combinando WS + formazioni + previsioni + previousResults
  const classifica = useMemo<WeekendClassificaEntry[]>(() => {
    if (formazioni.length === 0) return [];
    if (!debug && ws.positions.size === 0) return [];

    const snap = { positions: ws.positions, raceControl: ws.raceControl, fastestLap: ws.fastestLap, stints: ws.stints };
    const events = detectLiveEvents(snap);
    const virtualResults = buildLiveWeekendResults(
      sessionType,
      snap,
      events,
      gridPositions,
      previousResults,
    );
    const isRace = classifySession(sessionType) === "race";

    const entries = formazioni.map<WeekendClassificaEntry>((f) => {
      const playerPrev = previsioni.get(f.user_id);
      const previsioniIn: Previsioni = isRace && playerPrev
        ? rowToPrevisioni(playerPrev)
        : { safetyCar: null, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null };

      const calc = calcolaPuntiWeekend(
        f.driver_numbers,
        f.primo_pilota,
        previsioniIn,
        virtualResults,
        rowToChipPiloti(f),
        isRace ? rowToChipPrev(playerPrev) : undefined,
      );

      return {
        userId: f.user_id,
        scuderiaName: f.scuderia_name,
        tpName: f.tp_name,
        points: calc.total,
        isMe: f.user_id === userId,
      };
    });

    entries.sort((a, b) => b.points - a.points);
    return entries;
  }, [formazioni, previsioni, ws.positions, ws.raceControl, ws.fastestLap, ws.stints, sessionType, gridPositions, previousResults, userId, debug]);

  return {
    classifica,
    formazioni,
    previsioniByUser: previsioni,
    previousResults,
    gridPositions,
    ws,
  };
}

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
import { countsPrevisioni } from "./player-breakdown";

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

const EMPTY_PENALITA = new Map<string, number>();

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
 *
 * Senza sessione in corso (`sessionKey` null, `sessionType` vuoto) lavora in
 * modalità archivio: niente WebSocket, punteggi calcolati solo dalle sessioni
 * già salvate in `weekend_results`. Serve alla vista del weekend a sessione
 * finita.
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
  const [previousLoaded, setPreviousLoaded] = useState(false);
  const [gridPositions, setGridPositions] = useState<Map<number, number>>(new Map());
  const [retiredDrivers, setRetiredDrivers] = useState<Set<number>>(new Set());
  const [formazioni, setFormazioni] = useState<PlayerFormazione[]>([]);
  const [previsioni, setPrevisioni] = useState<Map<string, PlayerPrevisioni>>(new Map());
  const [penalita, setPenalita] = useState<Map<string, number>>(new Map());

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
          if (error.name !== "AbortError") {
            console.warn("[weekend-classifica] previousResults", error);
            setPreviousLoaded(true);
          }
          return;
        }
        if (data?.data) setPreviousResults(data.data as RaceWeekendResults);
        setPreviousLoaded(true);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") console.warn("[weekend-classifica] previousResults", err);
      }
    })();
    return () => abort.abort();
  }, [round, debug]);

  // Fetch grid (solo per gara).
  //
  // `/api/live-grid` risponde con `source`: "starting_grid" è la griglia vera
  // (penalità in griglia incluse), "qualifying" è il fallback quando OpenF1 non
  // ha ancora pubblicato la griglia. Chi apre il live presto prendeva il
  // fallback e se lo teneva per tutta la gara, calcolando le posizioni
  // guadagnate/perse sulla qualifica. Quindi: finché la fonte è il fallback si
  // riprova, e la prima griglia vera che arriva sostituisce quella provvisoria.
  useEffect(() => {
    if (debug || !meetingKey) return;
    const isRaceSession = sessionType.toLowerCase().includes("race") && !sessionType.toLowerCase().includes("sprint");
    if (!isRaceSession) return;

    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;      // ~20 minuti di tentativi
    const RETRY_MS = 60_000;

    const load = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/live-grid?meeting_key=${meetingKey}`, { cache: "no-store", signal: abort.signal });
        if (!res.ok) {
          console.warn("[weekend-classifica] /api/live-grid not ok", res.status);
        } else {
          const { grid, source } = await res.json();
          const gridMap = new Map<number, number>();
          for (const [driverStr, pos] of Object.entries(grid)) {
            gridMap.set(Number(driverStr), pos as number);
          }
          if (gridMap.size > 0) setGridPositions(gridMap);
          if (source === "starting_grid") return; // griglia definitiva, stop
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        console.warn("[weekend-classifica] grid", err);
      }
      if (attempts < MAX_ATTEMPTS && !abort.signal.aborted) {
        timer = setTimeout(load, RETRY_MS);
      }
    };
    load();

    return () => {
      abort.abort();
      if (timer) clearTimeout(timer);
    };
  }, [meetingKey, sessionType, debug]);

  // Ritirati ufficiali da session_result (gara e sprint).
  //
  // I DNF live venivano dedotti solo dai messaggi race_control, ma OpenF1 non
  // emette un messaggio per ogni ritiro: quelli silenziosi non prendevano il
  // malus −10. `session_result` porta i flag dnf/dsq ufficiali ed è aggiornato
  // durante la sessione, quindi lo interroghiamo ogni 45 secondi mentre si
  // corre.
  useEffect(() => {
    if (debug || !sessionKey) return;
    const kind = classifySession(sessionType);
    if (kind !== "race" && kind !== "sprint") return;

    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const res = await fetch(`/api/live-retired?session_key=${sessionKey}`, { cache: "no-store", signal: abort.signal });
        if (res.ok) {
          const { retired } = await res.json();
          if (Array.isArray(retired)) {
            setRetiredDrivers((prev) => {
              // Un ritiro non si annulla: uniamo sempre, così una risposta
              // parziale o un errore momentaneo non fa "resuscitare" nessuno.
              const next = new Set(prev);
              let changed = false;
              for (const n of retired) {
                if (typeof n === "number" && !next.has(n)) { next.add(n); changed = true; }
              }
              return changed ? next : prev;
            });
          }
        }
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") console.warn("[weekend-classifica] retired", err);
      }
      if (!abort.signal.aborted) timer = setTimeout(load, 45_000);
    };
    load();

    return () => {
      abort.abort();
      if (timer) clearTimeout(timer);
    };
  }, [sessionKey, sessionType, debug]);

  // Penalità cambi extra (dal 3° cambio −10), solo in gara come nel post-gara:
  // lì la penalità si applica quando la gara è in archivio, qui dal via, così
  // il punteggio live è già quello che verrà salvato. `mercato_cambi` è
  // leggibile solo dal proprietario, quindi la penalità degli altri arriva da
  // una route server che restituisce solo i punti. Si riprova se fallisce:
  // senza penalità la classifica live resterebbe al lordo.
  useEffect(() => {
    if (debug || !round) return;
    const kind = classifySession(sessionType);
    if (kind !== "race" && kind !== "unknown") return;

    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    const RETRY_MS = 30_000;

    const load = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/live-penalita?round=${round}`, { cache: "no-store", signal: abort.signal });
        if (res.ok) {
          const { penalita: byUser } = await res.json();
          const next = new Map<string, number>();
          for (const [uid, pts] of Object.entries(byUser ?? {})) {
            if (typeof pts === "number" && pts > 0) next.set(uid, pts);
          }
          setPenalita(next);
          return;
        }
        console.warn("[weekend-classifica] /api/live-penalita not ok", res.status);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        console.warn("[weekend-classifica] penalita", err);
      }
      if (attempts < MAX_ATTEMPTS && !abort.signal.aborted) timer = setTimeout(load, RETRY_MS);
    };
    load();

    return () => {
      abort.abort();
      if (timer) clearTimeout(timer);
    };
  }, [round, sessionType, debug]);

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
    const archivio = !debug && !sessionKey;
    if (archivio && !previousResults) return [];
    if (!archivio && !debug && ws.positions.size === 0) return [];

    const snap = { positions: ws.positions, raceControl: ws.raceControl, fastestLap: ws.fastestLap, stints: ws.stints, retiredDrivers };
    const events = detectLiveEvents(snap);
    const virtualResults = archivio
      ? (previousResults as RaceWeekendResults)
      : buildLiveWeekendResults(sessionType, snap, events, gridPositions, previousResults);
    // Previsioni e penalità cambi: in gara, o in archivio se la gara è salvata.
    const isRace = countsPrevisioni(archivio ? "" : sessionType, previousResults);

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
        points: calc.total - (isRace ? penalita.get(f.user_id) ?? 0 : 0),
        isMe: f.user_id === userId,
      };
    });

    entries.sort((a, b) => b.points - a.points);
    return entries;
  }, [formazioni, previsioni, ws.positions, ws.raceControl, ws.fastestLap, ws.stints, sessionType, gridPositions, retiredDrivers, previousResults, penalita, userId, debug, sessionKey]);

  return {
    classifica,
    formazioni,
    previsioniByUser: previsioni,
    /** user_id → penalità cambi (in gara o gara in archivio, già tolta da `classifica`) */
    penalitaByUser: countsPrevisioni(!debug && !sessionKey ? "" : sessionType, previousResults) ? penalita : EMPTY_PENALITA,
    previousResults,
    /** true quando la lettura di `weekend_results` è terminata (anche se vuota) */
    previousLoaded,
    gridPositions,
    retiredDrivers,
    ws,
  };
}

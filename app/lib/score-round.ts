// Calcolo punteggi giocatori per un round — fonte unica condivisa tra
// /api/post-gara e /api/recalc-penalties (evita la logica duplicata).

import {
  calcolaPuntiWeekend,
  type RaceWeekendResults,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "./scoring";
import type { Previsioni } from "./types";
import { ordinaClassificaWeekend, puntiClassificaReale } from "./classifica-reale";

export interface PlayerScore {
  user_id: string;
  name: string;
  scuderia: string;
  weekend_points: number;
  piloti_points: number;
  previsioni_points: number;
  penalita_cambi: number;
}

const EMPTY_PREVISIONI: Previsioni = {
  safetyCar: null,
  virtualSafetyCar: null,
  redFlag: null,
  gommeWet: null,
  poleVince: null,
  numeroDnf: null,
};

/**
 * Calcola il punteggio weekend di tutti i giocatori con formazione confermata.
 * Le previsioni e la penalità cambi vengono considerate solo se `isPostRace`.
 * Restituisce la lista ordinata per punteggio weekend (desc).
 */
/**
 * Dati di un round già letti dal DB. Separarli dal calcolo permette di
 * valutare lo stesso round con risultati diversi (es. confronto fra due
 * griglie di partenza) senza rifare le query, e di leggere più round in
 * blocco invece che uno alla volta.
 */
export interface RoundScoringInputs {
  formazioni: any[];
  profiles: any[];
  previsioni: any[] | null;
  /** user_id → numero di cambi fatti nel round (per la penalità dal 3° in poi) */
  cambiPerUser: Map<string, number>;
}

export async function computePlayerScores(
  supabase: any,
  round: number,
  weekendResults: RaceWeekendResults,
  isPostRace: boolean,
): Promise<PlayerScore[]> {
  const { data: formazioni } = await supabase
    .from("formazioni")
    .select("*")
    .eq("round", round)
    .eq("confirmed", true);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, team_principal_name, scuderia_name");

  let previsioniData: any[] | null = null;
  if (isPostRace) {
    const { data } = await supabase
      .from("previsioni")
      .select("*")
      .eq("round", round)
      .eq("confirmed", true);
    previsioniData = data;
  }

  const cambiPerUser = new Map<string, number>();
  if (isPostRace) {
    for (const f of formazioni || []) {
      if (f.chip_piloti === "wildcard") continue;
      const { data: cambiData } = await supabase
        .from("mercato_cambi")
        .select("id")
        .eq("user_id", f.user_id)
        .eq("round", round);
      cambiPerUser.set(f.user_id, (cambiData || []).length);
    }
  }

  return computePlayerScoresFrom(
    { formazioni: formazioni || [], profiles: profiles || [], previsioni: previsioniData, cambiPerUser },
    weekendResults,
    isPostRace,
  );
}

/** Calcolo puro: stessi punteggi, ma su dati già caricati. */
export function computePlayerScoresFrom(
  inputs: RoundScoringInputs,
  weekendResults: RaceWeekendResults,
  isPostRace: boolean,
): PlayerScore[] {
  const { formazioni, profiles, previsioni: previsioniData, cambiPerUser } = inputs;
  const playerScores: PlayerScore[] = [];

  for (const formazione of formazioni || []) {
    const driverNumbers: number[] = (formazione.driver_numbers || []).map(Number);
    if (driverNumbers.length === 0) continue;

    const chipPiloti: ChipPilotiConfig = {
      chipPiloti: formazione.chip_piloti,
      chipPilotiTarget: formazione.chip_piloti_target,
      sestoUomo: formazione.sesto_uomo,
    };

    let previsioni: Previsioni = { ...EMPTY_PREVISIONI };
    let chipPrevisioni: ChipPrevisioniConfig = { chipAttivo: null, chipTarget: null };

    if (isPostRace) {
      const prev = previsioniData?.find((p: any) => p.user_id === formazione.user_id);
      if (prev) {
        previsioni = {
          safetyCar: prev.safety_car,
          virtualSafetyCar: prev.virtual_safety_car,
          redFlag: prev.red_flag,
          gommeWet: prev.gomme_wet,
          poleVince: prev.pole_vince,
          numeroDnf: prev.numero_dnf,
        };
        chipPrevisioni = {
          chipAttivo: prev.chip_attivo || null,
          chipTarget: prev.chip_target || null,
        };
      }
    }

    const calc = calcolaPuntiWeekend(
      driverNumbers,
      formazione.primo_pilota,
      previsioni,
      weekendResults,
      chipPiloti,
      chipPrevisioni,
    );
    const profile = profiles?.find((p: any) => p.id === formazione.user_id);

    // Penalità cambi: solo post-race, e mai con chip wildcard
    let penalitaCambi = 0;
    if (isPostRace && formazione.chip_piloti !== "wildcard") {
      const numCambi = cambiPerUser.get(formazione.user_id) ?? 0;
      penalitaCambi = Math.max(0, numCambi - 2) * 10;
    }

    playerScores.push({
      user_id: formazione.user_id,
      name: profile?.team_principal_name || "—",
      scuderia: profile?.scuderia_name || "—",
      weekend_points: calc.total - penalitaCambi,
      piloti_points: calc.pilotiPoints,
      previsioni_points: calc.previsioniPoints,
      penalita_cambi: penalitaCambi,
    });
  }

  // Stesso ordine della Classifica Reale (vedi classifica-reale.ts), così la
  // lista mostrata e i punti assegnati coincidono sempre.
  const ordine = ordinaClassificaWeekend(
    playerScores.map((p) => ({ user_id: p.user_id, total_points: p.weekend_points, piloti_points: p.piloti_points, previsioni_points: p.previsioni_points })),
  ).map((r) => r.user_id);
  return ordine.map((id) => playerScores.find((p) => p.user_id === id)!);
}

// ─── Applicazione dei punteggi di un round (idempotente) ───

export interface RigaApplicata {
  user_id: string;
  nome: string;
  weekend_points: number;
  real_points: number;
  delta_total: number;
  delta_real: number;
}

/**
 * Scrive i punteggi di un round e aggiorna la classifica generale per
 * DIFFERENZA rispetto a quanto già registrato per quel round. Unico punto di
 * scrittura per post-gara, recalc-penalties e reset-round.
 *
 * Perché per differenza, e perché anche sui punti "reale": prima la somma
 * punti era già a delta, ma i punti Classifica Reale (25-18-15...) venivano
 * SOMMATI a ogni calcolo della gara; ogni rilancio di un round li
 * raddoppiava e il reset non li toglieva. In produzione `real_points` era
 * arrivato a 637 con un massimo teorico di 325. Ora ogni round porta in
 * `weekend_scores.real_points` esattamente quanto ha dato, e un ricalcolo
 * sottrae quello e somma il nuovo: rilanciare cento volte dà lo stesso
 * risultato di lanciare una volta.
 *
 * Con `playerScores` vuoto il round viene semplicemente tolto dalla
 * classifica generale (è quello che fa reset-round).
 */
export async function applicaPunteggiRound(
  supabase: any,
  round: number,
  playerScores: PlayerScore[],
  isPostRace: boolean,
): Promise<RigaApplicata[]> {
  // Stato precedente del round.
  const { data: oldRows } = await supabase
    .from("weekend_scores")
    .select("user_id, total_points, piloti_points, previsioni_points, real_points")
    .eq("round", round);
  const old = (oldRows ?? []) as { user_id: string; total_points: number | null; piloti_points: number | null; previsioni_points: number | null; real_points: number | null }[];

  // Punti reale già dati: dalla colonna se c'è, altrimenti (righe salvate
  // prima della colonna) ricostruiti con la stessa regola di allora.
  const derivedOldReal = puntiClassificaReale(old);
  const oldTotal = new Map<string, number>();
  const oldReal = new Map<string, number>();
  for (const r of old) {
    oldTotal.set(r.user_id, Number(r.total_points ?? 0));
    oldReal.set(r.user_id, r.real_points != null ? Number(r.real_points) : (derivedOldReal.get(r.user_id) ?? 0));
  }

  // Nuovo stato: punti reale solo quando la gara è calcolata.
  const newReal = isPostRace
    ? puntiClassificaReale(playerScores.map((p) => ({ user_id: p.user_id, total_points: p.weekend_points, piloti_points: p.piloti_points, previsioni_points: p.previsioni_points })))
    : new Map<string, number>();

  const out: RigaApplicata[] = [];
  const utenti = new Set<string>([...oldTotal.keys(), ...playerScores.map((p) => p.user_id)]);

  for (const userId of utenti) {
    const ps = playerScores.find((p) => p.user_id === userId);
    const nuovoTotale = ps?.weekend_points ?? 0;
    const nuovoReale = ps ? (newReal.get(userId) ?? 0) : 0;
    const deltaTotal = nuovoTotale - (oldTotal.get(userId) ?? 0);
    const deltaReal = nuovoReale - (oldReal.get(userId) ?? 0);

    const { data: existing } = await supabase
      .from("classifica_totale")
      .select("total_points, real_points, team_principal_name, scuderia_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing || ps) {
      await supabase.from("classifica_totale").upsert({
        user_id: userId,
        team_principal_name: ps?.name ?? existing?.team_principal_name ?? "—",
        scuderia_name: ps?.scuderia ?? existing?.scuderia_name ?? "—",
        total_points: Number(existing?.total_points ?? 0) + deltaTotal,
        real_points: Number(existing?.real_points ?? 0) + deltaReal,
        last_weekend_points: nuovoTotale,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    if (ps) {
      await supabase.from("weekend_scores").upsert({
        user_id: userId,
        round,
        total_points: ps.weekend_points,
        piloti_points: ps.piloti_points,
        previsioni_points: ps.previsioni_points,
        real_points: nuovoReale,
      }, { onConflict: "user_id,round" });
    } else {
      // Non è più fra i calcolati (es. formazione tolta): il round non deve
      // più contare per questo utente.
      await supabase.from("weekend_scores").delete().eq("user_id", userId).eq("round", round);
    }

    out.push({ user_id: userId, nome: ps?.name ?? existing?.team_principal_name ?? userId, weekend_points: nuovoTotale, real_points: nuovoReale, delta_total: deltaTotal, delta_real: deltaReal });
  }

  return out;
}

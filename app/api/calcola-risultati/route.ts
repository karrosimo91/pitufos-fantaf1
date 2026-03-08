import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";
import {
  calcolaPuntiWeekend,
  type RaceWeekendResults,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "../../lib/scoring";
import type { Previsioni } from "../../lib/types";

const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/**
 * POST /api/calcola-risultati
 * Body: { round: number, admin_key: string }
 *
 * Calcola i punteggi di tutti i giocatori per un round,
 * aggiorna classifica_totale.
 *
 * Richiede ADMIN_API_KEY nelle env e nel body.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { round, admin_key } = body;

  // Verifica admin key
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || admin_key !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!round || typeof round !== "number" || round < 1 || round > 24) {
    return NextResponse.json({ error: "Round non valido" }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  // 1. Carica risultati weekend
  const { data: weekendData, error: weekendErr } = await supabase
    .from("weekend_results")
    .select("*")
    .eq("round", round)
    .single();

  if (weekendErr || !weekendData) {
    return NextResponse.json({ error: "Risultati weekend non trovati per il round " + round }, { status: 404 });
  }

  const raceResults: RaceWeekendResults = weekendData.data;

  // 2. Carica formazioni confermate
  const { data: formazioni, error: formErr } = await supabase
    .from("formazioni")
    .select("*")
    .eq("round", round)
    .eq("confirmed", true);

  if (formErr) {
    return NextResponse.json({ error: "Errore caricamento formazioni: " + formErr.message }, { status: 500 });
  }

  // 3. Carica previsioni confermate
  const { data: previsioniData } = await supabase
    .from("previsioni")
    .select("*")
    .eq("round", round)
    .eq("confirmed", true);

  // 4. Calcola punteggi per ogni giocatore
  const playerScores: { user_id: string; weekend_points: number; piloti_points: number; previsioni_points: number }[] = [];

  for (const formazione of formazioni || []) {
    const driverNumbers: number[] = (formazione.driver_numbers || []).map(Number);
    if (driverNumbers.length === 0) continue;

    const chipPiloti: ChipPilotiConfig = {
      chipPiloti: formazione.chip_piloti,
      chipPilotiTarget: formazione.chip_piloti_target,
      sestoUomo: formazione.sesto_uomo,
    };

    const prev = previsioniData?.find((p) => p.user_id === formazione.user_id);
    const previsioni: Previsioni = prev
      ? {
          safetyCar: prev.safety_car,
          virtualSafetyCar: prev.virtual_safety_car,
          redFlag: prev.red_flag,
          gommeWet: prev.gomme_wet,
          poleVince: prev.pole_vince,
          numeroDnf: prev.numero_dnf,
        }
      : { safetyCar: null, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null };

    const chipPrevisioni: ChipPrevisioniConfig = {
      chipAttivo: prev?.chip_attivo || null,
      chipTarget: prev?.chip_target || null,
    };

    const calc = calcolaPuntiWeekend(
      driverNumbers,
      formazione.primo_pilota,
      previsioni,
      raceResults,
      chipPiloti,
      chipPrevisioni
    );

    playerScores.push({
      user_id: formazione.user_id,
      weekend_points: calc.total,
      piloti_points: calc.pilotiPoints,
      previsioni_points: calc.previsioniPoints,
    });
  }

  // 5. Ordina per punteggio weekend (per classifica reale)
  playerScores.sort((a, b) => b.weekend_points - a.weekend_points);

  // 6. Aggiorna classifica_totale con upsert
  const errors: string[] = [];

  for (let i = 0; i < playerScores.length; i++) {
    const ps = playerScores[i];
    const realPoints = PUNTI_REALE[i] ?? 0;

    // Leggi classifica attuale del giocatore
    const { data: existing } = await supabase
      .from("classifica_totale")
      .select("*")
      .eq("user_id", ps.user_id)
      .single();

    const currentTotal = existing?.total_points ?? 0;
    const currentReal = existing?.real_points ?? 0;

    // Carica nome dal profilo
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_principal_name, scuderia_name")
      .eq("id", ps.user_id)
      .single();

    const { error: upsertErr } = await supabase
      .from("classifica_totale")
      .upsert({
        user_id: ps.user_id,
        team_principal_name: profile?.team_principal_name || "—",
        scuderia_name: profile?.scuderia_name || "—",
        total_points: currentTotal + ps.weekend_points,
        last_weekend_points: ps.weekend_points,
        real_points: currentReal + realPoints,
      }, { onConflict: "user_id" });

    if (upsertErr) {
      errors.push(`${ps.user_id}: ${upsertErr.message}`);
    }
  }

  // 7. Salva anche dettaglio per round (per storico)
  for (const ps of playerScores) {
    await supabase
      .from("weekend_scores")
      .upsert({
        user_id: ps.user_id,
        round,
        total_points: ps.weekend_points,
        piloti_points: ps.piloti_points,
        previsioni_points: ps.previsioni_points,
      }, { onConflict: "user_id,round" });
  }

  return NextResponse.json({
    success: true,
    round,
    giocatori_calcolati: playerScores.length,
    classifica: playerScores.map((ps, i) => ({
      posizione: i + 1,
      user_id: ps.user_id,
      weekend_points: ps.weekend_points,
      punti_reale: PUNTI_REALE[i] ?? 0,
    })),
    errors: errors.length > 0 ? errors : undefined,
  });
}

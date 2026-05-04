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
 * POST /api/ricalcola-round
 * Body: { round: number, admin_key: string }
 *
 * Ricalcola i punteggi di un round senza cancellare i weekend_results.
 * 1. Legge i vecchi weekend_scores
 * 2. Sottrae i vecchi punti dalla classifica_totale
 * 3. Ricalcola con il nuovo scoring
 * 4. Aggiorna classifica_totale e weekend_scores
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { round, admin_key } = body;

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

  const log: string[] = [];

  // 1. Carica risultati weekend (NON li cancella)
  const { data: weekendData, error: weekendErr } = await supabase
    .from("weekend_results")
    .select("*")
    .eq("round", round)
    .single();

  if (weekendErr || !weekendData) {
    return NextResponse.json({ error: "Risultati weekend non trovati per il round " + round }, { status: 404 });
  }

  const raceResults: RaceWeekendResults = weekendData.data;
  log.push("Weekend results caricati OK");

  // 2. Leggi vecchi weekend_scores per sottrarre dalla classifica
  const { data: oldScores } = await supabase
    .from("weekend_scores")
    .select("user_id, total_points")
    .eq("round", round);

  const oldScoresMap = new Map<string, number>();
  for (const os of oldScores || []) {
    oldScoresMap.set(os.user_id, os.total_points ?? 0);
  }
  log.push(`Vecchi scores trovati: ${oldScoresMap.size}`);

  // Ricostruisci il vecchio ranking per sottrarre i real_points già applicati
  const oldRanking = [...(oldScores || [])].sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0));
  const oldRealByUser = new Map<string, number>();
  oldRanking.forEach((os, idx) => {
    oldRealByUser.set(os.user_id, PUNTI_REALE[idx] ?? 0);
  });

  // 3. Sottrai vecchi punti dalla classifica_totale (sia weekend che reale)
  for (const [userId, oldPts] of oldScoresMap) {
    const { data: existing } = await supabase
      .from("classifica_totale")
      .select("total_points, real_points")
      .eq("user_id", userId)
      .single();

    if (existing) {
      const oldReal = oldRealByUser.get(userId) ?? 0;
      await supabase
        .from("classifica_totale")
        .update({
          total_points: (existing.total_points ?? 0) - oldPts,
          real_points: (existing.real_points ?? 0) - oldReal,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }
  }
  log.push("Vecchi punti sottratti dalla classifica");

  // 4. Carica formazioni e previsioni confermate
  const { data: formazioni } = await supabase
    .from("formazioni")
    .select("*")
    .eq("round", round)
    .eq("confirmed", true);

  const { data: previsioniData } = await supabase
    .from("previsioni")
    .select("*")
    .eq("round", round)
    .eq("confirmed", true);

  const { data: cambiData } = await supabase
    .from("mercato_cambi")
    .select("user_id, id")
    .eq("round", round);

  // 5. Ricalcola punteggi con il nuovo scoring
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

    const numCambi = (cambiData || []).filter((c) => c.user_id === formazione.user_id).length;
    const penalitaCambi = formazione.chip_piloti === "wildcard" ? 0 : Math.max(0, numCambi - 2) * 10;

    playerScores.push({
      user_id: formazione.user_id,
      weekend_points: calc.total - penalitaCambi,
      piloti_points: calc.pilotiPoints,
      previsioni_points: calc.previsioniPoints,
    });
  }

  // 6. Ordina per punteggio weekend (per classifica reale)
  playerScores.sort((a, b) => b.weekend_points - a.weekend_points);

  // 7. Aggiorna classifica_totale e weekend_scores
  const errors: string[] = [];

  for (let i = 0; i < playerScores.length; i++) {
    const ps = playerScores[i];
    const realPoints = PUNTI_REALE[i] ?? 0;

    const { data: existing } = await supabase
      .from("classifica_totale")
      .select("total_points, real_points")
      .eq("user_id", ps.user_id)
      .single();

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
        total_points: (existing?.total_points ?? 0) + ps.weekend_points,
        last_weekend_points: ps.weekend_points,
        real_points: (existing?.real_points ?? 0) + realPoints,
      }, { onConflict: "user_id" });

    if (upsertErr) errors.push(`${ps.user_id}: ${upsertErr.message}`);

    // Aggiorna weekend_scores
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

  log.push(`Ricalcolati ${playerScores.length} giocatori`);

  // Cancella punteggi provvisori
  await supabase.from("provisional_weekend").delete().eq("round", round);

  return NextResponse.json({
    success: true,
    round,
    message: `Round ${round} ricalcolato con nuovo regolamento`,
    giocatori_ricalcolati: playerScores.length,
    classifica: playerScores.map((ps, i) => ({
      posizione: i + 1,
      user_id: ps.user_id,
      weekend_points: ps.weekend_points,
      punti_reale: PUNTI_REALE[i] ?? 0,
    })),
    log,
    errors: errors.length > 0 ? errors : undefined,
  });
}

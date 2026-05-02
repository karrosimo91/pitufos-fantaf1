import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";
import {
  calcolaPuntiWeekend,
  getScoreBreakdown,
  calcolaPuntiPrevisioni,
  type RaceWeekendResults,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "../../lib/scoring";
import type { Previsioni } from "../../lib/types";
import { DRIVERS_2026 } from "../../lib/drivers-data";

function driverName(num: number): string {
  return DRIVERS_2026.find((d) => d.number === num)?.name ?? `#${num}`;
}

/**
 * POST /api/review-round
 * Body: { round: number, admin_key: string }
 *
 * Returns full detailed breakdown of all players' scores for a round.
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

  // 1. Load weekend results
  const { data: weekendData, error: weekendErr } = await supabase
    .from("weekend_results")
    .select("*")
    .eq("round", round)
    .single();

  if (weekendErr || !weekendData) {
    return NextResponse.json({ error: "Risultati weekend non trovati per il round " + round }, { status: 404 });
  }

  const results: RaceWeekendResults = weekendData.data;

  // 2. Load confirmed formazioni
  const { data: formazioni } = await supabase
    .from("formazioni")
    .select("*")
    .eq("round", round)
    .eq("confirmed", true);

  // 3. Load confirmed previsioni
  const { data: previsioniData } = await supabase
    .from("previsioni")
    .select("*")
    .eq("round", round)
    .eq("confirmed", true);

  // 4. Load profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, team_principal_name, scuderia_name");

  // 5. Load saved weekend_scores for comparison
  const { data: savedScores } = await supabase
    .from("weekend_scores")
    .select("*")
    .eq("round", round);

  // 6. Load transfer penalties
  const { data: cambiData } = await supabase
    .from("mercato_cambi")
    .select("user_id, id")
    .eq("round", round);

  // Build raw results summary
  const rawResults = {
    qualifying: results.qualifying
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        pos: r.position,
        driver: driverName(r.driver_number),
        driver_number: r.driver_number,
        dnf: r.dnf || false,
      })),
    race: results.race
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        pos: r.position,
        driver: driverName(r.driver_number),
        driver_number: r.driver_number,
        grid: r.grid_position ?? null,
        dnf: r.dnf || false,
        fastest_lap: r.fastest_lap || false,
        dotd: r.driver_of_the_day || false,
        penalty: r.penalty || false,
      })),
    sprint_shootout: results.sprint_shootout?.sort((a, b) => a.position - b.position).map((r) => ({
      pos: r.position,
      driver: driverName(r.driver_number),
      driver_number: r.driver_number,
      dnf: r.dnf || false,
    })),
    sprint: results.sprint?.sort((a, b) => a.position - b.position).map((r) => ({
      pos: r.position,
      driver: driverName(r.driver_number),
      driver_number: r.driver_number,
      dnf: r.dnf || false,
      fastest_lap: r.fastest_lap || false,
    })),
    events: results.events,
  };

  // Build per-player breakdown
  const players: any[] = [];

  for (const formazione of formazioni || []) {
    const driverNumbers: number[] = (formazione.driver_numbers || []).map(Number);
    if (driverNumbers.length === 0) continue;

    const profile = profiles?.find((p) => p.id === formazione.user_id);
    const prev = previsioniData?.find((p) => p.user_id === formazione.user_id);

    const chipPiloti: ChipPilotiConfig = {
      chipPiloti: formazione.chip_piloti,
      chipPilotiTarget: formazione.chip_piloti_target,
      sestoUomo: formazione.sesto_uomo,
    };

    const hasRaceResults = results.race.length > 0;
    const previsioni: Previsioni = prev && hasRaceResults
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

    // Full weekend calculation
    const calc = calcolaPuntiWeekend(driverNumbers, formazione.primo_pilota, previsioni, results, chipPiloti, chipPrevisioni);

    // Per-driver, per-session breakdown
    const allDrivers = [...driverNumbers];
    if (chipPiloti.chipPiloti === "sesto" && chipPiloti.sestoUomo && !allDrivers.includes(chipPiloti.sestoUomo)) {
      allDrivers.push(chipPiloti.sestoUomo);
    }

    const driversBreakdown = allDrivers.map((num) => {
      const isPrimo = num === formazione.primo_pilota;
      const isBoosted = chipPiloti.chipPiloti === "boost" && chipPiloti.chipPilotiTarget === num && !isPrimo;
      const chipForBreakdown = isBoosted ? "boost" : (isPrimo && chipPiloti.chipPiloti === "scudo") ? "scudo" : chipPiloti.chipPiloti === "halo" ? "halo" : null;

      const sessions: any = {};

      // Qualifying
      const qualResult = results.qualifying.find((r) => r.driver_number === num);
      if (qualResult) {
        sessions.qualifying = getScoreBreakdown(qualResult, "qualifying", isPrimo, chipForBreakdown);
      }

      // Sprint Shootout
      if (results.sprint_shootout) {
        const ssResult = results.sprint_shootout.find((r) => r.driver_number === num);
        if (ssResult) {
          sessions.sprint_shootout = getScoreBreakdown(ssResult, "sprint_shootout", isPrimo, chipForBreakdown);
        }
      }

      // Sprint
      if (results.sprint) {
        const spResult = results.sprint.find((r) => r.driver_number === num);
        if (spResult) {
          sessions.sprint = getScoreBreakdown(spResult, "sprint", isPrimo, chipForBreakdown);
        }
      }

      // Race
      const raceResult = results.race.find((r) => r.driver_number === num);
      if (raceResult) {
        sessions.race = getScoreBreakdown(raceResult, "race", isPrimo, chipForBreakdown);
      }

      const dettaglio = calc.pilotiDettaglio.find((d) => d.driver_number === num);

      return {
        driver_number: num,
        name: driverName(num),
        primo_pilota: isPrimo,
        boost: isBoosted,
        sesto_uomo: chipPiloti.chipPiloti === "sesto" && chipPiloti.sestoUomo === num,
        punti_base: dettaglio?.puntiBase ?? 0,
        moltiplicatore: dettaglio?.moltiplicatore ?? 1,
        punti_finali: dettaglio?.puntiFinali ?? 0,
        halo_applicato: dettaglio?.haloApplicato ?? false,
        sessions,
      };
    });

    // Transfer penalties
    const userCambi = (cambiData || []).filter((c) => c.user_id === formazione.user_id);
    const numCambi = userCambi.length;
    const penalitaCambi = formazione.chip_piloti === "wildcard" ? 0 : Math.max(0, numCambi - 2) * 10;

    // Compare with saved scores
    const saved = savedScores?.find((s) => s.user_id === formazione.user_id);

    players.push({
      user_id: formazione.user_id,
      nome: profile?.team_principal_name || "—",
      scuderia: profile?.scuderia_name || "—",
      formazione: {
        piloti: driverNumbers.map((n) => ({ number: n, name: driverName(n) })),
        primo_pilota: formazione.primo_pilota ? { number: formazione.primo_pilota, name: driverName(formazione.primo_pilota) } : null,
        chip_piloti: formazione.chip_piloti || null,
        chip_piloti_target: formazione.chip_piloti_target || null,
        sesto_uomo: formazione.chip_piloti === "sesto" && formazione.sesto_uomo ? { number: formazione.sesto_uomo, name: driverName(formazione.sesto_uomo) } : null,
        sesto_uomo_raw: formazione.sesto_uomo || null,
      },
      previsioni_raw: prev ? {
        safety_car: prev.safety_car,
        virtual_safety_car: prev.virtual_safety_car,
        red_flag: prev.red_flag,
        gomme_wet: prev.gomme_wet,
        pole_vince: prev.pole_vince,
        numero_dnf: prev.numero_dnf,
        chip_attivo: prev.chip_attivo,
        chip_target: prev.chip_target,
      } : null,
      piloti_breakdown: driversBreakdown,
      previsioni_breakdown: calc.previsioniDettaglio,
      punti_piloti: calc.pilotiPoints,
      punti_previsioni: calc.previsioniPoints,
      penalita_cambi: penalitaCambi,
      num_cambi: numCambi,
      totale_calcolato: calc.total - penalitaCambi,
      totale_salvato: saved?.total_points ?? null,
      differenza: saved ? (calc.total - penalitaCambi) - saved.total_points : null,
      avvisi: [
        ...(formazione.sesto_uomo && formazione.chip_piloti !== "sesto"
          ? [`sesto_uomo=${driverName(formazione.sesto_uomo)} nel DB ma chip_piloti="${formazione.chip_piloti}" (non "sesto") — Norris NON conteggiato`]
          : []),
        ...(!hasRaceResults ? ["Gara non ancora calcolata — previsioni non conteggiate"] : []),
      ],
    });
  }

  players.sort((a, b) => b.totale_calcolato - a.totale_calcolato);

  return NextResponse.json({
    success: true,
    round,
    raw_results: rawResults,
    players,
    discrepanze: players.filter((p) => p.differenza !== null && p.differenza !== 0),
  });
}

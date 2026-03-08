import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";
import type { RaceWeekendResults, DriverResult } from "../../lib/scoring";
import {
  calcolaPuntiWeekend,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "../../lib/scoring";
import type { Previsioni } from "../../lib/types";
import { RACES_2026 } from "../../lib/races";

const OPENF1 = "https://api.openf1.org/v1";
const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/**
 * POST /api/post-gara
 * Body: { round: number, admin_key: string, driver_of_the_day?: number }
 *
 * Fa tutto in un colpo:
 * 1. Scarica risultati da OpenF1
 * 2. Salva in weekend_results
 * 3. Calcola punteggi di tutti i giocatori
 * 4. Aggiorna classifica_totale
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { round, admin_key, driver_of_the_day } = body;

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

  const race = RACES_2026.find((r) => r.round === round);
  if (!race) {
    return NextResponse.json({ error: "Gara non trovata" }, { status: 404 });
  }

  const log: string[] = [];

  try {
    // ═══════════════════════════════════
    // STEP 1: Fetch risultati da OpenF1
    // ═══════════════════════════════════

    log.push("--- STEP 1: Fetch da OpenF1 ---");

    const allMeetings = await fetchJson(`${OPENF1}/meetings?year=2026`);
    if (!allMeetings || allMeetings.length === 0) {
      return NextResponse.json({ error: "Nessun meeting trovato per il 2026", log }, { status: 404 });
    }

    // Filtra via pre-season testing
    const meetings = allMeetings
      .filter((m: any) => !m.meeting_name?.toLowerCase().includes("testing"))
      .sort((a: any, b: any) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
    const meeting = meetings[round - 1];
    if (!meeting) {
      return NextResponse.json({ error: `Meeting per round ${round} non trovato`, log }, { status: 404 });
    }

    const meetingKey = meeting.meeting_key;
    log.push(`Meeting: ${meeting.meeting_name} (key: ${meetingKey})`);

    const sessions = await fetchJson(`${OPENF1}/sessions?meeting_key=${meetingKey}`);
    log.push(`Sessioni trovate: ${sessions.length}`);

    const qualifyingSession = sessions.find((s: any) => s.session_type === "Qualifying");
    const raceSession = sessions.find((s: any) => s.session_type === "Race");
    const sprintShootoutSession = sessions.find((s: any) =>
      s.session_type === "Sprint Shootout" || s.session_type === "Sprint Qualifying"
    );
    const sprintSession = sessions.find((s: any) =>
      s.session_type === "Sprint" && s.session_name?.toLowerCase() !== "sprint qualifying"
    );

    if (!raceSession) {
      return NextResponse.json({ error: "Sessione gara non trovata", log }, { status: 404 });
    }

    // Qualifica
    let qualifying: DriverResult[] = [];
    if (qualifyingSession) {
      qualifying = await fetchSessionResults(qualifyingSession.session_key);
      log.push(`Qualifica: ${qualifying.length} piloti`);
    }

    // Gara (usa qualifica come griglia di partenza)
    const raceKey = raceSession.session_key;
    const qualGridMap = new Map<number, number>();
    for (const q of qualifying) {
      qualGridMap.set(q.driver_number, q.position);
    }
    const raceResults = await fetchRaceResults(raceKey, driver_of_the_day, qualGridMap);
    log.push(`Gara: ${raceResults.length} piloti (con griglia da qualifica)`);

    // Sprint
    let sprint_shootout: DriverResult[] | undefined;
    let sprint: DriverResult[] | undefined;

    if (sprintShootoutSession) {
      sprint_shootout = await fetchSessionResults(sprintShootoutSession.session_key);
      log.push(`Sprint Shootout: ${sprint_shootout.length} piloti`);
    }
    if (sprintSession) {
      sprint = await fetchSprintResults(sprintSession.session_key);
      log.push(`Sprint: ${sprint.length} piloti`);
    }

    // Eventi
    const events = await fetchRaceEvents(raceKey);
    const poleDriver = qualifying.find((d) => d.position === 1);
    const raceWinner = raceResults.find((d) => d.position === 1);
    events.pole_won = !!(poleDriver && raceWinner && poleDriver.driver_number === raceWinner.driver_number);

    log.push(`Eventi: SC=${events.safety_car} VSC=${events.virtual_safety_car} RF=${events.red_flag} Wet=${events.wet_tyres} DNF=${events.total_dnf} PoleWon=${events.pole_won}`);

    const weekendResults: RaceWeekendResults = { qualifying, race: raceResults, sprint_shootout, sprint, events };

    // Salva in DB
    const { error: saveErr } = await supabase
      .from("weekend_results")
      .upsert({ round, data: weekendResults, updated_at: new Date().toISOString() }, { onConflict: "round" });

    if (saveErr) {
      return NextResponse.json({ error: "Errore salvataggio weekend_results: " + saveErr.message, log }, { status: 500 });
    }
    log.push("weekend_results salvato OK");

    // ═══════════════════════════════════
    // STEP 2: Calcola punteggi
    // ═══════════════════════════════════

    log.push("--- STEP 2: Calcolo punteggi ---");

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

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, team_principal_name, scuderia_name");

    const playerScores: { user_id: string; name: string; scuderia: string; weekend_points: number; piloti_points: number; previsioni_points: number; penalita_cambi: number }[] = [];

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
        ? { safetyCar: prev.safety_car, virtualSafetyCar: prev.virtual_safety_car, redFlag: prev.red_flag, gommeWet: prev.gomme_wet, poleVince: prev.pole_vince, numeroDnf: prev.numero_dnf }
        : { safetyCar: null, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null };

      const chipPrevisioni: ChipPrevisioniConfig = {
        chipAttivo: prev?.chip_attivo || null,
        chipTarget: prev?.chip_target || null,
      };

      const calc = calcolaPuntiWeekend(driverNumbers, formazione.primo_pilota, previsioni, weekendResults, chipPiloti, chipPrevisioni);
      const profile = profiles?.find((p) => p.id === formazione.user_id);

      // Penalita' cambi mercato: 2 gratis, dal 3° in poi -10 ciascuno (wildcard = nessuna penalita')
      let penalitaCambi = 0;
      if (formazione.chip_piloti !== "wildcard") {
        const { data: cambiData } = await supabase
          .from("mercato_cambi")
          .select("id")
          .eq("user_id", formazione.user_id)
          .eq("round", round);
        const numCambi = (cambiData || []).length;
        const cambiExtra = Math.max(0, numCambi - 2);
        penalitaCambi = cambiExtra * 10;
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

    playerScores.sort((a, b) => b.weekend_points - a.weekend_points);
    log.push(`Giocatori calcolati: ${playerScores.length}`);

    // ═══════════════════════════════════
    // STEP 3: Aggiorna classifiche
    // ═══════════════════════════════════

    log.push("--- STEP 3: Aggiorna classifiche ---");

    for (let i = 0; i < playerScores.length; i++) {
      const ps = playerScores[i];
      const realPoints = PUNTI_REALE[i] ?? 0;

      const { data: existing } = await supabase
        .from("classifica_totale")
        .select("total_points, real_points")
        .eq("user_id", ps.user_id)
        .single();

      await supabase.from("classifica_totale").upsert({
        user_id: ps.user_id,
        team_principal_name: ps.name,
        scuderia_name: ps.scuderia,
        total_points: (existing?.total_points ?? 0) + ps.weekend_points,
        last_weekend_points: ps.weekend_points,
        real_points: (existing?.real_points ?? 0) + realPoints,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      await supabase.from("weekend_scores").upsert({
        user_id: ps.user_id,
        round,
        total_points: ps.weekend_points,
        piloti_points: ps.piloti_points,
        previsioni_points: ps.previsioni_points,
      }, { onConflict: "user_id,round" });

      log.push(`${i + 1}. ${ps.name}: ${ps.weekend_points} pts (P:${ps.piloti_points} + Prev:${ps.previsioni_points}${ps.penalita_cambi > 0 ? ` - Cambi:${ps.penalita_cambi}` : ""}) | Reale: +${realPoints}`);
    }

    return NextResponse.json({
      success: true,
      round,
      gara: meeting.meeting_name,
      giocatori: playerScores.length,
      classifica: playerScores.map((ps, i) => ({
        pos: i + 1,
        nome: ps.name,
        scuderia: ps.scuderia,
        punti_weekend: ps.weekend_points,
        punti_reale: PUNTI_REALE[i] ?? 0,
      })),
      eventi: events,
      log,
    });

  } catch (err: any) {
    return NextResponse.json({ error: "Errore: " + err.message, log }, { status: 500 });
  }
}

// ─── Helper functions ───

async function fetchJson(url: string): Promise<any[]> {
  console.log(`[DEBUG] fetchJson: ${url}`);
  const res = await fetch(url, { cache: "no-store" });
  console.log(`[DEBUG] fetchJson: status=${res.status} ok=${res.ok}`);
  if (!res.ok) return [];
  const data = await res.json();
  console.log(`[DEBUG] fetchJson: isArray=${Array.isArray(data)} length=${Array.isArray(data) ? data.length : 'N/A'}`);
  return data;
}

async function fetchSessionResults(sessionKey: number): Promise<DriverResult[]> {
  const results = await fetchJson(`${OPENF1}/position?session_key=${sessionKey}`);
  if (!results || results.length === 0) return [];

  const lastPositions = new Map<number, any>();
  for (const r of results) {
    if (r.driver_number) lastPositions.set(r.driver_number, r);
  }

  return Array.from(lastPositions.values()).map((r) => ({
    driver_number: r.driver_number,
    position: r.position,
    dnf: false,
  }));
}

async function fetchRaceResults(sessionKey: number, dotdNumber?: number, qualGridMap?: Map<number, number>): Promise<DriverResult[]> {
  const positions = await fetchJson(`${OPENF1}/position?session_key=${sessionKey}`);
  const lastPositions = new Map<number, any>();
  for (const r of positions) {
    if (r.driver_number) lastPositions.set(r.driver_number, r);
  }

  // Usa griglia da qualifica (passata come parametro)
  const gridMap = qualGridMap ?? new Map<number, number>();

  const laps = await fetchJson(`${OPENF1}/laps?session_key=${sessionKey}`);
  let fastestLapDriver: number | null = null;
  let fastestTime = Infinity;
  for (const lap of laps) {
    if (lap.lap_duration && lap.lap_duration < fastestTime && lap.lap_duration > 0) {
      fastestTime = lap.lap_duration;
      fastestLapDriver = lap.driver_number;
    }
  }

  const raceControl = await fetchJson(`${OPENF1}/race_control?session_key=${sessionKey}`);
  const retiredDrivers = new Set<number>();
  const penalizedDrivers = new Set<number>();
  for (const rc of raceControl) {
    const msg = (rc.message || "").toUpperCase();
    if (msg.includes("RETIRED") || msg.includes("OUT OF THE RACE") || msg.includes("DID NOT FINISH")) {
      if (rc.driver_number) retiredDrivers.add(rc.driver_number);
    }
    if (msg.includes("PENALTY") && !msg.includes("GRID") && !msg.includes("REPRIMAND")) {
      if (rc.driver_number) penalizedDrivers.add(rc.driver_number);
    }
  }

  return Array.from(lastPositions.values()).map((r) => ({
    driver_number: r.driver_number,
    position: r.position,
    grid_position: gridMap.get(r.driver_number) || undefined,
    dnf: retiredDrivers.has(r.driver_number),
    fastest_lap: r.driver_number === fastestLapDriver,
    driver_of_the_day: r.driver_number === dotdNumber,
    penalty: penalizedDrivers.has(r.driver_number),
  }));
}

async function fetchSprintResults(sessionKey: number): Promise<DriverResult[]> {
  const positions = await fetchJson(`${OPENF1}/position?session_key=${sessionKey}`);
  const lastPositions = new Map<number, any>();
  for (const r of positions) {
    if (r.driver_number) lastPositions.set(r.driver_number, r);
  }

  const laps = await fetchJson(`${OPENF1}/laps?session_key=${sessionKey}`);
  let fastestLapDriver: number | null = null;
  let fastestTime = Infinity;
  for (const lap of laps) {
    if (lap.lap_duration && lap.lap_duration < fastestTime && lap.lap_duration > 0) {
      fastestTime = lap.lap_duration;
      fastestLapDriver = lap.driver_number;
    }
  }

  const raceControl = await fetchJson(`${OPENF1}/race_control?session_key=${sessionKey}`);
  const retiredDrivers = new Set<number>();
  for (const rc of raceControl) {
    const msg = (rc.message || "").toUpperCase();
    if (msg.includes("RETIRED") || msg.includes("OUT OF THE RACE") || msg.includes("DID NOT FINISH")) {
      if (rc.driver_number) retiredDrivers.add(rc.driver_number);
    }
  }

  return Array.from(lastPositions.values()).map((r) => ({
    driver_number: r.driver_number,
    position: r.position,
    dnf: retiredDrivers.has(r.driver_number),
    fastest_lap: r.driver_number === fastestLapDriver,
  }));
}

async function fetchRaceEvents(sessionKey: number): Promise<RaceWeekendResults["events"]> {
  const raceControl = await fetchJson(`${OPENF1}/race_control?session_key=${sessionKey}`);

  let safety_car = false;
  let virtual_safety_car = false;
  let red_flag = false;
  const retiredDrivers = new Set<number>();

  for (const rc of raceControl) {
    const msg = (rc.message || "").toUpperCase();
    if (msg.includes("SAFETY CAR") && !msg.includes("VIRTUAL")) safety_car = true;
    if (msg.includes("VIRTUAL SAFETY CAR") || msg.includes("VSC")) virtual_safety_car = true;
    if (msg.includes("RED FLAG")) red_flag = true;
    if (msg.includes("RETIRED") || msg.includes("OUT OF THE RACE") || msg.includes("DID NOT FINISH")) {
      if (rc.driver_number) retiredDrivers.add(rc.driver_number);
    }
  }

  const stints = await fetchJson(`${OPENF1}/stints?session_key=${sessionKey}`);
  let wet_tyres = false;
  for (const stint of stints) {
    const compound = (stint.compound || "").toUpperCase();
    if (compound === "WET" || compound === "INTERMEDIATE") {
      wet_tyres = true;
      break;
    }
  }

  return { safety_car, virtual_safety_car, red_flag, wet_tyres, pole_won: false, total_dnf: retiredDrivers.size };
}

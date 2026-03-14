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

type SessionMode = "sprint_shootout" | "sprint" | "qualifying" | "race";

/**
 * POST /api/post-gara
 * Body: { round, admin_key, session, driver_of_the_day? }
 *
 * session: "sprint_shootout" | "sprint" | "qualifying" | "race"
 *
 * Ogni sessione:
 * 1. Scarica risultati da OpenF1 per quella sessione
 * 2. Salva/aggiorna in weekend_results (merge con dati esistenti)
 * 3. Ricalcola punteggi piloti da TUTTE le sessioni salvate
 * 4. Solo "race": calcola anche previsioni e penalità cambi
 * 5. Aggiorna classifica_totale (delta rispetto al precedente)
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { round, admin_key, session, driver_of_the_day } = body;

  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || admin_key !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!round || typeof round !== "number" || round < 1 || round > 24) {
    return NextResponse.json({ error: "Round non valido" }, { status: 400 });
  }

  const validSessions: SessionMode[] = ["sprint_shootout", "sprint", "qualifying", "race"];
  if (!session || !validSessions.includes(session)) {
    return NextResponse.json({ error: `Sessione non valida. Usa: ${validSessions.join(", ")}` }, { status: 400 });
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
  const mode: SessionMode = session;

  try {
    // ═══════════════════════════════════
    // STEP 1: Trova meeting e sessioni OpenF1
    // ═══════════════════════════════════

    log.push(`--- STEP 1: Fetch ${mode} da OpenF1 ---`);

    const allMeetings = await fetchJson(`${OPENF1}/meetings?year=2026`);
    if (!allMeetings || allMeetings.length === 0) {
      return NextResponse.json({ error: "Nessun meeting trovato per il 2026", log }, { status: 404 });
    }

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

    // ═══════════════════════════════════
    // STEP 2: Fetch dati della sessione richiesta
    // ═══════════════════════════════════

    // Carica weekend_results esistente (da sessioni precedenti)
    const { data: existingWR } = await supabase
      .from("weekend_results")
      .select("data")
      .eq("round", round)
      .single();

    const prevData: Partial<RaceWeekendResults> = existingWR?.data || {};

    // Mantieni i risultati delle sessioni già calcolate
    let qualifying: DriverResult[] = prevData.qualifying || [];
    let raceResults: DriverResult[] = prevData.race || [];
    let sprint_shootout: DriverResult[] | undefined = prevData.sprint_shootout;
    let sprint: DriverResult[] | undefined = prevData.sprint;
    let events: RaceWeekendResults["events"] = prevData.events || {
      safety_car: false, virtual_safety_car: false, red_flag: false,
      wet_tyres: false, pole_won: false, total_dnf: 0,
    };

    // OpenF1 session matching: usare session_name perché session_type è ambiguo
    // Sprint Qualifying → type="Qualifying", name="Sprint Qualifying"
    // Sprint            → type="Race",       name="Sprint"
    // Qualifying        → type="Qualifying", name="Qualifying"
    // Race              → type="Race",       name="Race"

    if (mode === "sprint_shootout") {
      const ssSession = sessions.find((s: any) =>
        s.session_name?.toLowerCase().includes("sprint") && s.session_name?.toLowerCase().includes("quali")
      );
      if (!ssSession) {
        return NextResponse.json({ error: "Sessione Sprint Shootout non trovata", log }, { status: 404 });
      }
      sprint_shootout = await fetchSessionResults(ssSession.session_key);
      log.push(`Sprint Shootout (key: ${ssSession.session_key}): ${sprint_shootout.length} piloti`);

    } else if (mode === "sprint") {
      const spSession = sessions.find((s: any) =>
        s.session_name?.toLowerCase() === "sprint"
      );
      if (!spSession) {
        return NextResponse.json({ error: "Sessione Sprint non trovata", log }, { status: 404 });
      }
      sprint = await fetchSprintResults(spSession.session_key);
      log.push(`Sprint (key: ${spSession.session_key}): ${sprint.length} piloti`);

    } else if (mode === "qualifying") {
      const qualSession = sessions.find((s: any) =>
        s.session_name?.toLowerCase() === "qualifying"
      );
      if (!qualSession) {
        return NextResponse.json({ error: "Sessione Qualifica non trovata", log }, { status: 404 });
      }
      qualifying = await fetchSessionResults(qualSession.session_key);
      log.push(`Qualifica (key: ${qualSession.session_key}): ${qualifying.length} piloti`);

    } else if (mode === "race") {
      const raceSession = sessions.find((s: any) => s.session_name?.toLowerCase() === "race");
      if (!raceSession) {
        return NextResponse.json({ error: "Sessione Gara non trovata", log }, { status: 404 });
      }
      const raceKey = raceSession.session_key;

      // Griglia di partenza = risultato qualifica (già salvato o fetch ora)
      const qualGridMap = new Map<number, number>();
      for (const q of qualifying) {
        qualGridMap.set(q.driver_number, q.position);
      }
      if (qualGridMap.size === 0) {
        log.push("ATTENZIONE: nessun dato qualifica trovato — posizioni guadagnate/perse non calcolate");
      }

      raceResults = await fetchRaceResults(raceKey, driver_of_the_day, qualGridMap);
      log.push(`Gara: ${raceResults.length} piloti`);

      // Eventi (solo dalla gara)
      events = await fetchRaceEvents(raceKey);
      const poleDriver = qualifying.find((d) => d.position === 1);
      const raceWinner = raceResults.find((d) => d.position === 1);
      events.pole_won = !!(poleDriver && raceWinner && poleDriver.driver_number === raceWinner.driver_number);

      log.push(`Eventi: SC=${events.safety_car} VSC=${events.virtual_safety_car} RF=${events.red_flag} Wet=${events.wet_tyres} DNF=${events.total_dnf} PoleWon=${events.pole_won}`);
    }

    // Salva weekend_results (merge di tutte le sessioni)
    const weekendResults: RaceWeekendResults = {
      qualifying,
      race: raceResults,
      sprint_shootout,
      sprint,
      events,
    };

    const { error: saveErr } = await supabase
      .from("weekend_results")
      .upsert({ round, data: weekendResults, updated_at: new Date().toISOString() }, { onConflict: "round" });

    if (saveErr) {
      return NextResponse.json({ error: "Errore salvataggio weekend_results: " + saveErr.message, log }, { status: 500 });
    }
    log.push("weekend_results salvato OK");

    // ═══════════════════════════════════
    // STEP 3: Calcola punteggi giocatori
    // ═══════════════════════════════════

    log.push("--- STEP 2: Calcolo punteggi ---");

    const { data: formazioni } = await supabase
      .from("formazioni")
      .select("*")
      .eq("round", round)
      .eq("confirmed", true);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, team_principal_name, scuderia_name");

    // Previsioni: solo se mode === "race"
    let previsioniData: any[] | null = null;
    if (mode === "race") {
      const { data } = await supabase
        .from("previsioni")
        .select("*")
        .eq("round", round)
        .eq("confirmed", true);
      previsioniData = data;
    }

    const isPostRace = mode === "race";

    const playerScores: {
      user_id: string; name: string; scuderia: string;
      weekend_points: number; piloti_points: number;
      previsioni_points: number; penalita_cambi: number;
    }[] = [];

    for (const formazione of formazioni || []) {
      const driverNumbers: number[] = (formazione.driver_numbers || []).map(Number);
      if (driverNumbers.length === 0) continue;

      const chipPiloti: ChipPilotiConfig = {
        chipPiloti: formazione.chip_piloti,
        chipPilotiTarget: formazione.chip_piloti_target,
        sestoUomo: formazione.sesto_uomo,
      };

      // Previsioni: solo post-race, altrimenti tutte null (0 punti)
      let previsioni: Previsioni = {
        safetyCar: null, virtualSafetyCar: null, redFlag: null,
        gommeWet: null, poleVince: null, numeroDnf: null,
      };
      let chipPrevisioni: ChipPrevisioniConfig = { chipAttivo: null, chipTarget: null };

      if (isPostRace) {
        const prev = previsioniData?.find((p) => p.user_id === formazione.user_id);
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

      const calc = calcolaPuntiWeekend(driverNumbers, formazione.primo_pilota, previsioni, weekendResults, chipPiloti, chipPrevisioni);
      const profile = profiles?.find((p) => p.id === formazione.user_id);

      // Penalità cambi: solo post-race
      let penalitaCambi = 0;
      if (isPostRace && formazione.chip_piloti !== "wildcard") {
        const { data: cambiData } = await supabase
          .from("mercato_cambi")
          .select("id")
          .eq("user_id", formazione.user_id)
          .eq("round", round);
        const numCambi = (cambiData || []).length;
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

    playerScores.sort((a, b) => b.weekend_points - a.weekend_points);
    log.push(`Giocatori calcolati: ${playerScores.length}`);

    // ═══════════════════════════════════
    // STEP 4: Aggiorna classifiche
    // ═══════════════════════════════════

    log.push("--- STEP 3: Aggiorna classifiche ---");

    for (let i = 0; i < playerScores.length; i++) {
      const ps = playerScores[i];

      // Punti "reale" solo post-race (classifica definitiva del weekend)
      const realPoints = isPostRace ? (PUNTI_REALE[i] ?? 0) : 0;

      // Leggi punteggio precedente di questo round (da sessioni già calcolate)
      const { data: prevScore } = await supabase
        .from("weekend_scores")
        .select("total_points")
        .eq("user_id", ps.user_id)
        .eq("round", round)
        .single();

      const prevRoundPoints = prevScore?.total_points ?? 0;
      const delta = ps.weekend_points - prevRoundPoints;

      // Aggiorna classifica_totale con il delta
      const { data: existing } = await supabase
        .from("classifica_totale")
        .select("total_points, real_points")
        .eq("user_id", ps.user_id)
        .single();

      await supabase.from("classifica_totale").upsert({
        user_id: ps.user_id,
        team_principal_name: ps.name,
        scuderia_name: ps.scuderia,
        total_points: (existing?.total_points ?? 0) + delta,
        last_weekend_points: ps.weekend_points,
        real_points: (existing?.real_points ?? 0) + realPoints,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Salva/aggiorna weekend_scores
      await supabase.from("weekend_scores").upsert({
        user_id: ps.user_id,
        round,
        total_points: ps.weekend_points,
        piloti_points: ps.piloti_points,
        previsioni_points: ps.previsioni_points,
      }, { onConflict: "user_id,round" });

      log.push(`${i + 1}. ${ps.name}: ${ps.weekend_points} pts (P:${ps.piloti_points}${isPostRace ? ` + Prev:${ps.previsioni_points}` : ""}${ps.penalita_cambi > 0 ? ` - Cambi:${ps.penalita_cambi}` : ""}${delta !== ps.weekend_points ? ` | delta: +${delta}` : ""})${isPostRace ? ` | Reale: +${realPoints}` : ""}`);
    }

    return NextResponse.json({
      success: true,
      round,
      session: mode,
      gara: meeting.meeting_name,
      giocatori: playerScores.length,
      classifica: playerScores.map((ps, i) => ({
        pos: i + 1,
        nome: ps.name,
        scuderia: ps.scuderia,
        punti_weekend: ps.weekend_points,
        punti_reale: isPostRace ? (PUNTI_REALE[i] ?? 0) : undefined,
      })),
      eventi: isPostRace ? events : undefined,
      sessioni_calcolate: {
        sprint_shootout: (weekendResults.sprint_shootout?.length ?? 0) > 0,
        sprint: (weekendResults.sprint?.length ?? 0) > 0,
        qualifying: weekendResults.qualifying.length > 0,
        race: weekendResults.race.length > 0,
      },
      log,
    });

  } catch (err: any) {
    return NextResponse.json({ error: "Errore: " + err.message, log }, { status: 500 });
  }
}

// ─── Helper functions ───

async function fetchJson(url: string): Promise<any[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
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

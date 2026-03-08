import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";
import type { RaceWeekendResults, DriverResult } from "../../lib/scoring";
import { RACES_2026 } from "../../lib/races";

const OPENF1 = "https://api.openf1.org/v1";

/**
 * POST /api/fetch-risultati
 * Body: { round: number, admin_key: string, driver_of_the_day?: number }
 *
 * Fetcha i risultati da OpenF1, compone RaceWeekendResults,
 * lo salva in weekend_results.
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

  const race = RACES_2026.find((r) => r.round === round);
  if (!race) {
    return NextResponse.json({ error: "Gara non trovata" }, { status: 404 });
  }

  try {
    // 1. Trova il meeting per questo round (anno 2026)
    const allMeetings = await fetchJson(`${OPENF1}/meetings?year=2026`);
    if (!allMeetings || allMeetings.length === 0) {
      return NextResponse.json({ error: "Nessun meeting trovato per il 2026" }, { status: 404 });
    }

    // Filtra via pre-season testing, ordina per data
    const meetings = allMeetings
      .filter((m: any) => !m.meeting_name?.toLowerCase().includes("testing"))
      .sort((a: any, b: any) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
    const meeting = meetings[round - 1];
    if (!meeting) {
      return NextResponse.json({ error: `Meeting per round ${round} non trovato` }, { status: 404 });
    }

    const meetingKey = meeting.meeting_key;
    const log: string[] = [`Meeting: ${meeting.meeting_name} (key: ${meetingKey})`];

    // 2. Trova le sessioni del weekend
    const sessions = await fetchJson(`${OPENF1}/sessions?meeting_key=${meetingKey}`);
    log.push(`Sessioni trovate: ${sessions.length}`);

    const findSession = (type: string) =>
      sessions.find((s: any) => s.session_type === type || s.session_name?.toLowerCase().includes(type));

    const qualifyingSession = findSession("Qualifying");
    const raceSession = findSession("Race");
    const sprintShootoutSession = findSession("Sprint Shootout") || findSession("Sprint Qualifying");
    const sprintSession = sessions.find((s: any) =>
      s.session_type === "Sprint" || (s.session_name?.toLowerCase() === "sprint" && s.session_type !== "Sprint Qualifying")
    );

    if (!raceSession) {
      return NextResponse.json({ error: "Sessione gara non trovata", log }, { status: 404 });
    }

    // 3. Fetch risultati qualifica
    let qualifying: DriverResult[] = [];
    if (qualifyingSession) {
      qualifying = await fetchSessionResults(qualifyingSession.session_key, "qualifying");
      log.push(`Qualifica: ${qualifying.length} piloti`);
    }

    // 4. Fetch risultati gara (usa qualifica come griglia)
    const raceKey = raceSession.session_key;
    const qualGridMap = new Map<number, number>();
    for (const q of qualifying) {
      qualGridMap.set(q.driver_number, q.position);
    }
    const raceResults = await fetchRaceResults(raceKey, driver_of_the_day, qualGridMap);
    log.push(`Gara: ${raceResults.length} piloti (con griglia da qualifica)`);

    // 5. Sprint (se presente)
    let sprint_shootout: DriverResult[] | undefined;
    let sprint: DriverResult[] | undefined;

    if (sprintShootoutSession) {
      sprint_shootout = await fetchSessionResults(sprintShootoutSession.session_key, "sprint_shootout");
      log.push(`Sprint Shootout: ${sprint_shootout.length} piloti`);
    }

    if (sprintSession) {
      sprint = await fetchSprintResults(sprintSession.session_key);
      log.push(`Sprint: ${sprint.length} piloti`);
    }

    // 6. Fetch eventi gara (SC, VSC, Red Flag)
    const events = await fetchRaceEvents(raceKey);
    log.push(`Eventi: SC=${events.safety_car} VSC=${events.virtual_safety_car} RF=${events.red_flag} Wet=${events.wet_tyres} DNF=${events.total_dnf}`);

    // Pole ha vinto?
    const poleDriver = qualifying.find((d) => d.position === 1);
    const raceWinner = raceResults.find((d) => d.position === 1);
    events.pole_won = !!(poleDriver && raceWinner && poleDriver.driver_number === raceWinner.driver_number);
    log.push(`Pole ha vinto: ${events.pole_won}`);

    // 7. Componi RaceWeekendResults
    const weekendResults: RaceWeekendResults = {
      qualifying,
      race: raceResults,
      sprint_shootout,
      sprint,
      events,
    };

    // 8. Salva in DB
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
    }

    const { error: saveErr } = await supabase
      .from("weekend_results")
      .upsert({
        round,
        data: weekendResults,
        updated_at: new Date().toISOString(),
      }, { onConflict: "round" });

    if (saveErr) {
      return NextResponse.json({ error: "Errore salvataggio: " + saveErr.message, log }, { status: 500 });
    }

    log.push("Salvato in weekend_results OK");

    return NextResponse.json({
      success: true,
      round,
      meeting: meeting.meeting_name,
      qualifying_count: qualifying.length,
      race_count: raceResults.length,
      sprint: !!sprint,
      events,
      log,
    });

  } catch (err: any) {
    return NextResponse.json({ error: "Errore fetch: " + err.message }, { status: 500 });
  }
}

// ─── Helper: fetch JSON ───

async function fetchJson(url: string): Promise<any[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

// ─── Fetch risultati qualifica/sprint shootout ───

async function fetchSessionResults(sessionKey: number, type: string): Promise<DriverResult[]> {
  // Prova session_result (endpoint ufficiale)
  let results = await fetchJson(`${OPENF1}/position?session_key=${sessionKey}`);

  if (!results || results.length === 0) return [];

  // Prendi l'ultima posizione di ogni pilota (posizione finale)
  const lastPositions = new Map<number, any>();
  for (const r of results) {
    if (r.driver_number) {
      lastPositions.set(r.driver_number, r);
    }
  }

  return Array.from(lastPositions.values()).map((r) => ({
    driver_number: r.driver_number,
    position: r.position,
    dnf: false, // In qualifica non c'e DNF classico
  }));
}

// ─── Fetch risultati gara con griglia e giro veloce ───

async function fetchRaceResults(sessionKey: number, dotdNumber?: number, qualGridMap?: Map<number, number>): Promise<DriverResult[]> {
  // Posizioni finali
  const positions = await fetchJson(`${OPENF1}/position?session_key=${sessionKey}`);
  const lastPositions = new Map<number, any>();
  for (const r of positions) {
    if (r.driver_number) lastPositions.set(r.driver_number, r);
  }

  // Usa griglia da qualifica (passata come parametro)
  const gridMap = qualGridMap ?? new Map<number, number>();

  // Giro veloce
  const laps = await fetchJson(`${OPENF1}/laps?session_key=${sessionKey}`);
  let fastestLapDriver: number | null = null;
  let fastestTime = Infinity;
  for (const lap of laps) {
    if (lap.lap_duration && lap.lap_duration < fastestTime && lap.lap_duration > 0) {
      fastestTime = lap.lap_duration;
      fastestLapDriver = lap.driver_number;
    }
  }

  // Race control per DNF e penalita
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

// ─── Fetch risultati sprint ───

async function fetchSprintResults(sessionKey: number): Promise<DriverResult[]> {
  const positions = await fetchJson(`${OPENF1}/position?session_key=${sessionKey}`);
  const lastPositions = new Map<number, any>();
  for (const r of positions) {
    if (r.driver_number) lastPositions.set(r.driver_number, r);
  }

  // Giro veloce sprint
  const laps = await fetchJson(`${OPENF1}/laps?session_key=${sessionKey}`);
  let fastestLapDriver: number | null = null;
  let fastestTime = Infinity;
  for (const lap of laps) {
    if (lap.lap_duration && lap.lap_duration < fastestTime && lap.lap_duration > 0) {
      fastestTime = lap.lap_duration;
      fastestLapDriver = lap.driver_number;
    }
  }

  // DNF sprint
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

// ─── Fetch eventi gara (SC, VSC, Red Flag, Wet) ───

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

  // Gomme wet: controlla gli stint
  const stints = await fetchJson(`${OPENF1}/stints?session_key=${sessionKey}`);
  let wet_tyres = false;
  for (const stint of stints) {
    const compound = (stint.compound || "").toUpperCase();
    if (compound === "WET" || compound === "INTERMEDIATE") {
      wet_tyres = true;
      break;
    }
  }

  return {
    safety_car,
    virtual_safety_car,
    red_flag,
    wet_tyres,
    pole_won: false, // calcolato dopo
    total_dnf: retiredDrivers.size,
  };
}

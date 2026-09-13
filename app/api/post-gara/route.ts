import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { createServerClient } from "../../lib/supabase-server";
import type { RaceWeekendResults, DriverResult } from "../../lib/scoring";
import {
  calcolaPuntiPilotaBase,
  aggiornaQuotazione,
} from "../../lib/scoring";
import { DRIVERS_2026 } from "../../lib/drivers-data";
import { RACES_2026 } from "../../lib/races";
import { extractPenalizedDrivers } from "../../lib/penalties";
import { resolveGrid, gridFromRacePositions } from "../../lib/starting-grid";
import { computePlayerScores, applicaPunteggiRound } from "../../lib/score-round";
import { OPENF1, fetchJson, fetchOpenF1 } from "../../lib/openf1-server";
import {
  addAbsentAsNoTime,
  checkResultsReady,
  countDnf,
  mapQualifyingResults,
  poleDriverNumber,
  poleWon,
  validateWeekendResults,
  type OfficialRow,
} from "../../lib/official-results";
import {
  findRaceSessionForRound,
  findSessionInMeeting,
  type OpenF1Session,
  type SessionKind,
} from "../../lib/openf1-sessions";

/**
 * POST /api/post-gara
 * Body: { round, admin_key, session, driver_of_the_day? }
 *
 * session: "sprint_shootout" | "sprint" | "qualifying" | "race"
 *
 * Unico percorso che scrive risultati e punteggi. Per ogni sessione:
 * 1. Trova la sessione OpenF1 del round PER DATA (non per posizione in lista,
 *    vedi lib/openf1-sessions.ts)
 * 2. Verifica che i risultati ufficiali esistano e siano completi
 *    (lib/official-results.ts): se no, 409 e non si tocca niente
 * 3. Salva/aggiorna weekend_results (merge con le sessioni già salvate),
 *    dopo un controllo di coerenza interna
 * 4. Ricalcola i punteggi di TUTTE le sessioni salvate e li applica per
 *    differenza (lib/score-round.ts): rilanciare è sempre sicuro
 * 5. Solo "race": aggiorna le quotazioni piloti
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { round, admin_key, session, driver_of_the_day } = body;

  if (!isAdminRequest(request, admin_key)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!round || typeof round !== "number" || round < 1 || round > 24) {
    return NextResponse.json({ error: "Round non valido" }, { status: 400 });
  }

  const validSessions: SessionKind[] = ["sprint_shootout", "sprint", "qualifying", "race"];
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
  const mode: SessionKind = session;

  try {
    // ═══════════════════════════════════
    // STEP 1: Sessione OpenF1 del round, abbinata per data
    // ═══════════════════════════════════

    log.push(`--- STEP 1: Fetch ${mode} da OpenF1 ---`);

    const year = new Date(race.date).getUTCFullYear();
    const sessionsRes = await fetchOpenF1<OpenF1Session>(`${OPENF1}/sessions?year=${year}`);
    if (!sessionsRes.ok || sessionsRes.data.length === 0) {
      const msg = `OpenF1 non risponde sul calendario (HTTP ${sessionsRes.status}). Nessun dato salvato.`;
      log.push(msg);
      return NextResponse.json({ error: msg, log }, { status: 502 });
    }
    const sessions = sessionsRes.data;

    const match = findRaceSessionForRound(round, sessions);
    if (!match.ok) {
      log.push(match.error);
      return NextResponse.json({ error: match.error, log }, { status: 404 });
    }
    const meetingKey = match.session.meeting_key;
    const meetingLabel = `${match.session.location ?? race.name} (meeting ${meetingKey}, gara ${match.session.date_start})`;
    log.push(`Round ${round} → ${meetingLabel}`);

    const target = findSessionInMeeting(sessions, meetingKey, mode);
    if (!target) {
      const msg = `Sessione ${mode} non trovata nel meeting ${meetingKey}`;
      log.push(msg);
      return NextResponse.json({ error: msg, log }, { status: 404 });
    }

    // ═══════════════════════════════════
    // STEP 2: Risultati ufficiali (o niente)
    // ═══════════════════════════════════

    const official = await loadOfficialResults(target, mode === "qualifying" || mode === "sprint_shootout");
    if (!official.ok) {
      log.push(official.error);
      return NextResponse.json({ error: official.error, log }, { status: 409 });
    }

    // weekend_results esistente (sessioni già calcolate)
    const { data: existingWR } = await supabase
      .from("weekend_results")
      .select("data")
      .eq("round", round)
      .maybeSingle();
    const prevData: Partial<RaceWeekendResults> = existingWR?.data || {};

    let qualifying: DriverResult[] = prevData.qualifying || [];
    let raceResults: DriverResult[] = prevData.race || [];
    let sprint_shootout: DriverResult[] | undefined = prevData.sprint_shootout;
    let sprint: DriverResult[] | undefined = prevData.sprint;
    let events: RaceWeekendResults["events"] = prevData.events || {
      safety_car: false, virtual_safety_car: false, red_flag: false,
      wet_tyres: false, pole_won: false, total_dnf: 0,
    };

    if (mode === "sprint_shootout") {
      const iscritti = await iscrittiMeeting(meetingKey);
      sprint_shootout = addAbsentAsNoTime(mapQualifyingResults(official.rows), iscritti);
      log.push(`Sprint Shootout (key: ${target.session_key}): ${official.rows.length} classificati, ${iscritti.size} iscritti`);
      logQualifica(log, sprint_shootout);

    } else if (mode === "sprint") {
      sprint = await fetchSprintResults(target.session_key, official.rows);
      log.push(`Sprint (key: ${target.session_key}): ${sprint.length} piloti, ${sprint.filter((d) => d.dnf).length} ritiri`);

    } else if (mode === "qualifying") {
      const iscritti = await iscrittiMeeting(meetingKey);
      qualifying = addAbsentAsNoTime(mapQualifyingResults(official.rows), iscritti);
      log.push(`Qualifica (key: ${target.session_key}): ${official.rows.length} classificati, ${iscritti.size} iscritti`);
      logQualifica(log, qualifying);

    } else {
      const raceKey = target.session_key;

      // Griglia di partenza reale: `starting_grid` se OpenF1 la dà, altrimenti
      // lo schieramento dal feed `position`, altrimenti la qualifica (segnalato).
      const startingGrid = await fetchJson(`${OPENF1}/starting_grid?session_key=${raceKey}`);
      const racePositions = await fetchJson(`${OPENF1}/position?session_key=${raceKey}`);
      const { grid: gridMap, source: gridSource } = resolveGrid([
        { name: "starting_grid", entries: startingGrid },
        { name: "race_first_positions", entries: gridFromRacePositions(racePositions) },
        { name: "qualifying", entries: qualifying },
      ]);
      if (gridSource === "none") {
        log.push("ATTENZIONE: nessuna griglia trovata — posizioni guadagnate/perse non calcolate");
      } else if (gridSource === "qualifying") {
        log.push("ATTENZIONE: nessuna fonte per la griglia reale — uso le posizioni di qualifica (penalità in griglia ignorate)");
      } else {
        log.push(`Griglia di partenza: ${gridMap.size} piloti da ${gridSource}`);
      }

      // Driver of the Day è un dato manuale: se non arriva col body (tipico
      // di un rilancio), si tiene quello già salvato invece di azzerarlo.
      const dotdPrecedente = prevData.race?.find((d) => d.driver_of_the_day)?.driver_number;
      const dotd: number | undefined = driver_of_the_day ?? dotdPrecedente;
      if (dotd && !driver_of_the_day) log.push(`Driver of the Day mantenuto dal calcolo precedente: #${dotd}`);
      if (!dotd) log.push("ATTENZIONE: nessun Driver of the Day indicato (+5 non assegnato)");

      raceResults = await fetchRaceResults(raceKey, official.rows, dotd, gridMap);
      log.push(`Gara: ${raceResults.length} piloti, ${raceResults.filter((d) => d.dnf).length} ritiri, ${raceResults.filter((d) => d.dns).length} DNS`);

      events = await fetchRaceEvents(raceKey, official.rows);
      // "Pole vince": la pole è chi parte primo in griglia (regola 1)
      events.pole_won = poleWon(raceResults, qualifying);
      const pole = poleDriverNumber(raceResults, qualifying);
      if (pole == null) log.push("ATTENZIONE: né griglia né qualifica disponibili — 'pole vince' valutato false");
      else log.push(`Pole (primo in griglia): #${pole}${gridSource === "qualifying" || gridSource === "none" ? " (dalla qualifica, griglia reale assente)" : ""}`);

      log.push(`Eventi: SC=${events.safety_car} VSC=${events.virtual_safety_car} RF=${events.red_flag} Wet=${events.wet_tyres} DNF=${events.total_dnf} PoleWon=${events.pole_won}`);
    }

    // ═══════════════════════════════════
    // STEP 3: Coerenza e salvataggio
    // ═══════════════════════════════════

    const weekendResults: RaceWeekendResults = {
      qualifying,
      race: raceResults,
      sprint_shootout,
      sprint,
      events,
    };

    const incoerenze = validateWeekendResults(weekendResults);
    if (incoerenze.length > 0) {
      const msg = `Risultati incoerenti, non salvati: ${incoerenze.join("; ")}`;
      log.push(msg);
      return NextResponse.json({ error: msg, log }, { status: 422 });
    }

    const { error: saveErr } = await supabase
      .from("weekend_results")
      .upsert({ round, data: weekendResults, updated_at: new Date().toISOString() }, { onConflict: "round" });

    if (saveErr) {
      return NextResponse.json({ error: "Errore salvataggio weekend_results: " + saveErr.message, log }, { status: 500 });
    }
    log.push("weekend_results salvato OK");

    // ═══════════════════════════════════
    // STEP 4: Punteggi giocatori, applicati per differenza
    // ═══════════════════════════════════

    log.push("--- STEP 2: Calcolo punteggi ---");

    // Previsioni, penalità cambi e Classifica Reale contano appena la gara è in
    // archivio: dipende da cosa c'è salvato, non da quale sessione si è
    // rilanciata. Così ricalcolare la qualifica dopo la gara non azzera
    // niente.
    const isPostRace = weekendResults.race.length > 0;

    const playerScores = await computePlayerScores(supabase, round, weekendResults, isPostRace);
    log.push(`Giocatori calcolati: ${playerScores.length}`);

    log.push("--- STEP 3: Aggiorna classifiche ---");
    const applicati = await applicaPunteggiRound(supabase, round, playerScores, isPostRace);

    playerScores.forEach((ps, i) => {
      const a = applicati.find((x) => x.user_id === ps.user_id);
      const delta = a?.delta_total ?? 0;
      log.push(
        `${i + 1}. ${ps.name}: ${ps.weekend_points} pts (P:${ps.piloti_points}` +
        `${isPostRace ? ` + Prev:${ps.previsioni_points}` : ""}` +
        `${ps.penalita_cambi > 0 ? ` - Cambi:${ps.penalita_cambi}` : ""}` +
        `${delta !== ps.weekend_points ? ` | delta: ${delta >= 0 ? "+" : ""}${delta}` : ""})` +
        `${isPostRace ? ` | Reale: ${a?.real_points ?? 0}${a && a.delta_real !== a.real_points ? ` (delta ${a.delta_real >= 0 ? "+" : ""}${a.delta_real})` : ""}` : ""}`,
      );
    });
    for (const a of applicati.filter((x) => !playerScores.some((p) => p.user_id === x.user_id))) {
      log.push(`Rimosso dal round: ${a.nome} (delta ${a.delta_total}, reale ${a.delta_real})`);
    }

    // ═══════════════════════════════════
    // STEP 5: Aggiorna quotazioni piloti (solo post-race)
    // Algoritmo a fasce CDA — vedi scoring.ts:aggiornaQuotazione
    // ═══════════════════════════════════
    // Le quotazioni si aggiornano solo se questo è il round più recente in
    // archivio: rilanciare una gara passata deve toccare i punti, non i prezzi
    // (il cleanup delle "quotazioni future" cancellerebbe quelle dei round
    // successivi, già usate dal mercato).
    const { data: roundsSuccessivi } = await supabase
      .from("weekend_results")
      .select("round")
      .gt("round", round)
      .limit(1);
    const isRoundPiuRecente = !roundsSuccessivi || roundsSuccessivi.length === 0;
    if (mode === "race" && !isRoundPiuRecente) {
      log.push("--- STEP 5: quotazioni NON aggiornate (round passato, esistono round successivi in archivio) ---");
    }
    if (mode === "race" && isRoundPiuRecente) {
      log.push("--- STEP 5: Aggiorna quotazioni piloti ---");
      try {
        // Leggi quotazioni vigenti (ultima riga <= round per ogni pilota)
        const { data: priceRows } = await supabase
          .from("driver_prices")
          .select("driver_number, round, price")
          .lte("round", round)
          .order("round", { ascending: false });

        const currentPrice = new Map<number, number>();
        for (const r of priceRows ?? []) {
          if (!currentPrice.has(r.driver_number)) currentPrice.set(r.driver_number, r.price);
        }

        // Per ogni pilota della stagione, calcola punti grezzi weekend e nuovo prezzo
        const nextRound = round + 1;
        const updates: { driver_number: number; round: number; price: number }[] = [];
        const changes: string[] = [];

        for (const driver of DRIVERS_2026) {
          const oldPrice = currentPrice.get(driver.number) ?? driver.price;
          const puntiGrezzi = calcolaPuntiPilotaBase(driver.number, weekendResults);
          const newPrice = aggiornaQuotazione(oldPrice, puntiGrezzi);
          updates.push({ driver_number: driver.number, round: nextRound, price: newPrice });
          if (newPrice !== oldPrice) {
            const sign = newPrice > oldPrice ? "+" : "";
            changes.push(`${driver.name}: ${oldPrice} → ${newPrice} (${sign}${newPrice - oldPrice}, ${puntiGrezzi}pts)`);
          }
        }

        const { error: upErr } = await supabase
          .from("driver_prices")
          .upsert(updates, { onConflict: "driver_number,round" });
        if (upErr) log.push(`Errore upsert driver_prices: ${upErr.message}`);
        else log.push(`Quotazioni aggiornate per round ${nextRound}: ${changes.length} variazioni`);

        // Hardening: se ci sono quotazioni "future" oltre il nextRound, sono
        // obsolete (calcolate quando il round attuale non era ancora processato
        // o lo era in modo diverso). Le droppiamo per forzare il ricalcolo
        // al prossimo post-gara.
        const { error: delErr, count: deleted } = await supabase
          .from("driver_prices")
          .delete({ count: "exact" })
          .gt("round", nextRound);
        if (delErr) log.push(`Warning cleanup quotazioni future: ${delErr.message}`);
        else if (deleted && deleted > 0) log.push(`Cleanup quotazioni obsolete: ${deleted} righe rimosse (round > ${nextRound})`);

        for (const c of changes) log.push(`  ${c}`);
      } catch (e) {
        log.push(`Errore aggiornamento quotazioni: ${(e as Error).message}`);
      }
    }

    // Cancella punteggi provvisori
    await supabase.from("provisional_weekend").delete().eq("round", round);

    return NextResponse.json({
      success: true,
      round,
      session: mode,
      gara: meetingLabel,
      giocatori: playerScores.length,
      classifica: playerScores.map((ps, i) => ({
        pos: i + 1,
        nome: ps.name,
        scuderia: ps.scuderia,
        punti_weekend: ps.weekend_points,
        punti_reale: isPostRace ? (applicati.find((a) => a.user_id === ps.user_id)?.real_points ?? 0) : undefined,
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

/**
 * Iscritti al weekend: piloti della stagione (rosa dell'app) presenti nella
 * lista OpenF1 `drivers` del meeting. Chi c'è ma manca dalla classifica di
 * qualifica non ha girato: -5 (addAbsentAsNoTime).
 */
async function iscrittiMeeting(meetingKey: number): Promise<Set<number>> {
  const rows = await fetchJson(`${OPENF1}/drivers?meeting_key=${meetingKey}`);
  const rosa = new Set(DRIVERS_2026.map((d) => d.number));
  const out = new Set<number>();
  for (const r of rows) if (r?.driver_number && rosa.has(r.driver_number)) out.add(r.driver_number);
  return out;
}

function logQualifica(log: string[], rows: DriverResult[]) {
  const nc = rows.filter((r) => r.dnf && !r.no_time).map((r) => `#${r.driver_number}`);
  const noTime = rows.filter((r) => r.no_time).map((r) => `#${r.driver_number}`);
  if (nc.length) log.push(`  NC/squalificati (-5): ${nc.join(", ")}`);
  if (noTime.length) log.push(`  Senza tempo o assenti (-5): ${noTime.join(", ")}`);
}

/**
 * Risultati ufficiali di una sessione (`session_result`) più i controlli di
 * prontezza del dato (vedi lib/official-results.ts per il perché).
 */
async function loadOfficialResults(
  session: OpenF1Session,
  allowMissingDrivers = false,
): Promise<{ ok: true; rows: OfficialRow[] } | { ok: false; error: string }> {
  const nome = session.session_name || "Sessione";
  const res = await fetchOpenF1<OfficialRow>(`${OPENF1}/session_result?session_key=${session.session_key}`);

  // 404 è il modo di OpenF1 di dire "niente risultati" ("No results found"):
  // lo tratta la guardia sotto. Qualsiasi altro errore è un problema di
  // chiamata (token, rete, 5xx) e va detto per quello che è.
  if (!res.ok && res.status !== 404) {
    return { ok: false, error: `OpenF1 ha risposto HTTP ${res.status} su session_result (sessione ${session.session_key}): impossibile verificare i risultati di ${nome}. Nessun dato salvato.` };
  }

  const drivers = await fetchJson(`${OPENF1}/drivers?session_key=${session.session_key}`);
  const expectedDrivers = new Set(drivers.map((d: any) => d?.driver_number).filter(Boolean)).size;

  const check = checkResultsReady({
    sessionName: nome,
    dateEnd: session.date_end,
    rows: res.data,
    expectedDrivers,
    allowMissingDrivers,
  });
  if (!check.ok) return { ok: false, error: `${check.error} (sessione ${session.session_key})` };

  return { ok: true, rows: res.data };
}

async function fetchRaceResults(sessionKey: number, officialRows: OfficialRow[], dotdNumber?: number, startingGridMap?: Map<number, number>): Promise<DriverResult[]> {
  // Risultati ufficiali da session_result (posizioni, DNF, DNS, DSQ),
  // già verificati da loadOfficialResults()
  const resultMap = new Map<number, OfficialRow>();
  for (const sr of officialRows) {
    if (sr.driver_number) resultMap.set(sr.driver_number, sr);
  }

  const gridMap = startingGridMap ?? new Map<number, number>();

  const laps = await fetchJson(`${OPENF1}/laps?session_key=${sessionKey}`);
  let fastestLapDriver: number | null = null;
  let fastestTime = Infinity;
  for (const lap of laps) {
    if (lap.lap_duration && lap.lap_duration < fastestTime && lap.lap_duration > 0) {
      fastestTime = lap.lap_duration;
      fastestLapDriver = lap.driver_number;
    }
  }

  // Penalità da race_control (session_result non le ha).
  // NB: OpenF1 lascia driver_number=null sui messaggi dei commissari, il numero
  // auto è nel testo — la rilevazione è centralizzata in lib/penalties.ts
  const raceControl = await fetchJson(`${OPENF1}/race_control?session_key=${sessionKey}`);
  const penalizedDrivers = extractPenalizedDrivers(raceControl);

  return Array.from(resultMap.values()).map((r) => ({
    driver_number: r.driver_number as number,
    position: r.position as number,
    grid_position: gridMap.get(r.driver_number as number) || undefined,
    // dns (non ha preso parte) è distinto da dnf/dsq (ha corso poi si è
    // ritirato/squalificato): solo dnf/dsq portano il malus -10, vedi scoring.ts
    dnf: !!(r.dnf || r.dsq),
    dns: !!r.dns,
    fastest_lap: r.driver_number === fastestLapDriver,
    driver_of_the_day: r.driver_number === dotdNumber,
    penalty: penalizedDrivers.has(r.driver_number as number),
  }));
}

async function fetchSprintResults(sessionKey: number, officialRows: OfficialRow[]): Promise<DriverResult[]> {
  // Risultati ufficiali da session_result, già verificati da loadOfficialResults()
  const resultMap = new Map<number, OfficialRow>();
  for (const sr of officialRows) {
    if (sr.driver_number) resultMap.set(sr.driver_number, sr);
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

  return Array.from(resultMap.values()).map((r) => ({
    driver_number: r.driver_number as number,
    position: r.position as number,
    dnf: !!(r.dnf || r.dsq),
    dns: !!r.dns,
    fastest_lap: r.driver_number === fastestLapDriver,
  }));
}

async function fetchRaceEvents(sessionKey: number, officialRows: OfficialRow[]): Promise<RaceWeekendResults["events"]> {
  // SC, VSC, Red Flag da race_control
  const raceControl = await fetchJson(`${OPENF1}/race_control?session_key=${sessionKey}`);

  let safety_car = false;
  let virtual_safety_car = false;
  let red_flag = false;

  for (const rc of raceControl) {
    const msg = (rc.message || "").toUpperCase();
    if (msg.includes("SAFETY CAR") && !msg.includes("VIRTUAL")) safety_car = true;
    if (msg.includes("VIRTUAL SAFETY CAR") || msg.includes("VSC")) virtual_safety_car = true;
    if (rc.flag === "RED" || (msg.includes("RED FLAG") && !msg.includes("CHEQUERED"))) red_flag = true;
  }

  // Ritiri da session_result (fonte ufficiale, già verificata)
  const total_dnf = countDnf(officialRows);

  // Gomme wet da stints
  const stints = await fetchJson(`${OPENF1}/stints?session_key=${sessionKey}`);
  let wet_tyres = false;
  for (const stint of stints) {
    const compound = (stint.compound || "").toUpperCase();
    if (compound === "WET" || compound === "INTERMEDIATE") {
      wet_tyres = true;
      break;
    }
  }

  return { safety_car, virtual_safety_car, red_flag, wet_tyres, pole_won: false, total_dnf };
}

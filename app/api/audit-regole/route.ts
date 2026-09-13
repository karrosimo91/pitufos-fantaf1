import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";
import type { RaceWeekendResults, DriverResult } from "../../lib/scoring";
import { computePlayerScoresFrom, type RoundScoringInputs, type PlayerScore } from "../../lib/score-round";
import { DRIVERS_2026 } from "../../lib/drivers-data";
import { resolveGrid, gridFromRacePositions } from "../../lib/starting-grid";
import { findRaceSessionForRound, findSessionInMeeting, type OpenF1Session } from "../../lib/openf1-sessions";
import { extractGridPenalizedDrivers } from "../../lib/penalties";
import { mapQualifyingResults, poleDriverNumber, poleWon, type OfficialRow } from "../../lib/official-results";
import { OPENF1, fetchOpenF1 } from "../../lib/openf1-server";

/**
 * GET /api/audit-regole?admin_key=...&from=2&to=16[&raw=1]
 *
 * SOLA LETTURA. Per ogni round con gara in archivio ricalcola i punteggi di
 * tutti i giocatori applicando, una alla volta, le regole decise il 13/09/2026
 * e dice quanto cambierebbe rispetto a quanto salvato:
 *
 *   A. archivio com'è
 *   B. + regola 3: posizioni guadagnate/perse dalla griglia REALE (i round
 *      2-14 in archivio hanno come griglia la posizione di qualifica)
 *   C. + regola 1: "pole vince" = chi PARTE primo in griglia
 *   D. + regole 2 e 4: qualifica dai risultati ufficiali, "senza tempo" = -5
 *      salvo penalità in griglia a priori (stesso per la sprint shootout, -3)
 *
 * Il report è per round e per giocatore, con i piloti che fanno scattare
 * ogni regola, così il CDA decide con i numeri in mano. Nessuna scrittura.
 * `raw=1` allega la prima riga grezza di session_result della qualifica, per
 * verificare la forma del campo `duration` su cui si basa il "senza tempo".
 */
// Vercel Hobby taglia a 60 secondi: con 13 round e il retry sui 429 conviene
// chiamare a blocchi (es. from=2&to=6, poi 7&to=11...), i totali si sommano.
export const maxDuration = 60;

type Rc = { message?: string | null; driver_number?: number | null };

function driverName(num: number): string {
  return DRIVERS_2026.find((d) => d.number === num)?.name ?? `#${num}`;
}

function scoreMap(list: PlayerScore[]): Map<string, PlayerScore> {
  return new Map(list.map((p) => [p.user_id, p]));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || params.get("admin_key") !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const from = Number(params.get("from") ?? 1);
  const to = Number(params.get("to") ?? 24);
  const raw = params.get("raw") === "1";
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 24 || from > to) {
    return NextResponse.json({ error: "Intervallo round non valido" }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });

  const [{ data: allResults }, { data: allFormazioni }, { data: allPrevisioni }, { data: allCambi }, { data: profiles }, { data: allScores }] =
    await Promise.all([
      supabase.from("weekend_results").select("round, data").gte("round", from).lte("round", to),
      supabase.from("formazioni").select("*").gte("round", from).lte("round", to).eq("confirmed", true),
      supabase.from("previsioni").select("*").gte("round", from).lte("round", to).eq("confirmed", true),
      supabase.from("mercato_cambi").select("user_id, round").gte("round", from).lte("round", to),
      supabase.from("profiles").select("id, team_principal_name, scuderia_name"),
      supabase.from("weekend_scores").select("*").gte("round", from).lte("round", to),
    ]);

  const rounds = (allResults || []).map((r: { round: number }) => r.round).sort((a: number, b: number) => a - b);
  const year = new Date().getFullYear();
  const sessionsRes = await fetchOpenF1<OpenF1Session>(`${OPENF1}/sessions?year=${year}`);
  if (!sessionsRes.ok || sessionsRes.data.length === 0) {
    return NextResponse.json({ error: `OpenF1 non risponde sul calendario (HTTP ${sessionsRes.status})` }, { status: 502 });
  }
  const sessions = sessionsRes.data;

  const report: unknown[] = [];
  const totaliStagione = new Map<string, { nome: string; salvato: number; regola3: number; regola1: number; regole24: number; nuovo: number }>();
  let rawQualiRow: unknown = null;

  for (const round of rounds) {
    const row = (allResults || []).find((x: { round: number }) => x.round === round);
    const results = row?.data as RaceWeekendResults | undefined;
    if (!results?.race?.length) continue;

    const match = findRaceSessionForRound(round, sessions);
    if (!match.ok) {
      report.push({ round, stato: `saltato: ${match.error}` });
      continue;
    }
    const raceKey = match.session.session_key;
    const meetingKey = match.session.meeting_key;
    const note: string[] = [];

    // ── Regola 3: griglia reale (con esito delle chiamate: un 429 non è "nessun dato")
    const chiamate: Record<string, string> = {};
    const esito = (nome: string, r: { ok: boolean; status: number; data: unknown[]; retries: number }) => {
      chiamate[nome] = `${r.ok ? "ok" : "ERRORE"} HTTP ${r.status}, ${r.data.length} righe${r.retries ? `, ${r.retries} tentativi` : ""}`;
    };
    const sgRes = await fetchOpenF1(`${OPENF1}/starting_grid?session_key=${raceKey}`); esito("starting_grid", sgRes);
    const startingGrid = sgRes.data;
    let racePositions: any[] = [];
    if (startingGrid.length === 0) {
      const rpRes = await fetchOpenF1(`${OPENF1}/position?session_key=${raceKey}`); esito("position_gara", rpRes);
      racePositions = rpRes.data;
    }
    const { grid: gridReale, source: fonteGriglia } = resolveGrid([
      { name: "starting_grid", entries: startingGrid },
      { name: "race_first_positions", entries: gridFromRacePositions(racePositions) },
    ]);
    if (gridReale.size === 0) note.push(`griglia reale non disponibile (${chiamate.position_gara ?? chiamate.starting_grid}): regole 3 e 1 valutate sulla griglia in archivio`);

    const diffGriglia = results.race
      .filter((r) => gridReale.has(r.driver_number) && gridReale.get(r.driver_number) !== r.grid_position)
      .map((r) => ({ pilota: driverName(r.driver_number), griglia_archivio: r.grid_position ?? null, griglia_reale: gridReale.get(r.driver_number), arrivo: r.position ?? null, dnf: !!r.dnf }));

    const B: RaceWeekendResults = {
      ...results,
      race: results.race.map((r) => ({ ...r, grid_position: gridReale.get(r.driver_number) ?? r.grid_position })),
    };

    // ── Regola 1: pole dalla griglia
    const poleQuali = results.qualifying.find((q) => q.position === 1)?.driver_number ?? null;
    const poleGriglia = poleDriverNumber(B.race, B.qualifying);
    const C: RaceWeekendResults = { ...B, events: { ...B.events, pole_won: poleWon(B.race, B.qualifying) } };

    // ── Regole 2 e 4: qualifica ufficiale, senza tempo, esenzioni
    // I messaggi di penalità in griglia stanno nelle sessioni di qualifica e
    // gara (le libere non servono): meno chiamate, meno 429.
    const qualiSession = findSessionInMeeting(sessions, meetingKey, "qualifying");
    const ssSession = findSessionInMeeting(sessions, meetingKey, "sprint_shootout");
    const rcAll: Rc[] = [];
    for (const s of [qualiSession, ssSession, match.session]) {
      if (!s) continue;
      const r = await fetchOpenF1<Rc>(`${OPENF1}/race_control?session_key=${s.session_key}`); esito(`race_control_${s.session_key}`, r);
      rcAll.push(...r.data);
    }
    const esenti = extractGridPenalizedDrivers(rcAll);

    let qualiRows: OfficialRow[] = [];
    if (qualiSession) {
      const r = await fetchOpenF1<OfficialRow>(`${OPENF1}/session_result?session_key=${qualiSession.session_key}`); esito("session_result_qualifica", r);
      qualiRows = r.data;
    }
    let ssRows: OfficialRow[] = [];
    if (ssSession) {
      const r = await fetchOpenF1<OfficialRow>(`${OPENF1}/session_result?session_key=${ssSession.session_key}`); esito("session_result_shootout", r);
      ssRows = r.data;
    }
    if (raw && !rawQualiRow && qualiRows.length) rawQualiRow = { round, riga: qualiRows[0] };

    let qualiNuova: DriverResult[] = C.qualifying;
    let ssNuova: DriverResult[] | undefined = C.sprint_shootout;
    if (qualiRows.length >= 15) qualiNuova = mapQualifyingResults(qualiRows, { esenti });
    else note.push(`qualifica ufficiale non disponibile (${chiamate.session_result_qualifica ?? "sessione non trovata"}): regole 2 e 4 non valutate`);
    if (ssSession && ssRows.length >= 15) ssNuova = mapQualifyingResults(ssRows, { esenti });

    const D: RaceWeekendResults = { ...C, qualifying: qualiNuova, sprint_shootout: ssNuova };

    const descQ = (rows: DriverResult[]) => ({
      senza_tempo_meno5: rows.filter((r) => r.no_time && !r.esente_penalita).map((r) => driverName(r.driver_number)),
      senza_tempo_esenti: rows.filter((r) => r.esente_penalita).map((r) => driverName(r.driver_number)),
      nc_o_squalificati: rows.filter((r) => r.dnf && !r.no_time).map((r) => driverName(r.driver_number)),
      dns_zero_punti: rows.filter((r) => r.dns).map((r) => driverName(r.driver_number)),
    });
    const posDiverse = qualiNuova
      .filter((q) => { const a = results.qualifying.find((x) => x.driver_number === q.driver_number); return a && a.position !== q.position; })
      .map((q) => ({ pilota: driverName(q.driver_number), archivio: results.qualifying.find((x) => x.driver_number === q.driver_number)?.position ?? null, ufficiale: q.position }));

    // ── Punteggi per variante
    const cambiPerUser = new Map<string, number>();
    for (const c of (allCambi || []) as { user_id: string; round: number }[]) {
      if (c.round === round) cambiPerUser.set(c.user_id, (cambiPerUser.get(c.user_id) ?? 0) + 1);
    }
    const inputs: RoundScoringInputs = {
      formazioni: (allFormazioni || []).filter((f: { round: number }) => f.round === round),
      profiles: profiles || [],
      previsioni: (allPrevisioni || []).filter((p: { round: number }) => p.round === round),
      cambiPerUser,
    };
    const sA = scoreMap(computePlayerScoresFrom(inputs, results, true));
    const sB = scoreMap(computePlayerScoresFrom(inputs, B, true));
    const sC = scoreMap(computePlayerScoresFrom(inputs, C, true));
    const sD = scoreMap(computePlayerScoresFrom(inputs, D, true));

    const giocatori = [...sD.values()].map((d) => {
      const a = sA.get(d.user_id)?.weekend_points ?? 0;
      const b = sB.get(d.user_id)?.weekend_points ?? a;
      const c = sC.get(d.user_id)?.weekend_points ?? b;
      const salvato = (allScores || []).find((s: { round: number; user_id: string }) => s.round === round && s.user_id === d.user_id);
      const tot = totaliStagione.get(d.user_id) ?? { nome: d.name, salvato: 0, regola3: 0, regola1: 0, regole24: 0, nuovo: 0 };
      tot.salvato += salvato ? Number(salvato.total_points) : a;
      tot.regola3 += b - a; tot.regola1 += c - b; tot.regole24 += d.weekend_points - c; tot.nuovo += d.weekend_points;
      totaliStagione.set(d.user_id, tot);
      return {
        nome: d.name,
        punti_salvati_db: salvato ? Number(salvato.total_points) : null,
        punti_archivio_ricalcolati: a,
        delta_regola3_griglia: b - a,
        delta_regola1_pole: c - b,
        delta_regole24_qualifica: d.weekend_points - c,
        punti_nuovi: d.weekend_points,
        delta_totale: d.weekend_points - a,
      };
    }).sort((x, y) => y.punti_nuovi - x.punti_nuovi);

    report.push({
      round,
      gara: match.session.location,
      note,
      chiamate_openf1: chiamate,
      griglia: { fonte: fonteGriglia, piloti_diversi_dall_archivio: diffGriglia.length, dettaglio: diffGriglia },
      pole: { qualifica: poleQuali && driverName(poleQuali), griglia: poleGriglia && driverName(poleGriglia), pole_won_archivio: results.events.pole_won, pole_won_nuovo: C.events.pole_won },
      qualifica: { ...descQ(qualiNuova), posizioni_diverse_dall_archivio: posDiverse, penalita_griglia_a_priori_rilevate: [...esenti].map(driverName) },
      sprint_shootout: ssSession ? descQ(ssNuova ?? []) : undefined,
      giocatori,
    });
  }

  return NextResponse.json({
    intervallo: { from, to },
    round_analizzati: rounds,
    totali_stagione: [...totaliStagione.values()].sort((a, b) => b.nuovo - a.nuovo),
    report,
    ...(raw ? { prima_riga_session_result_qualifica: rawQualiRow } : {}),
    nota: "Sola lettura: nessun dato è stato modificato. Per applicare, rilanciare Qualifica e Gara di ogni round da /admin (idempotente).",
  });
}

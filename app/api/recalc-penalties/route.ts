import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";
import type { RaceWeekendResults, DriverResult } from "../../lib/scoring";
import { OPENF1, fetchJson } from "../../lib/openf1-server";
import { extractPenalizedDrivers } from "../../lib/penalties";
import { computePlayerScores, applicaPunteggiRound } from "../../lib/score-round";
import { DRIVERS_2026 } from "../../lib/drivers-data";
import { findRaceSessionForRound, type OpenF1Session } from "../../lib/openf1-sessions";

/**
 * POST /api/recalc-penalties
 * Body: { admin_key: string, round?: number }
 *
 * Corregge le penalità di gara già salvate usando la rilevazione aggiornata
 * (legge il numero auto dal testo di race_control, non dal campo driver_number
 * che OpenF1 lascia null). Per ogni round con risultati gara:
 *   1. ri-scarica race_control e ricalcola i piloti penalizzati
 *   2. aggiorna i flag `penalty` in weekend_results
 *   3. se qualcosa è cambiato, ricalcola i punteggi del round e li applica per
 *      differenza (somma punti + classifica reale) via applicaPunteggiRound —
 *      idempotente
 *
 * Se `round` è omesso, processa tutti i round con risultati gara salvati.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { round, admin_key } = body;

  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || admin_key !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  const log: string[] = [];

  try {
    // 1. Round da processare: quelli con risultati gara salvati
    let query = supabase.from("weekend_results").select("round, data").order("round", { ascending: true });
    if (round) query = supabase.from("weekend_results").select("round, data").eq("round", round);
    const { data: wrRows } = await query;

    const targetRounds = (wrRows || [])
      .filter((r: any) => Array.isArray(r.data?.race) && r.data.race.length > 0)
      .map((r: any) => ({ round: r.round as number, data: r.data as RaceWeekendResults }));

    if (targetRounds.length === 0) {
      return NextResponse.json({ error: "Nessun round con risultati gara trovato", log }, { status: 404 });
    }
    log.push(`Round da verificare: ${targetRounds.map((r) => r.round).join(", ")}`);

    // 2. Calendario OpenF1 una volta sola; la gara di ogni round si trova per
    //    data (vedi lib/openf1-sessions.ts), non per posizione in lista.
    const year = new Date().getFullYear();
    const allSessions: OpenF1Session[] = await fetchJson(`${OPENF1}/sessions?year=${year}`);

    const driverName = (num: number) =>
      DRIVERS_2026.find((d) => d.number === num)?.name ?? `#${num}`;

    const report: any[] = [];

    for (const { round: rnd, data } of targetRounds) {
      const match = findRaceSessionForRound(rnd, allSessions);
      if (!match.ok) {
        log.push(`R${rnd}: ${match.error} — saltato`);
        continue;
      }
      const raceSession = match.session;
      const meeting = { meeting_name: raceSession.location ?? `meeting ${raceSession.meeting_key}` };

      // Ricalcola i piloti penalizzati con la rilevazione aggiornata
      const raceControl = await fetchJson(`${OPENF1}/race_control?session_key=${raceSession.session_key}`);
      const penalized = extractPenalizedDrivers(raceControl);

      // Confronta con i flag salvati
      const added: number[] = [];
      const removed: number[] = [];
      const newRace: DriverResult[] = data.race.map((r) => {
        const newFlag = penalized.has(r.driver_number);
        if (newFlag && !r.penalty) added.push(r.driver_number);
        if (!newFlag && r.penalty) removed.push(r.driver_number);
        return { ...r, penalty: newFlag };
      });

      if (added.length === 0 && removed.length === 0) {
        log.push(`R${rnd} (${meeting.meeting_name}): nessuna variazione penalità`);
        report.push({ round: rnd, gara: meeting.meeting_name, variazioni: false, aggiunte: [], rimosse: [] });
        continue;
      }

      log.push(
        `R${rnd} (${meeting.meeting_name}): ` +
        `+[${added.map(driverName).join(", ") || "—"}] ` +
        `-[${removed.map(driverName).join(", ") || "—"}]`
      );

      // 3a. Salva i flag corretti
      const updatedResults: RaceWeekendResults = { ...data, race: newRace };
      const { error: saveErr } = await supabase
        .from("weekend_results")
        .upsert({ round: rnd, data: updatedResults, updated_at: new Date().toISOString() }, { onConflict: "round" });
      if (saveErr) {
        log.push(`  ERRORE salvataggio weekend_results: ${saveErr.message}`);
        continue;
      }

      // 3b. Ricalcola i punteggi (gara in archivio → isPostRace true) e
      //     applicali per differenza: somma punti e Classifica Reale.
      const newScores = await computePlayerScores(supabase, rnd, updatedResults, true);
      const applicati = await applicaPunteggiRound(supabase, rnd, newScores, true);
      const affected = applicati
        .filter((a) => a.delta_total !== 0 || a.delta_real !== 0)
        .map((a) => ({ nome: a.nome, delta_punti: a.delta_total, delta_reale: a.delta_real, nuovo_weekend: a.weekend_points }));

      report.push({
        round: rnd,
        gara: meeting.meeting_name,
        variazioni: true,
        aggiunte: added.map((n) => `#${n} ${driverName(n)}`),
        rimosse: removed.map((n) => `#${n} ${driverName(n)}`),
        giocatori_impattati: affected,
      });
    }

    const roundsConVariazioni = report.filter((r) => r.variazioni).length;
    return NextResponse.json({
      success: true,
      round: round ?? "tutti",
      round_verificati: targetRounds.length,
      round_con_variazioni: roundsConVariazioni,
      report,
      log,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Errore: " + err.message, log }, { status: 500 });
  }
}

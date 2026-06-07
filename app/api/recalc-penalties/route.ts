import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";
import type { RaceWeekendResults, DriverResult } from "../../lib/scoring";
import { OPENF1, fetchJson } from "../../lib/openf1-server";
import { extractPenalizedDrivers } from "../../lib/penalties";
import { computePlayerScores } from "../../lib/score-round";
import { DRIVERS_2026 } from "../../lib/drivers-data";

const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/**
 * POST /api/recalc-penalties
 * Body: { admin_key: string, round?: number }
 *
 * Corregge le penalità di gara già salvate usando la rilevazione aggiornata
 * (legge il numero auto dal testo di race_control, non dal campo driver_number
 * che OpenF1 lascia null). Per ogni round con risultati gara:
 *   1. ri-scarica race_control e ricalcola i piloti penalizzati
 *   2. aggiorna i flag `penalty` in weekend_results
 *   3. se qualcosa è cambiato, ricalcola i punteggi del round e applica il
 *      DELTA (somma punti + classifica reale) a classifica_totale — idempotente
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

    // 2. Risolvi i meeting OpenF1 una volta sola
    const year = new Date().getFullYear();
    const allMeetings = await fetchJson(`${OPENF1}/meetings?year=${year}`);
    const meetings = (allMeetings || [])
      .filter((m: any) => !m.meeting_name?.toLowerCase().includes("testing"))
      .sort((a: any, b: any) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());

    const driverName = (num: number) =>
      DRIVERS_2026.find((d) => d.number === num)?.name ?? `#${num}`;

    const report: any[] = [];

    for (const { round: rnd, data } of targetRounds) {
      const meeting = meetings[rnd - 1];
      if (!meeting) {
        log.push(`R${rnd}: meeting non trovato su OpenF1 — saltato`);
        continue;
      }
      const sessions = await fetchJson(`${OPENF1}/sessions?meeting_key=${meeting.meeting_key}`);
      const raceSession = sessions.find((s: any) => s.session_name?.toLowerCase() === "race");
      if (!raceSession) {
        log.push(`R${rnd}: sessione gara non trovata — saltato`);
        continue;
      }

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

      // 3b. Stato precedente: vecchi punteggi weekend + classifica reale implicita
      const { data: oldScores } = await supabase
        .from("weekend_scores")
        .select("user_id, total_points")
        .eq("round", rnd);

      const oldTotal = new Map<string, number>();
      for (const os of oldScores || []) oldTotal.set(os.user_id, os.total_points ?? 0);

      const oldRealRanking = [...(oldScores || [])].sort(
        (a, b) => (b.total_points ?? 0) - (a.total_points ?? 0)
      );
      const oldReal = new Map<string, number>();
      oldRealRanking.forEach((os, i) => oldReal.set(os.user_id, PUNTI_REALE[i] ?? 0));

      // 3c. Ricalcola i nuovi punteggi (gara → isPostRace true)
      const newScores = await computePlayerScores(supabase, rnd, updatedResults, true);
      const newReal = new Map<string, number>();
      newScores.forEach((ps, i) => newReal.set(ps.user_id, PUNTI_REALE[i] ?? 0));

      // 3d. Applica i delta (idempotente) a classifica_totale e weekend_scores
      const affected: any[] = [];
      for (const ps of newScores) {
        const deltaTotal = ps.weekend_points - (oldTotal.get(ps.user_id) ?? 0);
        const deltaReal = (newReal.get(ps.user_id) ?? 0) - (oldReal.get(ps.user_id) ?? 0);

        const { data: existing } = await supabase
          .from("classifica_totale")
          .select("total_points, real_points")
          .eq("user_id", ps.user_id)
          .single();

        await supabase.from("classifica_totale").upsert({
          user_id: ps.user_id,
          team_principal_name: ps.name,
          scuderia_name: ps.scuderia,
          total_points: (existing?.total_points ?? 0) + deltaTotal,
          last_weekend_points: ps.weekend_points,
          real_points: (existing?.real_points ?? 0) + deltaReal,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        await supabase.from("weekend_scores").upsert({
          user_id: ps.user_id,
          round: rnd,
          total_points: ps.weekend_points,
          piloti_points: ps.piloti_points,
          previsioni_points: ps.previsioni_points,
        }, { onConflict: "user_id,round" });

        if (deltaTotal !== 0 || deltaReal !== 0) {
          affected.push({
            nome: ps.name,
            delta_punti: deltaTotal,
            delta_reale: deltaReal,
            nuovo_weekend: ps.weekend_points,
          });
        }
      }

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

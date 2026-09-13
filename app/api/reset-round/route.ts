import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { createServerClient } from "../../lib/supabase-server";
import { applicaPunteggiRound } from "../../lib/score-round";

/**
 * POST /api/reset-round
 * Body: { round: number, admin_key: string }
 *
 * Azzera un round:
 * 1. Toglie dalla classifica generale quanto il round aveva dato — somma
 *    punti E punti Classifica Reale (prima i punti reale restavano dentro)
 * 2. Elimina weekend_scores del round
 * 3. Elimina weekend_results del round
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { round, admin_key } = body;

  if (!isAdminRequest(request, admin_key)) {
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

  try {
    // 1. Nessun giocatore calcolato = il round non conta più per nessuno.
    //    applicaPunteggiRound sottrae per differenza e cancella le righe di
    //    weekend_scores che non hanno più un punteggio.
    const tolti = await applicaPunteggiRound(supabase, round, [], false);
    log.push(`Weekend scores trovati per round ${round}: ${tolti.length}`);
    for (const t of tolti) {
      log.push(`${t.nome}: punti ${t.delta_total}, reale ${t.delta_real}`);
    }

    // 2. Cintura e bretelle: nessuna riga del round deve restare
    const { error: delScores } = await supabase
      .from("weekend_scores")
      .delete()
      .eq("round", round);
    if (delScores) log.push(`ERRORE eliminazione weekend_scores: ${delScores.message}`);
    else log.push("weekend_scores eliminati OK");

    // 3. Risultati del weekend
    const { error: delResults } = await supabase
      .from("weekend_results")
      .delete()
      .eq("round", round);
    if (delResults) log.push(`ERRORE eliminazione weekend_results: ${delResults.message}`);
    else log.push("weekend_results eliminati OK");

    return NextResponse.json({
      success: true,
      round,
      message: `Round ${round} azzerato`,
      log,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Errore: " + err.message, log }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";

/**
 * POST /api/reset-round
 * Body: { round: number, admin_key: string }
 *
 * Azzera i punteggi di un round:
 * 1. Elimina weekend_results per il round
 * 2. Sottrae i punti weekend da classifica_totale
 * 3. Elimina weekend_scores per il round
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

  try {
    // 1. Leggi i punteggi weekend da sottrarre dalla classifica totale
    const { data: weekendScores } = await supabase
      .from("weekend_scores")
      .select("user_id, total_points")
      .eq("round", round);

    log.push(`Weekend scores trovati per round ${round}: ${weekendScores?.length ?? 0}`);

    // 2. Per ogni giocatore, sottrai i punti dal totale
    if (weekendScores && weekendScores.length > 0) {
      for (const ws of weekendScores) {
        const { data: existing } = await supabase
          .from("classifica_totale")
          .select("total_points, real_points")
          .eq("user_id", ws.user_id)
          .single();

        if (existing) {
          const newTotal = (existing.total_points ?? 0) - (ws.total_points ?? 0);
          await supabase
            .from("classifica_totale")
            .update({
              total_points: newTotal,
              last_weekend_points: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", ws.user_id);

          log.push(`${ws.user_id}: ${existing.total_points} - ${ws.total_points} = ${newTotal}`);
        }
      }
    }

    // 3. Elimina weekend_scores per il round
    const { error: delScores } = await supabase
      .from("weekend_scores")
      .delete()
      .eq("round", round);

    if (delScores) {
      log.push(`ERRORE eliminazione weekend_scores: ${delScores.message}`);
    } else {
      log.push("weekend_scores eliminati OK");
    }

    // 4. Elimina weekend_results per il round
    const { error: delResults } = await supabase
      .from("weekend_results")
      .delete()
      .eq("round", round);

    if (delResults) {
      log.push(`ERRORE eliminazione weekend_results: ${delResults.message}`);
    } else {
      log.push("weekend_results eliminati OK");
    }

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

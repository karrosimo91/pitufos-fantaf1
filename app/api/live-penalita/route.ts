import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";
import { getRaceByRound, isAfterDeadline } from "../../lib/races";
import { penalitaCambiPerUser } from "../../lib/penalita-cambi";

/**
 * GET /api/live-penalita?round=18
 *
 * Penalità cambi extra per giocatore (user_id → punti da togliere), solo per
 * chi ne ha una. Serve al live per mostrare il punteggio già al netto, come
 * lo salverà il post-gara.
 *
 * Perché lato server: `mercato_cambi` per RLS è leggibile solo dal
 * proprietario, quindi il browser non può contare i cambi degli altri. Qui si
 * legge con la service key ma si restituisce solo la penalità, non i cambi.
 * Prima della deadline non risponde nulla: il mercato è ancora aperto e la
 * penalità direbbe agli altri chi sta facendo cambi.
 */
export async function GET(request: NextRequest) {
  const round = Number(request.nextUrl.searchParams.get("round"));
  const race = Number.isInteger(round) ? getRaceByRound(round) : undefined;
  if (!race) {
    return NextResponse.json({ error: "round non valido" }, { status: 400 });
  }
  if (!isAfterDeadline(race)) {
    return NextResponse.json({ penalita: {}, locked: false });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  const [formRes, cambiRes] = await Promise.all([
    supabase.from("formazioni").select("user_id, chip_piloti").eq("round", round).eq("confirmed", true),
    supabase.from("mercato_cambi").select("user_id").eq("round", round),
  ]);
  if (formRes.error || cambiRes.error) {
    console.warn("[live-penalita]", formRes.error ?? cambiRes.error);
    return NextResponse.json({ error: "lettura fallita" }, { status: 500 });
  }

  return NextResponse.json(
    { penalita: penalitaCambiPerUser(formRes.data ?? [], cambiRes.data ?? []), locked: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}

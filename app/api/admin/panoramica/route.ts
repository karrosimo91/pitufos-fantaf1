import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../lib/supabase-server";

/**
 * POST /api/admin/panoramica
 * Body: { admin_key, round? }
 *
 * Restituisce snapshot server-side (via service_role) di:
 *   - profiles
 *   - formazioni confermate (tutte + del round richiesto)
 *   - previsioni del round richiesto
 *   - weekend_results disponibili
 *   - classifica_totale ordinata per total_points
 *
 * Sostituisce le letture dirette che /debug faceva sulla tabella
 * classifica_totale (chiusa da RLS dopo la migration v15).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { admin_key, round = 1 } = body as { admin_key?: string; round?: number };

  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || admin_key !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato lato server" }, { status: 500 });
  }

  const [
    profilesRes,
    allFormazioniRes,
    formazioniRoundRes,
    previsioniRoundRes,
    weekendRes,
    classificaRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, team_principal_name, scuderia_name, email"),
    supabase.from("formazioni").select("*").eq("confirmed", true),
    supabase.from("formazioni").select("*").eq("round", round),
    supabase.from("previsioni").select("*").eq("round", round),
    supabase.from("weekend_results").select("round").order("round"),
    supabase.from("classifica_totale").select("*").order("total_points", { ascending: false }),
  ]);

  return NextResponse.json({
    profiles: profilesRes.data ?? [],
    allFormazioniConfermate: allFormazioniRes.data ?? [],
    formazioniRound: formazioniRoundRes.data ?? [],
    previsioniRound: previsioniRoundRes.data ?? [],
    weekendResults: weekendRes.data ?? [],
    classifica: classificaRes.data ?? [],
    errors: {
      profiles: profilesRes.error?.message,
      allFormazioni: allFormazioniRes.error?.message,
      formazioniRound: formazioniRoundRes.error?.message,
      previsioniRound: previsioniRoundRes.error?.message,
      weekend: weekendRes.error?.message,
      classifica: classificaRes.error?.message,
    },
  });
}

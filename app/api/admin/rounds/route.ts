import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../lib/supabase-server";
import { isAdminRequest } from "../../../lib/admin-auth";

/**
 * GET /api/admin/rounds — round che hanno risultati in archivio.
 * Serve al "Ricalcola stagione": si rilanciano SOLO i round già calcolati,
 * mai quelli mai giocati dalla lega (round 1) o cancellati (4, 5).
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request, request.nextUrl.searchParams.get("admin_key") ?? undefined)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  const { data, error } = await supabase.from("weekend_results").select("round").order("round");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rounds: (data ?? []).map((r: { round: number }) => r.round) });
}

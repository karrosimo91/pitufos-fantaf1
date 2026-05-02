import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";

/**
 * POST /api/fix-formazione
 * Body: { round, admin_key, user_id, fields: { chip_piloti?, sesto_uomo?, ... } }
 *
 * Patch specifici campi della formazione di un giocatore per un round.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { round, admin_key, user_id, fields } = body;

  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || admin_key !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!round || !user_id || !fields) {
    return NextResponse.json({ error: "Parametri mancanti: round, user_id, fields" }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  const allowedFields = ["chip_piloti", "chip_piloti_target", "sesto_uomo", "primo_pilota"];
  const updatePayload: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (allowedFields.includes(key)) {
      updatePayload[key] = val;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "Nessun campo valido da aggiornare" }, { status: 400 });
  }

  // Read current
  const { data: before } = await supabase
    .from("formazioni")
    .select("*")
    .eq("user_id", user_id)
    .eq("round", round)
    .single();

  if (!before) {
    return NextResponse.json({ error: "Formazione non trovata" }, { status: 404 });
  }

  // Update
  const { error } = await supabase
    .from("formazioni")
    .update(updatePayload)
    .eq("user_id", user_id)
    .eq("round", round);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Read after
  const { data: after } = await supabase
    .from("formazioni")
    .select("*")
    .eq("user_id", user_id)
    .eq("round", round)
    .single();

  return NextResponse.json({
    success: true,
    round,
    user_id,
    before: { chip_piloti: before.chip_piloti, sesto_uomo: before.sesto_uomo },
    after: { chip_piloti: after?.chip_piloti, sesto_uomo: after?.sesto_uomo },
    updated_fields: updatePayload,
  });
}

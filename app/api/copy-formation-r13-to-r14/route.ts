import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";

/**
 * POST /api/copy-formation-r13-to-r14
 * Copia formazione round 13 → round 14 per un utente, rimuovendo Hadjar (numero 6)
 *
 * Body: { admin_key, username }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { admin_key, username } = body;

  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || admin_key !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!username) {
    return NextResponse.json({ error: "Parametro mancante: username" }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  try {
    // 1. Trova user_id
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", username)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: `Utente '${username}' non trovato` }, { status: 404 });
    }

    const userId = user.id;

    // 2. Leggi formazione round 13
    const { data: r13, error: r13Error } = await supabase
      .from("formazioni")
      .select("*")
      .eq("user_id", userId)
      .eq("round", 13)
      .single();

    if (r13Error || !r13) {
      return NextResponse.json(
        { error: `Formazione round 13 non trovata per ${username}` },
        { status: 404 }
      );
    }

    // 3. Rimuovi Hadjar (numero 6)
    const r14Drivers = (r13.driver_numbers || []).filter((num: number) => num !== 6);

    if (r14Drivers.length < 4) {
      return NextResponse.json(
        { error: "Errore: meno di 4 piloti dopo la rimozione di Hadjar" },
        { status: 400 }
      );
    }

    // 4. Copia formazione a round 14 (confirmed = true)
    const { error: r14Error } = await supabase
      .from("formazioni")
      .upsert(
        {
          user_id: userId,
          round: 14,
          driver_numbers: r14Drivers,
          primo_pilota: r13.primo_pilota,
          sesto_uomo: null,
          chip_piloti: null,
          chip_piloti_target: null,
          cassa: r13.cassa,
          confirmed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,round" }
      );

    if (r14Error) {
      return NextResponse.json(
        { error: `Errore formazione: ${r14Error.message}` },
        { status: 500 }
      );
    }

    // 5. Azzera e conferma previsioni
    const { error: prevError } = await supabase
      .from("previsioni")
      .upsert(
        {
          user_id: userId,
          round: 14,
          safety_car: null,
          virtual_safety_car: null,
          red_flag: null,
          gomme_wet: null,
          pole_vince: null,
          numero_dnf: null,
          chip_previsioni: null,
          chip_previsioni_target: null,
          confirmed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,round" }
      );

    if (prevError) {
      return NextResponse.json(
        { error: `Errore previsioni: ${prevError.message}` },
        { status: 500 }
      );
    }

    // 6. Leggi risultato finale
    const { data: r14Final } = await supabase
      .from("formazioni")
      .select("*")
      .eq("user_id", userId)
      .eq("round", 14)
      .single();

    const { data: prevFinal } = await supabase
      .from("previsioni")
      .select("*")
      .eq("user_id", userId)
      .eq("round", 14)
      .single();

    return NextResponse.json({
      success: true,
      username,
      userId,
      r13: {
        drivers: r13.driver_numbers,
        primo_pilota: r13.primo_pilota,
        cassa: r13.cassa,
      },
      r14: {
        drivers: r14Final?.driver_numbers,
        primo_pilota: r14Final?.primo_pilota,
        cassa: r14Final?.cassa,
        confirmed: r14Final?.confirmed,
      },
      previsioni: {
        r14_confirmed: prevFinal?.confirmed,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Errore interno: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}

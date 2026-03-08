import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";

/**
 * POST /api/fix-numeri
 * Body: { admin_key: string }
 *
 * Migrazione one-shot: fix numeri piloti 2026
 * - #1 (vecchio Verstappen) → #3
 * - #2 (vecchio Lindblad) → #41
 * - #4 (vecchio Norris) → #1
 * Poi resetta classifica_totale e weekend_scores
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { admin_key } = body;

  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || admin_key !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  const log: string[] = [];

  const NUMBER_MAP: Record<number, number> = {
    1: 3,   // Verstappen: #1 → #3
    2: 41,  // Lindblad: #2 → #41
    4: 1,   // Norris: #4 → #1
  };

  function migrateNumber(n: number): number {
    return NUMBER_MAP[n] ?? n;
  }

  try {
    // ═══ FIX FORMAZIONI ═══
    const { data: formazioni, error: formErr } = await supabase
      .from("formazioni")
      .select("*");

    if (formErr) {
      return NextResponse.json({ error: "Errore lettura formazioni: " + formErr.message, log }, { status: 500 });
    }

    log.push(`Formazioni trovate: ${formazioni?.length || 0}`);
    let formazioniFixed = 0;

    for (const f of formazioni || []) {
      const oldNumbers: number[] = (f.driver_numbers || []).map(Number);
      const newNumbers = oldNumbers.map(migrateNumber);
      const oldPrimo = f.primo_pilota;
      const newPrimo = migrateNumber(oldPrimo);
      const oldSesto = f.sesto_uomo;
      const newSesto = oldSesto ? migrateNumber(oldSesto) : null;
      const oldChipTarget = f.chip_piloti_target;
      const newChipTarget = oldChipTarget ? migrateNumber(oldChipTarget) : null;

      const changed =
        JSON.stringify(oldNumbers) !== JSON.stringify(newNumbers) ||
        oldPrimo !== newPrimo ||
        oldSesto !== newSesto ||
        oldChipTarget !== newChipTarget;

      if (changed) {
        const { error: upErr } = await supabase
          .from("formazioni")
          .update({
            driver_numbers: newNumbers,
            primo_pilota: newPrimo,
            sesto_uomo: newSesto,
            chip_piloti_target: newChipTarget,
          })
          .eq("id", f.id);

        if (upErr) {
          log.push(`ERROR formazione ${f.id}: ${upErr.message}`);
        } else {
          log.push(`FIX formazione R${f.round} user=${f.user_id.slice(0, 8)}: [${oldNumbers}] → [${newNumbers}] | primo: ${oldPrimo} → ${newPrimo}`);
          formazioniFixed++;
        }
      }
    }
    log.push(`Formazioni fixate: ${formazioniFixed}`);

    // ═══ FIX SCUDERIA_DRIVERS ═══
    const { data: drivers, error: drvErr } = await supabase
      .from("scuderia_drivers")
      .select("*");

    if (drvErr) {
      log.push(`ERROR lettura scuderia_drivers: ${drvErr.message}`);
    } else {
      log.push(`Scuderia_drivers trovate: ${drivers?.length || 0}`);
      let driversFixed = 0;

      for (const d of drivers || []) {
        const oldNum = d.driver_number;
        const newNum = migrateNumber(oldNum);
        if (oldNum !== newNum) {
          const { error: upErr } = await supabase
            .from("scuderia_drivers")
            .update({ driver_number: newNum })
            .eq("user_id", d.user_id)
            .eq("driver_number", oldNum);

          if (upErr) {
            log.push(`ERROR scuderia_driver: ${upErr.message}`);
          } else {
            log.push(`FIX driver user=${d.user_id.slice(0, 8)}: #${oldNum} → #${newNum}`);
            driversFixed++;
          }
        }
      }
      log.push(`Scuderia_drivers fixati: ${driversFixed}`);
    }

    // ═══ RESET CLASSIFICA E SCORES ═══
    const { error: delClass } = await supabase
      .from("classifica_totale")
      .delete()
      .neq("user_id", "00000000-0000-0000-0000-000000000000"); // delete all

    if (delClass) {
      log.push(`ERROR reset classifica: ${delClass.message}`);
    } else {
      log.push("classifica_totale resettata OK");
    }

    const { error: delScores } = await supabase
      .from("weekend_scores")
      .delete()
      .neq("user_id", "00000000-0000-0000-0000-000000000000");

    if (delScores) {
      log.push(`ERROR reset weekend_scores: ${delScores.message}`);
    } else {
      log.push("weekend_scores resettata OK");
    }

    const { error: delResults } = await supabase
      .from("weekend_results")
      .delete()
      .neq("round", -1);

    if (delResults) {
      log.push(`ERROR reset weekend_results: ${delResults.message}`);
    } else {
      log.push("weekend_results resettata OK");
    }

    return NextResponse.json({
      success: true,
      formazioni_fixed: formazioniFixed,
      log,
    });

  } catch (err: any) {
    return NextResponse.json({ error: "Errore: " + err.message, log }, { status: 500 });
  }
}

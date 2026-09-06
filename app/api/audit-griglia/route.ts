import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";
import { computePlayerScoresFrom, type RoundScoringInputs } from "../../lib/score-round";
import { gridFromJolpicaResults, type JolpicaResult } from "../../lib/starting-grid";
import type { RaceWeekendResults } from "../../lib/scoring";
import { DRIVERS_2026 } from "../../lib/drivers-data";

/**
 * GET /api/audit-griglia?admin_key=...&from=1&to=24
 *
 * SOLA LETTURA: non scrive nulla, né sui risultati né sui punteggi.
 *
 * Confronta i punteggi salvati (calcolati con la griglia = posizione di
 * qualifica, il bug corretto in v1.9.2) con quelli che verrebbero fuori usando
 * la griglia di partenza reale presa dai risultati ufficiali Jolpica.
 * Serve a sapere quali round cambierebbero, per chi e di quanto, prima di
 * decidere se ricalcolare la stagione.
 */

function driverName(num: number): string {
  return DRIVERS_2026.find((d) => d.number === num)?.name ?? `#${num}`;
}

async function fetchJolpicaResults(year: number, round: number): Promise<JolpicaResult[]> {
  try {
    const res = await fetch(`https://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.MRData?.RaceTable?.Races?.[0]?.Results ?? [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || params.get("admin_key") !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const from = Number(params.get("from") ?? 1);
  const to = Number(params.get("to") ?? 24);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 24 || from > to) {
    return NextResponse.json({ error: "Intervallo round non valido" }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });

  // Letture in blocco: un giro solo di query per tutti i round richiesti
  const [{ data: allResults }, { data: allFormazioni }, { data: allPrevisioni }, { data: allCambi }, { data: profiles }, { data: allScores }] =
    await Promise.all([
      supabase.from("weekend_results").select("round, data").gte("round", from).lte("round", to),
      supabase.from("formazioni").select("*").gte("round", from).lte("round", to).eq("confirmed", true),
      supabase.from("previsioni").select("*").gte("round", from).lte("round", to).eq("confirmed", true),
      supabase.from("mercato_cambi").select("user_id, round").gte("round", from).lte("round", to),
      supabase.from("profiles").select("id, team_principal_name, scuderia_name"),
      supabase.from("weekend_scores").select("*").gte("round", from).lte("round", to),
    ]);

  const year = new Date().getFullYear();
  const rounds = (allResults || []).map((r: { round: number }) => r.round).sort((a: number, b: number) => a - b);
  const jolpicaByRound = new Map<number, JolpicaResult[]>();
  await Promise.all(rounds.map(async (r: number) => jolpicaByRound.set(r, await fetchJolpicaResults(year, r))));

  const report: unknown[] = [];
  let totaleRoundCambiati = 0;

  for (const round of rounds) {
    const row = (allResults || []).find((x: { round: number }) => x.round === round);
    const results = row?.data as RaceWeekendResults | undefined;
    if (!results?.race?.length) continue;

    const gridEntries = gridFromJolpicaResults(jolpicaByRound.get(round) ?? []);
    if (gridEntries.length === 0) {
      report.push({ round, stato: "griglia ufficiale non disponibile su Jolpica — round saltato" });
      continue;
    }
    const gridReale = new Map<number, number>();
    for (const e of gridEntries) if (e.driver_number && e.position) gridReale.set(e.driver_number, e.position);

    // Differenze di griglia rispetto a quanto salvato
    const diffGriglia = results.race
      .filter((r) => r.driver_number && gridReale.has(r.driver_number) && gridReale.get(r.driver_number) !== r.grid_position)
      .map((r) => ({
        pilota: driverName(r.driver_number),
        numero: r.driver_number,
        griglia_salvata: r.grid_position ?? null,
        griglia_reale: gridReale.get(r.driver_number),
        arrivo: r.position ?? null,
        dnf: !!r.dnf,
      }));

    const resultsCorretti: RaceWeekendResults = {
      ...results,
      race: results.race.map((r) => ({
        ...r,
        grid_position: gridReale.get(r.driver_number) ?? r.grid_position,
      })),
    };

    const cambiPerUser = new Map<string, number>();
    for (const c of (allCambi || []) as { user_id: string; round: number }[]) {
      if (c.round !== round) continue;
      cambiPerUser.set(c.user_id, (cambiPerUser.get(c.user_id) ?? 0) + 1);
    }

    const inputs: RoundScoringInputs = {
      formazioni: (allFormazioni || []).filter((f: { round: number }) => f.round === round),
      profiles: profiles || [],
      previsioni: (allPrevisioni || []).filter((p: { round: number }) => p.round === round),
      cambiPerUser,
    };

    const prima = computePlayerScoresFrom(inputs, results, true);
    const dopo = computePlayerScoresFrom(inputs, resultsCorretti, true);

    const giocatori = dopo
      .map((d) => {
        const p = prima.find((x) => x.user_id === d.user_id);
        const salvato = (allScores || []).find(
          (s: { round: number; user_id: string }) => s.round === round && s.user_id === d.user_id,
        );
        return {
          nome: d.name,
          punti_salvati_db: salvato ? Number(salvato.total_points) : null,
          punti_ricalcolati_griglia_qualifica: p?.weekend_points ?? null,
          punti_con_griglia_reale: d.weekend_points,
          differenza: p ? d.weekend_points - p.weekend_points : null,
        };
      })
      .filter((g) => g.differenza !== 0);

    if (giocatori.length > 0 || diffGriglia.length > 0) {
      if (giocatori.length > 0) totaleRoundCambiati++;
      report.push({
        round,
        piloti_con_griglia_diversa: diffGriglia.length,
        dettaglio_griglia: diffGriglia,
        giocatori_con_punti_diversi: giocatori,
      });
    }
  }

  return NextResponse.json({
    intervallo: { from, to },
    round_analizzati: rounds,
    round_con_punteggi_da_correggere: totaleRoundCambiati,
    report,
    nota: "Sola lettura: nessun dato è stato modificato.",
  });
}

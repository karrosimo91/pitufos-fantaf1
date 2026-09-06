import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase-server";
import { computePlayerScoresFrom, type RoundScoringInputs } from "../../lib/score-round";
import { resolveGrid, gridFromJolpicaResults, gridFromRacePositions, type JolpicaResult } from "../../lib/starting-grid";
import type { RaceWeekendResults } from "../../lib/scoring";
import { DRIVERS_2026 } from "../../lib/drivers-data";

/**
 * GET /api/audit-griglia?admin_key=...&from=1&to=24
 *
 * SOLA LETTURA: non scrive nulla, né sui risultati né sui punteggi.
 *
 * Confronta i punteggi salvati (calcolati con la griglia = posizione di
 * qualifica, il bug corretto in v1.9.2) con quelli che verrebbero fuori usando
 * la griglia di partenza reale. Serve a sapere quali round cambierebbero, per
 * chi e di quanto, prima di decidere se ricalcolare la stagione.
 *
 * Le fonti della griglia sono le stesse del post-gara, nello stesso ordine:
 * `starting_grid` di OpenF1 (oggi vuoto, ma se lo popolano viene usato),
 * risultati ufficiali Jolpica, prime posizioni del feed `position` della gara
 * su OpenF1. Il report dice quale fonte ha risposto per ogni round: se due
 * fonti indipendenti concordano, il risultato è molto più difendibile davanti
 * al CDA di una sola.
 */

const OPENF1 = "https://api.openf1.org/v1";

async function openf1Token(): Promise<string | null> {
  const username = process.env.OPENF1_USERNAME;
  const password = process.env.OPENF1_PASSWORD;
  if (!username || !password) return null;
  try {
    const res = await fetch("https://api.openf1.org/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "password", username, password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function openf1Json(url: string, headers: Record<string, string>): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

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

export const maxDuration = 60;

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

  // OpenF1: risolve round → session_key della gara, come fa /api/fetch-risultati
  const token = await openf1Token();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const meetings = (await openf1Json(`${OPENF1}/meetings?year=${year}`, headers))
    .filter((m) => !String(m.meeting_name ?? "").toLowerCase().includes("testing"))
    .sort((a, b) => new Date(String(a.date_start)).getTime() - new Date(String(b.date_start)).getTime());
  const allSessions = await openf1Json(`${OPENF1}/sessions?year=${year}`, headers);

  const raceSessionKeyByRound = new Map<number, number>();
  for (const round of rounds) {
    const meetingKey = meetings[round - 1]?.meeting_key;
    if (!meetingKey) continue;
    const race = allSessions.find(
      (s) => s.meeting_key === meetingKey && String(s.session_name ?? "").toLowerCase() === "race",
    );
    if (race?.session_key) raceSessionKeyByRound.set(round, Number(race.session_key));
  }

  const report: unknown[] = [];
  let totaleRoundCambiati = 0;

  for (const round of rounds) {
    const row = (allResults || []).find((x: { round: number }) => x.round === round);
    const results = row?.data as RaceWeekendResults | undefined;
    if (!results?.race?.length) continue;

    const sessionKey = raceSessionKeyByRound.get(round);
    const startingGrid = sessionKey ? await openf1Json(`${OPENF1}/starting_grid?session_key=${sessionKey}`, headers) : [];
    const jolpicaGrid = gridFromJolpicaResults(jolpicaByRound.get(round) ?? []);
    // Il feed `position` è pesante: lo interroghiamo solo se serve davvero
    const racePositions = startingGrid.length === 0 && jolpicaGrid.length === 0 && sessionKey
      ? await openf1Json(`${OPENF1}/position?session_key=${sessionKey}`, headers)
      : [];

    const { grid: gridReale, source: fonte } = resolveGrid([
      { name: "starting_grid", entries: startingGrid as { driver_number?: number | null; position?: number | null }[] },
      { name: "jolpica_results", entries: jolpicaGrid },
      { name: "race_first_positions", entries: gridFromRacePositions(racePositions as { driver_number?: number | null; position?: number | null; date?: string | null }[]) },
    ]);
    if (gridReale.size === 0) {
      report.push({ round, stato: "griglia reale non disponibile da nessuna fonte — round saltato" });
      continue;
    }

    // Controprova: quando ci sono due fonti, devono dire la stessa cosa
    const controprova = gridFromRacePositions(racePositions as { driver_number?: number | null; position?: number | null; date?: string | null }[]);
    let concordanza: string | null = null;
    if (fonte === "jolpica_results" && controprova.length > 0) {
      const diverse = controprova.filter((c) => c.driver_number && gridReale.get(c.driver_number) !== c.position).length;
      concordanza = diverse === 0 ? "Jolpica e OpenF1 concordano" : `${diverse} piloti in disaccordo fra Jolpica e OpenF1`;
    }

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
        fonte_griglia: fonte,
        concordanza_fonti: concordanza,
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

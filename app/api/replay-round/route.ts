import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../lib/admin-auth";
import { createServerClient } from "../../lib/supabase-server";
import { RACES_2026, LAST_ROUND } from "../../lib/races";
import { DRIVERS_2026 } from "../../lib/drivers-data";
import { CDA_LEAGUE_ID } from "../../lib/cda-questions";
import { FORZA_MAGGIORE } from "../../lib/manual-overrides";
import { OPENF1, fetchOpenF1 } from "../../lib/openf1-server";
import { findRaceSessionForRound, type OpenF1Session } from "../../lib/openf1-sessions";
import { resolveGrid, gridFromRacePositions } from "../../lib/starting-grid";
import type { RaceWeekendResults } from "../../lib/scoring";
import type { RoundScoringInputs } from "../../lib/score-round";
import { buildReplay, type ReplayRawData } from "../../lib/replay-round";

export const maxDuration = 60;

/**
 * GET /api/replay-round?round=18[&lega=<id>|all][&admin_key=...]
 *
 * Replay della gara: la classifica dei giocatori a ogni giro, ricostruita
 * dagli stream storici OpenF1 con le stesse funzioni del live (vedi
 * lib/replay-round.ts). Sola lettura, riservata all'admin: legge formazioni e
 * previsioni di tutti con la service key. Serve alla pagina /replay.html.
 *
 * `lega` filtra i giocatori ai membri di una lega; senza parametro si usa la
 * lega Los Pitufos, con `lega=all` tutti i giocatori con formazione confermata.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  if (!isAdminRequest(request, q.get("admin_key") ?? undefined)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const round = Number(q.get("round"));
  const race = RACES_2026.find((r) => r.round === round);
  if (!Number.isInteger(round) || round < 1 || round > LAST_ROUND || !race) {
    return NextResponse.json({ error: "Round non valido" }, { status: 400 });
  }
  const legaParam = q.get("lega");
  const legaId = legaParam === "all" ? null : (legaParam || CDA_LEAGUE_ID);

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  // ─── Sessione gara OpenF1, abbinata per data ───
  const year = new Date(race.date).getUTCFullYear();
  const sessionsRes = await fetchOpenF1<OpenF1Session>(`${OPENF1}/sessions?year=${year}`);
  if (!sessionsRes.ok || sessionsRes.data.length === 0) {
    return NextResponse.json({ error: `OpenF1 non risponde sul calendario (HTTP ${sessionsRes.status})` }, { status: 502 });
  }
  const match = findRaceSessionForRound(round, sessionsRes.data);
  if (!match.ok) return NextResponse.json({ error: match.error }, { status: 404 });
  const raceKey = match.session.session_key;

  // ─── Stream storici della gara ───
  const [positions, raceControl, laps, stints, sessionResult, startingGrid, drivers] = await Promise.all([
    fetchOpenF1(`${OPENF1}/position?session_key=${raceKey}`),
    fetchOpenF1(`${OPENF1}/race_control?session_key=${raceKey}`),
    fetchOpenF1(`${OPENF1}/laps?session_key=${raceKey}`),
    fetchOpenF1(`${OPENF1}/stints?session_key=${raceKey}`),
    fetchOpenF1(`${OPENF1}/session_result?session_key=${raceKey}`),
    fetchOpenF1(`${OPENF1}/starting_grid?session_key=${raceKey}`),
    fetchOpenF1(`${OPENF1}/drivers?session_key=${raceKey}`),
  ]);
  const failed = [
    ["position", positions], ["race_control", raceControl], ["laps", laps], ["stints", stints],
  ].filter(([, r]) => !(r as { ok: boolean }).ok).map(([n]) => n);
  if (failed.length) {
    return NextResponse.json({ error: `OpenF1 non ha risposto su: ${failed.join(", ")} (sessione ${raceKey})` }, { status: 502 });
  }
  if (positions.data.length === 0 || laps.data.length === 0) {
    return NextResponse.json({ error: `Nessun dato di gara su OpenF1 per la sessione ${raceKey}: la gara è stata corsa?` }, { status: 409 });
  }

  // ─── Archivio: sessioni precedenti del weekend e punteggi ufficiali ───
  const [wrRes, scoresRes] = await Promise.all([
    supabase.from("weekend_results").select("data").eq("round", round).maybeSingle(),
    supabase.from("weekend_scores").select("user_id, total_points, piloti_points, previsioni_points").eq("round", round),
  ]);
  const previousResults = (wrRes.data?.data as RaceWeekendResults | undefined) ?? null;

  const { grid, source: gridSource } = resolveGrid([
    { name: "starting_grid", entries: startingGrid.data },
    { name: "race_first_positions", entries: gridFromRacePositions(positions.data) },
    { name: "qualifying", entries: previousResults?.qualifying ?? [] },
  ]);

  // ─── Giocatori del round ───
  let memberIds: Set<string> | null = null;
  if (legaId) {
    const { data: members, error } = await supabase.from("lega_members").select("user_id").eq("lega_id", legaId);
    if (error) return NextResponse.json({ error: `lega_members: ${error.message}` }, { status: 500 });
    memberIds = new Set((members ?? []).map((m: { user_id: string }) => m.user_id));
  }
  const [formRes, prevRes, cambiRes] = await Promise.all([
    supabase.from("formazioni").select("*").eq("round", round).eq("confirmed", true),
    supabase.from("previsioni").select("*").eq("round", round).eq("confirmed", true),
    supabase.from("mercato_cambi").select("user_id").eq("round", round),
  ]);
  const dbErr = formRes.error ?? prevRes.error ?? cambiRes.error;
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const formazioni = (formRes.data ?? []).filter((f: { user_id: string }) => !memberIds || memberIds.has(f.user_id));
  if (formazioni.length === 0) {
    return NextResponse.json({ error: `Nessuna formazione confermata per il round ${round}` }, { status: 404 });
  }
  const userIds = formazioni.map((f: { user_id: string }) => f.user_id);
  const { data: profiles } = await supabase
    .from("profiles").select("id, team_principal_name, scuderia_name").in("id", userIds);
  const cambiPerUser = new Map<string, number>();
  for (const c of cambiRes.data ?? []) {
    cambiPerUser.set(c.user_id, (cambiPerUser.get(c.user_id) ?? 0) + 1);
  }
  const scoring: RoundScoringInputs = {
    formazioni,
    profiles: profiles ?? [],
    previsioni: prevRes.data ?? [],
    cambiPerUser,
  };

  const raw: ReplayRawData = {
    positions: positions.data,
    raceControl: raceControl.data,
    laps: laps.data,
    stints: stints.data,
    sessionResult: sessionResult.ok ? sessionResult.data : [],
  };
  const replay = buildReplay({
    raw, grid, previousResults, scoring,
    forzaMaggiore: new Set(FORZA_MAGGIORE[round] ?? []),
  });

  // Nomi e colori piloti: OpenF1 del weekend, con la rosa dell'app a copertura.
  const driverInfo: Record<number, { name: string; team: string; colour: string }> = {};
  for (const d of DRIVERS_2026) driverInfo[d.number] = { name: d.name, team: d.team, colour: d.teamColour };
  for (const d of drivers.data as { driver_number?: number; full_name?: string; team_name?: string; team_colour?: string }[]) {
    if (!d?.driver_number) continue;
    const base = driverInfo[d.driver_number];
    driverInfo[d.driver_number] = {
      name: d.full_name || base?.name || `#${d.driver_number}`,
      team: d.team_name || base?.team || "",
      colour: d.team_colour || base?.colour || "888888",
    };
  }

  const official = scoresRes.data && scoresRes.data.length > 0
    ? scoresRes.data
      .filter((s: { user_id: string }) => userIds.includes(s.user_id))
      .map((s: { user_id: string; total_points: number; piloti_points: number; previsioni_points: number }) => ({
        user_id: s.user_id,
        points: Number(s.total_points),
        piloti: Number(s.piloti_points),
        previsioni: Number(s.previsioni_points),
      }))
      .sort((a: { points: number }, b: { points: number }) => b.points - a.points)
    : null;

  return NextResponse.json(
    {
      round,
      race: { name: race.name, circuit: race.circuit, date: race.date, flag: race.flag },
      session_key: raceKey,
      grid_source: gridSource,
      lega: legaId,
      total_laps: replay.total_laps,
      drivers: driverInfo,
      frames: replay.frames,
      official,
      note: "Ricostruzione dagli stream storici OpenF1 con le regole del live: il momento dei ritiri è stimato all'ultimo giro completato; Driver of the Day, penalità post-gara e override manuali entrano solo nei punteggi ufficiali (campo `official`).",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

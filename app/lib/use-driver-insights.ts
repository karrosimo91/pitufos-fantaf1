"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";
import { DRIVERS_2026 } from "./drivers-data";
import { useAllWeekendResults } from "./use-weekend-results";
import { driverFormByRound, lastRacedRound, computeEventStats, type RoundResults } from "./season-insights";
import { RACES_2026, isAfterDeadline } from "./races";

export interface DriverInsight {
  /** Ultimi 3 weekend in archivio: punti base, dal più recente */
  form: { round: number; points: number; raced: boolean }[];
  /** Variazione di quotazione rispetto al round precedente (0 se invariata) */
  priceDelta: number;
  /** Storico quotazioni per round (crescente) */
  priceHistory: { round: number; price: number }[];
  /** Quanti Team Principal della lega lo hanno in rosa (formazioni confermate del round) */
  owners: number;
  /** Quanti lo hanno come Primo Pilota */
  captains: number;
  /** Nomi dei proprietari: valorizzato solo a formazione chiusa */
  ownerNames: string[];
  /** Ha corso nell'ultimo GP in archivio (false = probabile non iscritto) */
  racedLast: boolean | null;
}

/**
 * Round di cui si può mostrare "chi lo ha in rosa": il corrente solo a
 * formazione chiusa (qualifiche o shootout iniziate); prima, l'ultimo round
 * già chiuso. Le formazioni degli altri per il weekend in preparazione non
 * devono uscire in nessuna forma, nemmeno come conteggio.
 */
export function ownershipRoundFor(round: number, locked: boolean): number | null {
  if (locked) return round;
  const closed = RACES_2026.filter((r) => r.round < round && isAfterDeadline(r));
  return closed.length > 0 ? closed[closed.length - 1].round : null;
}

/**
 * Dati di contesto per le schede pilota (Mercato, Muretto, Sesto Uomo, Boost):
 * forma, trend quotazione, chi lo ha in lega, se ha corso l'ultimo GP.
 * Tutte tabelle read-all. Prima della deadline "chi lo ha" si riferisce
 * all'ultimo round chiuso; i nomi escono solo per il round corrente chiuso.
 */
export function useDriverInsights(round: number, legaId: string | null, locked: boolean) {
  const ownershipRound = ownershipRoundFor(round, locked);
  const { rows: resultRows, loaded: resultsLoaded } = useAllWeekendResults();
  const [prices, setPrices] = useState<{ round: number; driver_number: number; price: number }[]>([]);
  const [formazioni, setFormazioni] = useState<{ user_id: string; driver_numbers: number[]; primo_pilota: number | null }[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [members, setMembers] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoaded(true); return; }
    const supabase = createClient();
    if (!supabase) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const memberIds: string[] | null = legaId
        ? ((await supabase.from("lega_members").select("user_id").eq("lega_id", legaId)).data ?? []).map((m) => m.user_id)
        : null;
      if (cancelled) return;

      let formQuery = supabase
        .from("formazioni")
        .select("user_id, driver_numbers, primo_pilota")
        .eq("round", ownershipRound ?? -1)
        .eq("confirmed", true);
      if (memberIds) formQuery = formQuery.in("user_id", memberIds);

      const [priceRes, formRes] = await Promise.all([
        supabase.from("driver_prices").select("round, driver_number, price").lte("round", round).order("round", { ascending: true }),
        formQuery,
      ]);
      if (cancelled) return;
      if (priceRes.error) console.warn("[driver-insights] prices", priceRes.error);
      if (formRes.error) console.warn("[driver-insights] formazioni", formRes.error);

      const forms = (formRes.data ?? []).map((f) => ({
        user_id: f.user_id as string,
        driver_numbers: ((f.driver_numbers ?? []) as number[]).map(Number),
        primo_pilota: f.primo_pilota as number | null,
      }));
      setPrices((priceRes.data ?? []) as { round: number; driver_number: number; price: number }[]);
      setFormazioni(forms);
      setMembers(memberIds ? memberIds.length : forms.length);

      if (locked && forms.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, team_principal_name")
          .in("id", forms.map((f) => f.user_id));
        if (cancelled) return;
        const m = new Map<string, string>();
        for (const p of profiles ?? []) m.set(p.id, p.team_principal_name || "—");
        setNames(m);
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [round, legaId, locked, ownershipRound]);

  const insights = useMemo(() => {
    const rows: RoundResults[] = resultRows.map((r) => ({ round: r.round, data: r.data }));
    const last = lastRacedRound(rows);
    const out = new Map<number, DriverInsight>();
    for (const d of DRIVERS_2026) {
      const hist = prices.filter((p) => p.driver_number === d.number).sort((a, b) => a.round - b.round);
      // Prezzo vigente = ultima riga; precedente = riga prima (o iniziale statica)
      const current = hist.length > 0 ? hist[hist.length - 1].price : d.price;
      const previous = hist.length > 1 ? hist[hist.length - 2].price : d.price;
      const owners = formazioni.filter((f) => f.driver_numbers.includes(d.number));
      out.set(d.number, {
        form: driverFormByRound(rows, d.number).slice(0, 3),
        priceDelta: current - previous,
        priceHistory: [{ round: 0, price: d.price }, ...hist.map((h) => ({ round: h.round, price: h.price }))],
        owners: owners.length,
        captains: formazioni.filter((f) => f.primo_pilota === d.number).length,
        ownerNames: locked ? owners.map((o) => names.get(o.user_id) ?? "—") : [],
        racedLast: last ? last.drivers.has(d.number) : null,
      });
    }
    return out;
  }, [resultRows, prices, formazioni, names, locked]);

  const eventStats = useMemo(
    () => computeEventStats(resultRows.map((r) => ({ round: r.round, data: r.data }))),
    [resultRows],
  );

  return {
    loaded: loaded && resultsLoaded,
    insights,
    members,
    /** Round a cui si riferiscono `owners`/`captains` (il corrente solo a formazione chiusa) */
    ownershipRound,
    ownershipIsCurrent: ownershipRound === round,
    eventStats,
    lastRacedRound: useMemo(() => lastRacedRound(resultRows.map((r) => ({ round: r.round, data: r.data })))?.round ?? null, [resultRows]),
    resultRows,
  };
}

export const EMPTY_INSIGHT: DriverInsight = {
  form: [], priceDelta: 0, priceHistory: [], owners: 0, captains: 0, ownerNames: [], racedLast: null,
};

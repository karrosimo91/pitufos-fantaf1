"use client";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";
import { DRIVERS_2026 } from "./drivers-data";

/**
 * Hook per leggere le quotazioni piloti vigenti per un dato round.
 *
 * Strategia: per ogni pilota prende la riga driver_prices con round <= R
 * più recente. Se non esiste alcuna riga (DB vuoto), fallback al prezzo
 * iniziale in DRIVERS_2026 (allineato al seed v16).
 *
 * Ritorna una Map<driver_number, price>. Loaded=true quando il fetch è
 * completato (anche con fallback).
 */
export function useDriverPrices(round: number) {
  const [prices, setPrices] = useState<Map<number, number>>(() => {
    // Bootstrap immediato con i prezzi statici (round=0)
    const m = new Map<number, number>();
    for (const d of DRIVERS_2026) m.set(d.number, d.price);
    return m;
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoaded(true);
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setLoaded(true);
      return;
    }

    const abort = new AbortController();
    (async () => {
      try {
        const { data, error } = await supabase
          .from("driver_prices")
          .select("driver_number, round, price")
          .lte("round", round)
          .order("round", { ascending: false })
          .abortSignal(abort.signal);
        if (error) {
          if (error.name !== "AbortError") console.warn("[driver-prices] fetch", error);
          setLoaded(true);
          return;
        }
        // Baseline statica + per ogni pilota usa la riga più recente (data è
        // ordinato desc per round, quindi la prima occorrenza è quella vigente).
        const next = new Map<number, number>();
        for (const d of DRIVERS_2026) next.set(d.number, d.price);
        const seen = new Set<number>();
        for (const r of data ?? []) {
          if (seen.has(r.driver_number)) continue;
          next.set(r.driver_number, r.price);
          seen.add(r.driver_number);
        }
        setPrices(next);
        setLoaded(true);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") console.warn("[driver-prices] fetch", err);
        setLoaded(true);
      }
    })();
    return () => abort.abort();
  }, [round]);

  return { prices, loaded };
}

/**
 * Helper sincrono: dato un driver_number, ritorna il prezzo dalla mappa
 * (o fallback al prezzo statico iniziale).
 */
export function getDriverPrice(prices: Map<number, number>, driverNumber: number): number {
  const p = prices.get(driverNumber);
  if (p != null) return p;
  return DRIVERS_2026.find((d) => d.number === driverNumber)?.price ?? 5;
}

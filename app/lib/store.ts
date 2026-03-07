"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "./supabase";
import { useAuth } from "./auth";
import type { ScuderiaDriver, Previsioni } from "./types";

const BUDGET_INIZIALE = 100;

// ─── Hook: useScuderia (Supabase) ───

export function useScuderia() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<ScuderiaDriver[]>([]);
  const [primoPilota, setPrimoPilotaState] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Carica piloti da Supabase
  useEffect(() => {
    if (!user) {
      setDrivers([]);
      setPrimoPilotaState(null);
      setLoaded(true);
      return;
    }

    const supabase = createClient();
    supabase
      .from("scuderia_drivers")
      .select("*")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          setDrivers(
            data.map((d) => ({
              driver_number: d.driver_number,
              name: d.name,
              team: d.team,
              price: Number(d.price),
              teamColour: d.team_colour,
            }))
          );
          const primo = data.find((d) => d.is_primo_pilota);
          setPrimoPilotaState(primo?.driver_number ?? null);
        }
        setLoaded(true);
      });
  }, [user]);

  const budget = BUDGET_INIZIALE - drivers.reduce((sum, d) => sum + d.price, 0);

  const acquista = useCallback(
    async (driver: ScuderiaDriver): Promise<boolean> => {
      if (!user) return false;
      if (drivers.length >= 5) return false;
      if (drivers.some((d) => d.driver_number === driver.driver_number)) return false;
      if (budget < driver.price) return false;

      const supabase = createClient();
      const { error } = await supabase.from("scuderia_drivers").insert({
        user_id: user.id,
        driver_number: driver.driver_number,
        name: driver.name,
        team: driver.team,
        team_colour: driver.teamColour,
        price: driver.price,
        is_primo_pilota: false,
      });

      if (error) return false;
      setDrivers((prev) => [...prev, driver]);
      return true;
    },
    [user, drivers, budget]
  );

  const vendi = useCallback(
    async (driverNumber: number) => {
      if (!user) return;
      const supabase = createClient();
      await supabase
        .from("scuderia_drivers")
        .delete()
        .eq("user_id", user.id)
        .eq("driver_number", driverNumber);

      setDrivers((prev) => prev.filter((d) => d.driver_number !== driverNumber));
      if (primoPilota === driverNumber) setPrimoPilotaState(null);
    },
    [user, primoPilota]
  );

  const setPrimoPilota = useCallback(
    async (driverNumber: number) => {
      if (!user) return;
      if (!drivers.some((d) => d.driver_number === driverNumber)) return;

      const supabase = createClient();
      // Togli primo pilota da tutti
      await supabase
        .from("scuderia_drivers")
        .update({ is_primo_pilota: false })
        .eq("user_id", user.id);

      // Setta il nuovo
      await supabase
        .from("scuderia_drivers")
        .update({ is_primo_pilota: true })
        .eq("user_id", user.id)
        .eq("driver_number", driverNumber);

      setPrimoPilotaState(driverNumber);
    },
    [user, drivers]
  );

  return { drivers, primoPilota, budget, loaded, acquista, vendi, setPrimoPilota };
}

// ─── Hook: usePrevisioni (Supabase) ───

export function usePrevisioni(round = 1) {
  const { user } = useAuth();
  const [previsioni, setPrevisioniState] = useState<Previsioni>({
    safetyCar: null,
    virtualSafetyCar: null,
    redFlag: null,
    gommeWet: null,
    poleVince: null,
    numeroDnf: null,
  });
  const [chipAttivo, setChipAttivoState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Carica previsioni da Supabase
  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }

    const supabase = createClient();
    supabase
      .from("previsioni")
      .select("*")
      .eq("user_id", user.id)
      .eq("round", round)
      .single()
      .then(({ data }) => {
        if (data) {
          setPrevisioniState({
            safetyCar: data.safety_car,
            virtualSafetyCar: data.virtual_safety_car,
            redFlag: data.red_flag,
            gommeWet: data.gomme_wet,
            poleVince: data.pole_vince,
            numeroDnf: data.numero_dnf,
          });
          setChipAttivoState(data.chip_attivo);
        }
        setLoaded(true);
      });
  }, [user, round]);

  // Salva su Supabase (upsert)
  const saveToDb = useCallback(
    async (prev: Previsioni, chip: string | null) => {
      if (!user) return;
      const supabase = createClient();
      await supabase.from("previsioni").upsert(
        {
          user_id: user.id,
          round,
          safety_car: prev.safetyCar,
          virtual_safety_car: prev.virtualSafetyCar,
          red_flag: prev.redFlag,
          gomme_wet: prev.gommeWet,
          pole_vince: prev.poleVince,
          numero_dnf: prev.numeroDnf,
          chip_attivo: chip,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,round" }
      );
    },
    [user, round]
  );

  const setPrevisione = useCallback(
    (key: keyof Omit<Previsioni, "numeroDnf">, value: boolean | null) => {
      setPrevisioniState((prev) => {
        const next = { ...prev, [key]: value };
        saveToDb(next, chipAttivo);
        return next;
      });
    },
    [saveToDb, chipAttivo]
  );

  const setNumeroDnf = useCallback(
    (value: number | null) => {
      setPrevisioniState((prev) => {
        const next = { ...prev, numeroDnf: value };
        saveToDb(next, chipAttivo);
        return next;
      });
    },
    [saveToDb, chipAttivo]
  );

  const setChipAttivo = useCallback(
    (chip: string | null) => {
      setChipAttivoState(chip);
      saveToDb(previsioni, chip);
    },
    [saveToDb, previsioni]
  );

  const completate =
    Object.entries(previsioni)
      .filter(([k]) => k !== "numeroDnf")
      .filter(([, v]) => v !== null).length + (previsioni.numeroDnf !== null ? 1 : 0);

  return { previsioni, chipAttivo, completate, loaded, setPrevisione, setNumeroDnf, setChipAttivo };
}

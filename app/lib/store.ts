"use client";
import { useState, useEffect, useCallback } from "react";
import type { ScuderiaDriver, Previsioni } from "./types";

const BUDGET_INIZIALE = 100;

// ─── LocalStorage helpers ───

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Hook: useScuderia ───

export function useScuderia() {
  const [drivers, setDrivers] = useState<ScuderiaDriver[]>([]);
  const [primoPilota, setPrimoPilotaState] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDrivers(load("scuderia_drivers", []));
    setPrimoPilotaState(load("scuderia_primo", null));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    save("scuderia_drivers", drivers);
  }, [drivers, loaded]);

  useEffect(() => {
    if (!loaded) return;
    save("scuderia_primo", primoPilota);
  }, [primoPilota, loaded]);

  const budget = BUDGET_INIZIALE - drivers.reduce((sum, d) => sum + d.price, 0);

  const acquista = useCallback(
    (driver: ScuderiaDriver): boolean => {
      if (drivers.length >= 5) return false;
      if (drivers.some((d) => d.driver_number === driver.driver_number)) return false;
      if (budget < driver.price) return false;
      setDrivers((prev) => [...prev, driver]);
      return true;
    },
    [drivers, budget]
  );

  const vendi = useCallback(
    (driverNumber: number) => {
      setDrivers((prev) => prev.filter((d) => d.driver_number !== driverNumber));
      if (primoPilota === driverNumber) setPrimoPilotaState(null);
    },
    [primoPilota]
  );

  const setPrimoPilota = useCallback(
    (driverNumber: number) => {
      if (drivers.some((d) => d.driver_number === driverNumber)) {
        setPrimoPilotaState(driverNumber);
      }
    },
    [drivers]
  );

  return { drivers, primoPilota, budget, loaded, acquista, vendi, setPrimoPilota };
}

// ─── Hook: usePrevisioni ───

export function usePrevisioni() {
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

  useEffect(() => {
    setPrevisioniState(
      load("previsioni", {
        safetyCar: null,
        virtualSafetyCar: null,
        redFlag: null,
        gommeWet: null,
        poleVince: null,
        numeroDnf: null,
      })
    );
    setChipAttivoState(load("previsioni_chip", null));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    save("previsioni", previsioni);
  }, [previsioni, loaded]);

  useEffect(() => {
    if (!loaded) return;
    save("previsioni_chip", chipAttivo);
  }, [chipAttivo, loaded]);

  const setPrevisione = useCallback((key: keyof Omit<Previsioni, "numeroDnf">, value: boolean | null) => {
    setPrevisioniState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setNumeroDnf = useCallback((value: number | null) => {
    setPrevisioniState((prev) => ({ ...prev, numeroDnf: value }));
  }, []);

  const setChipAttivo = useCallback((chip: string | null) => {
    setChipAttivoState(chip);
  }, []);

  const completate =
    Object.entries(previsioni)
      .filter(([k]) => k !== "numeroDnf")
      .filter(([, v]) => v !== null).length + (previsioni.numeroDnf !== null ? 1 : 0);

  return { previsioni, chipAttivo, completate, loaded, setPrevisione, setNumeroDnf, setChipAttivo };
}

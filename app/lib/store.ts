"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import { getDriverByNumber } from "./drivers-data";
import type { Previsioni } from "./types";

const BUDGET_INIZIALE = 100;

// ═══════════════════════════════════════════
// Hook: useScuderia — Rosa attuale (mercato)
// Tabella: scuderia_drivers (user_id, driver_number)
// Prezzo/nome/team vengono da drivers-data.ts
// ═══════════════════════════════════════════

export interface OwnedDriver {
  driver_number: number;
  name: string;
  team: string;
  teamColour: string;
  price: number;
}

function driverNumberToOwned(num: number): OwnedDriver | null {
  const d = getDriverByNumber(num);
  if (!d) return null;
  return {
    driver_number: d.number,
    name: d.name,
    team: d.team,
    teamColour: d.teamColour,
    price: d.price,
  };
}

export function useScuderia() {
  const { user } = useAuth();
  const [driverNumbers, setDriverNumbers] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setDriverNumbers([]);
      setLoaded(true);
      return;
    }

    const supabase = createClient()!;
    supabase
      .from("scuderia_drivers")
      .select("driver_number")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error) console.error("[scuderia] load error:", error);
        if (data) setDriverNumbers(data.map((d) => d.driver_number));
        setLoaded(true);
      });
  }, [user]);

  const drivers: OwnedDriver[] = driverNumbers
    .map(driverNumberToOwned)
    .filter((d): d is OwnedDriver => d !== null);

  const budget = BUDGET_INIZIALE - drivers.reduce((sum, d) => sum + d.price, 0);

  const acquista = useCallback(
    async (driverNumber: number): Promise<boolean> => {
      if (!user || !isSupabaseConfigured) return false;

      const supabase = createClient()!;
      // Verifica stato attuale dal DB
      const { data: current, error: loadErr } = await supabase
        .from("scuderia_drivers")
        .select("driver_number")
        .eq("user_id", user.id);

      if (loadErr) {
        console.error("[scuderia] acquista load error:", loadErr);
        return false;
      }

      const list = current || [];
      if (list.length >= 5) return false;
      if (list.some((d) => d.driver_number === driverNumber)) return false;

      const driverData = getDriverByNumber(driverNumber);
      if (!driverData) return false;

      const currentBudget = BUDGET_INIZIALE - list.reduce((sum, d) => {
        const dd = getDriverByNumber(d.driver_number);
        return sum + (dd?.price ?? 0);
      }, 0);
      if (currentBudget < driverData.price) return false;

      const { error } = await supabase.from("scuderia_drivers").insert({
        user_id: user.id,
        driver_number: driverNumber,
      });

      if (error) {
        console.error("[scuderia] acquista error:", error);
        return false;
      }
      setDriverNumbers((prev) => [...prev, driverNumber]);
      return true;
    },
    [user]
  );

  const vendi = useCallback(
    async (driverNumber: number) => {
      if (!user || !isSupabaseConfigured) return;
      const supabase = createClient()!;
      const { error } = await supabase
        .from("scuderia_drivers")
        .delete()
        .eq("user_id", user.id)
        .eq("driver_number", driverNumber);

      if (error) {
        console.error("[scuderia] vendi error:", error);
        return;
      }
      setDriverNumbers((prev) => prev.filter((n) => n !== driverNumber));
    },
    [user]
  );

  return { drivers, driverNumbers, budget, loaded, acquista, vendi };
}

// ═══════════════════════════════════════════
// Hook: useFormazione — Formazione per round
// Tabella: formazioni (user_id, round)
//
// Lo stato (primo pilota, chip, sesto uomo) è LOCALE.
// Va in DB solo quando l'utente clicca "Conferma".
// Al load, se esiste una riga in DB, la ripristina.
// ═══════════════════════════════════════════

export interface FormazioneState {
  driverNumbers: number[];
  primoPilota: number | null;
  sestoUomo: number | null;
  chipPiloti: string | null;
  chipPilotiTarget: number | null;
  confirmed: boolean;
}

export function useFormazione(round: number) {
  const { user } = useAuth();
  const [state, setState] = useState<FormazioneState>({
    driverNumbers: [],
    primoPilota: null,
    sestoUomo: null,
    chipPiloti: null,
    chipPilotiTarget: null,
    confirmed: false,
  });
  const [loaded, setLoaded] = useState(false);

  // Carica da DB (se esiste una riga per questo round)
  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setLoaded(true);
      return;
    }

    const supabase = createClient()!;
    supabase
      .from("formazioni")
      .select("*")
      .eq("user_id", user.id)
      .eq("round", round)
      .single()
      .then(({ data, error }) => {
        if (error && error.code !== "PGRST116") {
          console.error("[formazione] load error:", error);
        }
        if (data) {
          console.log("[formazione] loaded from DB:", data);
          setState({
            driverNumbers: (data.driver_numbers || []).map(Number),
            primoPilota: data.primo_pilota,
            sestoUomo: data.sesto_uomo,
            chipPiloti: data.chip_piloti,
            chipPilotiTarget: data.chip_piloti_target,
            confirmed: !!data.confirmed,
          });
        }
        setLoaded(true);
      });
  }, [user, round]);

  // Setters locali (non salvano in DB)
  const setPrimoPilota = useCallback((driverNumber: number) => {
    setState((prev) => ({ ...prev, primoPilota: driverNumber, confirmed: false }));
  }, []);

  const setSestoUomo = useCallback((driverNumber: number | null) => {
    setState((prev) => ({ ...prev, sestoUomo: driverNumber, confirmed: false }));
  }, []);

  const setChipPiloti = useCallback((chip: string | null) => {
    setState((prev) => ({
      ...prev,
      chipPiloti: chip,
      chipPilotiTarget: null,
      sestoUomo: chip !== "sesto" ? null : prev.sestoUomo,
      confirmed: false,
    }));
  }, []);

  const setChipPilotiTarget = useCallback((target: number | null) => {
    setState((prev) => ({ ...prev, chipPilotiTarget: target, confirmed: false }));
  }, []);

  // Conferma: salva TUTTO in DB (driver_numbers dalla scuderia + stato locale)
  const conferma = useCallback(
    async (currentDriverNumbers: number[]): Promise<boolean> => {
      if (!user || !isSupabaseConfigured) return false;
      if (currentDriverNumbers.length !== 5) return false;

      // Leggi lo stato corrente (non dal ref, dal parametro + closure)
      // setState è asincrono, quindi usiamo una Promise per leggere lo stato attuale
      return new Promise((resolve) => {
        setState((current) => {
          if (!current.primoPilota) {
            resolve(false);
            return current;
          }

          const payload = {
            user_id: user!.id,
            round,
            driver_numbers: currentDriverNumbers,
            primo_pilota: current.primoPilota,
            sesto_uomo: current.sestoUomo,
            chip_piloti: current.chipPiloti,
            chip_piloti_target: current.chipPilotiTarget,
            confirmed: true,
            updated_at: new Date().toISOString(),
          };

          console.log("[formazione] confirming:", payload);

          const supabase = createClient()!;
          supabase
            .from("formazioni")
            .upsert(payload, { onConflict: "user_id,round" })
            .then(({ error }) => {
              if (error) {
                console.error("[formazione] confirm error:", error);
                resolve(false);
              } else {
                console.log("[formazione] confirmed OK");
                setState((prev) => ({ ...prev, driverNumbers: currentDriverNumbers, confirmed: true }));
                resolve(true);
              }
            });

          return current; // Non modificare lo stato qui
        });
      });
    },
    [user, round]
  );

  return {
    ...state,
    loaded,
    setPrimoPilota,
    setSestoUomo,
    setChipPiloti,
    setChipPilotiTarget,
    conferma,
  };
}

// ═══════════════════════════════════════════
// Hook: usePrevisioni — Previsioni per round
// Tabella: previsioni (user_id, round)
// ═══════════════════════════════════════════

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
  const [chipTarget, setChipTargetState] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const previsioniRef = useRef(previsioni);
  previsioniRef.current = previsioni;
  const chipRef = useRef(chipAttivo);
  chipRef.current = chipAttivo;
  const chipTargetRef = useRef(chipTarget);
  chipTargetRef.current = chipTarget;

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setLoaded(true);
      return;
    }

    const supabase = createClient()!;
    supabase
      .from("previsioni")
      .select("*")
      .eq("user_id", user.id)
      .eq("round", round)
      .single()
      .then(({ data, error }) => {
        if (error && error.code !== "PGRST116") {
          console.error("[previsioni] load error:", error);
        }
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
          setChipTargetState(data.chip_target ?? null);
          setConfirmed(!!data.confirmed);
        }
        setLoaded(true);
      });
  }, [user, round]);

  const saveToDb = useCallback(
    async (nextPrev: Previsioni, nextChip: string | null, nextChipTarget: string | null) => {
      if (!user || !isSupabaseConfigured) return;

      const supabase = createClient()!;
      const payload = {
        user_id: user.id,
        round,
        safety_car: nextPrev.safetyCar,
        virtual_safety_car: nextPrev.virtualSafetyCar,
        red_flag: nextPrev.redFlag,
        gomme_wet: nextPrev.gommeWet,
        pole_vince: nextPrev.poleVince,
        numero_dnf: nextPrev.numeroDnf,
        chip_attivo: nextChip,
        chip_target: nextChipTarget,
        confirmed: false,
        updated_at: new Date().toISOString(),
      };

      console.log("[previsioni] saving:", payload);
      const { error } = await supabase
        .from("previsioni")
        .upsert(payload, { onConflict: "user_id,round" });

      if (error) console.error("[previsioni] save error:", error);
      else console.log("[previsioni] saved OK");
    },
    [user, round]
  );

  const setPrevisione = useCallback(
    (key: keyof Omit<Previsioni, "numeroDnf">, value: boolean | null) => {
      const next = { ...previsioniRef.current, [key]: value };
      setPrevisioniState(next);
      setConfirmed(false);
      saveToDb(next, chipRef.current, chipTargetRef.current);
    },
    [saveToDb]
  );

  const setNumeroDnf = useCallback(
    (value: number | null) => {
      const next = { ...previsioniRef.current, numeroDnf: value };
      setPrevisioniState(next);
      setConfirmed(false);
      saveToDb(next, chipRef.current, chipTargetRef.current);
    },
    [saveToDb]
  );

  const setChipAttivo = useCallback(
    (chip: string | null) => {
      setChipAttivoState(chip);
      setConfirmed(false);
      // Se si deseleziona il chip, resetta anche il target
      const target = chip ? chipTargetRef.current : null;
      setChipTargetState(target);
      saveToDb(previsioniRef.current, chip, target);
    },
    [saveToDb]
  );

  const setChipTarget = useCallback(
    (target: string | null) => {
      setChipTargetState(target);
      setConfirmed(false);
      saveToDb(previsioniRef.current, chipRef.current, target);
    },
    [saveToDb]
  );

  const confermaPrevisioni = useCallback(async (): Promise<boolean> => {
    if (!user || !isSupabaseConfigured) return false;

    const p = previsioniRef.current;
    const completate =
      Object.entries(p)
        .filter(([k]) => k !== "numeroDnf")
        .filter(([, v]) => v !== null).length + (p.numeroDnf !== null ? 1 : 0);

    if (completate < 6) return false;

    const supabase = createClient()!;
    const payload = {
      user_id: user.id,
      round,
      safety_car: p.safetyCar,
      virtual_safety_car: p.virtualSafetyCar,
      red_flag: p.redFlag,
      gomme_wet: p.gommeWet,
      pole_vince: p.poleVince,
      numero_dnf: p.numeroDnf,
      chip_attivo: chipRef.current,
      chip_target: chipTargetRef.current,
      confirmed: true,
      updated_at: new Date().toISOString(),
    };

    console.log("[previsioni] confirming:", payload);
    const { error } = await supabase
      .from("previsioni")
      .upsert(payload, { onConflict: "user_id,round" });

    if (error) {
      console.error("[previsioni] confirm error:", error);
      return false;
    }

    console.log("[previsioni] confirmed OK");
    setConfirmed(true);
    return true;
  }, [user, round]);

  const completate =
    Object.entries(previsioni)
      .filter(([k]) => k !== "numeroDnf")
      .filter(([, v]) => v !== null).length + (previsioni.numeroDnf !== null ? 1 : 0);

  return {
    previsioni, chipAttivo, chipTarget, completate, confirmed, loaded,
    setPrevisione, setNumeroDnf, setChipAttivo, setChipTarget, confermaPrevisioni,
  };
}

// ═══════════════════════════════════════════
// Hook: useAggiornamenti — Chip usati nella stagione
// Legge da formazioni + previsioni
// ═══════════════════════════════════════════

const PAUSA_ESTIVA_ROUND = 14; // Round 14+ = dopo la pausa estiva

export interface ChipUsage {
  id: string;
  label: string;
  usedPrePausa: number | null;  // round in cui è stato usato (null = non usato)
  usedPostPausa: number | null;
  availablePrePausa: boolean;
  availablePostPausa: boolean;
}

export function useAggiornamenti() {
  const { user } = useAuth();
  const [chipPilotiUsed, setChipPilotiUsed] = useState<{ chip: string; round: number }[]>([]);
  const [chipPrevisioniUsed, setChipPrevisioniUsed] = useState<{ chip: string; round: number }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setLoaded(true);
      return;
    }

    const supabase = createClient()!;

    Promise.all([
      supabase
        .from("formazioni")
        .select("round, chip_piloti")
        .eq("user_id", user.id)
        .eq("confirmed", true)
        .not("chip_piloti", "is", null),
      supabase
        .from("previsioni")
        .select("round, chip_attivo")
        .eq("user_id", user.id)
        .eq("confirmed", true)
        .not("chip_attivo", "is", null),
    ]).then(([formRes, prevRes]) => {
      if (formRes.error) console.error("[aggiornamenti] load formazioni error:", formRes.error);
      if (prevRes.error) console.error("[aggiornamenti] load previsioni error:", prevRes.error);

      setChipPilotiUsed(
        (formRes.data || []).map((r) => ({ chip: r.chip_piloti!, round: r.round }))
      );
      setChipPrevisioniUsed(
        (prevRes.data || []).map((r) => ({ chip: r.chip_attivo!, round: r.round }))
      );
      setLoaded(true);
    });
  }, [user]);

  function getChipStatus(chipId: string, source: { chip: string; round: number }[]): ChipUsage {
    const labels: Record<string, string> = {
      boost: "Boost Mode", halo: "Halo", sostituzione: "Sost. Griglia", sesto: "Sesto Uomo",
      sicura: "Prev. Sicura", doppia: "Prev. Doppia", tardiva: "Prev. Tardiva",
    };
    const uses = source.filter((u) => u.chip === chipId);
    const pre = uses.find((u) => u.round < PAUSA_ESTIVA_ROUND);
    const post = uses.find((u) => u.round >= PAUSA_ESTIVA_ROUND);
    return {
      id: chipId,
      label: labels[chipId] || chipId,
      usedPrePausa: pre?.round ?? null,
      usedPostPausa: post?.round ?? null,
      availablePrePausa: !pre,
      availablePostPausa: !post,
    };
  }

  const pilotiChips = ["boost", "halo", "sostituzione", "sesto"].map((id) =>
    getChipStatus(id, chipPilotiUsed)
  );

  const previsioniChips = ["sicura", "doppia", "tardiva"].map((id) =>
    getChipStatus(id, chipPrevisioniUsed)
  );

  return { pilotiChips, previsioniChips, loaded };
}

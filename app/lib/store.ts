"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import { getDriverByNumber } from "./drivers-data";
import type { Previsioni, Lega } from "./types";

const BUDGET_INIZIALE = 100;

// ═══════════════════════════════════════════
// Tipi condivisi
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

const CAMBI_GRATIS = 2;
const PENALITA_CAMBIO_EXTRA = 10;

// ═══════════════════════════════════════════
// Hook: useSquadra — Unica fonte di verita'
// Tabella: formazioni (user_id, round)
//
// La rosa, il primo pilota, i chip, tutto vive in formazioni.
// Al primo accesso di un round, copia i piloti dal round precedente.
// Prima della deadline: modifichi tutto liberamente.
// Dopo deadline: bloccato.
// ═══════════════════════════════════════════

export interface SquadraState {
  driverNumbers: number[];
  primoPilota: number | null;
  sestoUomo: number | null;
  chipPiloti: string | null;
  chipPilotiTarget: number | null;
  confirmed: boolean;
}

export function useSquadra(round: number) {
  const { user } = useAuth();
  const [state, setState] = useState<SquadraState>({
    driverNumbers: [],
    primoPilota: null,
    sestoUomo: null,
    chipPiloti: null,
    chipPilotiTarget: null,
    confirmed: false,
  });
  const [rosaBase, setRosaBase] = useState<number[]>([]);
  const [cambiRound, setCambiRound] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Carica formazione del round (o copia dal precedente)
  useEffect(() => {
    // Reset stato al cambio round per evitare dati stale
    setLoaded(false);
    setCambiRound(0);
    setState({ driverNumbers: [], primoPilota: null, sestoUomo: null, chipPiloti: null, chipPilotiTarget: null, confirmed: false });
    setRosaBase([]);

    if (!user || !isSupabaseConfigured) {
      setLoaded(true);
      return;
    }

    const supabase = createClient()!;

    (async () => {
      // 1. Cerca formazione di questo round
      const { data, error } = await supabase
        .from("formazioni")
        .select("*")
        .eq("user_id", user.id)
        .eq("round", round)
        .single();

      if (data) {
        // Formazione esiste per questo round
        setState({
          driverNumbers: (data.driver_numbers || []).map(Number),
          primoPilota: data.primo_pilota,
          sestoUomo: data.sesto_uomo,
          chipPiloti: data.chip_piloti,
          chipPilotiTarget: data.chip_piloti_target,
          confirmed: !!data.confirmed,
        });

        // La rosa base è SEMPRE l'ultima confermata di un round PRECEDENTE.
        // Se non esiste (primo round in assoluto), rosaBase = [] → nessuna penalità.
        // Questo garantisce che la prima formazione sia sempre modificabile liberamente.
        const { data: prev } = await supabase
          .from("formazioni")
          .select("driver_numbers")
          .eq("user_id", user.id)
          .eq("confirmed", true)
          .lt("round", round)
          .order("round", { ascending: false })
          .limit(1)
          .single();
        setRosaBase(prev?.driver_numbers ? (prev.driver_numbers as number[]).map(Number) : []);
      } else if (!error || error.code === "PGRST116") {
        // Nessuna formazione per questo round: copia dal round precedente
        const { data: prev } = await supabase
          .from("formazioni")
          .select("driver_numbers")
          .eq("user_id", user.id)
          .eq("confirmed", true)
          .order("round", { ascending: false })
          .limit(1)
          .single();

        if (prev?.driver_numbers) {
          const prevDrivers = (prev.driver_numbers as number[]).map(Number);
          setState((s) => ({ ...s, driverNumbers: prevDrivers }));
          setRosaBase(prevDrivers);

          // Crea la riga in DB per questo round (non confermata)
          await supabase.from("formazioni").upsert({
            user_id: user.id,
            round,
            driver_numbers: prevDrivers,
            confirmed: false,
          }, { onConflict: "user_id,round" });
        }
      }

      // Carica conteggio cambi
      const { data: cambiData } = await supabase
        .from("mercato_cambi")
        .select("id")
        .eq("user_id", user.id)
        .eq("round", round);
      setCambiRound((cambiData || []).length);

      setLoaded(true);
    })();
  }, [user, round]);

  const drivers: OwnedDriver[] = state.driverNumbers
    .map(driverNumberToOwned)
    .filter((d): d is OwnedDriver => d !== null);

  const budget = BUDGET_INIZIALE - drivers.reduce((sum, d) => sum + d.price, 0);

  const cambiGratisRimasti = Math.max(0, CAMBI_GRATIS - cambiRound);
  const hasWildcard = state.chipPiloti === "wildcard";
  const penalitaProssimoCambio = hasWildcard ? 0 : (cambiRound >= CAMBI_GRATIS ? PENALITA_CAMBIO_EXTRA : 0);
  const penalitaTotale = hasWildcard ? 0 : Math.max(0, cambiRound - CAMBI_GRATIS) * PENALITA_CAMBIO_EXTRA;

  // Salva driver_numbers in DB (auto-save)
  const saveDrivers = useCallback(
    async (newDrivers: number[]) => {
      if (!user || !isSupabaseConfigured) return;
      const supabase = createClient()!;
      await supabase.from("formazioni").upsert({
        user_id: user.id,
        round,
        driver_numbers: newDrivers,
        confirmed: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,round" });
    },
    [user, round]
  );

  const acquista = useCallback(
    async (driverNumber: number): Promise<{ ok: boolean; error?: string }> => {
      if (!user || !isSupabaseConfigured) return { ok: false, error: "Non loggato" };

      const current = state.driverNumbers;
      if (current.length >= 5) return { ok: false, error: "Squadra piena (5/5)" };
      if (current.includes(driverNumber)) return { ok: false, error: "Pilota gia' in squadra" };

      const driverData = getDriverByNumber(driverNumber);
      if (!driverData) return { ok: false, error: "Pilota non trovato" };

      const currentBudget = BUDGET_INIZIALE - current.reduce((sum, n) => {
        const dd = getDriverByNumber(n);
        return sum + (dd?.price ?? 0);
      }, 0);
      if (currentBudget < driverData.price) return { ok: false, error: "Budget insufficiente" };

      const newDrivers = [...current, driverNumber];

      // Conta come cambio se il pilota NON era nella rosa base
      // (wildcard annulla la penalita' solo al calcolo post-gara, i cambi si registrano sempre)
      if (rosaBase.length > 0 && !rosaBase.includes(driverNumber)) {
        const supabase = createClient()!;
        const venduti = rosaBase.filter((n) => !current.includes(n));
        const driverOut = venduti[0] ?? 0;
        await supabase.from("mercato_cambi").insert({
          user_id: user.id, round, driver_in: driverNumber, driver_out: driverOut,
        });
        setCambiRound((prev) => prev + 1);
      }

      setState((prev) => ({ ...prev, driverNumbers: newDrivers, confirmed: false }));
      await saveDrivers(newDrivers);
      return { ok: true };
    },
    [user, state.driverNumbers, rosaBase, round, saveDrivers]
  );

  const vendi = useCallback(
    async (driverNumber: number): Promise<boolean> => {
      if (!user || !isSupabaseConfigured) return false;
      const newDrivers = state.driverNumbers.filter((n) => n !== driverNumber);
      setState((prev) => ({
        ...prev,
        driverNumbers: newDrivers,
        primoPilota: prev.primoPilota === driverNumber ? null : prev.primoPilota,
        confirmed: false,
      }));
      await saveDrivers(newDrivers);
      return true;
    },
    [user, state.driverNumbers, saveDrivers]
  );

  // Setters locali
  const setPrimoPilota = useCallback((driverNumber: number) => {
    setState((prev) => ({ ...prev, primoPilota: driverNumber, confirmed: false }));
  }, []);

  const setSestoUomo = useCallback((driverNumber: number | null) => {
    setState((prev) => ({ ...prev, sestoUomo: driverNumber, confirmed: false }));
  }, []);

  const setChipPiloti = useCallback((chip: string | null) => {
    setState((prev) => ({
      ...prev, chipPiloti: chip, chipPilotiTarget: null,
      sestoUomo: chip !== "sesto" ? null : prev.sestoUomo, confirmed: false,
    }));
  }, []);

  const setChipPilotiTarget = useCallback((target: number | null) => {
    setState((prev) => ({ ...prev, chipPilotiTarget: target, confirmed: false }));
  }, []);

  // Conferma: salva tutto in DB
  const conferma = useCallback(
    async (): Promise<boolean> => {
      if (!user || !isSupabaseConfigured) return false;

      return new Promise((resolve) => {
        setState((current) => {
          if (current.driverNumbers.length !== 5) { resolve(false); return current; }
          if (!current.primoPilota) { resolve(false); return current; }

          const payload = {
            user_id: user!.id,
            round,
            driver_numbers: current.driverNumbers,
            primo_pilota: current.primoPilota,
            sesto_uomo: current.sestoUomo,
            chip_piloti: current.chipPiloti,
            chip_piloti_target: current.chipPilotiTarget,
            confirmed: true,
            updated_at: new Date().toISOString(),
          };

          const supabase = createClient()!;
          supabase
            .from("formazioni")
            .upsert(payload, { onConflict: "user_id,round" })
            .then(({ error }) => {
              if (error) {
                console.error("[squadra] confirm error:", error);
                resolve(false);
              } else {
                setState((prev) => ({ ...prev, confirmed: true }));
                resolve(true);
              }
            });

          return current;
        });
      });
    },
    [user, round]
  );

  return {
    ...state,
    drivers, budget, loaded,
    acquista, vendi,
    setPrimoPilota, setSestoUomo, setChipPiloti, setChipPilotiTarget,
    conferma,
    cambiRound, cambiGratisRimasti, penalitaProssimoCambio, penalitaTotale,
    CAMBI_GRATIS, PENALITA_CAMBIO_EXTRA,
  };
}

// Alias retrocompatibili
export const useScuderia = () => { throw new Error("useScuderia rimosso: usa useSquadra"); };
export const useFormazione = (_round: number) => { throw new Error("useFormazione rimosso: usa useSquadra"); };

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
      boost: "Boost Mode", halo: "Halo", sesto: "Sesto Uomo", wildcard: "Wildcard",
      sicura: "Prev. Sicura", doppia: "Prev. Doppia",
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

  const pilotiChips = ["boost", "halo", "sesto", "wildcard"].map((id) =>
    getChipStatus(id, chipPilotiUsed)
  );

  const previsioniChips = ["sicura", "doppia"].map((id) =>
    getChipStatus(id, chipPrevisioniUsed)
  );

  return { pilotiChips, previsioniChips, loaded };
}

// ═══════════════════════════════════════════
// Hook: useLeghe — Le leghe dell'utente
// ═══════════════════════════════════════════

const LEGA_GENERALE_ID = "00000000-0000-0000-0000-000000000001";

export function useLeghe() {
  const { user } = useAuth();
  const [leghe, setLeghe] = useState<Lega[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setLoaded(true);
      return;
    }
    const supabase = createClient()!;

    // Leghe a cui l'utente appartiene
    const { data: membership } = await supabase
      .from("lega_members")
      .select("lega_id")
      .eq("user_id", user.id);

    if (!membership || membership.length === 0) {
      setLeghe([]);
      setLoaded(true);
      return;
    }

    const legaIds = membership.map((m) => m.lega_id);
    const { data: legheData } = await supabase
      .from("leghe")
      .select("*")
      .in("id", legaIds)
      .order("is_generale", { ascending: false })
      .order("created_at", { ascending: true });

    // Conta membri per ogni lega
    const legheWithCount: Lega[] = [];
    for (const l of legheData || []) {
      const { count } = await supabase
        .from("lega_members")
        .select("*", { count: "exact", head: true })
        .eq("lega_id", l.id);

      legheWithCount.push({ ...l, member_count: count ?? 0 });
    }

    setLeghe(legheWithCount);
    setLoaded(true);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const creaLega = useCallback(
    async (name: string, roundStart: number, roundEnd: number, isPublic: boolean): Promise<Lega | null> => {
      if (!user || !isSupabaseConfigured) return null;
      const supabase = createClient()!;

      const inviteCode = isPublic ? null : Math.random().toString(36).substring(2, 8).toUpperCase();

      const legaId = crypto.randomUUID();

      const { error } = await supabase
        .from("leghe")
        .insert({
          id: legaId,
          name,
          creator_id: user.id,
          round_start: roundStart,
          round_end: roundEnd,
          is_public: isPublic,
          invite_code: inviteCode,
        });

      if (error) {
        console.error("[leghe] create error:", error);
        return null;
      }

      // Auto-join il creatore
      const { error: joinErr } = await supabase.from("lega_members").insert({
        lega_id: legaId,
        user_id: user.id,
      });

      if (joinErr) {
        console.error("[leghe] auto-join error:", joinErr);
      }

      await load();

      // Ritorna la lega creata
      return {
        id: legaId,
        name,
        creator_id: user.id,
        round_start: roundStart,
        round_end: roundEnd,
        is_public: isPublic,
        invite_code: inviteCode,
        is_generale: false,
        created_at: new Date().toISOString(),
      } as Lega;
    },
    [user, load]
  );

  const uniscitiConCodice = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user || !isSupabaseConfigured) return { ok: false, error: "Non loggato" };
      const supabase = createClient()!;

      // Cerca la lega per codice
      const { data: lega, error: findErr } = await supabase
        .from("leghe")
        .select("*")
        .eq("invite_code", code.toUpperCase().trim())
        .single();

      if (findErr || !lega) return { ok: false, error: "Codice non valido" };

      // Controlla se gia' membro
      const { data: existing } = await supabase
        .from("lega_members")
        .select("*")
        .eq("lega_id", lega.id)
        .eq("user_id", user.id)
        .single();

      if (existing) return { ok: false, error: "Sei gia' in questa lega" };

      // Unisciti
      const { error: joinErr } = await supabase.from("lega_members").insert({
        lega_id: lega.id,
        user_id: user.id,
      });

      if (joinErr) return { ok: false, error: "Errore: " + joinErr.message };

      await load();
      return { ok: true };
    },
    [user, load]
  );

  const uniscitiPubblica = useCallback(
    async (legaId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user || !isSupabaseConfigured) return { ok: false, error: "Non loggato" };
      const supabase = createClient()!;

      const { data: existing } = await supabase
        .from("lega_members")
        .select("*")
        .eq("lega_id", legaId)
        .eq("user_id", user.id)
        .single();

      if (existing) return { ok: false, error: "Sei gia' in questa lega" };

      const { error } = await supabase.from("lega_members").insert({
        lega_id: legaId,
        user_id: user.id,
      });

      if (error) return { ok: false, error: error.message };

      await load();
      return { ok: true };
    },
    [user, load]
  );

  return { leghe, loaded, creaLega, uniscitiConCodice, uniscitiPubblica, LEGA_GENERALE_ID, reload: load };
}

// ═══════════════════════════════════════════
// Hook: useClassificaLega — Classifica filtrata per lega
// Usa la RPC function classifica_lega
// ═══════════════════════════════════════════

export interface ClassificaLegaEntry {
  user_id: string;
  team_principal_name: string;
  scuderia_name: string;
  total_points: number;
  piloti_points: number;
  previsioni_points: number;
  last_weekend_points: number;
}

export function useClassificaLega(legaId: string | null, round: number | null = null) {
  const [classifica, setClassifica] = useState<ClassificaLegaEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!legaId || !isSupabaseConfigured) {
      setClassifica([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = createClient()!;
    const params: Record<string, unknown> = { p_lega_id: legaId };
    if (round !== null) params.p_round = round;

    supabase
      .rpc("classifica_lega", params)
      .then(({ data, error }) => {
        if (error) {
          console.error("[classifica_lega] error:", error);
          setClassifica([]);
        } else {
          setClassifica(data || []);
        }
        setLoading(false);
      });
  }, [legaId, round]);

  return { classifica, loading };
}

// ═══════════════════════════════════════════
// Hook: useDashboardStats — Stats personali per dashboard
// Legge da classifica_totale + weekend_scores
// ═══════════════════════════════════════════

export interface DashboardStats {
  totalPoints: number;
  position: number | null;
  totalPlayers: number;
  gareGiocate: number;
  mediaPunti: number | null;
  lastWeekendPoints: number;
  loaded: boolean;
}

export function useDashboardStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalPoints: 0, position: null, totalPlayers: 0,
    gareGiocate: 0, mediaPunti: null, lastWeekendPoints: 0, loaded: false,
  });

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setStats((s) => ({ ...s, loaded: true }));
      return;
    }

    const supabase = createClient()!;

    Promise.all([
      // Classifica Lega Generale (fonte unica di verita')
      supabase.rpc("classifica_lega", { p_lega_id: LEGA_GENERALE_ID }),
      // Weekend scores dell'utente (per contare gare giocate)
      supabase
        .from("weekend_scores")
        .select("round")
        .eq("user_id", user.id),
    ]).then(([classificaRes, scoresRes]) => {
      const classifica = (classificaRes.data || []) as ClassificaLegaEntry[];
      const gare = (scoresRes.data || []).length;

      const posIndex = classifica.findIndex((e) => e.user_id === user.id);
      const myEntry = posIndex >= 0 ? classifica[posIndex] : null;
      const total = myEntry?.total_points ?? 0;

      setStats({
        totalPoints: total,
        position: posIndex >= 0 ? posIndex + 1 : null,
        totalPlayers: classifica.length,
        gareGiocate: gare,
        mediaPunti: gare > 0 ? Math.round((total / gare) * 10) / 10 : null,
        lastWeekendPoints: myEntry?.last_weekend_points ?? 0,
        loaded: true,
      });
    });
  }, [user]);

  return stats;
}

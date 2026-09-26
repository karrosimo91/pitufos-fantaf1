"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import { getDriverByNumber } from "./drivers-data";
import { useDriverPrices, getDriverPrice } from "./use-driver-prices";
import type { Previsioni, Lega } from "./types";

const BUDGET_INIZIALE = 100;

// ═══════════════════════════════════════════
// Chip / Aggiornamenti — limite per metà stagione
//
// Regolamento: ogni chip ha 2 utilizzi, 1 prima della pausa estiva e
// 1 dopo. Round < PAUSA_ESTIVA_ROUND = prima pausa, >= = dopo.
// ═══════════════════════════════════════════

export const PAUSA_ESTIVA_ROUND = 14; // Round 14+ = dopo la pausa estiva

// True se i due round cadono nella stessa metà di stagione (entrambi
// pre-pausa o entrambi post-pausa).
export function isSameHalf(a: number, b: number): boolean {
  return (a < PAUSA_ESTIVA_ROUND) === (b < PAUSA_ESTIVA_ROUND);
}

// Da una lista di utilizzi confermati { chip, round } in ALTRI round,
// costruisce la mappa chipId → round in cui è già stato usato nella stessa
// metà stagione del round corrente. Un chip presente nella mappa non è più
// disponibile per quel round.
function buildChipUnavailable(
  used: { chip: string; round: number }[],
  round: number
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const u of used) {
    if (isSameHalf(u.round, round)) m[u.chip] = u.round;
  }
  return m;
}

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

function driverNumberToOwned(num: number, priceOverride?: Map<number, number>): OwnedDriver | null {
  const d = getDriverByNumber(num);
  if (!d) return null;
  return {
    driver_number: d.number,
    name: d.name,
    team: d.team,
    teamColour: d.teamColour,
    price: priceOverride?.get(num) ?? d.price,
  };
}

const CAMBI_GRATIS = 2;
const PENALITA_CAMBIO_EXTRA = 10;

// Cassa iniziale di una rosa: 100 − somma delle quotazioni INIZIALI dei piloti.
// Usata solo come bootstrap quando formazioni.cassa è NULL (rose pre-v17):
// finora i prezzi non erano variati, quindi la quotazione iniziale è quanto
// il giocatore ha effettivamente pagato.
function initialCassa(driverNumbers: number[]): number {
  return BUDGET_INIZIALE - driverNumbers.reduce((sum, n) => {
    const d = getDriverByNumber(n);
    return sum + (d?.price ?? 0);
  }, 0);
}

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
  const [cassa, setCassa] = useState<number>(BUDGET_INIZIALE);
  const [loaded, setLoaded] = useState(false);
  // Chip piloti già confermati in ALTRI round (per limite metà stagione)
  const [chipPilotiUsedOther, setChipPilotiUsedOther] = useState<{ chip: string; round: number }[]>([]);
  // Ultima formazione confermata di un round precedente: round e Primo
  // Pilota. Serve per proporre il capitano "come a Baku" nel nuovo round.
  const [prevInfo, setPrevInfo] = useState<{ round: number; primoPilota: number | null } | null>(null);
  // Guardia contro il doppio tap: un'operazione di mercato alla volta.
  const busyRef = useRef(false);

  // Carica formazione del round (o copia dal precedente)
  useEffect(() => {
    // Reset stato al cambio round per evitare dati stale
    setLoaded(false);
    setCambiRound(0);
    setCassa(BUDGET_INIZIALE);
    setState({ driverNumbers: [], primoPilota: null, sestoUomo: null, chipPiloti: null, chipPilotiTarget: null, confirmed: false });
    setRosaBase([]);
    setChipPilotiUsedOther([]);
    setPrevInfo(null);

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
        const driverNumbers = (data.driver_numbers || []).map(Number);
        setState({
          driverNumbers,
          primoPilota: data.primo_pilota,
          sestoUomo: data.sesto_uomo,
          chipPiloti: data.chip_piloti,
          chipPilotiTarget: data.chip_piloti_target,
          confirmed: !!data.confirmed,
        });

        // Cassa: se già memorizzata usala, altrimenti (rosa pre-v17) inizializza
        // dai prezzi pagati e persisti, così non si ricalcola più ogni volta.
        if (data.cassa != null) {
          setCassa(data.cassa);
        } else {
          const initCassa = initialCassa(driverNumbers);
          setCassa(initCassa);
          await supabase.from("formazioni").upsert({
            user_id: user.id, round, cassa: initCassa,
          }, { onConflict: "user_id,round" });
        }

        // La rosa base è SEMPRE l'ultima confermata di un round PRECEDENTE.
        // Se non esiste (primo round in assoluto), rosaBase = [] → nessuna penalità.
        // Questo garantisce che la prima formazione sia sempre modificabile liberamente.
        const { data: prev } = await supabase
          .from("formazioni")
          .select("round, driver_numbers, primo_pilota")
          .eq("user_id", user.id)
          .eq("confirmed", true)
          .lt("round", round)
          .order("round", { ascending: false })
          .limit(1)
          .single();
        setRosaBase(prev?.driver_numbers ? (prev.driver_numbers as number[]).map(Number) : []);
        if (prev) setPrevInfo({ round: prev.round as number, primoPilota: prev.primo_pilota ?? null });
      } else if (!error || error.code === "PGRST116") {
        // Nessuna formazione per questo round: copia dal round precedente
        const { data: prev } = await supabase
          .from("formazioni")
          .select("round, driver_numbers, cassa, primo_pilota")
          .eq("user_id", user.id)
          .eq("confirmed", true)
          .lt("round", round)
          .order("round", { ascending: false })
          .limit(1)
          .single();

        if (prev?.driver_numbers) {
          const prevDrivers = (prev.driver_numbers as number[]).map(Number);
          // La cassa si porta avanti invariata (nessun trade fra i round).
          const prevCassa = prev.cassa != null ? prev.cassa : initialCassa(prevDrivers);
          // Il Primo Pilota si porta avanti come PROPOSTA: la riga resta non
          // confermata, quindi il lunedì il Muretto mostra "come a Baku" e
          // chiede un tap di riconferma invece di ripartire da zero.
          const prevPrimo = prev.primo_pilota != null && prevDrivers.includes(Number(prev.primo_pilota))
            ? Number(prev.primo_pilota) : null;
          setState((s) => ({ ...s, driverNumbers: prevDrivers, primoPilota: prevPrimo }));
          setRosaBase(prevDrivers);
          setCassa(prevCassa);
          setPrevInfo({ round: prev.round as number, primoPilota: prev.primo_pilota ?? null });

          // Crea la riga in DB per questo round (non confermata)
          await supabase.from("formazioni").upsert({
            user_id: user.id,
            round,
            driver_numbers: prevDrivers,
            cassa: prevCassa,
            primo_pilota: prevPrimo,
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

      // Carica i chip piloti già usati in altri round confermati,
      // per applicare il limite di 1 utilizzo per metà stagione.
      const { data: chipRows } = await supabase
        .from("formazioni")
        .select("round, chip_piloti")
        .eq("user_id", user.id)
        .eq("confirmed", true)
        .neq("round", round)
        .not("chip_piloti", "is", null);
      setChipPilotiUsedOther(
        (chipRows || []).map((r) => ({ chip: r.chip_piloti as string, round: r.round as number }))
      );

      setLoaded(true);
    })();
  }, [user, round]);

  const { prices: dynamicPrices, loaded: pricesLoaded } = useDriverPrices(round);

  const drivers: OwnedDriver[] = state.driverNumbers
    .map((n) => driverNumberToOwned(n, dynamicPrices))
    .filter((d): d is OwnedDriver => d !== null);

  // Budget = saldo cassa memorizzato (NON ricalcolato dalle quotazioni attuali).
  // Le quotazioni muovono la cassa solo al momento di un trade.
  const budget = cassa;

  // Chip piloti non più disponibili in questo round (già usati nella stessa
  // metà stagione). Mappa chipId → round di utilizzo.
  const chipPilotiUnavailable = useMemo(
    () => buildChipUnavailable(chipPilotiUsedOther, round),
    [chipPilotiUsedOther, round]
  );
  const chipUnavailRef = useRef(chipPilotiUnavailable);
  chipUnavailRef.current = chipPilotiUnavailable;

  const cambiGratisRimasti = Math.max(0, CAMBI_GRATIS - cambiRound);
  const hasWildcard = state.chipPiloti === "wildcard";
  const penalitaProssimoCambio = hasWildcard ? 0 : (cambiRound >= CAMBI_GRATIS ? PENALITA_CAMBIO_EXTRA : 0);
  const penalitaTotale = hasWildcard ? 0 : Math.max(0, cambiRound - CAMBI_GRATIS) * PENALITA_CAMBIO_EXTRA;

  // Salva driver_numbers + cassa in DB (auto-save)
  const saveDrivers = useCallback(
    async (
      newDrivers: number[],
      newCassa: number,
      patch: Partial<{ primo_pilota: number | null; chip_piloti_target: number | null; sesto_uomo: number | null }> = {},
    ) => {
      if (!user || !isSupabaseConfigured) return;
      const supabase = createClient()!;
      const { error } = await supabase.from("formazioni").upsert({
        user_id: user.id,
        round,
        driver_numbers: newDrivers,
        cassa: newCassa,
        ...patch,
        confirmed: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,round" });
      if (error) console.error("[squadra] saveDrivers error:", error);
    },
    [user, round]
  );

  // Auto-save dei campi non-driver (primo pilota, sesto uomo, chip).
  // Prima erano salvati solo da conferma(): se l'utente cambiava il primo
  // pilota e non confermava, il valore andava perso al refresh / chiusura tab.
  const savePartial = useCallback(
    async (patch: Partial<{
      primo_pilota: number | null;
      sesto_uomo: number | null;
      chip_piloti: string | null;
      chip_piloti_target: number | null;
    }>) => {
      if (!user || !isSupabaseConfigured) return;
      const supabase = createClient()!;
      const { error } = await supabase.from("formazioni").upsert({
        user_id: user.id,
        round,
        ...patch,
        confirmed: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,round" });
      if (error) console.error("[squadra] savePartial error:", error);
    },
    [user, round]
  );

  // Registra un cambio di mercato (conta per la penalità dal 3° in poi) se il
  // pilota che entra NON era nella rosa base del round.
  const registraCambio = useCallback(
    async (driverIn: number, driverOut: number | null, prezzoIn: number, prezzoOut: number | null) => {
      if (!user) return;
      const supabase = createClient()!;
      const { error } = await supabase.from("mercato_cambi").insert({
        user_id: user.id, round, driver_in: driverIn, driver_out: driverOut ?? 0,
        prezzo_in: prezzoIn, prezzo_out: prezzoOut,
      });
      if (error) console.error("[squadra] mercato_cambi insert error:", error);
      else setCambiRound((prev) => prev + 1);
    },
    [user, round]
  );

  const acquista = useCallback(
    async (driverNumber: number): Promise<{ ok: boolean; error?: string }> => {
      if (!user || !isSupabaseConfigured) return { ok: false, error: "Non loggato" };
      if (busyRef.current) return { ok: false, error: "Operazione in corso" };

      const current = state.driverNumbers;
      if (current.length >= 5) return { ok: false, error: "Squadra piena (5/5)" };
      if (current.includes(driverNumber)) return { ok: false, error: "Pilota già in squadra" };

      const driverData = getDriverByNumber(driverNumber);
      if (!driverData) return { ok: false, error: "Pilota non trovato" };

      const priceOf = (n: number) => getDriverPrice(dynamicPrices, n);
      const newPrice = priceOf(driverNumber);
      if (cassa < newPrice) return { ok: false, error: `Ti mancano ${newPrice - cassa} Soldini` };

      busyRef.current = true;
      try {
        const newDrivers = [...current, driverNumber];
        const newCassa = cassa - newPrice; // paghi la quotazione ATTUALE

        // Conta come cambio se il pilota NON era nella rosa base
        // (wildcard annulla la penalita' solo al calcolo post-gara, i cambi si registrano sempre)
        if (rosaBase.length > 0 && !rosaBase.includes(driverNumber)) {
          const venduti = rosaBase.filter((n) => !current.includes(n));
          const driverOut = venduti[0] ?? null;
          await registraCambio(driverNumber, driverOut, newPrice, driverOut ? priceOf(driverOut) : null);
        }

        // Se era il Sesto Uomo, ora è titolare: il chip perde il bersaglio.
        const wasSesto = state.sestoUomo === driverNumber;
        setState((prev) => ({
          ...prev,
          driverNumbers: newDrivers,
          sestoUomo: wasSesto ? null : prev.sestoUomo,
          confirmed: false,
        }));
        setCassa(newCassa);
        await saveDrivers(newDrivers, newCassa, wasSesto ? { sesto_uomo: null } : {});
        return { ok: true };
      } finally {
        busyRef.current = false;
      }
    },
    [user, state.driverNumbers, state.sestoUomo, rosaBase, saveDrivers, dynamicPrices, cassa, registraCambio]
  );

  const vendi = useCallback(
    async (driverNumber: number): Promise<boolean> => {
      if (!user || !isSupabaseConfigured) return false;
      if (busyRef.current) return false;
      if (!state.driverNumbers.includes(driverNumber)) return false;
      busyRef.current = true;
      try {
        const newDrivers = state.driverNumbers.filter((n) => n !== driverNumber);
        // Incassi la quotazione ATTUALE del pilota venduto.
        const newCassa = cassa + getDriverPrice(dynamicPrices, driverNumber);
        const wasCaptain = state.primoPilota === driverNumber;
        const wasTarget = state.chipPilotiTarget === driverNumber;
        setState((prev) => ({
          ...prev,
          driverNumbers: newDrivers,
          primoPilota: wasCaptain ? null : prev.primoPilota,
          chipPilotiTarget: wasTarget ? null : prev.chipPilotiTarget,
          confirmed: false,
        }));
        setCassa(newCassa);
        // Anche il DB perde il capitano / bersaglio: prima restava in riga il
        // numero di un pilota che non era più in rosa.
        await saveDrivers(newDrivers, newCassa, {
          ...(wasCaptain ? { primo_pilota: null } : {}),
          ...(wasTarget ? { chip_piloti_target: null } : {}),
        });
        return true;
      } finally {
        busyRef.current = false;
      }
    },
    [user, state.driverNumbers, state.primoPilota, state.chipPilotiTarget, saveDrivers, dynamicPrices, cassa]
  );

  // Scambio in un gesto: esce `driverOut`, entra `driverIn`, un solo
  // salvataggio. Se esce il Primo Pilota, `nuovoPrimoPilota` lo sostituisce
  // (o resta vuoto, da scegliere nel Muretto).
  const scambia = useCallback(
    async (
      driverOut: number,
      driverIn: number,
      nuovoPrimoPilota: number | null = null,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!user || !isSupabaseConfigured) return { ok: false, error: "Non loggato" };
      if (busyRef.current) return { ok: false, error: "Operazione in corso" };
      const current = state.driverNumbers;
      if (!current.includes(driverOut)) return { ok: false, error: "Pilota non in rosa" };
      if (current.includes(driverIn)) return { ok: false, error: "Pilota già in squadra" };
      if (!getDriverByNumber(driverIn)) return { ok: false, error: "Pilota non trovato" };

      const priceOf = (n: number) => getDriverPrice(dynamicPrices, n);
      const newCassa = cassa + priceOf(driverOut) - priceOf(driverIn);
      if (newCassa < 0) return { ok: false, error: `Ti mancano ${-newCassa} Soldini` };

      busyRef.current = true;
      try {
        const newDrivers = current.map((n) => (n === driverOut ? driverIn : n));
        if (rosaBase.length > 0 && !rosaBase.includes(driverIn)) {
          await registraCambio(driverIn, driverOut, priceOf(driverIn), priceOf(driverOut));
        }
        const wasCaptain = state.primoPilota === driverOut;
        const wasTarget = state.chipPilotiTarget === driverOut;
        const wasSesto = state.sestoUomo === driverIn;
        const nextPrimo = wasCaptain
          ? (nuovoPrimoPilota && newDrivers.includes(nuovoPrimoPilota) ? nuovoPrimoPilota : null)
          : state.primoPilota;
        setState((prev) => ({
          ...prev,
          driverNumbers: newDrivers,
          primoPilota: nextPrimo,
          chipPilotiTarget: wasTarget ? null : prev.chipPilotiTarget,
          sestoUomo: wasSesto ? null : prev.sestoUomo,
          confirmed: false,
        }));
        setCassa(newCassa);
        await saveDrivers(newDrivers, newCassa, {
          primo_pilota: nextPrimo,
          ...(wasTarget ? { chip_piloti_target: null } : {}),
          ...(wasSesto ? { sesto_uomo: null } : {}),
        });
        return { ok: true };
      } finally {
        busyRef.current = false;
      }
    },
    [user, state.driverNumbers, state.primoPilota, state.chipPilotiTarget, state.sestoUomo, rosaBase, saveDrivers, dynamicPrices, cassa, registraCambio]
  );

  // Setters locali
  const setPrimoPilota = useCallback((driverNumber: number) => {
    setState((prev) => ({ ...prev, primoPilota: driverNumber, confirmed: false }));
    savePartial({ primo_pilota: driverNumber });
  }, [savePartial]);

  const setSestoUomo = useCallback((driverNumber: number | null) => {
    setState((prev) => ({ ...prev, sestoUomo: driverNumber, confirmed: false }));
    savePartial({ sesto_uomo: driverNumber });
  }, [savePartial]);

  const setChipPiloti = useCallback((chip: string | null) => {
    // Limite metà stagione: rifiuta un chip già usato in un altro round.
    if (chip && chipUnavailRef.current[chip] != null) {
      console.warn(`[squadra] chip "${chip}" già usato nel round ${chipUnavailRef.current[chip]} di questa metà stagione`);
      return;
    }
    setState((prev) => {
      const nextSesto = chip !== "sesto" ? null : prev.sestoUomo;
      // Quando cambia il chip resettiamo il target e (se non è "sesto") anche il sesto uomo
      savePartial({ chip_piloti: chip, chip_piloti_target: null, sesto_uomo: nextSesto });
      return {
        ...prev, chipPiloti: chip, chipPilotiTarget: null,
        sestoUomo: nextSesto, confirmed: false,
      };
    });
  }, [savePartial]);

  const setChipPilotiTarget = useCallback((target: number | null) => {
    setState((prev) => ({ ...prev, chipPilotiTarget: target, confirmed: false }));
    savePartial({ chip_piloti_target: target });
  }, [savePartial]);

  // Conferma: salva tutto in DB
  const conferma = useCallback(
    async (): Promise<boolean> => {
      if (!user || !isSupabaseConfigured) return false;

      return new Promise((resolve) => {
        setState((current) => {
          // Round 14: Hadjar rimosso per forza maggiore (sostituzione sedile),
          // rimborsato in cassa. Finché non ricomprano un 5° pilota, permetti
          // la conferma anche con 4 piloti (invece di richiederne esattamente 5).
          const minDrivers = minDriversForRound(round);
          if (current.driverNumbers.length < minDrivers || current.driverNumbers.length > 5) { resolve(false); return current; }
          if (!current.primoPilota) { resolve(false); return current; }
          // Limite metà stagione: blocca la conferma se il chip è già stato
          // usato in un altro round della stessa metà.
          if (current.chipPiloti && chipUnavailRef.current[current.chipPiloti] != null) {
            console.warn(`[squadra] conferma rifiutata: chip "${current.chipPiloti}" già usato nel round ${chipUnavailRef.current[current.chipPiloti]}`);
            resolve(false);
            return current;
          }

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

  // Il capitano è "proposto" (copiato dal round precedente, non ancora
  // riconfermato) se la formazione non è confermata e coincide con quello
  // dell'ultima formazione confermata.
  const primoPilotaProposto = !state.confirmed && prevInfo?.primoPilota != null && state.primoPilota === prevInfo.primoPilota
    ? { driver: state.primoPilota, fromRound: prevInfo.round }
    : null;

  return {
    ...state,
    drivers, budget, loaded, pricesLoaded,
    prices: dynamicPrices,
    rosaBase,
    prevRound: prevInfo?.round ?? null,
    primoPilotaProposto,
    acquista, vendi, scambia,
    setPrimoPilota, setSestoUomo, setChipPiloti, setChipPilotiTarget,
    conferma,
    cambiRound, cambiGratisRimasti, penalitaProssimoCambio, penalitaTotale,
    CAMBI_GRATIS, PENALITA_CAMBIO_EXTRA,
    chipPilotiUnavailable,
  };
}

/** Piloti minimi per confermare: round 14 (Hadjar rimosso per forza maggiore) accetta 4. */
export function minDriversForRound(round: number): number {
  return round === 14 ? 4 : 5;
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
  // Chip previsioni già confermati in ALTRI round (per limite metà stagione)
  const [chipPrevUsedOther, setChipPrevUsedOther] = useState<{ chip: string; round: number }[]>([]);

  const previsioniRef = useRef(previsioni);
  previsioniRef.current = previsioni;
  const chipRef = useRef(chipAttivo);
  chipRef.current = chipAttivo;
  const chipTargetRef = useRef(chipTarget);
  chipTargetRef.current = chipTarget;

  // Chip previsioni non più disponibili in questo round (già usati nella
  // stessa metà stagione). Mappa chipId → round di utilizzo.
  const chipPrevisioniUnavailable = useMemo(
    () => buildChipUnavailable(chipPrevUsedOther, round),
    [chipPrevUsedOther, round]
  );
  const chipPrevUnavailRef = useRef(chipPrevisioniUnavailable);
  chipPrevUnavailRef.current = chipPrevisioniUnavailable;

  useEffect(() => {
    // Reset al cambio round (o utente): senza, il lunedì il nuovo round
    // partiva con le previsioni e il "confermato" del round appena finito.
    setLoaded(false);
    setPrevisioniState({ safetyCar: null, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null });
    setChipAttivoState(null);
    setChipTargetState(null);
    setConfirmed(false);
    setChipPrevUsedOther([]);

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

    // Chip previsioni già usati in altri round confermati (limite metà stagione)
    supabase
      .from("previsioni")
      .select("round, chip_attivo")
      .eq("user_id", user.id)
      .eq("confirmed", true)
      .neq("round", round)
      .not("chip_attivo", "is", null)
      .then(({ data }) => {
        setChipPrevUsedOther(
          (data || []).map((r) => ({ chip: r.chip_attivo as string, round: r.round as number }))
        );
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
      // Limite metà stagione: rifiuta un chip già usato in un altro round.
      if (chip && chipPrevUnavailRef.current[chip] != null) {
        console.warn(`[previsioni] chip "${chip}" già usato nel round ${chipPrevUnavailRef.current[chip]} di questa metà stagione`);
        return;
      }
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

    // Limite metà stagione: blocca la conferma se il chip previsioni è già
    // stato usato in un altro round della stessa metà.
    if (chipRef.current && chipPrevUnavailRef.current[chipRef.current] != null) {
      console.warn(`[previsioni] conferma rifiutata: chip "${chipRef.current}" già usato nel round ${chipPrevUnavailRef.current[chipRef.current]}`);
      return false;
    }

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
    chipPrevisioniUnavailable,
  };
}

// ═══════════════════════════════════════════
// Hook: useAggiornamenti — Chip usati nella stagione
// Legge da formazioni + previsioni
// ═══════════════════════════════════════════

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
      boost: "Boost Mode", halo: "Halo", scudo: "Scudo Capitano", sesto: "Sesto Uomo", wildcard: "Wildcard",
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

  const pilotiChips = ["boost", "halo", "scudo", "sesto", "wildcard"].map((id) =>
    getChipStatus(id, chipPilotiUsed)
  );

  const previsioniChips = ["doppia"].map((id) =>
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
// ═══════════════════════════════════════════
// Hook: useLegaPreferita — Lega preferita (dal profilo DB)
// ═══════════════════════════════════════════

export function useLegaPreferita() {
  const { profile, updateProfile } = useAuth();

  const legaId = profile?.lega_preferita || LEGA_GENERALE_ID;
  const loaded = !!profile;

  const setLegaId = useCallback(async (id: string) => {
    await updateProfile({ lega_preferita: id });
  }, [updateProfile]);

  return { legaId, setLegaId, loaded };
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
  /** Distacco dal primo (0 se sei primo) */
  gapLeader: number;
  /** Chi ti precede e di quanto (null se sei primo) */
  ahead: { name: string; gap: number } | null;
  /** Chi ti segue e di quanto (null se sei ultimo) */
  behind: { name: string; gap: number } | null;
  loaded: boolean;
}

export function useDashboardStats(legaId: string = LEGA_GENERALE_ID) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalPoints: 0, position: null, totalPlayers: 0,
    gareGiocate: 0, mediaPunti: null, lastWeekendPoints: 0,
    gapLeader: 0, ahead: null, behind: null, loaded: false,
  });

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setStats((s) => ({ ...s, loaded: true }));
      return;
    }

    setStats((s) => ({ ...s, loaded: false }));
    const supabase = createClient()!;

    Promise.all([
      // Classifica della lega selezionata
      supabase.rpc("classifica_lega", { p_lega_id: legaId }),
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

      const aheadEntry = posIndex > 0 ? classifica[posIndex - 1] : null;
      const behindEntry = posIndex >= 0 && posIndex < classifica.length - 1 ? classifica[posIndex + 1] : null;
      setStats({
        totalPoints: total,
        position: posIndex >= 0 ? posIndex + 1 : null,
        totalPlayers: classifica.length,
        gareGiocate: gare,
        mediaPunti: gare > 0 ? Math.round((total / gare) * 10) / 10 : null,
        lastWeekendPoints: myEntry?.last_weekend_points ?? 0,
        gapLeader: classifica.length > 0 ? classifica[0].total_points - total : 0,
        ahead: aheadEntry ? { name: aheadEntry.team_principal_name, gap: aheadEntry.total_points - total } : null,
        behind: behindEntry ? { name: behindEntry.team_principal_name, gap: total - behindEntry.total_points } : null,
        loaded: true,
      });
    });
  }, [user, legaId]);

  return stats;
}

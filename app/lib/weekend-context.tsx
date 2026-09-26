"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { useSquadra, usePrevisioni } from "./store";
import { useLiveSession } from "./use-live-session";
import {
  getCurrentRound, getRaceByRound, getNextRace, getRacePhase, getRecapRace,
  isAfterDeadline, type RoundPhase,
} from "./races";
import type { Race } from "./types";

// ═══════════════════════════════════════════
// WeekendProvider — una sola istanza di squadra, previsioni e sessione live
// per tutta l'app. Prima Home, Muretto, BottomNav, Mercato e Gara chiamavano
// ciascuno i propri useSquadra/usePrevisioni: cinque copie dello stesso stato
// che si vedevano fra loro solo al refresh (il pallino "da confermare"
// restava acceso dopo la conferma, la Home diceva "da completare" mentre il
// Muretto era verde). Qui lo stato vive una volta sola.
// ═══════════════════════════════════════════

export interface WeekendContextValue {
  round: number;
  race: Race;
  /** Fase del round corrente: prepara (formazione aperta), weekend, recap. */
  phase: RoundPhase;
  /** Dopo la deadline: formazione, previsioni e mercato bloccati. */
  locked: boolean;
  /** Il GP appena concluso, finché non chiude la formazione del successivo. */
  recapRace: Race | null;
  /** Orologio condiviso (tick ogni 30 s) per deadline relative e fasi. */
  now: Date;
  squadra: ReturnType<typeof useSquadra>;
  previsioni: ReturnType<typeof usePrevisioni>;
  live: ReturnType<typeof useLiveSession>;
  /** Tutto confermato per il round corrente. */
  tuttoConfermato: boolean;
  /** Qualcosa manca e la formazione è ancora aperta. */
  daConfermare: boolean;
}

const WeekendContext = createContext<WeekendContextValue | null>(null);

export function WeekendProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [round, setRound] = useState(() => getCurrentRound());

  // Tick: ogni 30 s aggiorna l'orologio e, se il round è cambiato (lunedì
  // 00:00 UTC), passa al nuovo senza ricaricare la pagina.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      const r = getCurrentRound();
      setRound((prev) => (prev === r ? prev : r));
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const race = getRaceByRound(round) || getNextRace();
  const squadra = useSquadra(round);
  const previsioni = usePrevisioni(round);
  const live = useLiveSession(!!user);

  const locked = isAfterDeadline(race);
  const phase = getRacePhase(race, now);
  const recapRace = getRecapRace(now);
  const loaded = squadra.loaded && previsioni.loaded;
  const tuttoConfermato = loaded && squadra.confirmed && previsioni.confirmed;
  const daConfermare = !!user && !locked && loaded && !(squadra.confirmed && previsioni.confirmed);

  return (
    <WeekendContext.Provider
      value={{ round, race, phase, locked, recapRace, now, squadra, previsioni, live, tuttoConfermato, daConfermare }}
    >
      {children}
    </WeekendContext.Provider>
  );
}

export function useWeekend(): WeekendContextValue {
  const v = useContext(WeekendContext);
  if (!v) throw new Error("useWeekend va usato dentro <WeekendProvider>");
  return v;
}

/** Variante che non lancia: per componenti montati anche fuori dal provider. */
export function useWeekendOptional(): WeekendContextValue | null {
  return useContext(WeekendContext);
}

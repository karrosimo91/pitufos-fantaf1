// Eventi live tradotti per il giocatore: da race_control (inglese FIA) a
// card in italiano con l'impatto sul MIO punteggio. Funzioni pure.

import type { LiveRaceControl } from "./use-live-ws";
import { carNumberFromMessage } from "./penalties";
import { PREVISIONI_PUNTI, type Previsioni } from "./types";
import { getDriverByNumber } from "./drivers-data";

export type FlagState = "green" | "yellow" | "sc" | "vsc" | "red" | "chequered" | "none";

/** Stato pista dall'ultimo messaggio rilevante di race_control. */
export function latestFlag(raceControl: LiveRaceControl[]): FlagState {
  let state: FlagState = "none";
  for (const rc of raceControl) {
    const msg = (rc.message || "").toUpperCase();
    const flag = (rc.flag || "").toUpperCase();
    if (flag === "CHEQUERED" || msg.includes("CHEQUERED FLAG")) { state = "chequered"; continue; }
    if (flag === "RED" || (msg.includes("RED FLAG") && !msg.includes("CHEQUERED"))) { state = "red"; continue; }
    if (msg.includes("VIRTUAL SAFETY CAR") || msg.includes("VSC")) {
      state = msg.includes("ENDING") || msg.includes("END") ? "green" : "vsc";
      continue;
    }
    if (msg.includes("SAFETY CAR")) {
      state = msg.includes("IN THIS LAP") || msg.includes("ENDING") ? "green" : "sc";
      continue;
    }
    if (flag === "GREEN" || msg.includes("GREEN LIGHT") || msg.includes("TRACK CLEAR") || msg.includes("GREEN FLAG")) { state = "green"; continue; }
    if (flag === "DOUBLE YELLOW" || flag === "YELLOW") { if (state !== "sc" && state !== "vsc" && state !== "red") state = "yellow"; continue; }
    if (flag === "CLEAR" && state === "yellow") { state = "green"; continue; }
  }
  return state;
}

export const FLAG_LABEL: Record<FlagState, string> = {
  green: "PISTA LIBERA",
  yellow: "BANDIERA GIALLA",
  sc: "SAFETY CAR",
  vsc: "VIRTUAL SAFETY CAR",
  red: "BANDIERA ROSSA",
  chequered: "BANDIERA A SCACCHI",
  none: "IN ATTESA",
};

/** La sessione è finita (bandiera a scacchi già sventolata). */
export function sessionEnded(raceControl: LiveRaceControl[]): boolean {
  return raceControl.some((rc) => (rc.flag || "").toUpperCase() === "CHEQUERED" || (rc.message || "").toUpperCase().includes("CHEQUERED FLAG"));
}

export interface LiveEventCard {
  date: string;
  kind: "sc" | "vsc" | "red" | "dnf" | "penalty" | "start" | "end" | "green" | "wet" | "other";
  title: string;
  /** Impatto sul mio punteggio, in parole (null se nessuno) */
  impact: string | null;
  /** Segno dell'impatto per il colore */
  sign: "up" | "down" | "none";
  raw: string;
}

export interface MyLiveContext {
  driverNumbers: number[];
  primoPilota: number | null;
  chipPiloti: string | null;
  chipPilotiTarget: number | null;
  previsioni: Previsioni | null;
  isRace: boolean;
  isSprint: boolean;
}

function driverName(n: number): string {
  return getDriverByNumber(n)?.name.split(" ").pop() ?? `#${n}`;
}

function multiplierFor(ctx: MyLiveContext, n: number): { m: number; label: string } {
  if (n === ctx.primoPilota) return ctx.chipPiloti === "scudo" ? { m: 1, label: "Primo Pilota con Scudo, malus x1" } : { m: 2, label: "Primo Pilota x2" };
  if (ctx.chipPiloti === "boost" && ctx.chipPilotiTarget === n) return { m: 3, label: "Boost x3" };
  return { m: 1, label: "" };
}

/**
 * Traduce i messaggi race_control in card leggibili con l'impatto per me.
 * Solo i messaggi che contano: partenza, SC, VSC, bandiera rossa, ritiri,
 * penalità, bandiera a scacchi. Il resto resta nel feed grezzo.
 */
export function translateRaceControl(raceControl: LiveRaceControl[], ctx: MyLiveContext): LiveEventCard[] {
  const out: LiveEventCard[] = [];
  const seen = { sc: false, vsc: false, red: false };
  const prev = ctx.previsioni;
  const dnfMalus = ctx.isSprint ? 5 : 10;

  for (const rc of raceControl) {
    const msg = (rc.message || "").toUpperCase();
    const flag = (rc.flag || "").toUpperCase();
    const date = rc.date;

    if (flag === "CHEQUERED" || msg.includes("CHEQUERED FLAG")) {
      out.push({ date, kind: "end", title: "Bandiera a scacchi", impact: "Risultato provvisorio, in attesa dell'ufficialità", sign: "none", raw: rc.message });
      continue;
    }
    if (msg.includes("LIGHTS OUT") || msg.includes("RACE STARTED") || (msg.includes("GREEN") && msg.includes("START"))) {
      out.push({ date, kind: "start", title: "Si parte", impact: null, sign: "none", raw: rc.message });
      continue;
    }
    if (flag === "RED" || (msg.includes("RED FLAG") && !msg.includes("CHEQUERED"))) {
      const first = !seen.red; seen.red = true;
      let impact: string | null = null; let sign: LiveEventCard["sign"] = "none";
      if (first && ctx.isRace && prev) {
        if (prev.redFlag === true) { impact = `Avevi detto SÌ: +${PREVISIONI_PUNTI.redFlag.si}`; sign = "up"; }
        else if (prev.redFlag === false) { impact = `Avevi detto NO: previsione sbagliata`; sign = "down"; }
      }
      out.push({ date, kind: "red", title: "Bandiera rossa", impact, sign, raw: rc.message });
      continue;
    }
    if (msg.includes("VIRTUAL SAFETY CAR") || msg.includes("VSC")) {
      if (msg.includes("ENDING") || msg.includes("END")) continue;
      const first = !seen.vsc; seen.vsc = true;
      if (!first) continue;
      let impact: string | null = null; let sign: LiveEventCard["sign"] = "none";
      if (ctx.isRace && prev) {
        if (prev.virtualSafetyCar === true) { impact = `Avevi detto SÌ: +${PREVISIONI_PUNTI.virtualSafetyCar.si}`; sign = "up"; }
        else if (prev.virtualSafetyCar === false) { impact = "Avevi detto NO: previsione sbagliata"; sign = "down"; }
      }
      out.push({ date, kind: "vsc", title: "Virtual Safety Car", impact, sign, raw: rc.message });
      continue;
    }
    if (msg.includes("SAFETY CAR")) {
      if (msg.includes("IN THIS LAP") || msg.includes("ENDING")) continue;
      const first = !seen.sc; seen.sc = true;
      if (!first) continue;
      let impact: string | null = null; let sign: LiveEventCard["sign"] = "none";
      if (ctx.isRace && prev) {
        if (prev.safetyCar === true) { impact = `Avevi detto SÌ: +${PREVISIONI_PUNTI.safetyCar.si}`; sign = "up"; }
        else if (prev.safetyCar === false) { impact = "Avevi detto NO: previsione sbagliata"; sign = "down"; }
      }
      out.push({ date, kind: "sc", title: "Safety Car in pista", impact, sign, raw: rc.message });
      continue;
    }
    if (msg.includes("RETIRED") || msg.includes("OUT OF THE RACE") || msg.includes("DID NOT FINISH")) {
      const num = rc.driver_number ?? carNumberFromMessage(rc.message || "");
      if (!num) continue;
      const mine = ctx.driverNumbers.includes(num);
      const mul = multiplierFor(ctx, num);
      const malus = dnfMalus * mul.m;
      const impact = mine
        ? `Tuo pilota: −${malus}${mul.label ? ` (${mul.label})` : ""}${ctx.chipPiloti === "halo" ? " · Halo: minimo 0 a fine weekend" : ""}`
        : null;
      out.push({ date, kind: "dnf", title: `${driverName(num)} ritirato`, impact, sign: mine ? "down" : "none", raw: rc.message });
      continue;
    }
    if (msg.includes("PENALTY") && !msg.includes("NO FURTHER")) {
      const num = rc.driver_number ?? carNumberFromMessage(rc.message || "");
      if (!num) continue;
      const mine = ctx.driverNumbers.includes(num);
      const mul = multiplierFor(ctx, num);
      const isTime = msg.includes("SECOND") || msg.includes("TIME PENALTY") || msg.includes("DRIVE THROUGH") || msg.includes("STOP") || msg.includes("GRID");
      if (!isTime) continue;
      out.push({
        date, kind: "penalty",
        title: `Penalità a ${driverName(num)}`,
        impact: mine ? `Tuo pilota: −${5 * mul.m}${mul.label ? ` (${mul.label})` : ""}` : null,
        sign: mine ? "down" : "none", raw: rc.message,
      });
      continue;
    }
  }
  return out.reverse();
}

// Recap del weekend: lo scontrino (ogni punto spiegato), migliore e peggiore
// scelta, i rimpianti (capitano giusto, rosa perfetta entro budget), il
// bottino previsioni. Funzioni pure sui risultati ufficiali.

import {
  calcolaPuntiWeekend,
  calcolaPuntiPilotaBase,
  getScoreBreakdown,
  type RaceWeekendResults,
  type ScoreBreakdown,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
  type DriverResult,
} from "./scoring";
import { PREVISIONI_PUNTI, type Previsioni } from "./types";
import { getDriverByNumber, DRIVERS_2026 } from "./drivers-data";

export interface RecapDriver {
  driver_number: number;
  name: string;
  team: string;
  teamColour: string;
  role: "captain" | "boost" | "sesto" | null;
  moltiplicatore: number;
  haloApplicato: boolean;
  puntiBase: number;
  puntiFinali: number;
  sessions: { label: string; breakdown: ScoreBreakdown }[];
  /** Riga "aggiustamento" (capitano x2, boost, scudo, halo) */
  adjustment: { label: string; value: number } | null;
}

export interface RecapPrevisione {
  key: keyof Previsioni;
  label: string;
  mine: boolean | number | null;
  happened: boolean | number;
  points: number;
  /** Punti se avessi risposto giusto */
  possible: number;
  doppia: boolean;
}

export interface Recap {
  pilotiPoints: number;
  previsioniPoints: number;
  penalitaCambi: number;
  total: number;
  drivers: RecapDriver[];
  best: RecapDriver | null;
  worst: RecapDriver | null;
  previsioni: RecapPrevisione[];
  previsioniPossible: number;
  /** Capitano migliore fra i miei: delta rispetto alla scelta fatta */
  captainWhatIf: { driver_number: number; name: string; delta: number } | null;
  /** Rosa perfetta del weekend entro 100 Soldini (con il capitano giusto) */
  perfect: { drivers: number[]; captain: number; points: number; delta: number } | null;
}

const SESSION_LABELS: [keyof Pick<RaceWeekendResults, "qualifying" | "sprint_shootout" | "sprint" | "race">, string, "qualifying" | "sprint_shootout" | "sprint" | "race"][] = [
  ["qualifying", "Qualifiche", "qualifying"],
  ["sprint_shootout", "Sprint Shootout", "sprint_shootout"],
  ["sprint", "Sprint", "sprint"],
  ["race", "Gara", "race"],
];

const PREV_META: { key: keyof Previsioni; label: string; event: keyof RaceWeekendResults["events"] }[] = [
  { key: "safetyCar", label: "Safety Car", event: "safety_car" },
  { key: "virtualSafetyCar", label: "Virtual Safety Car", event: "virtual_safety_car" },
  { key: "redFlag", label: "Bandiera rossa", event: "red_flag" },
  { key: "gommeWet", label: "Gomme da bagnato", event: "wet_tyres" },
  { key: "poleVince", label: "Pole vince", event: "pole_won" },
];

function sessionsOf(results: RaceWeekendResults, n: number): { label: string; breakdown: ScoreBreakdown }[] {
  const out: { label: string; breakdown: ScoreBreakdown }[] = [];
  for (const [key, label, kind] of SESSION_LABELS) {
    const arr = results[key] as DriverResult[] | undefined;
    if (!arr?.length) continue;
    const r = arr.find((x) => x.driver_number === n);
    if (!r) continue;
    out.push({ label, breakdown: getScoreBreakdown(r, kind, false, null) });
  }
  return out;
}

export function buildRecap(
  results: RaceWeekendResults,
  driverNumbers: number[],
  primoPilota: number | null,
  previsioni: Previsioni,
  chipPiloti: ChipPilotiConfig,
  chipPrevisioni: ChipPrevisioniConfig,
  penalitaCambi: number,
  prices: Map<number, number>,
): Recap {
  const raceDone = results.race.length > 0;
  const emptyPrev: Previsioni = { safetyCar: null, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null };
  const calc = calcolaPuntiWeekend(driverNumbers, primoPilota, raceDone ? previsioni : emptyPrev, results, chipPiloti, raceDone ? chipPrevisioni : undefined);

  const drivers: RecapDriver[] = calc.pilotiDettaglio.map((d) => {
    const info = getDriverByNumber(d.driver_number);
    const role: RecapDriver["role"] = d.driver_number === primoPilota ? "captain" : d.moltiplicatore === 3 ? "boost" : d.isSestoUomo ? "sesto" : null;
    const adj = d.puntiFinali - d.puntiBase;
    const label = d.haloApplicato ? "Halo (minimo 0)"
      : role === "captain" ? (chipPiloti.chipPiloti === "scudo" ? "Scudo Capitano" : "Primo Pilota ×2")
      : role === "boost" ? "Boost ×3" : null;
    return {
      driver_number: d.driver_number,
      name: info?.name ?? `#${d.driver_number}`,
      team: info?.team ?? "",
      teamColour: info?.teamColour ?? "555",
      role,
      moltiplicatore: d.moltiplicatore,
      haloApplicato: d.haloApplicato,
      puntiBase: d.puntiBase,
      puntiFinali: d.puntiFinali,
      sessions: sessionsOf(results, d.driver_number),
      adjustment: adj !== 0 && label ? { label, value: adj } : null,
    };
  });

  const sorted = [...drivers].sort((a, b) => b.puntiFinali - a.puntiFinali);
  const best = sorted[0] ?? null;
  const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  // Previsioni
  const prevList: RecapPrevisione[] = [];
  let possible = 0;
  if (raceDone) {
    for (const m of PREV_META) {
      const happened = results.events[m.event] as boolean;
      const pts = PREVISIONI_PUNTI[m.key as keyof typeof PREVISIONI_PUNTI] as { si: number; no: number };
      const doppia = chipPrevisioni.chipAttivo === "doppia" && chipPrevisioni.chipTarget === m.key;
      const poss = (happened ? pts.si : pts.no) * (doppia ? 2 : 1);
      possible += poss;
      prevList.push({ key: m.key, label: m.label, mine: previsioni[m.key], happened, points: calc.previsioniDettaglio[m.key] ?? 0, possible: poss, doppia });
    }
    const doppiaDnf = chipPrevisioni.chipAttivo === "doppia" && chipPrevisioni.chipTarget === "numeroDnf";
    const possDnf = PREVISIONI_PUNTI.numeroDnf.esatto * (doppiaDnf ? 2 : 1);
    possible += possDnf;
    prevList.push({ key: "numeroDnf", label: "Numero ritiri", mine: previsioni.numeroDnf, happened: results.events.total_dnf, points: calc.previsioniDettaglio.numeroDnf ?? 0, possible: possDnf, doppia: doppiaDnf });
  }

  // Capitano giusto: fra i miei titolari, chi avrebbe reso di più come x2
  // (con lo stesso chip). Confronto sul totale piloti.
  let captainWhatIf: Recap["captainWhatIf"] = null;
  if (primoPilota != null && driverNumbers.length > 0) {
    let bestAlt: { n: number; total: number } | null = null;
    for (const n of driverNumbers) {
      const alt = calcolaPuntiWeekend(driverNumbers, n, emptyPrev, results, chipPiloti, undefined);
      if (!bestAlt || alt.pilotiPoints > bestAlt.total) bestAlt = { n, total: alt.pilotiPoints };
    }
    if (bestAlt && bestAlt.n !== primoPilota && bestAlt.total > calc.pilotiPoints) {
      captainWhatIf = { driver_number: bestAlt.n, name: getDriverByNumber(bestAlt.n)?.name ?? `#${bestAlt.n}`, delta: bestAlt.total - calc.pilotiPoints };
    }
  }

  // Rosa perfetta entro 100 Soldini (prezzi del round): 5 piloti fra chi ha
  // corso, con il migliore come capitano x2. Forza bruta: C(23,5) ≈ 34k.
  const raced = DRIVERS_2026
    .map((d) => ({ n: d.number, pts: calcolaPuntiPilotaBase(d.number, results), price: prices.get(d.number) ?? d.price, present: presentIn(results, d.number) }))
    .filter((d) => d.present)
    .sort((a, b) => b.pts - a.pts);
  let perfect: Recap["perfect"] = null;
  if (raced.length >= 5) {
    const top = raced.slice(0, 16); // basta: il resto non entra in una rosa ottima
    let bestSel: { drivers: number[]; captain: number; points: number } | null = null;
    const m = top.length;
    for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) for (let c = b + 1; c < m; c++) for (let d = c + 1; d < m; d++) for (let e = d + 1; e < m; e++) {
      const sel = [top[a], top[b], top[c], top[d], top[e]];
      const price = sel.reduce((s, x) => s + x.price, 0);
      if (price > 100) continue;
      const cap = sel.reduce((bst, x) => (x.pts > bst.pts ? x : bst), sel[0]);
      const points = sel.reduce((s, x) => s + x.pts, 0) + cap.pts; // capitano x2
      if (!bestSel || points > bestSel.points) bestSel = { drivers: sel.map((x) => x.n), captain: cap.n, points };
    }
    if (bestSel) perfect = { ...bestSel, delta: bestSel.points - calc.pilotiPoints };
  }

  return {
    pilotiPoints: calc.pilotiPoints,
    previsioniPoints: calc.previsioniPoints,
    penalitaCambi,
    total: calc.total - penalitaCambi,
    drivers,
    best,
    worst,
    previsioni: prevList,
    previsioniPossible: possible,
    captainWhatIf,
    perfect,
  };
}

function presentIn(results: RaceWeekendResults, n: number): boolean {
  for (const arr of [results.qualifying, results.sprint_shootout, results.sprint, results.race]) {
    const r = arr?.find((x) => x.driver_number === n);
    if (r && !r.dns) return true;
  }
  return false;
}

/** Testo condivisibile del weekend. */
export function recapShareText(raceName: string, legaName: string | null, standings: { name: string; points: number }[], mine: { points: number; position: number; best?: string; worst?: string } | null): string {
  const lines = [`${raceName}${legaName ? ` · ${legaName}` : ""}`];
  standings.forEach((s, i) => lines.push(`${i + 1}. ${s.name} ${s.points}`));
  if (mine) {
    lines.push("");
    lines.push(`Il mio weekend: ${mine.points > 0 ? "+" : ""}${mine.points} (${mine.position}°)${mine.best ? ` · top ${mine.best}` : ""}${mine.worst ? ` · flop ${mine.worst}` : ""}`);
  }
  return lines.join("\n");
}

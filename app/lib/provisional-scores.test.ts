import { describe, it, expect } from "vitest";
import { computeProvisionalTotals } from "./provisional-scores";

describe("computeProvisionalTotals", () => {
  it("una sola sessione: totale = cumulativo", () => {
    const { sessions, totals } = computeProvisionalTotals([], "Race", { u1: 30, u2: 12 });
    expect(totals.get("u1")).toBe(30);
    expect(totals.get("u2")).toBe(12);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionName).toBe("Race");
  });

  it("due sessioni: NON conta due volte la qualifica", () => {
    // Qualifica: cumulativo = 12
    const afterQuali = computeProvisionalTotals([], "Qualifying", { u1: 12 });
    expect(afterQuali.totals.get("u1")).toBe(12);

    // Gara: il live dà il cumulativo del weekend (quali 12 + gara 30 = 42)
    const afterRace = computeProvisionalTotals(afterQuali.sessions, "Race", { u1: 42 });
    // Il totale deve essere 42, NON 12 + 42 = 54
    expect(afterRace.totals.get("u1")).toBe(42);
    // Le sessioni mostrano i delta reali: quali 12, gara 30
    const quali = afterRace.sessions.find((s) => s.sessionName === "Qualifying")!;
    const race = afterRace.sessions.find((s) => s.sessionName === "Race")!;
    expect(quali.scores.u1).toBe(12);
    expect(race.scores.u1).toBe(30);
  });

  it("re-save della stessa sessione (throttle): idempotente, niente accumulo", () => {
    const afterQuali = computeProvisionalTotals([], "Qualifying", { u1: 12 });
    // Prima lettura gara: cumulativo 42
    const race1 = computeProvisionalTotals(afterQuali.sessions, "Race", { u1: 42 });
    expect(race1.totals.get("u1")).toBe(42);
    // Aggiornamento gara (stessa sessione): cumulativo salito a 50
    const race2 = computeProvisionalTotals(race1.sessions, "Race", { u1: 50 });
    expect(race2.totals.get("u1")).toBe(50); // non 92, non 62
    expect(race2.sessions).toHaveLength(2);
  });

  it("tre sessioni (sprint weekend): somma corretta", () => {
    let acc = computeProvisionalTotals([], "Sprint Qualifying", { u1: 4 });
    acc = computeProvisionalTotals(acc.sessions, "Sprint", { u1: 12 }); // cumulativo 4+8
    acc = computeProvisionalTotals(acc.sessions, "Race", { u1: 37 });   // cumulativo 12+25
    expect(acc.totals.get("u1")).toBe(37);
    expect(acc.sessions.find((s) => s.sessionName === "Sprint Qualifying")!.scores.u1).toBe(4);
    expect(acc.sessions.find((s) => s.sessionName === "Sprint")!.scores.u1).toBe(8);
    expect(acc.sessions.find((s) => s.sessionName === "Race")!.scores.u1).toBe(25);
  });

  it("punteggi negativi gestiti correttamente", () => {
    const afterQuali = computeProvisionalTotals([], "Qualifying", { u1: -5 });
    const afterRace = computeProvisionalTotals(afterQuali.sessions, "Race", { u1: -15 }); // quali -5 + gara -10
    expect(afterRace.totals.get("u1")).toBe(-15);
    expect(afterRace.sessions.find((s) => s.sessionName === "Race")!.scores.u1).toBe(-10);
  });
});

import { isProvisionalStale, isSessionArchived } from "./provisional-scores";
import type { RaceWeekendResults } from "./scoring";

describe("isProvisionalStale", () => {
  it("nessun calcolo ufficiale: provvisori validi", () => {
    expect(isProvisionalStale("2026-09-27T14:00:00Z", null)).toBe(false);
  });
  it("gara salvata dal live dopo il calcolo della qualifica: validi", () => {
    expect(isProvisionalStale("2026-09-27T15:00:00Z", "2026-09-26T16:00:00Z")).toBe(false);
  });
  it("calcolo ufficiale dopo l'ultimo salvataggio live: superati", () => {
    expect(isProvisionalStale("2026-09-27T15:00:00Z", "2026-09-27T15:30:00Z")).toBe(true);
  });
});

describe("isSessionArchived", () => {
  const official = {
    qualifying: [{ driver_number: 1, position: 1 }],
    race: [],
    events: { safety_car: false, virtual_safety_car: false, red_flag: false, wet_tyres: false, pole_won: false, total_dnf: 0 },
  } as RaceWeekendResults;
  it("qualifica calcolata, gara no", () => {
    expect(isSessionArchived("Qualifying", official)).toBe(true);
    expect(isSessionArchived("Race", official)).toBe(false);
    expect(isSessionArchived("Race", null)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { latestFlag, sessionEnded, translateRaceControl } from "./live-events";
import { previsioneViva } from "./previsioni-live";

const rc = (message: string, extra: Partial<{ flag: string; driver_number: number }> = {}) => ({ message, date: "2026-09-26T11:00:00Z", ...extra });

describe("latestFlag", () => {
  it("segue l'ultimo stato pista", () => {
    expect(latestFlag([rc("GREEN LIGHT - PIT EXIT OPEN", { flag: "GREEN" }), rc("SAFETY CAR DEPLOYED")])).toBe("sc");
    expect(latestFlag([rc("SAFETY CAR DEPLOYED"), rc("SAFETY CAR IN THIS LAP"), rc("TRACK CLEAR", { flag: "GREEN" })])).toBe("green");
    expect(latestFlag([rc("VIRTUAL SAFETY CAR DEPLOYED"), rc("VIRTUAL SAFETY CAR ENDING")])).toBe("green");
    expect(latestFlag([rc("RED FLAG", { flag: "RED" })])).toBe("red");
    expect(latestFlag([rc("CHEQUERED FLAG", { flag: "CHEQUERED" })])).toBe("chequered");
    expect(latestFlag([])).toBe("none");
  });
  it("riconosce la fine sessione", () => {
    expect(sessionEnded([rc("CHEQUERED FLAG", { flag: "CHEQUERED" })])).toBe(true);
    expect(sessionEnded([rc("SAFETY CAR DEPLOYED")])).toBe(false);
  });
});

describe("translateRaceControl", () => {
  const ctx = {
    driverNumbers: [1, 3, 63, 16, 44], primoPilota: 1, chipPiloti: null, chipPilotiTarget: null,
    previsioni: { safetyCar: true, virtualSafetyCar: false, redFlag: null, gommeWet: false, poleVince: true, numeroDnf: 2 },
    isRace: true, isSprint: false,
  };
  it("safety car: impatto dalla mia previsione, una sola card", () => {
    const cards = translateRaceControl([rc("SAFETY CAR DEPLOYED"), rc("SAFETY CAR DEPLOYED")], ctx);
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("sc");
    expect(cards[0].impact).toContain("+4");
    expect(cards[0].sign).toBe("up");
  });
  it("VSC con NO: sbagliata", () => {
    const [c] = translateRaceControl([rc("VIRTUAL SAFETY CAR DEPLOYED")], ctx);
    expect(c.kind).toBe("vsc");
    expect(c.sign).toBe("down");
  });
  it("ritiro del Primo Pilota: −20", () => {
    const [c] = translateRaceControl([rc("CAR 1 (NOR) RETIRED")], ctx);
    expect(c.kind).toBe("dnf");
    expect(c.title).toContain("Norris");
    expect(c.impact).toContain("−20");
  });
  it("ritiro di un pilota non mio: nessun impatto", () => {
    const [c] = translateRaceControl([rc("CAR 77 (BOT) RETIRED", { driver_number: 77 })], ctx);
    expect(c.impact).toBeNull();
    expect(c.sign).toBe("none");
  });
  it("penalità di tempo a un mio pilota: −5", () => {
    const [c] = translateRaceControl([rc("FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 44 (HAM) - CAUSING A COLLISION")], ctx);
    expect(c.kind).toBe("penalty");
    expect(c.impact).toContain("−5");
  });
  it("bandiera a scacchi", () => {
    const [c] = translateRaceControl([rc("CHEQUERED FLAG", { flag: "CHEQUERED" })], ctx);
    expect(c.kind).toBe("end");
  });
});

describe("previsioneViva", () => {
  it("SÌ in attesa finché non succede, poi presa", () => {
    expect(previsioneViva({ key: "safetyCar", prediction: true, happened: false, ended: false, points: 0 }).state).toBe("pending");
    expect(previsioneViva({ key: "safetyCar", prediction: true, happened: true, ended: false, points: 4 })).toEqual({ state: "presa", payoff: "Presa · +4" });
    expect(previsioneViva({ key: "safetyCar", prediction: true, happened: false, ended: true, points: 0 }).state).toBe("sbagliata");
  });
  it("NO in attesa finché la gara non finisce, sbagliata appena succede", () => {
    const pend = previsioneViva({ key: "redFlag", prediction: false, happened: false, ended: false, points: 0 });
    expect(pend.state).toBe("pending");
    expect(pend.payoff).toContain("+3");
    expect(previsioneViva({ key: "redFlag", prediction: false, happened: true, ended: false, points: 0 }).state).toBe("sbagliata");
    expect(previsioneViva({ key: "redFlag", prediction: false, happened: false, ended: true, points: 3 }).state).toBe("presa");
  });
  it("numero ritiri: sbagliata solo quando superato o a fine gara", () => {
    expect(previsioneViva({ key: "numeroDnf", prediction: 3, happened: 2, ended: false, points: 0 }).state).toBe("pending");
    expect(previsioneViva({ key: "numeroDnf", prediction: 3, happened: 4, ended: false, points: 0 }).state).toBe("sbagliata");
    expect(previsioneViva({ key: "numeroDnf", prediction: 3, happened: 3, ended: true, points: 5 }).state).toBe("presa");
    expect(previsioneViva({ key: "numeroDnf", prediction: 3, happened: 2, ended: true, points: 0 }).state).toBe("sbagliata");
  });
  it("pole vince: in attesa fino alla fine", () => {
    const p = previsioneViva({ key: "poleVince", prediction: true, happened: false, ended: false, points: 0, poleName: "Verstappen", poleLeading: true });
    expect(p.state).toBe("pending");
    expect(p.payoff).toContain("Verstappen");
    expect(previsioneViva({ key: "poleVince", prediction: true, happened: true, ended: true, points: 4 }).state).toBe("presa");
  });
  it("nessuna previsione", () => {
    expect(previsioneViva({ key: "safetyCar", prediction: null, happened: false, ended: false, points: 0 }).state).toBe("none");
  });
});

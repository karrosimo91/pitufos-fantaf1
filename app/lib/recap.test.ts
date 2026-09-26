import { describe, it, expect } from "vitest";
import { buildRecap, recapShareText } from "./recap";
import type { RaceWeekendResults } from "./scoring";

const results: RaceWeekendResults = {
  qualifying: [
    { driver_number: 1, position: 1 }, { driver_number: 3, position: 2 }, { driver_number: 63, position: 3 },
    { driver_number: 16, position: 4 }, { driver_number: 44, position: 5 }, { driver_number: 77, position: 20 },
  ],
  race: [
    { driver_number: 3, position: 1, grid_position: 2, fastest_lap: true },
    { driver_number: 1, position: 2, grid_position: 1 },
    { driver_number: 63, position: 3, grid_position: 3 },
    { driver_number: 16, position: 4, grid_position: 4 },
    { driver_number: 44, position: 22, grid_position: 5, dnf: true },
    { driver_number: 77, position: 10, grid_position: 20 },
  ],
  events: { safety_car: true, virtual_safety_car: false, red_flag: false, wet_tyres: false, pole_won: false, total_dnf: 1 },
};
const prices = new Map<number, number>([[1, 36], [3, 36], [63, 12], [16, 9], [44, 28], [77, 7]]);

describe("buildRecap", () => {
  const recap = buildRecap(
    results, [1, 3, 63, 16, 44], 44,
    { safetyCar: true, virtualSafetyCar: false, redFlag: true, gommeWet: false, poleVince: false, numeroDnf: 1 },
    { chipPiloti: null, chipPilotiTarget: null, sestoUomo: null },
    { chipAttivo: null, chipTarget: null },
    10, prices,
  );
  it("totale al netto della penalità e dettaglio per pilota con sessioni", () => {
    expect(recap.penalitaCambi).toBe(10);
    expect(recap.total).toBe(recap.pilotiPoints + recap.previsioniPoints - 10);
    const ham = recap.drivers.find((d) => d.driver_number === 44)!;
    expect(ham.role).toBe("captain");
    expect(ham.sessions.map((s) => s.label)).toEqual(["Qualifiche", "Gara"]);
    expect(ham.puntiFinali).toBe(ham.puntiBase * 2);
    expect(ham.adjustment?.label).toBe("Primo Pilota ×2");
  });
  it("migliore e peggiore scelta", () => {
    expect(recap.best?.driver_number).toBe(3);
    expect(recap.worst?.driver_number).toBe(44);
  });
  it("capitano giusto: Verstappen invece di Hamilton", () => {
    expect(recap.captainWhatIf?.driver_number).toBe(3);
    expect(recap.captainWhatIf!.delta).toBeGreaterThan(0);
  });
  it("previsioni: prese, sbagliate e massimo possibile", () => {
    const sc = recap.previsioni.find((p) => p.key === "safetyCar")!;
    expect(sc.points).toBe(4);
    const rf = recap.previsioni.find((p) => p.key === "redFlag")!;
    expect(rf.points).toBe(0);
    expect(rf.possible).toBe(3);
    expect(recap.previsioniPossible).toBe(4 + 5 + 3 + 2 + 7 + 5);
    expect(recap.previsioniPoints).toBe(4 + 5 + 2 + 7 + 5);
  });
  it("rosa perfetta entro budget", () => {
    expect(recap.perfect).not.toBeNull();
    expect(recap.perfect!.drivers).toHaveLength(5);
    const cost = recap.perfect!.drivers.reduce((s, n) => s + (prices.get(n) ?? 0), 0);
    expect(cost).toBeLessThanOrEqual(100);
    expect(recap.perfect!.points).toBeGreaterThanOrEqual(recap.pilotiPoints);
  });
  it("senza gara: niente previsioni", () => {
    const r = buildRecap({ ...results, race: [] }, [1, 3], 1, { safetyCar: true, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null }, { chipPiloti: null, chipPilotiTarget: null, sestoUomo: null }, { chipAttivo: null, chipTarget: null }, 0, prices);
    expect(r.previsioni).toHaveLength(0);
    expect(r.previsioniPoints).toBe(0);
  });
});

describe("recapShareText", () => {
  it("classifica e riga personale", () => {
    const t = recapShareText("Baku", "Los Pitufos", [{ name: "Marco", points: 71 }, { name: "Simo", points: 67 }], { points: 67, position: 2, best: "Verstappen +38", worst: "Bottas −10" });
    expect(t).toContain("1. Marco 71");
    expect(t).toContain("Il mio weekend: +67 (2°)");
  });
});

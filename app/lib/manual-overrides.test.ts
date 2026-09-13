import { describe, it, expect } from "vitest";
import { applyRaceOverrides, RACE_OVERRIDES } from "./manual-overrides";

describe("applyRaceOverrides", () => {
  it("Monaco 2026: Gasly 7°, Hadjar 3° anche se OpenF1 dice il contrario", () => {
    const openf1 = [
      { driver_number: 12, position: 1 },
      { driver_number: 44, position: 2 },
      { driver_number: 10, position: 3 },
      { driver_number: 6, position: 4 },
      { driver_number: 81, position: 5 },
      { driver_number: 30, position: 6 },
      { driver_number: 41, position: 7 },
      { driver_number: 23, position: 8 },
    ];
    const { race, modifiche } = applyRaceOverrides(8, openf1);
    const pos = (n: number) => race.find((r) => r.driver_number === n)?.position;
    expect(pos(10)).toBe(7);
    expect(pos(6)).toBe(3);
    expect(pos(81)).toBe(4);
    expect(pos(30)).toBe(5);
    expect(pos(41)).toBe(6);
    expect(pos(12)).toBe(1);
    expect(pos(23)).toBe(8);
    expect(modifiche).toHaveLength(5);
    // posizioni univoche dopo l'override
    expect(new Set(race.map((r) => r.position)).size).toBe(race.length);
  });

  it("se OpenF1 è già allineato non tocca niente", () => {
    const ok = Object.entries(RACE_OVERRIDES[8].positions).map(([n, p]) => ({ driver_number: Number(n), position: p }));
    expect(applyRaceOverrides(8, ok).modifiche).toEqual([]);
  });

  it("round senza override: identità", () => {
    const rows = [{ driver_number: 1, position: 1 }];
    expect(applyRaceOverrides(16, rows).race).toBe(rows);
  });
});

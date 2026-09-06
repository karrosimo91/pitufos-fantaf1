import { describe, it, expect } from "vitest";
import { buildGridMap } from "./starting-grid";
import { calcolaGara } from "./scoring";

describe("buildGridMap", () => {
  it("usa starting_grid quando disponibile", () => {
    const { grid, source } = buildGridMap(
      [
        { driver_number: 44, position: 20 },
        { driver_number: 1, position: 1 },
      ],
      [
        { driver_number: 44, position: 7 },
        { driver_number: 1, position: 2 },
      ],
    );
    expect(source).toBe("starting_grid");
    expect(grid.get(44)).toBe(20);
    expect(grid.get(1)).toBe(1);
  });

  it("torna alla qualifica se starting_grid è vuoto o assente", () => {
    const q = [{ driver_number: 44, position: 7 }];
    expect(buildGridMap([], q).source).toBe("qualifying");
    expect(buildGridMap(undefined, q).grid.get(44)).toBe(7);
    expect(buildGridMap(null, q).grid.get(44)).toBe(7);
  });

  it("ignora le righe senza driver_number o position", () => {
    const { grid, source } = buildGridMap(
      [
        { driver_number: null, position: 3 },
        { driver_number: 16, position: null },
        { driver_number: 55, position: 5 },
      ],
      [],
    );
    expect(source).toBe("starting_grid");
    expect(grid.size).toBe(1);
    expect(grid.get(55)).toBe(5);
  });

  it("senza nessuna fonte torna una mappa vuota", () => {
    const { grid, source } = buildGridMap([], []);
    expect(source).toBe("none");
    expect(grid.size).toBe(0);
  });

  it("penalità in griglia: quali P7, griglia P20, arrivo P8 → +12 posizioni", () => {
    const { grid } = buildGridMap(
      [{ driver_number: 44, position: 20 }],
      [{ driver_number: 44, position: 7 }],
    );
    const punti = calcolaGara({
      driver_number: 44,
      position: 8,
      grid_position: grid.get(44),
    });
    // P8 = +4, 20 - 8 = +12 posizioni guadagnate
    expect(punti).toBe(4 + 12);
  });
});

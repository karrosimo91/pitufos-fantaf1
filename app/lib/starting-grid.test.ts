import { describe, it, expect } from "vitest";
import { buildGridMap, resolveGrid, gridFromRacePositions, gridFromJolpicaResults } from "./starting-grid";
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

describe("gridFromRacePositions", () => {
  it("prende la prima posizione registrata di ogni pilota", () => {
    const entries = gridFromRacePositions([
      { driver_number: 44, position: 20, date: "2026-09-06T13:00:00Z" },
      { driver_number: 44, position: 12, date: "2026-09-06T13:05:00Z" },
      { driver_number: 1, position: 9, date: "2026-09-06T13:00:00Z" },
      { driver_number: 1, position: 4, date: "2026-09-06T13:10:00Z" },
    ]);
    const grid = new Map(entries.map((e) => [e.driver_number, e.position]));
    expect(grid.get(44)).toBe(20);
    expect(grid.get(1)).toBe(9);
  });

  it("non si fida dell'ordine di arrivo delle righe", () => {
    const entries = gridFromRacePositions([
      { driver_number: 16, position: 3, date: "2026-09-06T13:30:00Z" },
      { driver_number: 16, position: 4, date: "2026-09-06T13:00:00Z" },
    ]);
    expect(entries[0].position).toBe(4);
  });

  it("ignora righe senza driver o posizione", () => {
    expect(gridFromRacePositions([{ driver_number: null, position: 2, date: "x" }])).toHaveLength(0);
    expect(gridFromRacePositions(undefined)).toHaveLength(0);
  });
});

describe("gridFromJolpicaResults", () => {
  it("legge il campo grid ufficiale", () => {
    const entries = gridFromJolpicaResults([
      { grid: "20", position: "8", Driver: { permanentNumber: "44" } },
      { grid: "1", position: "1", Driver: { permanentNumber: "10" } },
    ]);
    const grid = new Map(entries.map((e) => [e.driver_number, e.position]));
    expect(grid.get(44)).toBe(20);
    expect(grid.get(10)).toBe(1);
  });

  it("grid 0 (partenza dalla pit lane) vale come ultima casella", () => {
    const rows = Array.from({ length: 22 }, (_, i) => ({
      grid: String(i + 1),
      position: String(i + 1),
      Driver: { permanentNumber: String(i + 1) },
    }));
    rows[0] = { grid: "0", position: "1", Driver: { permanentNumber: "99" } };
    const entries = gridFromJolpicaResults(rows);
    const grid = new Map(entries.map((e) => [e.driver_number, e.position]));
    expect(grid.get(99)).toBe(22);
  });
});

describe("resolveGrid", () => {
  it("prende la prima fonte non vuota nell'ordine dato", () => {
    const r = resolveGrid([
      { name: "starting_grid", entries: [] },
      { name: "jolpica_results", entries: [{ driver_number: 44, position: 20 }] },
      { name: "qualifying", entries: [{ driver_number: 44, position: 7 }] },
    ]);
    expect(r.source).toBe("jolpica_results");
    expect(r.grid.get(44)).toBe(20);
  });

  it("senza fonti valide torna none", () => {
    expect(resolveGrid([{ name: "starting_grid", entries: [] }]).source).toBe("none");
  });
});

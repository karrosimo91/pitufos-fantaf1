import { describe, it, expect } from "vitest";
import { buildPrevisioniStatus, computePlayerWeekendDetail, countsPrevisioni, lastArchivedResult } from "./player-breakdown";
import { calcolaPuntiWeekend, type RaceWeekendResults } from "./scoring";
import type { PlayerFormazione, PlayerPrevisioni } from "./use-weekend-classifica";

const EMPTY_SNAP = { positions: new Map(), raceControl: [], fastestLap: null, stints: [] };

const archivio: RaceWeekendResults = {
  qualifying: [
    { driver_number: 1, position: 1 },
    { driver_number: 4, position: 5 },
  ],
  race: [
    { driver_number: 1, position: 2, grid_position: 1, fastest_lap: true },
    { driver_number: 4, position: 20, grid_position: 5, dnf: true },
  ],
  events: { safety_car: true, virtual_safety_car: false, red_flag: false, wet_tyres: false, pole_won: false, total_dnf: 1 },
};

const formazione: PlayerFormazione = {
  user_id: "u1", scuderia_name: "S", tp_name: "T",
  driver_numbers: [1, 4], primo_pilota: 1,
  chip_piloti: null, chip_piloti_target: null, sesto_uomo: null,
};
const previsioni: PlayerPrevisioni = {
  safety_car: true, virtual_safety_car: false, red_flag: null, gomme_wet: null,
  pole_vince: false, numero_dnf: 1, chip_attivo: null, chip_target: null,
};

describe("countsPrevisioni", () => {
  it("in gara sì, in qualifica no", () => {
    expect(countsPrevisioni("Race", null)).toBe(true);
    expect(countsPrevisioni("Qualifying", archivio)).toBe(false);
  });
  it("a sessione finita solo se la gara è in archivio", () => {
    expect(countsPrevisioni("", archivio)).toBe(true);
    expect(countsPrevisioni("", { ...archivio, race: [] })).toBe(false);
  });
});

describe("computePlayerWeekendDetail a sessione finita", () => {
  it("stesso totale del calcolo ufficiale, posizioni e ritiri dall'archivio", () => {
    const d = computePlayerWeekendDetail(formazione, previsioni, EMPTY_SNAP, new Map(), archivio, "");
    const ufficiale = calcolaPuntiWeekend(
      [1, 4], 1,
      { safetyCar: true, virtualSafetyCar: false, redFlag: null, gommeWet: null, poleVince: false, numeroDnf: 1 },
      archivio,
      { chipPiloti: null, chipPilotiTarget: null, sestoUomo: null },
      undefined,
    );
    expect(d.totalPoints).toBe(ufficiale.total);
    expect(ufficiale.previsioniPoints).toBeGreaterThan(0);

    const verstappen = d.piloti.find((p) => p.driver_number === 1)!;
    expect(verstappen.position).toBe(2);
    expect(verstappen.isFastestLap).toBe(true);
    expect(d.piloti.find((p) => p.driver_number === 4)!.isDnf).toBe(true);
  });
});

describe("lastArchivedResult", () => {
  it("prende la sessione più avanzata disponibile", () => {
    expect(lastArchivedResult(4, archivio)?.position).toBe(20);
    expect(lastArchivedResult(4, { ...archivio, race: [] })?.position).toBe(5);
  });
});

describe("buildPrevisioniStatus", () => {
  it("una riga per previsione nell'ordine fisso, con detto, successo, esito e punti", () => {
    const st = buildPrevisioniStatus(
      { safetyCar: true, virtualSafetyCar: false, redFlag: null, gommeWet: false, poleVince: true, numeroDnf: 2 },
      { safety_car: true, virtual_safety_car: true, red_flag: false, wet_tyres: false, pole_won: false, total_dnf: 2 },
      { safetyCar: 4, gommeWet: 2, numeroDnf: 5 },
    );
    expect(st.map((p) => p.key)).toEqual(["safetyCar", "virtualSafetyCar", "redFlag", "gommeWet", "poleVince", "numeroDnf"]);
    expect(st[0]).toMatchObject({ label: "Safety Car", prediction: true, happened: true, correct: true, points: 4 });
    expect(st[1]).toMatchObject({ prediction: false, happened: true, correct: false, points: 0 });
    expect(st[2]).toMatchObject({ prediction: null, correct: null, points: 0 });
    expect(st[3]).toMatchObject({ prediction: false, happened: false, correct: true, points: 2 });
    expect(st[5]).toMatchObject({ key: "numeroDnf", prediction: 2, correct: true, points: 5 });
    expect(Number(st[5].happened)).toBe(2);
  });
});

describe("computePlayerWeekendDetail · previsioni e totali", () => {
  it("in archivio con la gara salvata espone totali piloti/previsioni e lo stato delle previsioni", () => {
    const d = computePlayerWeekendDetail(formazione, previsioni, EMPTY_SNAP, new Map(), archivio, "");
    expect(d.isRace).toBe(true);
    expect(d.previsioniStatus).toHaveLength(6);
    expect(d.pilotiPoints + d.previsioniPoints).toBe(d.totalPoints);
    const sc = d.previsioniStatus.find((p) => p.key === "safetyCar")!;
    expect(sc.correct).toBe(true);
    expect(sc.points).toBeGreaterThan(0);
  });

  it("in qualifica le previsioni non contano: lista vuota e zero punti previsioni", () => {
    const soloQ: RaceWeekendResults = { ...archivio, race: [] };
    const d = computePlayerWeekendDetail(formazione, previsioni, EMPTY_SNAP, new Map(), soloQ, "");
    expect(d.isRace).toBe(false);
    expect(d.previsioniStatus).toEqual([]);
    expect(d.previsioniPoints).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { buildFrameTimes, retirementTimes, snapshotAt, buildReplay, type ReplayRawData } from "./replay-round";
import type { RoundScoringInputs } from "./score-round";

// Gara di 3 giri, 3 piloti: #1 parte 1° e vince, #2 parte 2°, #3 parte 3° e
// si ritira durante il giro 2. Safety car al giro 2.
const T0 = Date.parse("2026-10-04T07:00:00Z");
const iso = (offsetSec: number) => new Date(T0 + offsetSec * 1000).toISOString();

const raw: ReplayRawData = {
  positions: [
    { driver_number: 1, position: 1, date: iso(-120) },
    { driver_number: 2, position: 2, date: iso(-120) },
    { driver_number: 3, position: 3, date: iso(-120) },
    // giro 1: #2 passa #1
    { driver_number: 2, position: 1, date: iso(30) },
    { driver_number: 1, position: 2, date: iso(30) },
    // giro 3: #1 ripassa
    { driver_number: 1, position: 1, date: iso(190) },
    { driver_number: 2, position: 2, date: iso(190) },
  ],
  raceControl: [
    { message: "SAFETY CAR DEPLOYED", date: iso(130) },
    { message: "CHEQUERED FLAG", date: iso(275) },
  ],
  laps: [
    { driver_number: 1, lap_number: 1, date_start: iso(0), lap_duration: 90 },
    { driver_number: 2, lap_number: 1, date_start: iso(0.5), lap_duration: 89 },
    { driver_number: 3, lap_number: 1, date_start: iso(1), lap_duration: 95 },
    { driver_number: 2, lap_number: 2, date_start: iso(89.5), lap_duration: 92 },
    { driver_number: 1, lap_number: 2, date_start: iso(90), lap_duration: 91 },
    { driver_number: 3, lap_number: 2, date_start: iso(96), lap_duration: null },
    { driver_number: 1, lap_number: 3, date_start: iso(181), lap_duration: 88 },
    { driver_number: 2, lap_number: 3, date_start: iso(181.5), lap_duration: 90 },
  ],
  stints: [
    { driver_number: 1, compound: "MEDIUM", lap_start: 1, lap_end: 3 },
    { driver_number: 2, compound: "MEDIUM", lap_start: 1, lap_end: 3 },
    { driver_number: 3, compound: "INTERMEDIATE", lap_start: 1, lap_end: 2 },
  ],
  sessionResult: [
    { driver_number: 1, position: 1 },
    { driver_number: 2, position: 2 },
    { driver_number: 3, position: 3, dnf: true },
  ],
};

const grid = new Map([[1, 1], [2, 2], [3, 3]]);

const scoring: RoundScoringInputs = {
  formazioni: [
    { user_id: "A", driver_numbers: [1], primo_pilota: 1, chip_piloti: null, chip_piloti_target: null, sesto_uomo: null },
    { user_id: "B", driver_numbers: [2], primo_pilota: null, chip_piloti: null, chip_piloti_target: null, sesto_uomo: null },
    { user_id: "C", driver_numbers: [3], primo_pilota: null, chip_piloti: null, chip_piloti_target: null, sesto_uomo: null },
  ],
  profiles: [
    { id: "A", team_principal_name: "Simone", scuderia_name: "SC" },
    { id: "B", team_principal_name: "Stefano", scuderia_name: "ST" },
    { id: "C", team_principal_name: "Claudio", scuderia_name: "CL" },
  ],
  previsioni: [
    { user_id: "A", safety_car: true, virtual_safety_car: null, red_flag: null, gomme_wet: null, pole_vince: null, numero_dnf: null },
    { user_id: "B", safety_car: false, virtual_safety_car: null, red_flag: null, gomme_wet: null, pole_vince: null, numero_dnf: null },
  ],
  cambiPerUser: new Map(),
};

const previousResults = {
  qualifying: [
    { driver_number: 1, position: 1 },
    { driver_number: 2, position: 2 },
    { driver_number: 3, position: 3 },
  ],
  race: [],
  events: { safety_car: false, virtual_safety_car: false, red_flag: false, wet_tyres: false, pole_won: false, total_dnf: 0 },
};

describe("buildFrameTimes", () => {
  it("un fotogramma per giro, il primo prima del via e l'ultimo senza limite", () => {
    const { totalLaps, times } = buildFrameTimes(raw.laps);
    expect(totalLaps).toBe(3);
    expect(times).toHaveLength(4);
    expect(times[0]).toBe(T0 - 1);
    expect(times[1]).toBe(T0 + 89_500); // il leader (#2) inizia il giro 2
    expect(times[2]).toBe(T0 + 181_000);
    expect(times[3]).toBe(Infinity);
  });

  it("senza giri resta solo il fotogramma finale", () => {
    expect(buildFrameTimes([])).toEqual({ totalLaps: 0, times: [Infinity] });
  });
});

describe("retirementTimes", () => {
  it("colloca il ritiro alla fine dell'ultimo giro registrato", () => {
    const r = retirementTimes(raw.sessionResult, raw.laps, new Set());
    expect(r.size).toBe(1);
    expect(r.get(3)).toBe(T0 + 96_000); // giro 2 iniziato, senza durata
  });
  it("chi non ha giri è ritirato dal via; la forza maggiore non conta", () => {
    const rows = [{ driver_number: 9, dns: true }, { driver_number: 6, dnf: true }];
    const r = retirementTimes(rows, [], new Set([6]));
    expect(r.get(9)).toBe(-Infinity);
    expect(r.has(6)).toBe(false);
  });
});

describe("snapshotAt", () => {
  it("prende l'ultima posizione, i messaggi e il giro veloce completati entro t", () => {
    const retired = retirementTimes(raw.sessionResult, raw.laps, new Set());
    const snap = snapshotAt(raw, T0 + 181_000, 2, retired, new Set());
    expect(snap.positions.get(2)?.position).toBe(1);
    expect(snap.positions.get(1)?.position).toBe(2);
    expect(snap.raceControl).toHaveLength(1);
    // giri completi entro t: #2 g1 (89s), #1 g1 (90s), #2 g2, #1 g2 → il più veloce è #2 (89)
    expect(snap.fastestLap).toEqual({ driver_number: 2, duration: 89 });
    expect(snap.retiredDrivers?.has(3)).toBe(true);
    expect(snap.stints.some((s) => s.compound === "INTERMEDIATE")).toBe(true);
  });
});

describe("buildReplay", () => {
  const replay = buildReplay({ raw, grid, previousResults, scoring });

  it("fotogramma 0: solo qualifica, niente previsioni, griglia come classifica piloti", () => {
    const f0 = replay.frames[0];
    expect(f0.lap).toBe(0);
    expect(f0.drivers.map((d) => d.number)).toEqual([1, 2, 3]);
    const a = f0.players.find((p) => p.user_id === "A")!;
    expect(a.points).toBe(16); // pole +8, capitano x2
    expect(a.previsioni).toBe(0);
    expect(f0.players[0].user_id).toBe("A");
  });

  it("giro 1: #2 in testa, chi ha detto NO safety car prende i punti (per ora)", () => {
    const f1 = replay.frames[1];
    expect(f1.label).toBe("Giro 1/3");
    expect(f1.drivers[0].number).toBe(2);
    const b = f1.players.find((p) => p.user_id === "B")!;
    // qualifica P2 +6, gara P1 +25 e +1 posizione, giro veloce +3 (89s), NO SC +6
    expect(b.previsioni).toBe(6);
    expect(b.points).toBe(6 + 25 + 1 + 3 + 6);
    // A: (pole +8, P2 +18, una posizione persa -1) x2 capitano = 50: resta davanti
    const a = f1.players.find((p) => p.user_id === "A")!;
    expect(a.points).toBe(50);
    expect(f1.players.map((p) => p.user_id)).toEqual(["A", "B", "C"]);
  });

  it("giro 2: safety car uscita, ritiro di #3 già contato", () => {
    const f2 = replay.frames[2];
    expect(f2.events.safety_car).toBe(true);
    expect(f2.events.total_dnf).toBe(1);
    const c = f2.players.find((p) => p.user_id === "C")!;
    expect(c.points).toBe(4 - 10); // qualifica P3 +4, ritiro -10
    const a = f2.players.find((p) => p.user_id === "A")!;
    expect(a.previsioni).toBe(4); // SI safety car
    expect(f2.drivers.find((d) => d.number === 3)?.dnf).toBe(true);
  });

  it("bandiera a scacchi: #1 vince col giro veloce (88s) e la classifica torna a Simone", () => {
    const last = replay.frames[replay.frames.length - 1];
    expect(last.label).toBe("Bandiera a scacchi");
    expect(last.at).toBeNull();
    expect(last.drivers.map((d) => d.number)).toEqual([1, 2, 3]);
    const a = last.players.find((p) => p.user_id === "A")!;
    // (pole +8 + P1 +25 + giro veloce +3) x2 capitano = 72, SC +4 → 76
    expect(a.points).toBe(76);
    expect(last.players[0].user_id).toBe("A");
    expect(last.players.map((p) => p.rank)).toEqual([1, 2, 3]);
  });

  it("forza maggiore: pilota a 0, fuori dal conteggio ritiri", () => {
    const r = buildReplay({ raw, grid, previousResults, scoring, forzaMaggiore: new Set([3]) });
    const last = r.frames[r.frames.length - 1];
    expect(last.events.total_dnf).toBe(0);
    expect(last.drivers.find((d) => d.number === 3)).toBeUndefined();
    const c = last.players.find((p) => p.user_id === "C")!;
    expect(c.points).toBe(4); // resta la qualifica
  });
});

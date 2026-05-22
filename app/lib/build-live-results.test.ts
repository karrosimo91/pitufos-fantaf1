import { describe, it, expect } from "vitest";
import {
  classifySession,
  detectLiveEvents,
  buildLiveWeekendResults,
  type LiveSnapshot,
} from "./build-live-results";
import type { RaceWeekendResults } from "./scoring";

function emptySnap(): LiveSnapshot {
  return {
    positions: new Map(),
    raceControl: [],
    fastestLap: null,
    stints: [],
  };
}

describe("classifySession", () => {
  it("riconosce qualifying", () => expect(classifySession("Qualifying")).toBe("qualifying"));
  it("riconosce race", () => expect(classifySession("Race")).toBe("race"));
  it("riconosce sprint shootout", () => expect(classifySession("Sprint Qualifying")).toBe("sprint_shootout"));
  it("riconosce sprint race", () => {
    expect(classifySession("Sprint")).toBe("sprint");
    expect(classifySession("Sprint Race")).toBe("sprint");
  });
  it("case-insensitive", () => {
    expect(classifySession("RACE")).toBe("race");
    expect(classifySession("qualifying")).toBe("qualifying");
  });
  it("sconosciuto → unknown", () => expect(classifySession("Practice")).toBe("unknown"));
});

describe("detectLiveEvents", () => {
  it("nessun evento da snapshot vuoto", () => {
    const e = detectLiveEvents(emptySnap());
    expect(e.safetyCar).toBe(false);
    expect(e.virtualSafetyCar).toBe(false);
    expect(e.redFlag).toBe(false);
    expect(e.wetTyres).toBe(false);
    expect(e.totalDnf).toBe(0);
  });

  it("Safety Car da race_control", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      raceControl: [{ message: "SAFETY CAR DEPLOYED", date: "2026-01-01" }],
    };
    expect(detectLiveEvents(snap).safetyCar).toBe(true);
  });

  it("VSC NON conta come Safety Car", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      raceControl: [{ message: "VIRTUAL SAFETY CAR DEPLOYED", date: "2026-01-01" }],
    };
    const e = detectLiveEvents(snap);
    expect(e.safetyCar).toBe(false);
    expect(e.virtualSafetyCar).toBe(true);
  });

  it("VSC abbreviato funziona", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      raceControl: [{ message: "VSC ENDING", date: "2026-01-01" }],
    };
    expect(detectLiveEvents(snap).virtualSafetyCar).toBe(true);
  });

  it("Red Flag via flag=RED", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      raceControl: [{ message: "anything", flag: "RED", date: "2026-01-01" }],
    };
    expect(detectLiveEvents(snap).redFlag).toBe(true);
  });

  it("Red Flag via messaggio", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      raceControl: [{ message: "RED FLAG SHOWN", date: "2026-01-01" }],
    };
    expect(detectLiveEvents(snap).redFlag).toBe(true);
  });

  it("CHEQUERED + RED FLAG (fine gara) NON conta come red flag", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      raceControl: [{ message: "CHEQUERED FLAG · RED FLAG ON RACE", date: "2026-01-01" }],
    };
    expect(detectLiveEvents(snap).redFlag).toBe(false);
  });

  it("DNF: contati i driver retired", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      raceControl: [
        { message: "CAR 77 RETIRED", driver_number: 77, date: "2026-01-01" },
        { message: "CAR 5 OUT OF THE RACE", driver_number: 5, date: "2026-01-01" },
      ],
    };
    const e = detectLiveEvents(snap);
    expect(e.totalDnf).toBe(2);
    expect(e.dnfDrivers.has(77)).toBe(true);
    expect(e.dnfDrivers.has(5)).toBe(true);
  });

  it("DNF stesso driver due volte: conta una sola volta", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      raceControl: [
        { message: "CAR 77 RETIRED", driver_number: 77, date: "2026-01-01" },
        { message: "CAR 77 DID NOT FINISH", driver_number: 77, date: "2026-01-01" },
      ],
    };
    expect(detectLiveEvents(snap).totalDnf).toBe(1);
  });

  it("Wet tyres: rilevati da stints WET o INTERMEDIATE", () => {
    const snap1: LiveSnapshot = {
      ...emptySnap(),
      stints: [{ driver_number: 1, compound: "WET", date: "2026-01-01" }],
    };
    expect(detectLiveEvents(snap1).wetTyres).toBe(true);

    const snap2: LiveSnapshot = {
      ...emptySnap(),
      stints: [{ driver_number: 1, compound: "INTERMEDIATE", date: "2026-01-01" }],
    };
    expect(detectLiveEvents(snap2).wetTyres).toBe(true);
  });

  it("stints solo SOFT/MED/HARD: no wet", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      stints: [
        { driver_number: 1, compound: "SOFT", date: "2026-01-01" },
        { driver_number: 2, compound: "HARD", date: "2026-01-01" },
      ],
    };
    expect(detectLiveEvents(snap).wetTyres).toBe(false);
  });
});

describe("buildLiveWeekendResults", () => {
  const makePrev = (): RaceWeekendResults => ({
    qualifying: [{ driver_number: 1, position: 1 }],
    race: [],
    events: { safety_car: false, virtual_safety_car: false, red_flag: false, wet_tyres: false, pole_won: false, total_dnf: 0 },
  });

  it("sessione corrente race: usa positions live per la gara, mantiene qualifica storica", () => {
    const snap: LiveSnapshot = {
      positions: new Map([
        [1, { driver_number: 1, position: 2, date: "2026-01-01" }],
        [3, { driver_number: 3, position: 1, date: "2026-01-01" }],
      ]),
      raceControl: [],
      fastestLap: null,
      stints: [],
    };
    const events = detectLiveEvents(snap);
    const out = buildLiveWeekendResults("Race", snap, events, new Map(), makePrev());

    // Quali: dalle previous
    expect(out.qualifying).toHaveLength(1);
    expect(out.qualifying[0].position).toBe(1);

    // Race: dalle live
    expect(out.race).toHaveLength(2);
    expect(out.race.find(r => r.driver_number === 3)!.position).toBe(1);
  });

  it("sessione qualifying: race resta vuota", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      positions: new Map([[1, { driver_number: 1, position: 1, date: "2026-01-01" }]]),
    };
    const out = buildLiveWeekendResults("Qualifying", snap, detectLiveEvents(snap), new Map(), null);
    expect(out.qualifying).toHaveLength(1);
    expect(out.race).toHaveLength(0);
  });

  it("eventi gara: applicati solo se sessione corrente è race", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      positions: new Map([[1, { driver_number: 1, position: 1, date: "2026-01-01" }]]),
      raceControl: [{ message: "SAFETY CAR DEPLOYED", date: "2026-01-01" }],
    };
    const events = detectLiveEvents(snap);

    // In qualifica: l'evento "safety car" della quali è ignorato
    const qOut = buildLiveWeekendResults("Qualifying", snap, events, new Map(), null);
    expect(qOut.events.safety_car).toBe(false);

    // In gara: l'evento viene applicato
    const rOut = buildLiveWeekendResults("Race", snap, events, new Map(), null);
    expect(rOut.events.safety_car).toBe(true);
  });

  it("pole_won: true se il pole sitter è P1 in gara", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      positions: new Map([
        [1, { driver_number: 1, position: 1, date: "2026-01-01" }], // pole = #1, e P1 in gara
      ]),
    };
    const out = buildLiveWeekendResults("Race", snap, detectLiveEvents(snap), new Map(), null, 1);
    expect(out.events.pole_won).toBe(true);
  });

  it("pole_won: false se il pole sitter non è P1", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      positions: new Map([
        [1, { driver_number: 1, position: 5, date: "2026-01-01" }],
      ]),
    };
    const out = buildLiveWeekendResults("Race", snap, detectLiveEvents(snap), new Map(), null, 1);
    expect(out.events.pole_won).toBe(false);
  });

  it("grid_position applicato solo in race", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      positions: new Map([[1, { driver_number: 1, position: 3, date: "2026-01-01" }]]),
    };
    const grid = new Map<number, number>([[1, 10]]);

    const rOut = buildLiveWeekendResults("Race", snap, detectLiveEvents(snap), grid, null);
    expect(rOut.race[0].grid_position).toBe(10);

    // In qualifying il grid non viene attaccato ai DriverResult
    const qOut = buildLiveWeekendResults("Qualifying", snap, detectLiveEvents(snap), grid, null);
    expect(qOut.qualifying[0].grid_position).toBeUndefined();
  });

  it("DNF rilevati popolano il dnf flag dei DriverResult", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      positions: new Map([[77, { driver_number: 77, position: 22, date: "2026-01-01" }]]),
      raceControl: [{ message: "CAR 77 RETIRED", driver_number: 77, date: "2026-01-01" }],
    };
    const out = buildLiveWeekendResults("Race", snap, detectLiveEvents(snap), new Map(), null);
    expect(out.race[0].dnf).toBe(true);
  });

  it("fastest_lap applicato al pilota giusto", () => {
    const snap: LiveSnapshot = {
      ...emptySnap(),
      positions: new Map([[1, { driver_number: 1, position: 1, date: "2026-01-01" }]]),
      fastestLap: { driver_number: 1, duration: 78.123 },
    };
    const out = buildLiveWeekendResults("Race", snap, detectLiveEvents(snap), new Map(), null);
    expect(out.race[0].fastest_lap).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { deriveStats, PUNTI_REALE, type StatsRaw } from "./use-statistiche";
import type { RaceWeekendResults } from "./scoring";

function emptyResults(over: Partial<RaceWeekendResults["events"]> = {}, withRace = true): RaceWeekendResults {
  return {
    qualifying: [],
    race: withRace ? [{ driver_number: 1, position: 1 }] : [],
    events: {
      safety_car: false,
      virtual_safety_car: false,
      red_flag: false,
      wet_tyres: false,
      pole_won: false,
      total_dnf: 0,
      ...over,
    },
  };
}

function raw(over: Partial<StatsRaw> = {}): StatsRaw {
  return {
    loading: false,
    error: null,
    players: [
      { userId: "a", tpName: "Anna", scuderiaName: "SA" },
      { userId: "b", tpName: "Bruno", scuderiaName: "SB" },
      { userId: "c", tpName: "Carlo", scuderiaName: "SC" },
    ],
    scores: [],
    results: new Map(),
    formazioni: [],
    previsioni: [],
    ...over,
  };
}

const score = (u: string, r: number, total: number, piloti = total, prev = 0) => ({
  user_id: u,
  round: r,
  total_points: total,
  piloti_points: piloti,
  previsioni_points: prev,
});

describe("deriveStats — riepiloghi partecipanti", () => {
  it("cumula i punti e assegna posizione round per round", () => {
    const d = deriveStats(
      raw({ scores: [score("a", 1, 10), score("b", 1, 20), score("a", 2, 30), score("b", 2, 5)] }),
      1,
      24,
    );
    expect(d.rounds).toEqual([1, 2]);
    expect(d.season.get("a")!.cumulative).toEqual([10, 40]);
    expect(d.season.get("b")!.cumulative).toEqual([20, 25]);
    // Bruno guida dopo R1, Anna passa dopo R2
    expect(d.season.get("a")!.positions).toEqual([2, 1]);
    expect(d.season.get("b")!.positions).toEqual([1, 2]);
  });

  it("lascia null i round prima del primo punteggio di un giocatore", () => {
    const d = deriveStats(raw({ scores: [score("a", 1, 10), score("a", 2, 5), score("b", 2, 7)] }), 1, 24);
    expect(d.season.get("b")!.cumulative).toEqual([null, 7]);
    expect(d.season.get("b")!.positions).toEqual([null, 2]);
    // Carlo non ha punteggi: nessuna posizione
    expect(d.season.get("c")!.cumulative).toEqual([null, null]);
  });

  it("conta vittorie, podi e punti della Classifica Reale", () => {
    const d = deriveStats(
      raw({
        scores: [
          score("a", 1, 100), score("b", 1, 90), score("c", 1, 80),
          score("a", 2, 10), score("b", 2, 50), score("c", 2, 30),
        ],
      }),
      1,
      24,
    );
    const a = d.summaries.find((s) => s.userId === "a")!;
    const b = d.summaries.find((s) => s.userId === "b")!;
    expect(a.wins).toBe(1);
    expect(a.podiums).toBe(2);
    expect(a.points).toBe(110);
    expect(a.avg).toBe(55);
    expect(a.best).toEqual({ round: 1, points: 100 });
    expect(a.worst).toEqual({ round: 2, points: 10 });
    // Anna: P1 + P3 · Bruno: P2 + P1
    expect(a.realPoints).toBe(PUNTI_REALE[0] + PUNTI_REALE[2]);
    expect(b.realPoints).toBe(PUNTI_REALE[1] + PUNTI_REALE[0]);
  });

  it("ordina i riepiloghi per punti totali e registra il vincitore di ogni weekend", () => {
    const d = deriveStats(
      raw({ scores: [score("a", 1, 10), score("b", 1, 40), score("c", 1, 20), score("a", 2, 100)] }),
      1,
      24,
    );
    expect(d.summaries.map((s) => s.userId)).toEqual(["a", "b", "c"]);
    expect(d.roundWinners).toEqual([
      { round: 1, userId: "b", points: 40 },
      { round: 2, userId: "a", points: 100 },
    ]);
    expect(d.bestWeekend).toEqual({ userId: "a", round: 2, points: 100 });
    expect(d.worstWeekend).toEqual({ userId: "a", round: 1, points: 10 });
  });
});

describe("deriveStats — previsioni ed eventi", () => {
  const results = new Map<number, RaceWeekendResults>([
    [1, emptyResults({ safety_car: true, total_dnf: 3 })],
    // Round senza gara calcolata: non deve contare
    [2, emptyResults({ safety_car: true }, false)],
  ]);

  const previsioni = [
    { user_id: "a", round: 1, safety_car: true, virtual_safety_car: false, red_flag: null, gomme_wet: null, pole_vince: null, numero_dnf: 3, chip_attivo: "doppia" },
    { user_id: "b", round: 1, safety_car: false, virtual_safety_car: true, red_flag: null, gomme_wet: null, pole_vince: null, numero_dnf: 1, chip_attivo: null },
    { user_id: "a", round: 2, safety_car: true, virtual_safety_car: null, red_flag: null, gomme_wet: null, pole_vince: null, numero_dnf: 0, chip_attivo: null },
  ];

  it("conta solo i round con gara calcolata", () => {
    const d = deriveStats(raw({ results, previsioni }), 1, 24);
    const sc = d.previsioniAccuracy.find((x) => x.key === "safety_car")!;
    expect(sc.total).toBe(2); // solo il round 1, due giocatori
    expect(sc.correct).toBe(1); // solo Anna ha detto SI

    const a = d.playerAccuracy.find((x) => x.userId === "a")!;
    expect(a).toMatchObject({ correct: 2, total: 2, dnfHits: 1, dnfTotal: 1 });
    const b = d.playerAccuracy.find((x) => x.userId === "b")!;
    expect(b).toMatchObject({ correct: 0, total: 2, dnfHits: 0, dnfTotal: 1 });
  });

  it("aggrega gli eventi della stagione e i chip usati", () => {
    const d = deriveStats(raw({ results, previsioni }), 1, 24);
    expect(d.racesWithResults).toBe(1);
    expect(d.events.find((e) => e.key === "safety_car")).toMatchObject({ happened: 1, total: 1 });
    expect(d.totalDnf).toBe(3);
    expect(d.chipUsage.find((c) => c.userId === "a")!.previsioni).toEqual(["doppia"]);
    expect(d.chipUsage.find((c) => c.userId === "b")!.previsioni).toEqual([]);
  });
});

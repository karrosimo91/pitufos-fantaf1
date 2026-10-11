import { describe, it, expect } from "vitest";
import { buildClassificaGeneraleLive, buildDuelliLive, buildDuelloStorico } from "./classifica-generale-live";

const season = [
  { user_id: "a", team_principal_name: "Anna", scuderia_name: "A Racing", total_points: 300 },
  { user_id: "b", team_principal_name: "Bruno", scuderia_name: "B Racing", total_points: 290 },
  { user_id: "c", team_principal_name: "Carla", scuderia_name: "C Racing", total_points: 250 },
  { user_id: "d", team_principal_name: "Dario", scuderia_name: "D Racing", total_points: 100 },
];

describe("buildClassificaGeneraleLive", () => {
  it("ordina per totale con il live sommato e calcola i distacchi da chi precede e dal leader", () => {
    const rows = buildClassificaGeneraleLive(season, new Map(), new Map([["b", 20], ["c", 5]]), "c");
    expect(rows.map((r) => r.userId)).toEqual(["b", "a", "c", "d"]);
    expect(rows.map((r) => r.total)).toEqual([310, 300, 255, 100]);
    expect(rows.map((r) => r.gapAhead)).toEqual([null, 10, 45, 155]);
    expect(rows.map((r) => r.gapLeader)).toEqual([0, 10, 55, 210]);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4]);
    expect(rows.find((r) => r.userId === "c")?.isMe).toBe(true);
  });

  it("non conta due volte le sessioni del round già in classifica_totale", () => {
    // Qualifica già calcolata: 12 punti di "a" sono già nel totale e anche nel live cumulativo.
    const rows = buildClassificaGeneraleLive(season, new Map([["a", 12]]), new Map([["a", 30]]));
    const a = rows.find((r) => r.userId === "a")!;
    expect(a.totalBefore).toBe(288);
    expect(a.total).toBe(318);
    expect(a.liveWeekend).toBe(30);
  });

  it("ricorda la posizione a inizio weekend", () => {
    const rows = buildClassificaGeneraleLive(season, new Map(), new Map([["b", 20]]));
    const b = rows.find((r) => r.userId === "b")!;
    const a = rows.find((r) => r.userId === "a")!;
    expect(b.position).toBe(1);
    expect(b.positionBefore).toBe(2);
    expect(a.position).toBe(2);
    expect(a.positionBefore).toBe(1);
  });

  it("senza live la classifica è quella di stagione", () => {
    const rows = buildClassificaGeneraleLive(season, new Map(), new Map());
    expect(rows.map((r) => r.userId)).toEqual(["a", "b", "c", "d"]);
    expect(rows.every((r) => r.position === r.positionBefore)).toBe(true);
    expect(rows.every((r) => r.liveWeekend === 0)).toBe(true);
  });

  it("pari punti: ordine stabile per nome, indipendente dall'ordine di arrivo", () => {
    const pari = [
      { user_id: "y", team_principal_name: "Yuri", scuderia_name: "Y", total_points: 50 },
      { user_id: "x", team_principal_name: "Xavier", scuderia_name: "X", total_points: 50 },
    ];
    const r1 = buildClassificaGeneraleLive(pari, new Map(), new Map());
    const r2 = buildClassificaGeneraleLive([...pari].reverse(), new Map(), new Map());
    expect(r1.map((r) => r.userId)).toEqual(["x", "y"]);
    expect(r2.map((r) => r.userId)).toEqual(["x", "y"]);
    expect(r1[1].gapAhead).toBe(0);
  });
});

describe("buildDuelliLive", () => {
  it("costruisce un duello per ogni coppia di posizioni adiacenti", () => {
    const rows = buildClassificaGeneraleLive(season, new Map(), new Map(), "c");
    const duelli = buildDuelliLive(rows);
    expect(duelli).toHaveLength(3);
    expect(duelli.map((d) => d.position)).toEqual([1, 2, 3]);
    expect(duelli.map((d) => [d.ahead.userId, d.behind.userId])).toEqual([["a", "b"], ["b", "c"], ["c", "d"]]);
    expect(duelli.map((d) => d.gap)).toEqual([10, 40, 150]);
    expect(duelli.map((d) => d.delta)).toEqual([0, 0, 0]);
    expect(duelli.map((d) => d.involvesMe)).toEqual([false, true, true]);
    expect(duelli.every((d) => !d.sorpasso)).toBe(true);
  });

  it("delta negativo quando chi insegue recupera, positivo quando chi precede allunga", () => {
    // b recupera 6 su a; c perde 4 da b.
    const rows = buildClassificaGeneraleLive(season, new Map(), new Map([["b", 6], ["c", 2]]));
    const duelli = buildDuelliLive(rows);
    expect(duelli[0].gap).toBe(4);
    expect(duelli[0].gapBefore).toBe(10);
    expect(duelli[0].delta).toBe(-6);
    expect(duelli[1].gap).toBe(44);
    expect(duelli[1].delta).toBe(4);
  });

  it("segnala il sorpasso quando l'ordine fra i due era inverso a inizio weekend", () => {
    const rows = buildClassificaGeneraleLive(season, new Map(), new Map([["b", 20]]));
    const duelli = buildDuelliLive(rows);
    expect(duelli[0].ahead.userId).toBe("b");
    expect(duelli[0].behind.userId).toBe("a");
    expect(duelli[0].gap).toBe(10);
    expect(duelli[0].gapBefore).toBe(-10);
    expect(duelli[0].delta).toBe(20);
    expect(duelli[0].sorpasso).toBe(true);
    expect(duelli[1].sorpasso).toBe(false);
  });

  it("con meno di due giocatori non ci sono duelli", () => {
    expect(buildDuelliLive([])).toEqual([]);
    expect(buildDuelliLive(buildClassificaGeneraleLive([season[0]], new Map(), new Map()))).toEqual([]);
  });
});

describe("buildDuelloStorico", () => {
  it("conta i weekend vinti da ciascuno e l'effetto dell'ultimo GP", () => {
    const s = buildDuelloStorico([1, 2, 3, 4], [50, 40, 30, 20], [45, 40, 35, 10]);
    expect(s.wonAhead).toBe(2);
    expect(s.wonBehind).toBe(1);
    expect(s.tied).toBe(1);
    expect(s.ultimoGp).toEqual({ round: 4, delta: 10 });
    expect(s.recent.map((r) => r.round)).toEqual([1, 2, 3, 4]);
  });

  it("salta i round in cui uno dei due non ha punteggio", () => {
    const s = buildDuelloStorico([1, 2, 3], [50, null, 30], [45, 40, undefined]);
    expect(s.wonAhead + s.wonBehind + s.tied).toBe(1);
    expect(s.ultimoGp).toEqual({ round: 1, delta: 5 });
  });

  it("limita i confronti recenti", () => {
    const rounds = Array.from({ length: 10 }, (_, i) => i + 1);
    const s = buildDuelloStorico(rounds, rounds.map(() => 1), rounds.map(() => 0), 3);
    expect(s.recent.map((r) => r.round)).toEqual([8, 9, 10]);
    expect(s.wonAhead).toBe(10);
  });

  it("senza round in comune non c'è ultimo GP", () => {
    expect(buildDuelloStorico([], [], []).ultimoGp).toBeNull();
  });
});

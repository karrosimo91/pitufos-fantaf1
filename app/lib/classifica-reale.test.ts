import { describe, it, expect } from "vitest";
import { ordinaClassificaWeekend, puntiClassificaReale, PUNTI_REALE } from "./classifica-reale";

describe("puntiClassificaReale", () => {
  it("assegna 25-18-15... in ordine di punteggio weekend", () => {
    const p = puntiClassificaReale([
      { user_id: "b", total_points: 80 },
      { user_id: "a", total_points: 120 },
      { user_id: "c", total_points: 10 },
    ]);
    expect(p.get("a")).toBe(25);
    expect(p.get("b")).toBe(18);
    expect(p.get("c")).toBe(15);
  });

  it("oltre il decimo vale 0", () => {
    const righe = Array.from({ length: 12 }, (_, i) => ({ user_id: `u${i}`, total_points: 100 - i }));
    const p = puntiClassificaReale(righe);
    expect(p.get("u9")).toBe(PUNTI_REALE[9]);
    expect(p.get("u10")).toBe(0);
    expect(p.get("u11")).toBe(0);
  });

  it("pari merito: decide prima il punteggio piloti, poi le previsioni", () => {
    const p = puntiClassificaReale([
      { user_id: "x", total_points: 100, piloti_points: 80, previsioni_points: 20 },
      { user_id: "y", total_points: 100, piloti_points: 90, previsioni_points: 10 },
    ]);
    expect(p.get("y")).toBe(25);
    expect(p.get("x")).toBe(18);
  });

  it("pari merito totale: ordine stabile per id, indipendente dall'ordine di arrivo", () => {
    const a = puntiClassificaReale([{ user_id: "b", total_points: 5 }, { user_id: "a", total_points: 5 }]);
    const b = puntiClassificaReale([{ user_id: "a", total_points: 5 }, { user_id: "b", total_points: 5 }]);
    expect(a.get("a")).toBe(25);
    expect(b.get("a")).toBe(25);
    expect(a.get("b")).toBe(18);
  });

  it("accetta i numeric di Postgres arrivati come stringhe", () => {
    const p = puntiClassificaReale([{ user_id: "a", total_points: "9" }, { user_id: "b", total_points: "10" }]);
    expect(p.get("b")).toBe(25);
  });

  it("ordinaClassificaWeekend non muta l'input", () => {
    const righe = [{ user_id: "a", total_points: 1 }, { user_id: "b", total_points: 2 }];
    ordinaClassificaWeekend(righe);
    expect(righe[0].user_id).toBe("a");
  });
});

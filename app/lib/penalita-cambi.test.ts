import { describe, it, expect } from "vitest";
import { penalitaCambi, penalitaCambiPerUser } from "./penalita-cambi";

describe("penalitaCambi", () => {
  it("2 cambi gratis, dal 3° −10 ciascuno", () => {
    expect(penalitaCambi(0, null)).toBe(0);
    expect(penalitaCambi(2, null)).toBe(0);
    expect(penalitaCambi(3, null)).toBe(10);
    expect(penalitaCambi(5, "boost")).toBe(30);
  });

  it("wildcard annulla la penalità", () => {
    expect(penalitaCambi(6, "wildcard")).toBe(0);
  });
});

describe("penalitaCambiPerUser", () => {
  it("conta i cambi per utente e restituisce solo chi ha penalità", () => {
    const formazioni = [
      { user_id: "a", chip_piloti: null },
      { user_id: "b", chip_piloti: null },
      { user_id: "c", chip_piloti: "wildcard" },
    ];
    const cambi = [
      ...Array(3).fill({ user_id: "a" }),
      ...Array(2).fill({ user_id: "b" }),
      ...Array(4).fill({ user_id: "c" }),
      ...Array(5).fill({ user_id: "senza-formazione" }),
    ];
    expect(penalitaCambiPerUser(formazioni, cambi)).toEqual({ a: 10 });
  });
});

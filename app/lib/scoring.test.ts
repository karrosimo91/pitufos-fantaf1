import { describe, it, expect } from "vitest";
import {
  calcolaQualifica,
  calcolaSprintShootout,
  calcolaSprint,
  calcolaGara,
  calcolaPuntiPrevisioni,
  calcolaPuntiPilotaBase,
  calcolaPuntiWeekend,
  aggiornaQuotazione,
  getScoreBreakdown,
  type DriverResult,
  type RaceWeekendResults,
} from "./scoring";
import type { Previsioni } from "./types";

// ─── Helper: builds a default weekend results object ───
function makeResults(overrides: Partial<RaceWeekendResults> = {}): RaceWeekendResults {
  return {
    qualifying: [],
    race: [],
    events: {
      safety_car: false,
      virtual_safety_car: false,
      red_flag: false,
      wet_tyres: false,
      pole_won: false,
      total_dnf: 0,
    },
    ...overrides,
  };
}

function emptyPrev(): Previsioni {
  return { safetyCar: null, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null };
}

// ═══════════════════════════════════════════════════════
// calcolaQualifica — regolamento CDA v1.0
// ═══════════════════════════════════════════════════════
describe("calcolaQualifica", () => {
  it("Pole: +8", () => expect(calcolaQualifica(1)).toBe(8));
  it("P2: +6", () => expect(calcolaQualifica(2)).toBe(6));
  it("P3: +4", () => expect(calcolaQualifica(3)).toBe(4));
  it("P4-P5: +3", () => {
    expect(calcolaQualifica(4)).toBe(3);
    expect(calcolaQualifica(5)).toBe(3);
  });
  it("P6-P10 (resto Q3): +2", () => {
    for (let p = 6; p <= 10; p++) expect(calcolaQualifica(p)).toBe(2);
  });
  it("P11-P16 (Q2): +1", () => {
    for (let p = 11; p <= 16; p++) expect(calcolaQualifica(p)).toBe(1);
  });
  it("P17-P22 (Q1): -1", () => {
    for (let p = 17; p <= 22; p++) expect(calcolaQualifica(p)).toBe(-1);
  });
  it("NC/DSQ/no tempo: -5", () => expect(calcolaQualifica(20, true)).toBe(-5));
});

// ═══════════════════════════════════════════════════════
// calcolaSprintShootout
// ═══════════════════════════════════════════════════════
describe("calcolaSprintShootout", () => {
  it("Pole sprint: +4", () => expect(calcolaSprintShootout(1)).toBe(4));
  it("P2: +3", () => expect(calcolaSprintShootout(2)).toBe(3));
  it("P3: +2", () => expect(calcolaSprintShootout(3)).toBe(2));
  it("P4-P10 (resto SQ3): +1", () => {
    for (let p = 4; p <= 10; p++) expect(calcolaSprintShootout(p)).toBe(1);
  });
  it("SQ2 (P11-P16): 0", () => {
    for (let p = 11; p <= 16; p++) expect(calcolaSprintShootout(p)).toBe(0);
  });
  it("SQ1 (P17-P22): -1", () => {
    for (let p = 17; p <= 22; p++) expect(calcolaSprintShootout(p)).toBe(-1);
  });
  it("NC: -3", () => expect(calcolaSprintShootout(20, true)).toBe(-3));
});

// ═══════════════════════════════════════════════════════
// calcolaSprint
// ═══════════════════════════════════════════════════════
describe("calcolaSprint", () => {
  const dr = (position: number, extra: Partial<DriverResult> = {}): DriverResult => ({
    driver_number: 1, position, ...extra,
  });

  it("P1: +8, P2: +5, P3: +4, P4: +3, P5: +2", () => {
    expect(calcolaSprint(dr(1))).toBe(8);
    expect(calcolaSprint(dr(2))).toBe(5);
    expect(calcolaSprint(dr(3))).toBe(4);
    expect(calcolaSprint(dr(4))).toBe(3);
    expect(calcolaSprint(dr(5))).toBe(2);
  });
  it("P6-P22: 0", () => {
    for (let p = 6; p <= 22; p++) expect(calcolaSprint(dr(p))).toBe(0);
  });
  it("Giro veloce sprint: +2", () => {
    expect(calcolaSprint(dr(1, { fastest_lap: true }))).toBe(8 + 2);
    expect(calcolaSprint(dr(8, { fastest_lap: true }))).toBe(2);
  });
  it("DNF sprint: -5 (annulla bonus)", () => {
    expect(calcolaSprint(dr(20, { dnf: true }))).toBe(-5);
    expect(calcolaSprint(dr(1, { dnf: true, fastest_lap: true }))).toBe(-5);
  });
});

// ═══════════════════════════════════════════════════════
// calcolaGara
// ═══════════════════════════════════════════════════════
describe("calcolaGara", () => {
  const dr = (position: number, extra: Partial<DriverResult> = {}): DriverResult => ({
    driver_number: 1, position, ...extra,
  });

  it("punti F1 (P1-P10)", () => {
    expect(calcolaGara(dr(1))).toBe(25);
    expect(calcolaGara(dr(2))).toBe(18);
    expect(calcolaGara(dr(3))).toBe(15);
    expect(calcolaGara(dr(4))).toBe(12);
    expect(calcolaGara(dr(5))).toBe(10);
    expect(calcolaGara(dr(6))).toBe(8);
    expect(calcolaGara(dr(7))).toBe(6);
    expect(calcolaGara(dr(8))).toBe(4);
    expect(calcolaGara(dr(9))).toBe(2);
    expect(calcolaGara(dr(10))).toBe(1);
    expect(calcolaGara(dr(11))).toBe(0);
    expect(calcolaGara(dr(22))).toBe(0);
  });

  it("posizioni guadagnate vs griglia: +1 per posizione", () => {
    // P3 partendo da P10 = +7 posizioni
    expect(calcolaGara(dr(3, { grid_position: 10 }))).toBe(15 + 7);
  });

  it("posizioni perse vs griglia: -1 per posizione", () => {
    // P10 partendo da P3 = -7 posizioni
    expect(calcolaGara(dr(10, { grid_position: 3 }))).toBe(1 - 7);
  });

  it("Giro veloce: +3", () => {
    expect(calcolaGara(dr(5, { fastest_lap: true }))).toBe(10 + 3);
  });

  it("Driver of the Day: +5", () => {
    expect(calcolaGara(dr(7, { driver_of_the_day: true }))).toBe(6 + 5);
  });

  it("Penalità: -5", () => {
    expect(calcolaGara(dr(4, { penalty: true }))).toBe(12 - 5);
  });

  it("DNF: -10 (azzera punti posizione e differenza griglia)", () => {
    expect(calcolaGara(dr(20, { dnf: true }))).toBe(-10);
    expect(calcolaGara(dr(20, { dnf: true, grid_position: 1 }))).toBe(-10);
    // FL e DotD valgono comunque anche se DNF? Da regolamento sembra di no, ma il codice li applica.
    // Documentiamo il comportamento corrente:
    expect(calcolaGara(dr(20, { dnf: true, fastest_lap: true }))).toBe(-10 + 3);
  });

  it("combinato realistico: P3 da P5 con FL = 15 + 2 + 3 = 20", () => {
    expect(calcolaGara(dr(3, { grid_position: 5, fastest_lap: true }))).toBe(15 + 2 + 3);
  });
});

// ═══════════════════════════════════════════════════════
// calcolaPuntiPrevisioni
// ═══════════════════════════════════════════════════════
describe("calcolaPuntiPrevisioni", () => {
  const noEvents = makeResults().events;
  const allEvents = {
    safety_car: true, virtual_safety_car: true, red_flag: true,
    wet_tyres: true, pole_won: true, total_dnf: 3,
  };

  it("nessuna previsione fatta: 0 totali", () => {
    const r = calcolaPuntiPrevisioni(emptyPrev(), noEvents);
    expect(r.total).toBe(0);
  });

  it("SI corretto: punti SI", () => {
    const r = calcolaPuntiPrevisioni({ ...emptyPrev(), safetyCar: true }, allEvents);
    expect(r.dettaglio.safetyCar).toBe(4); // PREVISIONI_PUNTI.safetyCar.si
  });

  it("NO corretto (evento NON accaduto): punti NO", () => {
    const r = calcolaPuntiPrevisioni({ ...emptyPrev(), safetyCar: false }, noEvents);
    expect(r.dettaglio.safetyCar).toBe(6); // .no
  });

  it("previsione sbagliata: 0", () => {
    const r = calcolaPuntiPrevisioni({ ...emptyPrev(), safetyCar: true }, noEvents);
    expect(r.dettaglio.safetyCar).toBe(0);
  });

  it("Numero DNF esatto: +5", () => {
    const r = calcolaPuntiPrevisioni({ ...emptyPrev(), numeroDnf: 3 }, allEvents);
    expect(r.dettaglio.numeroDnf).toBe(5);
  });

  it("Numero DNF sbagliato: 0", () => {
    const r = calcolaPuntiPrevisioni({ ...emptyPrev(), numeroDnf: 5 }, allEvents);
    expect(r.dettaglio.numeroDnf).toBe(0);
  });

  it("Chip Previsione Doppia: punti x2 se indovini", () => {
    const r = calcolaPuntiPrevisioni(
      { ...emptyPrev(), redFlag: true },
      allEvents,
      { chipAttivo: "doppia", chipTarget: "redFlag" }
    );
    expect(r.dettaglio.redFlag).toBe(14); // 7 * 2
  });

  it("Chip Doppia su DNF: x2", () => {
    const r = calcolaPuntiPrevisioni(
      { ...emptyPrev(), numeroDnf: 3 },
      allEvents,
      { chipAttivo: "doppia", chipTarget: "numeroDnf" }
    );
    expect(r.dettaglio.numeroDnf).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════
// calcolaPuntiPilotaBase — somma sessioni weekend
// ═══════════════════════════════════════════════════════
describe("calcolaPuntiPilotaBase", () => {
  it("somma qualifica + gara", () => {
    const r: RaceWeekendResults = makeResults({
      qualifying: [{ driver_number: 1, position: 1 }], // +8
      race: [{ driver_number: 1, position: 3, grid_position: 1 }], // 15 - 2
    });
    expect(calcolaPuntiPilotaBase(1, r)).toBe(8 + 13);
  });

  it("somma sprint + sprint shootout se presenti", () => {
    const r: RaceWeekendResults = makeResults({
      qualifying: [{ driver_number: 4, position: 5 }],         // +3
      sprint_shootout: [{ driver_number: 4, position: 1 }],    // +4
      sprint: [{ driver_number: 4, position: 1 }],             // +8
      race: [{ driver_number: 4, position: 2 }],               // +18
    });
    expect(calcolaPuntiPilotaBase(4, r)).toBe(3 + 4 + 8 + 18);
  });

  it("pilota non presente in nessuna sessione: 0", () => {
    expect(calcolaPuntiPilotaBase(99, makeResults())).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// calcolaPuntiWeekend — chip piloti + capitano + halo + sesto uomo
// ═══════════════════════════════════════════════════════
describe("calcolaPuntiWeekend — piloti", () => {
  const standardResults: RaceWeekendResults = makeResults({
    qualifying: [
      { driver_number: 1, position: 1 },   // +8
      { driver_number: 2, position: 3 },   // +4
      { driver_number: 3, position: 20 },  // -1
    ],
    race: [
      { driver_number: 1, position: 1 },   // +25
      { driver_number: 2, position: 5 },   // +10
      { driver_number: 3, position: 22, dnf: true }, // -10
    ],
  });

  it("primo pilota x2 sui punti totali", () => {
    const calc = calcolaPuntiWeekend([1, 2, 3], 1, emptyPrev(), standardResults);
    const p1 = calc.pilotiDettaglio.find((d) => d.driver_number === 1)!;
    expect(p1.puntiBase).toBe(8 + 25); // 33
    expect(p1.moltiplicatore).toBe(2);
    expect(p1.puntiFinali).toBe(66);
  });

  it("senza primo pilota: nessuno x2", () => {
    const calc = calcolaPuntiWeekend([1, 2, 3], null, emptyPrev(), standardResults);
    const p1 = calc.pilotiDettaglio.find((d) => d.driver_number === 1)!;
    expect(p1.moltiplicatore).toBe(1);
    expect(p1.puntiFinali).toBe(33);
  });

  it("chip Boost x3 su pilota diverso dal capitano", () => {
    const calc = calcolaPuntiWeekend([1, 2, 3], 1, emptyPrev(), standardResults, {
      chipPiloti: "boost", chipPilotiTarget: 2, sestoUomo: null,
    });
    const p2 = calc.pilotiDettaglio.find((d) => d.driver_number === 2)!;
    expect(p2.puntiBase).toBe(4 + 10);
    expect(p2.moltiplicatore).toBe(3);
    expect(p2.puntiFinali).toBe(42);
  });

  it("chip Boost NON moltiplica il capitano (solo non-capitano)", () => {
    const calc = calcolaPuntiWeekend([1, 2, 3], 1, emptyPrev(), standardResults, {
      chipPiloti: "boost", chipPilotiTarget: 1, sestoUomo: null,
    });
    const p1 = calc.pilotiDettaglio.find((d) => d.driver_number === 1)!;
    expect(p1.moltiplicatore).toBe(2); // capitano vince, no boost
  });

  it("chip Scudo Capitano: bonus x2, malus x1", () => {
    // Pilota 3 fa DNF (-10 totale, ma sommando quali -1 = -11)
    const calc = calcolaPuntiWeekend([3], 3, emptyPrev(), standardResults, {
      chipPiloti: "scudo", chipPilotiTarget: null, sestoUomo: null,
    });
    const p3 = calc.pilotiDettaglio.find((d) => d.driver_number === 3)!;
    expect(p3.puntiBase).toBe(-1 + -10); // -11
    // Scudo: se base < 0 → resta * 1 (malus invariato)
    expect(p3.puntiFinali).toBe(-11);
  });

  it("chip Scudo Capitano: bonus positivi x2", () => {
    const calc = calcolaPuntiWeekend([1], 1, emptyPrev(), standardResults, {
      chipPiloti: "scudo", chipPilotiTarget: null, sestoUomo: null,
    });
    const p1 = calc.pilotiDettaglio.find((d) => d.driver_number === 1)!;
    expect(p1.puntiBase).toBe(33);
    expect(p1.puntiFinali).toBe(66); // 33 * 2
  });

  it("chip Halo: minimo 0 punti se va in negativo", () => {
    const calc = calcolaPuntiWeekend([3], null, emptyPrev(), standardResults, {
      chipPiloti: "halo", chipPilotiTarget: null, sestoUomo: null,
    });
    const p3 = calc.pilotiDettaglio.find((d) => d.driver_number === 3)!;
    expect(p3.puntiBase).toBe(-11);
    expect(p3.puntiFinali).toBe(0);
    expect(p3.haloApplicato).toBe(true);
  });

  it("chip Halo non altera i positivi", () => {
    const calc = calcolaPuntiWeekend([1], null, emptyPrev(), standardResults, {
      chipPiloti: "halo", chipPilotiTarget: null, sestoUomo: null,
    });
    expect(calc.pilotiDettaglio[0].puntiFinali).toBe(33);
    expect(calc.pilotiDettaglio[0].haloApplicato).toBe(false);
  });

  it("chip Sesto Uomo: 6° pilota aggiunto al calcolo", () => {
    const calc = calcolaPuntiWeekend([1, 2], null, emptyPrev(), standardResults, {
      chipPiloti: "sesto", chipPilotiTarget: null, sestoUomo: 3,
    });
    expect(calc.pilotiDettaglio).toHaveLength(3);
    const p3 = calc.pilotiDettaglio.find((d) => d.driver_number === 3)!;
    expect(p3.isSestoUomo).toBe(true);
    expect(p3.puntiFinali).toBe(-11);
  });

  it("Capitano DNF (-10) raddoppia diventa -20 (no Scudo)", () => {
    const r = makeResults({
      qualifying: [{ driver_number: 1, position: 1 }], // +8
      race: [{ driver_number: 1, position: 22, dnf: true }], // -10
    });
    const calc = calcolaPuntiWeekend([1], 1, emptyPrev(), r);
    // base = 8 + (-10) = -2; capitano x2 = -4
    expect(calc.pilotiDettaglio[0].puntiFinali).toBe(-4);
  });
});

// ═══════════════════════════════════════════════════════
// getScoreBreakdown — UI dettaglio
// ═══════════════════════════════════════════════════════
describe("getScoreBreakdown", () => {
  it("qualifica: voce posizione + subtotale", () => {
    const b = getScoreBreakdown({ driver_number: 1, position: 1 }, "qualifying", false, null);
    expect(b.items).toHaveLength(1);
    expect(b.items[0].value).toBe(8);
    expect(b.finalTotal).toBe(8);
  });

  it("qualifica DNF: -5", () => {
    const b = getScoreBreakdown({ driver_number: 1, position: 20, dnf: true }, "qualifying", false, null);
    expect(b.items[0].label).toBe("NC/DSQ");
    expect(b.finalTotal).toBe(-5);
  });

  it("gara con posizioni guadagnate e FL", () => {
    const b = getScoreBreakdown(
      { driver_number: 1, position: 3, grid_position: 10, fastest_lap: true },
      "race", false, null
    );
    const labels = b.items.map((i) => i.label);
    expect(labels.some((l) => l.includes("guadagnate"))).toBe(true);
    expect(labels.some((l) => l.includes("Giro veloce"))).toBe(true);
    expect(b.finalTotal).toBe(15 + 7 + 3);
  });

  it("capitano: moltiplicatore x2 nel finalTotal", () => {
    const b = getScoreBreakdown({ driver_number: 1, position: 1 }, "race", true, null);
    expect(b.baseTotal).toBe(25);
    expect(b.moltiplicatore).toBe(2);
    expect(b.finalTotal).toBe(50);
  });

  it("chip halo applicato a negativo", () => {
    const b = getScoreBreakdown({ driver_number: 1, position: 22, dnf: true }, "race", false, "halo");
    expect(b.baseTotal).toBe(-10);
    expect(b.finalTotal).toBe(0);
  });

  it("chip scudo su capitano: positivo x2, negativo x1", () => {
    const pos = getScoreBreakdown({ driver_number: 1, position: 1 }, "race", true, "scudo");
    expect(pos.finalTotal).toBe(50);

    const neg = getScoreBreakdown({ driver_number: 1, position: 22, dnf: true }, "race", true, "scudo");
    expect(neg.finalTotal).toBe(-10); // malus non raddoppiato
  });
});

// ═══════════════════════════════════════════════════════
// aggiornaQuotazione — algoritmo CDA a fasce
// ═══════════════════════════════════════════════════════
describe("aggiornaQuotazione", () => {
  it("fascia ≥40: +3", () => {
    expect(aggiornaQuotazione(20, 50)).toBe(23);
    expect(aggiornaQuotazione(20, 40)).toBe(23);
  });
  it("fascia 25-39: +2", () => {
    expect(aggiornaQuotazione(20, 39)).toBe(22);
    expect(aggiornaQuotazione(20, 25)).toBe(22);
  });
  it("fascia 10-24: +1", () => {
    expect(aggiornaQuotazione(20, 24)).toBe(21);
    expect(aggiornaQuotazione(20, 10)).toBe(21);
  });
  it("fascia 0-9: invariato", () => {
    expect(aggiornaQuotazione(20, 9)).toBe(20);
    expect(aggiornaQuotazione(20, 0)).toBe(20);
  });
  it("fascia -1/-10: -1", () => {
    expect(aggiornaQuotazione(20, -1)).toBe(19);
    expect(aggiornaQuotazione(20, -10)).toBe(19);
  });
  it("fascia ≤-11: -2", () => {
    expect(aggiornaQuotazione(20, -11)).toBe(18);
    expect(aggiornaQuotazione(20, -50)).toBe(18);
  });

  it("clamp min a 5", () => {
    expect(aggiornaQuotazione(6, -20)).toBe(5);
    expect(aggiornaQuotazione(5, -50)).toBe(5);
  });

  it("clamp max a 45", () => {
    expect(aggiornaQuotazione(44, 100)).toBe(45);
    expect(aggiornaQuotazione(45, 100)).toBe(45);
  });

  it("simulazione multi-round: Norris (36) con 3 weekend top", () => {
    let p = 36;
    p = aggiornaQuotazione(p, 50); // +3 → 39
    p = aggiornaQuotazione(p, 45); // +3 → 42
    p = aggiornaQuotazione(p, 42); // +3 → 45
    p = aggiornaQuotazione(p, 80); // clamp → 45
    expect(p).toBe(45);
  });

  it("simulazione: Bottas (7) con un weekend disastroso", () => {
    let p = 7;
    p = aggiornaQuotazione(p, -25); // -2 → 5
    p = aggiornaQuotazione(p, -25); // clamp → 5
    expect(p).toBe(5);
  });
});

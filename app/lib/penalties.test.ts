import { describe, it, expect } from "vitest";
import {
  isRacePenaltyMessage,
  carNumberFromMessage,
  extractPenalizedDrivers,
} from "./penalties";

describe("isRacePenaltyMessage", () => {
  it("riconosce le penalità in tempo (5s/10s)", () => {
    expect(isRacePenaltyMessage("FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 44 (HAM) - SPEEDING IN THE PIT LANE")).toBe(true);
    expect(isRacePenaltyMessage("10 SECOND TIME PENALTY FOR CAR 1")).toBe(true);
  });

  it("riconosce drive through e stop and go", () => {
    expect(isRacePenaltyMessage("FIA STEWARDS: DRIVE THROUGH PENALTY FOR CAR 11 (PER)")).toBe(true);
    expect(isRacePenaltyMessage("10 SECOND STOP AND GO PENALTY FOR CAR 5")).toBe(true);
    expect(isRacePenaltyMessage("PENALTY SERVED - DRIVE THROUGH PENALTY FOR CAR 11 (PER)")).toBe(true);
  });

  it("NON conta i messaggi di processo (noted / investigation)", () => {
    expect(isRacePenaltyMessage("INCIDENT INVOLVING CAR 63 (RUS) NOTED - FALSE START")).toBe(false);
    expect(isRacePenaltyMessage("FIA STEWARDS: INCIDENT INVOLVING CAR 11 (PER) UNDER INVESTIGATION")).toBe(false);
    expect(isRacePenaltyMessage("FIA STEWARDS: INCIDENT INVOLVING CAR 11 WILL BE INVESTIGATED AFTER THE RACE")).toBe(false);
    expect(isRacePenaltyMessage("FIA STEWARDS: INCIDENT INVOLVING CAR 63 REVIEWED NO FURTHER INVESTIGATION")).toBe(false);
  });

  it("esclude penalità in griglia e reprimand", () => {
    expect(isRacePenaltyMessage("5 PLACE GRID PENALTY FOR CAR 4")).toBe(false);
    expect(isRacePenaltyMessage("REPRIMAND FOR CAR 18")).toBe(false);
  });

  it("ignora messaggi non correlati", () => {
    expect(isRacePenaltyMessage("GREEN LIGHT - PIT EXIT OPEN")).toBe(false);
    expect(isRacePenaltyMessage("YELLOW IN TRACK SECTOR 18")).toBe(false);
  });
});

describe("carNumberFromMessage", () => {
  it("estrae il numero dal testo CAR <n>", () => {
    expect(carNumberFromMessage("5 SECOND TIME PENALTY FOR CAR 44 (HAM)")).toBe(44);
    expect(carNumberFromMessage("DRIVE THROUGH PENALTY FOR CAR 11 (PER)")).toBe(11);
  });
  it("ritorna null se non c'è un numero auto", () => {
    expect(carNumberFromMessage("RED FLAG")).toBe(null);
  });
});

describe("extractPenalizedDrivers — dati reali Monaco 2026 (session 11299)", () => {
  // driver_number è null in TUTTI i messaggi dei commissari (come da API reale)
  const raceControl = [
    { driver_number: null, message: "GREEN LIGHT - PIT EXIT OPEN" },
    { driver_number: null, message: "INCIDENT INVOLVING CAR 11 (PER) NOTED - FAILING TO FOLLOW RACE DIRECTORS INSTRUCTIONS" },
    { driver_number: null, message: "INCIDENT INVOLVING CAR 63 (RUS) NOTED - FALSE START" },
    { driver_number: null, message: "FIA STEWARDS: INCIDENT INVOLVING CAR 63 (RUS) REVIEWED NO FURTHER INVESTIGATION - FALSE START" },
    { driver_number: null, message: "FIA STEWARDS: DRIVE THROUGH PENALTY FOR CAR 11 (PER) - FALSE START - OUT OF POSITION" },
    { driver_number: null, message: "FIA STEWARDS: PENALTY SERVED - DRIVE THROUGH PENALTY FOR CAR 11 (PER)" },
    { driver_number: null, message: "FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 44 (HAM) - SPEEDING IN THE PIT LANE" },
    { driver_number: null, message: "FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 63 (RUS) - SPEEDING IN THE PIT LANE" },
    { driver_number: null, message: "FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 43 (COL) - SPEEDING IN THE PIT LANE" },
    { driver_number: null, message: "FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 10 (GAS) - SPEEDING IN THE PIT LANE" },
    { driver_number: null, message: "TURN 10 INCIDENT INVOLVING CAR 18 (STR) NOTED - LEAVING THE TRACK" },
    { driver_number: null, message: "FIA STEWARDS: INCIDENT INVOLVING CAR 18 (STR) UNDER INVESTIGATION - TRACK LIMITS" },
  ];

  it("rileva i 5 piloti penalizzati: PER, HAM, RUS, COL, GAS", () => {
    const penalized = extractPenalizedDrivers(raceControl);
    expect([...penalized].sort((a, b) => a - b)).toEqual([10, 11, 43, 44, 63]);
  });

  it("non conta due volte lo stesso pilota (PER ha 2 messaggi)", () => {
    const penalized = extractPenalizedDrivers(raceControl);
    expect([...penalized].filter((n) => n === 11)).toHaveLength(1);
  });

  it("usa driver_number quando valorizzato", () => {
    const penalized = extractPenalizedDrivers([
      { driver_number: 16, message: "5 SECOND TIME PENALTY" },
    ]);
    expect(penalized.has(16)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { computePlayerScoresFrom } from "./score-round";
import type { RaceWeekendResults } from "./scoring";

const soloQualifica: RaceWeekendResults = {
  qualifying: [{ driver_number: 1, position: 1 }],
  race: [],
  events: { safety_car: false, virtual_safety_car: false, red_flag: false, wet_tyres: false, pole_won: false, total_dnf: 0 },
};

const formazione = (user_id: string, chip_piloti: string | null = null) => ({
  user_id, driver_numbers: [1], primo_pilota: null,
  chip_piloti, chip_piloti_target: null, sesto_uomo: null,
});

describe("computePlayerScoresFrom: penalità cambi", () => {
  it("vale già con la sola qualifica in archivio (non aspetta la gara)", () => {
    const scores = computePlayerScoresFrom(
      {
        formazioni: [formazione("a"), formazione("w", "wildcard")],
        profiles: [],
        previsioni: null,
        cambiPerUser: new Map([["a", 3], ["w", 5]]),
      },
      soloQualifica,
      false,
    );
    const a = scores.find((s) => s.user_id === "a")!;
    expect(a.penalita_cambi).toBe(10);
    expect(a.weekend_points).toBe(a.piloti_points - 10);
    expect(scores.find((s) => s.user_id === "w")!.penalita_cambi).toBe(0);
  });
});

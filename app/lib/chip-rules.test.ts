import { describe, it, expect } from "vitest";
import { remainingChips, chipRemaining, chipStatusText, halfEndRound, CHIP_PILOTI_RULES } from "./chip-rules";
import { ownershipRoundFor } from "./use-driver-insights";

describe("chip: usi rimasti per metà stagione", () => {
  it("un uso nella prima metà non conta nella seconda", () => {
    const used = [{ chip: "boost", round: 6 }, { chip: "halo", round: 15 }];
    const left = remainingChips(CHIP_PILOTI_RULES, used, 18).map((c) => c.id);
    expect(left).toContain("boost");
    expect(left).not.toContain("halo");
    expect(remainingChips(CHIP_PILOTI_RULES, used, 10).map((c) => c.id)).not.toContain("boost");
  });
  it("rimasto 1 se libero, 0 se usato", () => {
    expect(chipRemaining(18, null)).toBe(1);
    expect(chipRemaining(18, 15)).toBe(0);
  });
  it("fine metà e testo di stato", () => {
    expect(halfEndRound(5)).toBe(13);
    expect(halfEndRound(18)).toBe(24);
    expect(chipStatusText(18, 15)).toContain("esaurito");
    expect(chipStatusText(5, 3)).toContain("torna dopo la pausa");
    expect(chipStatusText(18, null)).toBe("Scade tra 7 GP");
  });
});

describe("ownershipRoundFor: chi lo ha in rosa", () => {
  it("prima della deadline usa l'ultimo round chiuso, dopo il corrente", () => {
    expect(ownershipRoundFor(18, true)).toBe(18);
    const before = ownershipRoundFor(18, false);
    expect(before).not.toBe(18);
    expect(before === null || before < 18).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  checkResultsReady,
  countDnf,
  mapQualifyingResults,
  MIN_DRIVERS_ATTESI,
} from "./official-results";

const FINE = "2026-09-13T15:00:00+00:00";
const DOPO = new Date("2026-09-13T16:00:00Z").getTime();
const DURANTE = new Date("2026-09-13T14:00:00Z").getTime();

function righe(n: number, extra: Record<number, { dnf?: boolean; dsq?: boolean; dns?: boolean }> = {}) {
  return Array.from({ length: n }, (_, i) => ({
    driver_number: i + 1,
    position: i + 1,
    ...(extra[i + 1] ?? {}),
  }));
}

describe("checkResultsReady", () => {
  it("passa quando la sessione è finita e ci sono tutti i piloti", () => {
    const r = checkResultsReady({
      sessionName: "Race",
      dateEnd: FINE,
      rows: righe(22),
      expectedDrivers: 22,
      now: DOPO,
    });
    expect(r.ok).toBe(true);
  });

  it("blocca se session_result è vuoto (caso Madrid round 16)", () => {
    const r = checkResultsReady({ sessionName: "Race", dateEnd: FINE, rows: [], expectedDrivers: 22, now: DOPO });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("non ha ancora pubblicato");
  });

  it("blocca se i risultati sono parziali", () => {
    const r = checkResultsReady({ sessionName: "Race", dateEnd: FINE, rows: righe(12), expectedDrivers: 22, now: DOPO });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("12 su 22");
  });

  it("blocca se la sessione non è ancora finita", () => {
    const r = checkResultsReady({ sessionName: "Race", dateEnd: FINE, rows: righe(22), expectedDrivers: 22, now: DURANTE });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("non ancora conclusa");
  });

  it("senza numero di piloti atteso usa la soglia minima", () => {
    expect(checkResultsReady({ sessionName: "Race", dateEnd: FINE, rows: righe(MIN_DRIVERS_ATTESI), now: DOPO }).ok).toBe(true);
    expect(checkResultsReady({ sessionName: "Race", dateEnd: FINE, rows: righe(MIN_DRIVERS_ATTESI - 1), now: DOPO }).ok).toBe(false);
  });

  it("senza date_end non blocca sulla durata", () => {
    expect(checkResultsReady({ sessionName: "Race", rows: righe(22), expectedDrivers: 22, now: DURANTE }).ok).toBe(true);
  });

  it("righe senza driver_number non contano", () => {
    const rows = [...righe(21), { driver_number: null, position: 22 }];
    const r = checkResultsReady({ sessionName: "Race", dateEnd: FINE, rows, expectedDrivers: 22, now: DOPO });
    expect(r.ok).toBe(false);
  });
});

describe("mapQualifyingResults", () => {
  it("NC/DSQ diventano dnf (-5 in qualifica), dns resta distinto", () => {
    const out = mapQualifyingResults(righe(3, { 1: { dsq: true }, 2: { dns: true } }));
    expect(out.find((d) => d.driver_number === 1)?.dnf).toBe(true);
    expect(out.find((d) => d.driver_number === 2)?.dnf).toBe(false);
    expect(out.find((d) => d.driver_number === 2)?.dns).toBe(true);
    expect(out.find((d) => d.driver_number === 3)?.dnf).toBe(false);
  });

  it("scarta le righe senza numero pilota", () => {
    expect(mapQualifyingResults([{ driver_number: null, position: 1 }])).toHaveLength(0);
  });
});

describe("countDnf", () => {
  it("conta ritiri e squalifiche", () => {
    expect(countDnf(righe(22, { 3: { dnf: true }, 7: { dsq: true } }))).toBe(2);
  });

  it("nessun ritiro fa 0 (e deve essere un 0 vero, non un dato mancante)", () => {
    expect(countDnf(righe(22))).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { mergeLapProgress, detectStoppedDrivers, type LapProgress, type RawLapLike } from "./live-stopped";

const T0 = Date.parse("2026-11-01T20:00:00Z");
const LAP = 80; // s

/** Giri 1..n per un pilota, partenza sfalsata di `offset` secondi */
function laps(driver: number, n: number, offset = 0, lapS = LAP): RawLapLike[] {
  return Array.from({ length: n }, (_, i) => ({
    driver_number: driver,
    lap_number: i + 1,
    // OpenF1 lascia spesso senza orario il primo giro
    date_start: i === 0 ? null : new Date(T0 + (offset + i * lapS) * 1000).toISOString(),
    lap_duration: lapS,
  }));
}

function progress(all: RawLapLike[]): Map<number, LapProgress> {
  return mergeLapProgress(new Map(), all) ?? new Map();
}

describe("detectStoppedDrivers", () => {
  it("segna chi smette di chiudere giri mentre gli altri vanno avanti", () => {
    const p = progress([...laps(1, 20), ...laps(4, 20, 2), ...laps(16, 8, 4)]);
    expect([...detectStoppedDrivers(p, [1, 4, 16])]).toEqual([16]);
  });

  it("non segna i doppiati: chiudono giri come gli altri", () => {
    const p = progress([...laps(1, 20), ...laps(43, 18, 70)]);
    expect(detectStoppedDrivers(p, [1, 43]).size).toBe(0);
  });

  it("non segna un pit stop o un giro lento sotto soglia", () => {
    const p = progress([...laps(1, 20), ...laps(81, 19, 30)]);
    expect(detectStoppedDrivers(p, [1, 81]).size).toBe(0);
  });

  it("bandiera rossa: si fermano tutti, nessuno segnato", () => {
    const p = progress([...laps(1, 30), ...laps(4, 30, 1), ...laps(63, 30, 2)]);
    expect(detectStoppedDrivers(p, [1, 4, 63]).size).toBe(0);
  });

  it("safety car: soglia segue il passo lento", () => {
    // giri da 130 s: 3 × 130 = 390 s di soglia; uno fermo da 300 s non è ritirato
    const p = progress([...laps(1, 10, 0, 130), ...laps(4, 10, 0, 130).slice(0, 9)]);
    const stopped = detectStoppedDrivers(p, [1, 4]);
    expect(stopped.has(4)).toBe(false);
  });

  it("ritirato al primo giro (nessun giro, o solo il primo senza orario)", () => {
    const p = progress([...laps(1, 10), ...laps(4, 10, 1), ...laps(23, 1)]);
    const stopped = detectStoppedDrivers(p, [1, 4, 23, 30]);
    expect(stopped.has(23)).toBe(true);
    expect(stopped.has(30)).toBe(true);
    expect(stopped.has(1)).toBe(false);
  });

  it("collegati a gara in corso: chi non si è ancora visto non viene segnato", () => {
    // solo gli ultimi 2 giri ricevuti: osservazione sotto soglia
    const p = progress([...laps(1, 30).slice(28), ...laps(4, 30, 1).slice(29)]);
    expect(detectStoppedDrivers(p, [1, 4, 10]).size).toBe(0);
  });

  it("nei primi giri non segna nessuno", () => {
    const p = progress([...laps(1, 2), ...laps(4, 1)]);
    expect(detectStoppedDrivers(p, [1, 4, 10]).size).toBe(0);
  });

  it("chi riparte dopo un box lungo torna in gara", () => {
    const base = [...laps(1, 20), ...laps(10, 8, 3)];
    expect(detectStoppedDrivers(progress(base), [1, 10]).has(10)).toBe(true);
    const ripartito = [...base, { driver_number: 10, lap_number: 9, date_start: new Date(T0 + 1560 * 1000).toISOString(), lap_duration: LAP }];
    expect(detectStoppedDrivers(progress(ripartito), [1, 10]).has(10)).toBe(false);
  });
});

describe("mergeLapProgress", () => {
  it("restituisce null se non cambia nulla", () => {
    const p = progress(laps(1, 5));
    expect(mergeLapProgress(p, laps(1, 5))).toBeNull();
  });
});

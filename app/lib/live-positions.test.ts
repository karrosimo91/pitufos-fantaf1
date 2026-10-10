import { describe, it, expect } from "vitest";
import { isNewerPosition, mergePositions, latestPositionDate, positionTime } from "./live-positions";

const REST = "2026-10-11T12:05:12.345000+00:00";
const MQTT_Z = "2026-10-11T12:05:13.100Z";

describe("positionTime", () => {
  it("legge REST (+00:00) e MQTT (Z) come lo stesso asse", () => {
    expect(positionTime(REST)).toBe(Date.parse("2026-10-11T12:05:12.345Z"));
    expect(positionTime(MQTT_Z)).toBeGreaterThan(positionTime(REST));
  });
  it("NaN senza data o con data illeggibile", () => {
    expect(positionTime(undefined)).toBeNaN();
    expect(positionTime("")).toBeNaN();
    expect(positionTime("boh")).toBeNaN();
  });
});

describe("isNewerPosition", () => {
  const existing = { driver_number: 1, position: 3, date: REST };
  it("senza esistente il nuovo vince", () => {
    expect(isNewerPosition(undefined, { date: REST })).toBe(true);
  });
  it("confronta istanti, non stringhe: un record MQTT più recente in formato diverso passa", () => {
    // Lessicograficamente "…12.345000+00:00" > "…12.345Z"? No: '0' (48) < 'Z' (90). Ma
    // "…12.3+00:00" < "…12.345000+00:00" per stringa pur essendo lo stesso istante
    // o più tardi: col parse è corretto.
    expect(isNewerPosition(existing, { date: MQTT_Z })).toBe(true);
    expect(isNewerPosition(existing, { date: "2026-10-11T12:05:12.4+00:00" })).toBe(true);
  });
  it("un record davvero più vecchio non sostituisce", () => {
    expect(isNewerPosition(existing, { date: "2026-10-11T12:05:11Z" })).toBe(false);
  });
  it("a parità di istante il nuovo vince", () => {
    expect(isNewerPosition(existing, { date: "2026-10-11T12:05:12.345Z" })).toBe(true);
  });
  it("senza data leggibile il nuovo vince (i messaggi arrivano in ordine)", () => {
    expect(isNewerPosition(existing, {})).toBe(true);
    expect(isNewerPosition(existing, { date: null })).toBe(true);
    expect(isNewerPosition({ ...existing, date: "" }, { date: REST })).toBe(true);
  });
});

describe("mergePositions", () => {
  it("costruisce la mappa dall'ultimo record per pilota, qualunque sia l'ordine", () => {
    const m = mergePositions(new Map(), [
      { driver_number: 1, position: 2, date: "2026-10-11T12:05:20Z" },
      { driver_number: 1, position: 1, date: "2026-10-11T12:05:30Z" },
      { driver_number: 1, position: 3, date: "2026-10-11T12:05:10Z" },
      { driver_number: 4, position: 2, date: "2026-10-11T12:05:30Z" },
    ]);
    expect(m.get(1)?.position).toBe(1);
    expect(m.get(4)?.position).toBe(2);
  });
  it("ignora record senza pilota o senza posizione", () => {
    const m = mergePositions(new Map(), [{ driver_number: null, position: 1 }, { driver_number: 5, position: 0 }]);
    expect(m.size).toBe(0);
  });
  it("restituisce la stessa mappa se niente cambia", () => {
    const prev = mergePositions(new Map(), [{ driver_number: 1, position: 1, date: REST }]);
    const same = mergePositions(prev, [{ driver_number: 1, position: 1, date: REST }]);
    expect(same).toBe(prev);
    const older = mergePositions(prev, [{ driver_number: 1, position: 5, date: "2026-10-11T12:00:00Z" }]);
    expect(older).toBe(prev);
  });
  it("non muta la mappa precedente", () => {
    const prev = mergePositions(new Map(), [{ driver_number: 1, position: 1, date: REST }]);
    const next = mergePositions(prev, [{ driver_number: 1, position: 2, date: MQTT_Z }]);
    expect(prev.get(1)?.position).toBe(1);
    expect(next.get(1)?.position).toBe(2);
    expect(next).not.toBe(prev);
  });
  it("un messaggio MQTT senza data aggiorna comunque la posizione", () => {
    const prev = mergePositions(new Map(), [{ driver_number: 1, position: 1, date: REST }]);
    const next = mergePositions(prev, [{ driver_number: 1, position: 2 }]);
    expect(next.get(1)?.position).toBe(2);
  });
});

describe("latestPositionDate", () => {
  it("null senza posizioni o senza date leggibili", () => {
    expect(latestPositionDate(new Map())).toBeNull();
    expect(latestPositionDate(mergePositions(new Map(), [{ driver_number: 1, position: 1 }]))).toBeNull();
  });
  it("la data più recente fra i piloti", () => {
    const m = mergePositions(new Map(), [
      { driver_number: 1, position: 1, date: REST },
      { driver_number: 4, position: 2, date: MQTT_Z },
    ]);
    expect(latestPositionDate(m)).toBe(MQTT_Z);
  });
});

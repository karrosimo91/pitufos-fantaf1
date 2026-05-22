import type { LivePilotaScore, LivePrevisioneStatus } from "../../lib/use-live-scoring";
import type { LiveRaceControl } from "../../lib/use-live-ws";
import type { ChipPilotiConfig } from "../../lib/scoring";
import type { WeekendClassificaEntry } from "../../lib/use-weekend-classifica";

export interface MockLiveData {
  piloti: LivePilotaScore[];
  totalPiloti: number;
  previsioniStatus: LivePrevisioneStatus[];
  totalPrevisioni: number;
  totalPoints: number;
  raceControlFeed: LiveRaceControl[];
  connected: boolean;
  events: { safetyCar: boolean; virtualSafetyCar: boolean; redFlag: boolean; wetTyres: boolean; totalDnf: number };
}

export function buildMockLiveData(
  driverNumbers: number[],
  primoPilota: number | null,
  chipPiloti: ChipPilotiConfig | null,
): MockLiveData {
  const mockPositions = [1, 3, 7, 11, 22];
  const piloti: LivePilotaScore[] = driverNumbers.map((num, i) => {
    const position = mockPositions[i] ?? 15;
    const isPrimo = num === primoPilota;
    const isBoosted = chipPiloti?.chipPiloti === "boost" && chipPiloti.chipPilotiTarget === num && !isPrimo;
    const isDnf = i === 4;
    const moltiplicatore = isPrimo ? 2 : isBoosted ? 3 : 1;
    const puntiBase = isDnf ? -10 : position === 1 ? 25 : position <= 3 ? 15 : position <= 10 ? 4 : 0;
    const isScudo = isPrimo && chipPiloti?.chipPiloti === "scudo";
    let puntiFinali = isScudo
      ? (puntiBase > 0 ? puntiBase * 2 : puntiBase)
      : puntiBase * moltiplicatore;
    if (chipPiloti?.chipPiloti === "halo" && puntiFinali < 0) puntiFinali = 0;
    return { driver_number: num, position, puntiBase, moltiplicatore, puntiFinali, isDnf, isFastestLap: i === 0 };
  });

  const previsioniStatus: LivePrevisioneStatus[] = [
    { key: "safetyCar", label: "Safety Car", prediction: true, happened: true, correct: true, points: 4 },
    { key: "virtualSafetyCar", label: "Virtual Safety Car", prediction: false, happened: true, correct: false, points: 0 },
    { key: "redFlag", label: "Red Flag", prediction: false, happened: null, correct: null, points: 0 },
    { key: "gommeWet", label: "Gomme Wet", prediction: false, happened: false, correct: null, points: 0 },
    { key: "poleVince", label: "Pole vince", prediction: true, happened: null, correct: null, points: 0 },
    { key: "numeroDnf", label: "Numero DNF", prediction: 2, happened: true as unknown as boolean, correct: true, points: 5 },
  ];

  const raceControlFeed: LiveRaceControl[] = [
    { message: "GREEN FLAG — Track clear", date: new Date().toISOString() },
    { message: "SAFETY CAR DEPLOYED", flag: "YELLOW", date: new Date(Date.now() - 120000).toISOString() },
    { message: "PENALTY — Stroll: 5 sec time penalty", date: new Date(Date.now() - 240000).toISOString() },
    { message: "RETIRED — Car 14 (Alonso) mechanical", driver_number: 14, date: new Date(Date.now() - 360000).toISOString() },
    { message: "VIRTUAL SAFETY CAR DEPLOYED", date: new Date(Date.now() - 600000).toISOString() },
    { message: "RETIRED — Car 77 (Bottas) collision damage", driver_number: 77, date: new Date(Date.now() - 900000).toISOString() },
    { message: "LIGHTS OUT AND AWAY WE GO", date: new Date(Date.now() - 3600000).toISOString() },
  ];

  const totalPiloti = piloti.reduce((s, p) => s + p.puntiFinali, 0);
  const totalPrevisioni = previsioniStatus.reduce((s, p) => s + p.points, 0);

  return {
    piloti, totalPiloti, previsioniStatus, totalPrevisioni,
    totalPoints: totalPiloti + totalPrevisioni,
    raceControlFeed, connected: true,
    events: { safetyCar: true, virtualSafetyCar: true, redFlag: false, wetTyres: false, totalDnf: 2 },
  };
}

export const MOCK_CLASSIFICA: WeekendClassificaEntry[] = [
  { userId: "1", scuderiaName: "McLaren Supremacy", tpName: "@PapaRossi", points: 112, isMe: false },
  { userId: "2", scuderiaName: "Scuderia Pitufa", tpName: "@TuNome", points: 87, isMe: true },
  { userId: "3", scuderiaName: "Red Bull Destroyers", tpName: "@MarcoF1", points: 83, isMe: false },
  { userId: "4", scuderiaName: "Ferrari Forever", tpName: "@GiuliaSpeed", points: 71, isMe: false },
  { userId: "5", scuderiaName: "Pit Stop Kings", tpName: "@AndreaGP", points: 58, isMe: false },
];

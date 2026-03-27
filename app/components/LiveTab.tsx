"use client";
import { useLiveScoring, type LivePilotaScore, type LivePrevisioneStatus } from "../lib/use-live-scoring";
import { type LiveRaceControl } from "../lib/use-live-ws";
import { getDriverByNumber } from "../lib/drivers-data";
import { Crown, Zap, Shield, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import type { ChipPilotiConfig, ChipPrevisioniConfig } from "../lib/scoring";

// ─── Sub-components ───

function PilotaLiveRow({ p, primoPilota, chipPiloti }: {
  p: LivePilotaScore;
  primoPilota: number | null;
  chipPiloti: string | null;
}) {
  const driver = getDriverByNumber(p.driver_number);
  const isPrimo = p.driver_number === primoPilota;
  const isBoosted = chipPiloti === "boost" && p.moltiplicatore === 3;
  const isScudo = isPrimo && chipPiloti === "scudo";

  const borderClass = p.isDnf
    ? "border-red-500/20 bg-red-500/[0.03]"
    : isPrimo
      ? "border-[#E8002D]/40 bg-[#E8002D]/[0.04]"
      : isBoosted
        ? "border-amber-500/40 bg-amber-500/[0.04]"
        : "border-white/[0.06] bg-white/[0.02]";

  return (
    <div className={`relative flex items-center justify-between rounded-xl p-3 mb-1.5 border transition-all ${borderClass}`}>
      {isPrimo && (
        <div className="absolute -top-1.5 left-3 bg-[#E8002D] text-white text-[8px] font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
          <Crown size={8} /> CAP {isScudo ? "SCUDO" : "x2"}
        </div>
      )}
      {isBoosted && (
        <div className="absolute -top-1.5 left-3 bg-amber-500 text-black text-[8px] font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
          <Zap size={8} /> BOOST x3
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className={`font-[family-name:var(--font-jetbrains)] text-sm font-bold w-6 text-center ${
          p.isDnf ? "text-red-400" : p.position <= 3 ? "text-[#E8002D]" : "text-white/50"
        }`}>
          {p.isDnf ? "DNF" : `P${p.position}`}
        </div>
        {driver && (
          <div className="w-[3px] h-7 rounded-full" style={{ backgroundColor: `#${driver.teamColour || "555"}` }} />
        )}
        <div>
          <div className={`text-[13px] font-semibold ${p.isDnf ? "text-white/40 line-through" : ""}`}>
            {driver?.name || `#${p.driver_number}`}
          </div>
          <div className="text-[10px] text-white/30">{driver?.team || ""}</div>
        </div>
        {p.isFastestLap && (
          <span className="text-[8px] bg-purple-500/20 text-purple-400 font-bold px-1.5 py-0.5 rounded">FL</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <span className={`font-[family-name:var(--font-jetbrains)] text-base font-bold ${
          p.puntiFinali > 0 ? "text-green-400" : p.puntiFinali < 0 ? "text-red-400" : "text-white/15"
        }`}>
          {p.puntiFinali > 0 ? "+" : ""}{p.puntiFinali}
        </span>
        {p.moltiplicatore > 1 && (
          <span className="text-[10px] text-white/30">×{p.moltiplicatore}</span>
        )}
      </div>
    </div>
  );
}

function PrevisioneLiveCard({ p }: { p: LivePrevisioneStatus }) {
  const isCorrect = p.happened === true && p.prediction === true;
  const isWrong = p.happened === true && p.prediction === false;
  const waiting = p.happened === null || p.happened === false;

  const borderClass = isCorrect
    ? "border-green-500/30 bg-green-500/[0.06]"
    : isWrong
      ? "border-red-500/15 bg-red-500/[0.04]"
      : "border-white/[0.06] bg-white/[0.02]";

  return (
    <div className={`rounded-xl p-3 border transition-all ${borderClass}`}>
      <div className="text-[10px] font-bold text-white/50 mb-1">{p.label}</div>
      <div className={`font-[family-name:var(--font-jetbrains)] text-sm font-bold ${
        isCorrect ? "text-green-400" : isWrong ? "text-red-400" : "text-white/20"
      }`}>
        {p.key === "numeroDnf"
          ? `${p.prediction ?? "—"} ${isCorrect ? "✓" : waiting ? "(provvisorio)" : "✗"}`
          : `${p.prediction === true ? "SI" : p.prediction === false ? "NO" : "—"} ${isCorrect ? "✓" : isWrong ? "✗" : "— in attesa"}`
        }
      </div>
      <div className={`font-[family-name:var(--font-jetbrains)] text-[11px] mt-0.5 ${
        isCorrect ? "text-green-400/60" : isWrong ? "text-red-400/40" : "text-white/10"
      }`}>
        {isCorrect ? `+${p.points} pts` : isWrong ? "0 pts" : waiting ? "in attesa" : ""}
      </div>
    </div>
  );
}

function RaceControlMessage({ rc }: { rc: LiveRaceControl }) {
  const msg = (rc.message || "").toUpperCase();
  const isSC = msg.includes("SAFETY CAR") && !msg.includes("VIRTUAL");
  const isVSC = msg.includes("VIRTUAL SAFETY CAR") || msg.includes("VSC");
  const isRF = msg.includes("RED FLAG") || (rc.flag || "").toUpperCase() === "RED";
  const isDNF = msg.includes("RETIRED") || msg.includes("OUT OF THE RACE");
  const isPenalty = msg.includes("PENALTY");
  const isGreen = msg.includes("GREEN") || msg.includes("LIGHTS OUT");

  const borderColor = isRF ? "border-l-[#E8002D] bg-[#E8002D]/[0.04]"
    : isSC ? "border-l-amber-500 bg-amber-500/[0.04]"
    : isVSC ? "border-l-amber-500 bg-amber-500/[0.03]"
    : isDNF ? "border-l-red-400"
    : isPenalty ? "border-l-purple-400 bg-purple-500/[0.04]"
    : isGreen ? "border-l-green-400"
    : "border-l-white/10";

  const time = rc.date ? new Date(rc.date).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className={`flex items-start gap-2 p-2 border-l-2 mb-1 text-[11px] ${borderColor}`}>
      <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/20 min-w-[40px]">{time}</span>
      <span className="text-white/60">{rc.message}</span>
    </div>
  );
}

// ─── Componente principale ───

// ─── Dati mock per debug ───

function useMockData(driverNumbers: number[], primoPilota: number | null, chipPiloti: ChipPilotiConfig | null) {
  const mockPositions = [1, 3, 7, 11, 22]; // posizioni finte per i 5 piloti
  const piloti: LivePilotaScore[] = driverNumbers.map((num, i) => {
    const position = mockPositions[i] || 15;
    const isPrimo = num === primoPilota;
    const isBoosted = chipPiloti?.chipPiloti === "boost" && chipPiloti.chipPilotiTarget === num && !isPrimo;
    const isDnf = i === 4; // ultimo pilota = DNF mock
    const moltiplicatore = isPrimo ? 2 : isBoosted ? 3 : 1;
    const puntiBase = isDnf ? -10 : position === 1 ? 25 : position <= 3 ? 15 : position <= 10 ? 4 : 0;
    const isScudo = isPrimo && chipPiloti?.chipPiloti === "scudo";
    const puntiFinali = isScudo
      ? (puntiBase > 0 ? puntiBase * 2 : puntiBase)
      : puntiBase * moltiplicatore;
    return { driver_number: num, position, puntiBase, moltiplicatore, puntiFinali: chipPiloti?.chipPiloti === "halo" && puntiFinali < 0 ? 0 : puntiFinali, isDnf, isFastestLap: i === 0 };
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

export default function LiveTab({
  sessionKey,
  sessionType,
  driverNumbers,
  primoPilota,
  chipPiloti,
  chipPrevisioni,
  previsioni,
  qualifyingPole,
  debug = false,
}: {
  sessionKey: number;
  sessionType: string;
  driverNumbers: number[];
  primoPilota: number | null;
  chipPiloti: ChipPilotiConfig | null;
  chipPrevisioni: ChipPrevisioniConfig | null;
  previsioni: {
    safetyCar: boolean | null;
    virtualSafetyCar: boolean | null;
    redFlag: boolean | null;
    gommeWet: boolean | null;
    poleVince: boolean | null;
    numeroDnf: number | null;
  };
  qualifyingPole?: number | null;
  debug?: boolean;
}) {
  const realLive = useLiveScoring(
    debug ? null : sessionKey, sessionType, driverNumbers, primoPilota,
    chipPiloti, chipPrevisioni, previsioni, qualifyingPole
  );
  const mockLive = useMockData(driverNumbers, primoPilota, chipPiloti);
  const live = debug ? mockLive : realLive;

  const isRace = sessionType.toLowerCase().includes("race") && !sessionType.toLowerCase().includes("sprint qualifying");

  return (
    <div>
      {/* Punteggio provvisorio */}
      <div className="bg-gradient-to-br from-[#E8002D]/10 to-[#E8002D]/[0.03] border border-[#E8002D]/15 rounded-2xl p-4 text-center mb-4">
        <div className="text-[9px] tracking-[3px] text-white/30 uppercase mb-1">Punteggio provvisorio</div>
        <div className="font-[family-name:var(--font-jetbrains)] text-[42px] font-bold leading-none">
          {live.totalPoints}
        </div>
        <div className="flex justify-center gap-4 mt-2 text-[11px] text-white/40">
          <span>Piloti: <span className="font-[family-name:var(--font-jetbrains)]">{live.totalPiloti}</span></span>
          {isRace && <span>Previsioni: <span className="font-[family-name:var(--font-jetbrains)]">{live.totalPrevisioni}</span></span>}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {live.connected ? (
            <>
              <Wifi size={10} className="text-green-400" />
              <span className="text-[9px] text-green-400/60">Connesso</span>
            </>
          ) : (
            <>
              <WifiOff size={10} className="text-white/20" />
              <span className="text-[9px] text-white/20">Connessione...</span>
            </>
          )}
        </div>
      </div>

      {/* I tuoi piloti */}
      <div className="text-[9px] tracking-[3px] text-white/30 uppercase font-bold mb-2">
        I tuoi piloti
      </div>
      {live.piloti.map((p) => (
        <PilotaLiveRow
          key={p.driver_number}
          p={p}
          primoPilota={primoPilota}
          chipPiloti={chipPiloti?.chipPiloti || null}
        />
      ))}

      {/* Previsioni live (solo gara) */}
      {isRace && live.previsioniStatus.length > 0 && (
        <>
          <div className="text-[9px] tracking-[3px] text-white/30 uppercase font-bold mb-2 mt-4">
            Previsioni live
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {live.previsioniStatus.map((p) => (
              <PrevisioneLiveCard key={p.key} p={p} />
            ))}
          </div>
        </>
      )}

      {/* Race Control Feed */}
      {live.raceControlFeed.length > 0 && (
        <>
          <div className="text-[9px] tracking-[3px] text-white/30 uppercase font-bold mb-2 mt-4">
            Race Control
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {live.raceControlFeed.slice(0, 30).map((rc, i) => (
              <RaceControlMessage key={i} rc={rc} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

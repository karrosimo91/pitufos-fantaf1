"use client";
import { useState, useEffect, useMemo } from "react";
import { useLiveScoring, type LivePilotaScore, type LivePrevisioneStatus } from "../lib/use-live-scoring";
import { useLiveWebSocket, type LiveRaceControl } from "../lib/use-live-ws";
import { getDriverByNumber } from "../lib/drivers-data";
import { Crown, Zap, Shield, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { createClient, isSupabaseConfigured } from "../lib/supabase";
import {
  calcolaQualifica, calcolaSprintShootout, calcolaSprint, calcolaGara,
  type DriverResult, type ChipPilotiConfig, type ChipPrevisioniConfig,
} from "../lib/scoring";

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

// ─── Tipo classifica ───

interface ClassificaEntry {
  userId: string;
  scuderiaName: string;
  tpName: string;
  points: number;
  isMe: boolean;
}

export default function LiveTab({
  sessionKey,
  sessionType,
  meetingKey,
  round,
  userId,
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
  meetingKey?: number;
  round: number;
  userId?: string;
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
  // Fetch grid positions dalla qualifica (per posizioni guadagnate/perse in gara)
  const [gridPositions, setGridPositions] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    if (debug || !meetingKey) return;
    const isRaceSession = sessionType.toLowerCase().includes("race") && !sessionType.toLowerCase().includes("sprint");
    if (!isRaceSession) return;

    (async () => {
      try {
        // Trova la sessione qualifica di questo meeting
        const sessRes = await fetch(`https://api.openf1.org/v1/sessions?meeting_key=${meetingKey}`, { cache: "no-store" });
        if (!sessRes.ok) return;
        const sessions = await sessRes.json();
        const qualiSession = sessions.find((s: { session_name: string }) =>
          s.session_name?.toLowerCase() === "qualifying"
        );
        if (!qualiSession) return;

        // Fetch posizioni qualifica
        const posRes = await fetch(`https://api.openf1.org/v1/position?session_key=${qualiSession.session_key}`, { cache: "no-store" });
        if (!posRes.ok) return;
        const posData = await posRes.json();

        // Prendi l'ultima posizione per ogni pilota (risultato finale qualifica)
        const grid = new Map<number, number>();
        for (const p of posData) {
          if (p.driver_number && p.position) {
            const existing = grid.get(p.driver_number);
            if (!existing || p.date > (posData.find((x: { driver_number: number; position: number }) => x.driver_number === p.driver_number && x.position === existing)?.date || "")) {
              grid.set(p.driver_number, p.position);
            }
          }
        }
        setGridPositions(grid);
      } catch { /* non bloccante */ }
    })();
  }, [meetingKey, sessionType, debug]);

  // Fetch formazioni confermate di tutti i giocatori per la classifica
  const [allFormazioni, setAllFormazioni] = useState<{
    user_id: string; driver_numbers: number[]; primo_pilota: number | null;
    chip_piloti: string | null; chip_piloti_target: number | null; sesto_uomo: number | null;
    scuderia_name?: string; tp_name?: string;
  }[]>([]);

  useEffect(() => {
    if (debug || !round || !isSupabaseConfigured) return;
    const supabase = createClient();
    if (!supabase) return;

    (async () => {
      const { data } = await supabase
        .from("formazioni")
        .select("user_id, driver_numbers, primo_pilota, chip_piloti, chip_piloti_target, sesto_uomo")
        .eq("round", round)
        .eq("confirmed", true);

      if (!data) return;

      // Fetch nomi profili
      const userIds = data.map((f) => f.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, scuderia_name, team_principal_name")
        .in("id", userIds);

      const profileMap = new Map<string, { scuderia: string; tp: string }>();
      for (const p of profiles || []) {
        profileMap.set(p.id, { scuderia: p.scuderia_name || "—", tp: p.team_principal_name || "—" });
      }

      setAllFormazioni(data.map((f) => ({
        ...f,
        driver_numbers: (f.driver_numbers || []).map(Number),
        scuderia_name: profileMap.get(f.user_id)?.scuderia,
        tp_name: profileMap.get(f.user_id)?.tp,
      })));
    })();
  }, [round, debug]);

  const realLive = useLiveScoring(
    debug ? null : sessionKey, sessionType, driverNumbers, primoPilota,
    chipPiloti, chipPrevisioni, previsioni, qualifyingPole, gridPositions
  );

  // Accedi ai dati WS raw per calcolare punti degli altri (solo se non debug)
  const wsData = useLiveWebSocket(debug ? null : sessionKey);

  // Calcola classifica weekend live
  const classifica = useMemo<ClassificaEntry[]>(() => {
    if (debug) {
      return [
        { userId: "1", scuderiaName: "McLaren Supremacy", tpName: "@PapaRossi", points: 112, isMe: false },
        { userId: "2", scuderiaName: "Scuderia Pitufa", tpName: "@TuNome", points: 87, isMe: true },
        { userId: "3", scuderiaName: "Red Bull Destroyers", tpName: "@MarcoF1", points: 83, isMe: false },
        { userId: "4", scuderiaName: "Ferrari Forever", tpName: "@GiuliaSpeed", points: 71, isMe: false },
        { userId: "5", scuderiaName: "Pit Stop Kings", tpName: "@AndreaGP", points: 58, isMe: false },
      ];
    }

    if (allFormazioni.length === 0 || wsData.positions.size === 0) return [];

    const stLower = sessionType.toLowerCase();
    const isQual = stLower === "qualifying";
    const isSprintQual = stLower.includes("sprint") && stLower.includes("qualifying");
    const isSprintRace = stLower === "sprint" || (stLower.includes("race") && stLower.includes("sprint"));
    const isMainRace = stLower.includes("race") && !stLower.includes("sprint");

    const events = (() => {
      const dnfDrivers = new Set<number>();
      for (const rc of wsData.raceControl) {
        const msg = (rc.message || "").toUpperCase();
        if (msg.includes("RETIRED") || msg.includes("OUT OF THE RACE") || msg.includes("DID NOT FINISH")) {
          if (rc.driver_number) dnfDrivers.add(rc.driver_number);
        }
      }
      return { dnfDrivers };
    })();

    const entries: ClassificaEntry[] = allFormazioni.map((f) => {
      let total = 0;

      for (const driverNum of f.driver_numbers) {
        const pos = wsData.positions.get(driverNum);
        const position = pos?.position ?? 22;
        const isDnf = events.dnfDrivers.has(driverNum);
        const isFastestLap = wsData.fastestLap?.driver_number === driverNum;

        let puntiBase = 0;
        if (isQual) puntiBase = calcolaQualifica(position, isDnf);
        else if (isSprintQual) puntiBase = calcolaSprintShootout(position, isDnf);
        else if (isSprintRace) {
          const dr: DriverResult = { driver_number: driverNum, position, dnf: isDnf, fastest_lap: isFastestLap };
          puntiBase = calcolaSprint(dr);
        } else if (isMainRace) {
          const grid = gridPositions.get(driverNum);
          const dr: DriverResult = { driver_number: driverNum, position, dnf: isDnf, grid_position: grid, fastest_lap: isFastestLap, driver_of_the_day: false, penalty: false };
          puntiBase = calcolaGara(dr);
        }

        const isPrimo = driverNum === f.primo_pilota;
        const isBoosted = f.chip_piloti === "boost" && f.chip_piloti_target === driverNum && !isPrimo;
        const molt = isPrimo ? 2 : isBoosted ? 3 : 1;

        let puntiFinali: number;
        if (isPrimo && f.chip_piloti === "scudo") {
          puntiFinali = puntiBase > 0 ? puntiBase * 2 : puntiBase;
        } else {
          puntiFinali = puntiBase * molt;
        }
        if (f.chip_piloti === "halo" && puntiFinali < 0) puntiFinali = 0;

        total += puntiFinali;
      }

      return {
        userId: f.user_id,
        scuderiaName: f.scuderia_name || "—",
        tpName: f.tp_name || "—",
        points: total,
        isMe: f.user_id === userId,
      };
    });

    entries.sort((a, b) => b.points - a.points);
    return entries;
  }, [allFormazioni, wsData.positions, wsData.raceControl, wsData.fastestLap, sessionType, gridPositions, userId, debug]);

  const mockLive = useMockData(driverNumbers, primoPilota, chipPiloti);
  const live = debug ? mockLive : realLive;

  const isRace = sessionType.toLowerCase().includes("race") && !sessionType.toLowerCase().includes("sprint qualifying");
  const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

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

      {/* Classifica Weekend Live */}
      {classifica.length > 0 && (
        <>
          <div className="text-[9px] tracking-[3px] text-white/30 uppercase font-bold mb-2 mt-4">
            Classifica Weekend
          </div>
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-hidden mb-4">
            {classifica.map((entry, i) => (
              <div
                key={entry.userId}
                className={`flex items-center justify-between px-3.5 py-2.5 transition-all ${
                  i < classifica.length - 1 ? "border-b border-white/[0.04]" : ""
                } ${entry.isMe ? "bg-[#E8002D]/[0.05] border-l-[3px] border-l-[#E8002D]" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-bold w-5 text-center ${
                    i === 0 ? "text-[#E8002D]" : entry.isMe ? "text-[#E8002D]" : "text-white/30"
                  }`}>
                    {i + 1}
                  </div>
                  <div>
                    <div className={`text-[13px] font-semibold ${entry.isMe ? "text-white" : ""}`}>
                      {entry.scuderiaName}
                    </div>
                    <div className={`text-[10px] ${entry.isMe ? "text-[#E8002D]/50" : "text-white/25"}`}>
                      @{entry.tpName}
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-[family-name:var(--font-jetbrains)] text-base font-bold ${
                    entry.isMe ? "text-white" : "text-white/70"
                  }`}>
                    {entry.points}
                  </span>
                  {i < 10 && (
                    <span className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/15">
                      +{PUNTI_REALE[i]} CR
                    </span>
                  )}
                </div>
              </div>
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

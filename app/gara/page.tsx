"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useSquadra, usePrevisioni } from "../lib/store";
import { useAuth } from "../lib/auth";
import { createClient, isSupabaseConfigured } from "../lib/supabase";
import { RACES_2026, getNextRace, getCurrentRound, getWeekendSessions, getDeadline, isAfterDeadline, getRaceByRound } from "../lib/races";
import { DRIVERS_2026, getDriverByNumber } from "../lib/drivers-data";
import { PREVISIONI_PUNTI } from "../lib/types";
import {
  calcolaPuntiWeekend,
  type RaceWeekendResults,
  type PilotaDettaglio,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "../lib/scoring";
import {
  Crown, Check, ChevronRight, ChevronDown, Clock, AlertTriangle, Trophy,
  Zap, Shield, Users, ShieldCheck, Copy as CopyIcon, Shuffle,
  CheckCircle2, Circle,
} from "lucide-react";

// ─── Config ───

const PREVISIONI_CONFIG = [
  { key: "safetyCar" as const, label: "Safety Car", desc: "Almeno una Safety Car in gara?", si: PREVISIONI_PUNTI.safetyCar.si, no: PREVISIONI_PUNTI.safetyCar.no },
  { key: "virtualSafetyCar" as const, label: "Virtual Safety Car", desc: "Almeno una VSC in gara?", si: PREVISIONI_PUNTI.virtualSafetyCar.si, no: PREVISIONI_PUNTI.virtualSafetyCar.no },
  { key: "redFlag" as const, label: "Red Flag", desc: "Almeno una bandiera rossa?", si: PREVISIONI_PUNTI.redFlag.si, no: PREVISIONI_PUNTI.redFlag.no },
  { key: "gommeWet" as const, label: "Gomme Wet", desc: "Gomme da bagnato usate in gara?", si: PREVISIONI_PUNTI.gommeWet.si, no: PREVISIONI_PUNTI.gommeWet.no },
  { key: "poleVince" as const, label: "Pole vince la gara", desc: "Il poleman vince il Gran Premio?", si: PREVISIONI_PUNTI.poleVince.si, no: PREVISIONI_PUNTI.poleVince.no },
];

type PrevisioneKey = (typeof PREVISIONI_CONFIG)[number]["key"];

const CHIP_PILOTI = [
  { id: "boost", label: "Boost Mode", desc: "Un pilota fa x3 (non il Capitano)", icon: Zap },
  { id: "halo", label: "Halo", desc: "Minimo 0 punti se va in negativo", icon: Shield },
  { id: "sesto", label: "Sesto Uomo", desc: "6° pilota temporaneo", icon: Users },
  { id: "wildcard", label: "Wildcard", desc: "Cambi illimitati senza penalità", icon: Shuffle },
];

const CHIP_PREVISIONI = [
  { id: "sicura", label: "Prev. Sicura", desc: "1 previsione vale comunque", icon: ShieldCheck },
  { id: "doppia", label: "Prev. Doppia", desc: "Punti x2 su 1 previsione", icon: CopyIcon },
];

function getTimeUntil(dateStr: string) {
  const now = new Date().getTime();
  const target = new Date(dateStr).getTime();
  const diff = target - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

type Tab = "formazione" | "previsioni" | "dettaglio";

const PREVISIONE_LABELS: Record<string, string> = {
  safetyCar: "Safety Car",
  virtualSafetyCar: "Virtual Safety Car",
  redFlag: "Red Flag",
  gommeWet: "Gomme Wet",
  poleVince: "Pole vince",
  numeroDnf: "Numero DNF",
};

const CHIP_LABELS: Record<string, string> = {
  boost: "Boost Mode x3", halo: "Halo", sesto: "Sesto Uomo", wildcard: "Wildcard",
  sicura: "Prev. Sicura", doppia: "Prev. Doppia",
};

// ─── Driver row ───

function DriverRow({
  driverNumber, isCaptain, isBoosted, isSestoUomo,
  onSetPrimoPilota, onRemove, locked, points,
}: {
  driverNumber: number; isCaptain: boolean; isBoosted: boolean; isSestoUomo: boolean;
  onSetPrimoPilota?: () => void; onRemove?: () => void; locked: boolean;
  points?: number | null;
}) {
  const d = getDriverByNumber(driverNumber);
  if (!d) return null;
  const color = `#${d.teamColour}`;

  return (
    <div
      className={`relative flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 transition-all ${
        isCaptain ? "border border-[#E8002D]/40 shadow-[0_0_12px_rgba(232,0,45,0.08)]"
        : isBoosted ? "border border-amber-500/40"
        : isSestoUomo ? "border border-blue-500/30 border-dashed"
        : "border border-white/[0.06]"
      }`}
    >
      {isCaptain && (
        <div className="absolute -top-1.5 left-3 bg-[#E8002D] text-white text-[8px] font-bold tracking-wider px-2 py-0.5 rounded">
          PRIMO PILOTA x2
        </div>
      )}
      {isBoosted && !isCaptain && (
        <div className="absolute -top-1.5 left-3 bg-amber-500 text-black text-[8px] font-bold tracking-wider px-2 py-0.5 rounded">
          BOOST x3
        </div>
      )}
      {isSestoUomo && (
        <div className="absolute -top-1.5 left-3 bg-blue-500 text-white text-[8px] font-bold tracking-wider px-2 py-0.5 rounded">
          SESTO UOMO
        </div>
      )}

      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ backgroundColor: `${color}25`, color }}
      >
        <span className="font-[family-name:var(--font-jetbrains)]">{d.number}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isCaptain && <Crown size={12} className="text-[#E8002D] shrink-0" />}
          <span className="font-bold text-sm truncate">{d.name}</span>
        </div>
        <div className="text-[11px] text-white/30 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          {d.team}
        </div>
      </div>

      {points != null && (
        <span className={`font-[family-name:var(--font-jetbrains)] font-bold text-sm shrink-0 ${points > 0 ? "text-green-400" : points < 0 ? "text-red-400" : "text-white/20"}`}>
          {points > 0 ? "+" : ""}{points}
        </span>
      )}

      {!locked && points == null && (
        <div className="flex gap-1.5 shrink-0">
          {!isCaptain && !isSestoUomo && onSetPrimoPilota && (
            <button
              onClick={onSetPrimoPilota}
              className="text-[8px] tracking-wider font-bold uppercase border border-[#E8002D]/20 text-[#E8002D]/60 hover:bg-[#E8002D]/10 px-2 py-1.5 rounded-lg transition-all leading-tight"
            >
              Primo<br/>Pilota
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-[9px] tracking-wider font-bold uppercase border border-white/10 text-white/30 hover:bg-white/5 px-2 py-1.5 rounded-lg transition-all"
            >
              {isSestoUomo ? "Rimuovi" : "Vendi"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGINA GARA
// ═══════════════════════════════════════════

export default function GaraPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const currentRound = getCurrentRound();
  const [viewRound, setViewRound] = useState(currentRound);

  const viewRace = getRaceByRound(viewRound) || getNextRace();
  const isCurrentRound = viewRound === currentRound;
  const deadline = getDeadline(viewRace);
  const sessions = getWeekendSessions(viewRace);

  const sq = useSquadra(viewRound);
  const prev = usePrevisioni(viewRound);

  const [tab, setTab] = useState<Tab>("formazione");
  const [countdown, setCountdown] = useState(getTimeUntil(deadline));
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmingForm, setConfirmingForm] = useState(false);
  const [confirmingPrev, setConfirmingPrev] = useState(false);
  const [weekendResults, setWeekendResults] = useState<RaceWeekendResults | null>(null);
  const [myWeekendScore, setMyWeekendScore] = useState<{
    pilotiPoints: number;
    previsioniPoints: number;
    penalitaCambi: number;
    total: number;
    pilotiDettaglio: (PilotaDettaglio & { name: string })[];
    previsioniDettaglio: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCountdown(getTimeUntil(deadline)), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  // Reset tab e risultati quando si cambia round
  useEffect(() => {
    setWeekendResults(null);
    setMyWeekendScore(null);
    setTab("formazione");
  }, [viewRound]);

  // Carica risultati post-gara se disponibili
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    const supabase = createClient()!;
    supabase
      .from("weekend_results")
      .select("data")
      .eq("round", viewRound)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const results: RaceWeekendResults = data.data;
        setWeekendResults(results);
        setTab("dettaglio");

        // Calcola il mio punteggio
        if (sq.loaded && sq.confirmed && sq.driverNumbers.length > 0) {
          const chipPiloti: ChipPilotiConfig = {
            chipPiloti: sq.chipPiloti,
            chipPilotiTarget: sq.chipPilotiTarget,
            sestoUomo: sq.sestoUomo,
          };
          const chipPrevisioni: ChipPrevisioniConfig = {
            chipAttivo: prev.chipAttivo,
            chipTarget: prev.chipTarget,
          };
          const calc = calcolaPuntiWeekend(
            sq.driverNumbers,
            sq.primoPilota,
            prev.previsioni,
            results,
            chipPiloti,
            chipPrevisioni
          );
          // Penalita' cambi (lato client non abbiamo il dato esatto, usiamo quello del hook)
          const penalita = sq.penalitaTotale;
          setMyWeekendScore({
            pilotiPoints: calc.pilotiPoints,
            previsioniPoints: calc.previsioniPoints,
            penalitaCambi: penalita,
            total: calc.total - penalita,
            pilotiDettaglio: calc.pilotiDettaglio.map((d) => ({
              ...d,
              name: getDriverByNumber(d.driver_number)?.name || `#${d.driver_number}`,
            })),
            previsioniDettaglio: calc.previsioniDettaglio,
          });
        }
      });
  }, [user, viewRound, sq.loaded, sq.confirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const locked = isAfterDeadline(viewRace);
  const hasResults = !!weekendResults;

  // Round disponibili nel selettore: round corrente + gare passate
  const pastRaces = RACES_2026.filter((r) => new Date(r.date) <= new Date() && r.round !== currentRound);
  const selectableRounds = [
    RACES_2026.find((r) => r.round === currentRound)!,
    ...pastRaces.reverse(),
  ].filter(Boolean);

  const handleConfermaFormazione = async () => {
    if (sq.drivers.length !== 5) return showToast("Devi avere 5 piloti");
    if (!sq.primoPilota) return showToast("Scegli un Primo Pilota");
    setConfirmingForm(true);
    const ok = await sq.conferma();
    setConfirmingForm(false);
    if (ok) showToast("Formazione confermata!");
  };

  const handleConfermaPrevisioni = async () => {
    setConfirmingPrev(true);
    const ok = await prev.confermaPrevisioni();
    setConfirmingPrev(false);
    if (ok) showToast("Previsioni confermate!");
    else showToast("Completa tutte le 6 previsioni");
  };

  const togglePrevisione = (key: PrevisioneKey, value: boolean) => {
    const current = prev.previsioni[key];
    prev.setPrevisione(key, current === value ? null : value);
  };

  // Piloti da mostrare
  const displayDrivers = sq.driverNumbers
    .map((num) => {
      const d = getDriverByNumber(num);
      return d ? { driver_number: num, name: d.name, team: d.team, teamColour: d.teamColour, price: d.price } : null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const sestoUomoDriver = sq.sestoUomo ? getDriverByNumber(sq.sestoUomo) : null;

  if (authLoading || !sq.loaded || !prev.loaded || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  // Per il tab dettaglio con risultati, lookup punti per pilota
  const pilotiPointsMap = new Map<number, number>();
  if (myWeekendScore) {
    for (const d of myWeekendScore.pilotiDettaglio) {
      pilotiPointsMap.set(d.driver_number, d.puntiFinali);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] bg-[#E8002D] text-white text-sm font-bold px-6 py-3 rounded-xl shadow-[0_0_30px_rgba(232,0,45,0.4)]">
          {toast}
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-4 pb-bottomnav">
        {/* ═══ SELETTORE ROUND ═══ */}
        {selectableRounds.length > 1 && (
          <div className="mb-3">
            <div className="relative">
              <select
                value={viewRound}
                onChange={(e) => setViewRound(Number(e.target.value))}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none focus:border-[#E8002D]/40 appearance-none pr-10"
              >
                {selectableRounds.map((race) => (
                  <option key={race.round} value={race.round} className="bg-[#0a0a12]">
                    R{race.round} — {race.flag} {race.name} {race.round === currentRound ? "(attuale)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          </div>
        )}

        {/* ═══ HEADER ═══ */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] tracking-[3px] text-[#E8002D] uppercase font-bold">R{viewRace.round}</span>
            <div className="flex items-center gap-2">
              {viewRace.sprint && (
                <span className="bg-[#E8002D]/20 text-[#E8002D] px-2 py-0.5 rounded text-[9px] font-bold tracking-wider">SPRINT</span>
              )}
              {locked && (
                <span className="bg-white/10 text-white/50 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider">BLOCCATO</span>
              )}
              {hasResults && (
                <span className="bg-green-500/15 text-green-400 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider">COMPLETATO</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{viewRace.flag}</span>
            <div>
              <h1 className="text-lg font-black font-[family-name:var(--font-oswald)] leading-tight">{viewRace.name}</h1>
              <p className="text-white/40 text-xs">{viewRace.circuit}</p>
            </div>
          </div>
          {mounted && isCurrentRound && !locked && (
            <div className="flex items-center gap-2 mt-3 bg-black/30 rounded-lg px-3 py-2">
              <Clock size={14} className="text-white/30" />
              <span className="text-[10px] tracking-wider text-white/40 uppercase">Deadline:</span>
              <span className="font-[family-name:var(--font-jetbrains)] text-xs font-bold tabular-nums">
                {countdown.days > 0 && `${countdown.days}g `}
                {String(countdown.hours).padStart(2, "0")}:{String(countdown.minutes).padStart(2, "0")}:{String(countdown.seconds).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>

        {/* ═══ TABS ═══ */}
        <div className="flex gap-1 mb-4">
          {(["formazione", "previsioni", "dettaglio"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = { formazione: "Formazione", previsioni: "Previsioni", dettaglio: hasResults ? "Dettaglio" : "Orari" };
            const isActive = tab === t;
            let indicator: React.ReactNode = null;
            if (t === "dettaglio" && hasResults) indicator = <Trophy size={12} className="text-[#E8002D]" />;
            if (t === "formazione" && sq.confirmed) indicator = <Check size={12} className="text-green-400" />;
            if (t === "previsioni" && prev.confirmed) indicator = <Check size={12} className="text-green-400" />;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] tracking-[2px] uppercase font-bold transition-all ${
                  isActive ? "bg-[#E8002D]/10 border border-[#E8002D]/30 text-[#E8002D]" : "bg-white/[0.03] border border-white/[0.06] text-white/40"
                }`}
              >
                {indicator}{labels[t]}
              </button>
            );
          })}
        </div>

        {/* ═══ TAB FORMAZIONE ═══ */}
        {tab === "formazione" && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-2">
                I tuoi piloti ({displayDrivers.length}/5{sestoUomoDriver ? " +1" : ""})
              </div>

              {displayDrivers.length === 0 ? (
                isCurrentRound && !locked ? (
                  <Link href="/mercato" className="block text-center border-2 border-dashed border-white/10 rounded-xl p-8 text-white/20 hover:text-white/30 transition-all text-sm tracking-wider uppercase">
                    Vai al Mercato per scegliere i tuoi piloti
                  </Link>
                ) : (
                  <div className="text-center py-8 text-white/20 text-sm">Nessuna formazione per questo round</div>
                )
              ) : (
                <div className="space-y-2">
                  {displayDrivers.map((driver) => (
                    <DriverRow
                      key={driver.driver_number}
                      driverNumber={driver.driver_number}
                      isCaptain={driver.driver_number === sq.primoPilota}
                      isBoosted={sq.chipPiloti === "boost" && sq.chipPilotiTarget === driver.driver_number}
                      isSestoUomo={false}
                      onSetPrimoPilota={() => sq.setPrimoPilota(driver.driver_number)}
                      locked={locked}
                      points={hasResults ? (pilotiPointsMap.get(driver.driver_number) ?? null) : null}
                    />
                  ))}

                  {sestoUomoDriver && (
                    <DriverRow
                      driverNumber={sestoUomoDriver.number}
                      isCaptain={false}
                      isBoosted={sq.chipPiloti === "boost" && sq.chipPilotiTarget === sestoUomoDriver.number}
                      isSestoUomo={true}
                      onRemove={() => sq.setSestoUomo(null)}
                      locked={locked}
                      points={hasResults ? (pilotiPointsMap.get(sestoUomoDriver.number) ?? null) : null}
                    />
                  )}
                </div>
              )}

              {displayDrivers.length < 5 && isCurrentRound && !locked && (
                <Link href="/mercato" className="flex items-center justify-center gap-2 mt-2 border border-dashed border-white/10 rounded-xl p-3 text-white/20 hover:text-white/30 hover:border-white/15 transition-all text-[11px] tracking-wider uppercase">
                  + Aggiungi dal Mercato ({displayDrivers.length}/5) <ChevronRight size={14} />
                </Link>
              )}
            </div>

            {/* Chip piloti usati (read-only per round passati) */}
            {locked && (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-1">Aggiornamento Piloti</div>
                {sq.chipPiloti ? (
                  <>
                    <div className="text-sm text-[#E8002D] font-bold">{CHIP_LABELS[sq.chipPiloti] || sq.chipPiloti}</div>
                    {sq.chipPilotiTarget && (
                      <div className="text-[11px] text-white/40 mt-0.5">Target: {getDriverByNumber(sq.chipPilotiTarget)?.name || `#${sq.chipPilotiTarget}`}</div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-white/20">Nessuno</div>
                )}
              </div>
            )}

            {/* Aggiornamento Piloti (editabile) */}
            {!locked && (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-2">Aggiornamento Piloti</div>
                <div className="grid grid-cols-2 gap-2">
                  {CHIP_PILOTI.map((chip) => {
                    const Icon = chip.icon;
                    const active = sq.chipPiloti === chip.id;
                    return (
                      <button key={chip.id}
                        onClick={() => sq.setChipPiloti(active ? null : chip.id)}
                        className={`flex items-start gap-2 p-3 rounded-xl text-left transition-all ${
                          active ? "bg-[#E8002D]/10 border border-[#E8002D]/30" : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04]"
                        }`}
                      >
                        <Icon size={16} className={active ? "text-[#E8002D] mt-0.5" : "text-white/30 mt-0.5"} />
                        <div>
                          <div className={`text-[11px] font-bold ${active ? "text-[#E8002D]" : "text-white/50"}`}>{chip.label}</div>
                          <div className="text-[9px] text-white/25 mt-0.5">{chip.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Boost: scegli pilota */}
                {sq.chipPiloti === "boost" && (
                  <div className="mt-3 bg-black/20 rounded-lg p-3">
                    <div className="text-[9px] text-white/30 uppercase tracking-wider font-bold mb-2">Scegli pilota per Boost x3</div>
                    <div className="grid grid-cols-1 gap-1">
                      {displayDrivers
                        .filter((d) => d.driver_number !== sq.primoPilota)
                        .map((d) => {
                          const sel = sq.chipPilotiTarget === d.driver_number;
                          return (
                            <button key={d.driver_number}
                              onClick={() => sq.setChipPilotiTarget(sel ? null : d.driver_number)}
                              className={`flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-all ${
                                sel ? "bg-amber-500/15 border border-amber-500/30 text-amber-300" : "bg-white/[0.02] border border-white/[0.04] text-white/50 hover:bg-white/[0.04]"
                              }`}
                            >
                              {sel ? <CheckCircle2 size={14} /> : <Circle size={14} className="text-white/20" />}
                              {d.name}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Sesto uomo: scegli pilota */}
                {sq.chipPiloti === "sesto" && !sq.sestoUomo && (
                  <div className="mt-3 bg-black/20 rounded-lg p-3">
                    <div className="text-[9px] text-white/30 uppercase tracking-wider font-bold mb-2">Scegli il 6° pilota</div>
                    <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                      {DRIVERS_2026.filter((d) => !sq.driverNumbers.includes(d.number)).map((d: typeof DRIVERS_2026[number]) => (
                        <button key={d.number}
                          onClick={() => sq.setSestoUomo(d.number)}
                          className="flex items-center gap-2 p-2 rounded-lg text-left text-sm bg-white/[0.02] border border-white/[0.04] text-white/50 hover:bg-white/[0.04] transition-all"
                        >
                          <Circle size={14} className="text-white/20" />
                          <span>{d.name}</span>
                          <span className="ml-auto text-[10px] text-white/20">{d.team}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sq.chipPiloti === "sesto" && sestoUomoDriver && (
                  <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-sm text-blue-300 flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    <span>{sestoUomoDriver.name} aggiunto come 6° pilota</span>
                  </div>
                )}
              </div>
            )}

            {/* Penalita' cambi */}
            {sq.penalitaTotale > 0 && (
              <div className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <div className="flex-1 text-sm text-amber-400">
                  Penalità cambi extra: <span className="font-bold font-[family-name:var(--font-jetbrains)]">-{sq.penalitaTotale} punti</span> sul weekend
                </div>
              </div>
            )}

            {sq.confirmed && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
                <Check size={16} />Formazione confermata
                {!locked && <span className="text-green-400/50 text-xs ml-auto">Puoi ancora modificare</span>}
              </div>
            )}

            {isCurrentRound && !locked && (
              <button
                onClick={handleConfermaFormazione}
                disabled={confirmingForm || sq.drivers.length !== 5 || !sq.primoPilota}
                className={`w-full py-4 rounded-xl text-sm font-bold tracking-[2px] uppercase transition-all ${
                  sq.drivers.length === 5 && sq.primoPilota
                    ? "bg-[#E8002D] hover:bg-[#ff1a3d] text-white hover:shadow-[0_0_30px_rgba(232,0,45,0.3)]"
                    : "bg-white/5 text-white/20 cursor-not-allowed"
                }`}
              >
                {confirmingForm ? "Conferma in corso..."
                  : sq.drivers.length !== 5 ? `Servono ${5 - sq.drivers.length} piloti`
                  : !sq.primoPilota ? "Scegli un Primo Pilota"
                  : sq.confirmed ? "Riconferma Formazione"
                  : "Conferma Formazione"}
              </button>
            )}
          </div>
        )}

        {/* ═══ TAB PREVISIONI ═══ */}
        {tab === "previsioni" && (
          <div className="space-y-3">
            {PREVISIONI_CONFIG.map((p) => {
              const myAnswer = prev.previsioni[p.key];
              const resultValue = weekendResults?.events
                ? p.key === "safetyCar" ? weekendResults.events.safety_car
                : p.key === "virtualSafetyCar" ? weekendResults.events.virtual_safety_car
                : p.key === "redFlag" ? weekendResults.events.red_flag
                : p.key === "gommeWet" ? weekendResults.events.wet_tyres
                : p.key === "poleVince" ? weekendResults.events.pole_won
                : null
                : null;
              const isCorrect = hasResults && myAnswer !== null && myAnswer === resultValue;
              const isWrong = hasResults && myAnswer !== null && myAnswer !== resultValue;

              return (
                <div key={p.key} className={`bg-white/[0.03] border rounded-xl p-4 ${
                  isCorrect ? "border-green-500/30" : isWrong ? "border-red-500/20" : "border-white/[0.06]"
                }`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm">{p.label}</h3>
                      <p className="text-[11px] text-white/30 mt-0.5">{p.desc}</p>
                    </div>
                    {hasResults && resultValue !== null && (
                      <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${
                        resultValue ? "bg-green-500/15 text-green-400" : "bg-blue-500/15 text-blue-400"
                      }`}>
                        {resultValue ? "SI" : "NO"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => !locked && togglePrevisione(p.key, true)} disabled={locked}
                      className={`flex-1 py-3 rounded-lg text-sm font-bold tracking-wider uppercase transition-all ${
                        myAnswer === true
                          ? isCorrect ? "bg-green-500/20 border border-green-500/40 text-green-400"
                          : isWrong ? "bg-red-500/15 border border-red-500/30 text-red-400"
                          : "bg-green-500/20 border border-green-500/40 text-green-400"
                        : "bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50"
                      } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                    >SI<span className="block text-[9px] font-normal mt-0.5 opacity-60">+{p.si} pts</span></button>
                    <button onClick={() => !locked && togglePrevisione(p.key, false)} disabled={locked}
                      className={`flex-1 py-3 rounded-lg text-sm font-bold tracking-wider uppercase transition-all ${
                        myAnswer === false
                          ? isCorrect ? "bg-green-500/20 border border-green-500/40 text-green-400"
                          : isWrong ? "bg-red-500/15 border border-red-500/30 text-red-400"
                          : "bg-blue-500/20 border border-blue-500/40 text-blue-400"
                        : "bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50"
                      } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                    >NO<span className="block text-[9px] font-normal mt-0.5 opacity-60">+{p.no} pts</span></button>
                  </div>
                </div>
              );
            })}

            <div className={`bg-white/[0.03] border rounded-xl p-4 ${
              hasResults && prev.previsioni.numeroDnf !== null
                ? prev.previsioni.numeroDnf === weekendResults?.events.total_dnf ? "border-green-500/30" : "border-red-500/20"
                : "border-white/[0.06]"
            }`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm">Numero DNF esatto</h3>
                {hasResults && (
                  <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-white/10 text-white/60">
                    DNF: {weekendResults?.events.total_dnf}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/30 mb-3">Quanti piloti si ritireranno? (+{PREVISIONI_PUNTI.numeroDnf.esatto} pts se indovini)</p>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 8 }, (_, i) => i).map((n) => {
                  const isSelected = prev.previsioni.numeroDnf === n;
                  const isExact = hasResults && isSelected && n === weekendResults?.events.total_dnf;
                  const isMissed = hasResults && isSelected && n !== weekendResults?.events.total_dnf;
                  return (
                    <button key={n} onClick={() => !locked && prev.setNumeroDnf(prev.previsioni.numeroDnf === n ? null : n)} disabled={locked}
                      className={`w-10 h-10 rounded-lg font-[family-name:var(--font-jetbrains)] font-bold text-sm transition-all ${
                        isExact ? "bg-green-500/20 border border-green-500/40 text-green-400"
                        : isMissed ? "bg-red-500/15 border border-red-500/30 text-red-400"
                        : isSelected ? "bg-[#E8002D]/20 border border-[#E8002D]/40 text-[#E8002D]"
                        : "bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50"
                      } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                    >{n}</button>
                  );
                })}
              </div>
            </div>

            {/* Chip previsioni usato (read-only per round passati) */}
            {locked && (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-1">Aggiornamento Previsioni</div>
                {prev.chipAttivo ? (
                  <>
                    <div className="text-sm text-[#E8002D] font-bold">{CHIP_LABELS[prev.chipAttivo] || prev.chipAttivo}</div>
                    {prev.chipTarget && (
                      <div className="text-[11px] text-white/40 mt-0.5">Applicato a: {PREVISIONE_LABELS[prev.chipTarget] || prev.chipTarget}</div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-white/20">Nessuno</div>
                )}
              </div>
            )}

            {!locked && (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-2">Aggiornamento Previsioni</div>
                <div className="flex gap-2 flex-wrap">
                  {CHIP_PREVISIONI.map((chip) => {
                    const Icon = chip.icon;
                    const active = prev.chipAttivo === chip.id;
                    return (
                      <button key={chip.id} onClick={() => prev.setChipAttivo(active ? null : chip.id)}
                        className={`flex items-start gap-2 px-3 py-3 rounded-xl text-left transition-all ${
                          active ? "bg-[#E8002D]/10 border border-[#E8002D]/30" : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04]"
                        }`}
                      >
                        <Icon size={14} className={active ? "text-[#E8002D] mt-0.5" : "text-white/30 mt-0.5"} />
                        <div>
                          <div className={`text-[11px] font-bold ${active ? "text-[#E8002D]" : "text-white/50"}`}>{chip.label}</div>
                          <div className="text-[9px] text-white/25 mt-0.5">{chip.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {(prev.chipAttivo === "sicura" || prev.chipAttivo === "doppia") && (
                  <div className="mt-3 bg-black/20 rounded-lg p-3">
                    <div className="text-[9px] text-white/30 uppercase tracking-wider font-bold mb-2">
                      Applica a quale previsione?
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {[...PREVISIONI_CONFIG.map(p => ({ id: p.key, label: p.label })), { id: "numeroDnf", label: "Numero DNF" }].map((p) => {
                        const sel = prev.chipTarget === p.id;
                        return (
                          <button key={p.id}
                            onClick={() => prev.setChipTarget(sel ? null : p.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-all ${
                              sel ? "bg-[#E8002D]/15 border border-[#E8002D]/30 text-[#E8002D]" : "bg-white/[0.02] border border-white/[0.04] text-white/50 hover:bg-white/[0.04]"
                            }`}
                          >
                            {sel ? <CheckCircle2 size={14} /> : <Circle size={14} className="text-white/20" />}
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {prev.confirmed && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
                <Check size={16} />Previsioni confermate ({prev.completate}/6)
                {!locked && <span className="text-green-400/50 text-xs ml-auto">Puoi ancora modificare</span>}
              </div>
            )}

            {isCurrentRound && !locked && (
              <button onClick={handleConfermaPrevisioni} disabled={prev.completate < 6 || confirmingPrev}
                className={`w-full py-4 rounded-xl text-sm font-bold tracking-[2px] uppercase transition-all ${
                  prev.completate === 6 ? "bg-[#E8002D] hover:bg-[#ff1a3d] text-white hover:shadow-[0_0_30px_rgba(232,0,45,0.3)]" : "bg-white/5 text-white/20 cursor-not-allowed"
                }`}
              >
                {confirmingPrev ? "Conferma in corso..." : prev.confirmed ? "Aggiorna Previsioni" : `Conferma Previsioni (${prev.completate}/6)`}
              </button>
            )}
          </div>
        )}

        {/* ═══ TAB DETTAGLIO (punteggio post-gara o orari pre-gara) ═══ */}
        {tab === "dettaglio" && (
          <div className="space-y-4">
            {hasResults && weekendResults ? (
              <>
                {myWeekendScore ? (
                  <>
                    {/* Punteggio totale */}
                    <div className="bg-white/[0.03] border border-[#E8002D]/20 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold">Il tuo weekend</div>
                        <span className="font-[family-name:var(--font-jetbrains)] text-3xl font-black text-[#E8002D]">
                          {myWeekendScore.total}
                        </span>
                      </div>

                      <div className={`grid ${myWeekendScore.penalitaCambi > 0 ? "grid-cols-3" : "grid-cols-2"} gap-3 mb-4`}>
                        <div className="bg-black/20 rounded-lg p-3 text-center">
                          <div className="font-[family-name:var(--font-jetbrains)] text-lg font-bold">{myWeekendScore.pilotiPoints}</div>
                          <div className="text-[8px] tracking-[2px] text-white/30 mt-0.5">PILOTI</div>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3 text-center">
                          <div className="font-[family-name:var(--font-jetbrains)] text-lg font-bold">{myWeekendScore.previsioniPoints}</div>
                          <div className="text-[8px] tracking-[2px] text-white/30 mt-0.5">PREVISIONI</div>
                        </div>
                        {myWeekendScore.penalitaCambi > 0 && (
                          <div className="bg-black/20 rounded-lg p-3 text-center">
                            <div className="font-[family-name:var(--font-jetbrains)] text-lg font-bold text-amber-400">-{myWeekendScore.penalitaCambi}</div>
                            <div className="text-[8px] tracking-[2px] text-amber-400/50 mt-0.5">PENALITÀ</div>
                          </div>
                        )}
                      </div>

                      {/* Dettaglio piloti */}
                      <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-2">Dettaglio Piloti</div>
                      <div className="space-y-1 mb-4">
                        {myWeekendScore.pilotiDettaglio.map((d) => {
                          const color = getDriverByNumber(d.driver_number)?.teamColour;
                          return (
                            <div key={d.driver_number} className="flex items-center justify-between text-sm bg-white/[0.02] rounded-lg px-3 py-2">
                              <span className="flex items-center gap-2">
                                {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `#${color}` }} />}
                                <span className={d.moltiplicatore === 2 ? "text-[#E8002D] font-bold" : d.moltiplicatore === 3 ? "text-amber-400 font-bold" : d.isSestoUomo ? "text-blue-400" : "text-white/70"}>
                                  {d.name}
                                </span>
                                {d.moltiplicatore === 2 && <span className="text-[9px] text-[#E8002D]/60">x2</span>}
                                {d.moltiplicatore === 3 && <Zap size={11} className="text-amber-400" />}
                                {d.isSestoUomo && <Users size={11} className="text-blue-400" />}
                                {d.haloApplicato && <Shield size={11} className="text-green-400" />}
                              </span>
                              <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${d.puntiFinali > 0 ? "text-green-400" : d.puntiFinali < 0 ? "text-red-400" : "text-white/20"}`}>
                                {d.puntiFinali > 0 ? "+" : ""}{d.puntiFinali}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Dettaglio previsioni */}
                      <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-2">Dettaglio Previsioni</div>
                      <div className="space-y-1">
                        {Object.entries(myWeekendScore.previsioniDettaglio).map(([key, pts]) => (
                          <div key={key} className="flex items-center justify-between text-sm bg-white/[0.02] rounded-lg px-3 py-2">
                            <span className="text-white/60">{PREVISIONE_LABELS[key] || key}</span>
                            <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${pts > 0 ? "text-green-400" : "text-white/20"}`}>
                              {pts > 0 ? `+${pts}` : "0"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <div className="text-white/20 text-sm">Non hai confermato la formazione per questa gara</div>
                  </div>
                )}

                {/* Eventi della gara */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-3">Eventi della gara</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Safety Car", value: weekendResults.events.safety_car },
                      { label: "VSC", value: weekendResults.events.virtual_safety_car },
                      { label: "Red Flag", value: weekendResults.events.red_flag },
                      { label: "Gomme Wet", value: weekendResults.events.wet_tyres },
                      { label: "Pole ha vinto", value: weekendResults.events.pole_won },
                    ].map((e) => (
                      <div key={e.label} className="flex items-center justify-between text-sm px-3 py-2 bg-white/[0.02] rounded-lg">
                        <span className="text-white/40">{e.label}</span>
                        <span className={e.value ? "text-green-400 font-bold" : "text-white/20"}>
                          {e.value ? "SI" : "NO"}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm px-3 py-2 bg-white/[0.02] rounded-lg">
                      <span className="text-white/40">DNF totali</span>
                      <span className="font-[family-name:var(--font-jetbrains)] font-bold text-white/60">
                        {weekendResults.events.total_dnf}
                      </span>
                    </div>
                  </div>
                </div>

                <Link href="/classifica"
                  className="flex items-center justify-center gap-2 bg-[#E8002D]/10 text-[#E8002D] font-bold text-[11px] tracking-wider uppercase py-3 rounded-xl hover:bg-[#E8002D]/20 transition-all"
                >
                  Classifica completa <ChevronRight size={14} />
                </Link>
              </>
            ) : (
              /* Orari sessioni (pre-gara) */
              <>
                {(["Venerdì", "Sabato", "Domenica"] as const).map((giorno) => {
                  const daySessions = sessions.filter((s) => s.day === giorno);
                  if (daySessions.length === 0) return null;
                  return (
                    <div key={giorno}>
                      <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-2">{giorno}</div>
                      <div className="space-y-1.5">
                        {daySessions.map((session) => {
                          const sessionDate = new Date(session.dateTime);
                          const now = new Date();
                          const isCompleted = now > new Date(sessionDate.getTime() + 2 * 60 * 60 * 1000);
                          const isLive = now >= sessionDate && !isCompleted;
                          const isPractice = session.type === "practice";
                          return (
                            <div key={session.shortName}
                              className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                                isLive ? "bg-[#E8002D]/10 border border-[#E8002D]/30" : "bg-white/[0.03] border border-white/[0.06]"
                              }`}
                            >
                              <div className="w-8 flex justify-center">
                                {isLive ? <div className="w-3 h-3 rounded-full bg-[#E8002D] animate-live-pulse" />
                                : isCompleted ? <CheckCircle2 size={16} className="text-green-500/50" />
                                : <Circle size={16} className="text-white/15" />}
                              </div>
                              <div className="flex-1">
                                <div className={`text-sm font-semibold ${isLive ? "text-[#E8002D]" : isPractice ? "text-white/50" : "text-white"}`}>{session.name}</div>
                                {isPractice && <div className="text-[9px] text-white/20">Nessun punteggio assegnato</div>}
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`font-[family-name:var(--font-jetbrains)] text-xs font-bold ${isLive ? "text-[#E8002D]" : "text-white/50"}`}>
                                  {sessionDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                                {isLive && <div className="text-[9px] text-[#E8002D] font-bold tracking-wider">LIVE</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={16} className="text-amber-400/60 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-400/80">Deadline</div>
                      <p className="text-[11px] text-white/30 mt-0.5 leading-relaxed">
                        {viewRace.sprint
                          ? "Weekend Sprint: devi confermare prima della Sprint Shootout (venerdì). Avrai visto solo FP1."
                          : "Weekend normale: devi confermare prima delle Qualifiche (sabato). Avrai visto FP1, FP2 e FP3."}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

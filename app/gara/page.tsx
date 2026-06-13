"use client";
import { useState, useEffect, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import CountryFlag from "../components/CountryFlag";
import { useSquadra, usePrevisioni, useLegaPreferita } from "../lib/store";
import { useAuth } from "../lib/auth";
import { createClient, isSupabaseConfigured } from "../lib/supabase";
import { RACES_2026, getNextRace, getCurrentRound, getDeadline, isAfterDeadline, getRaceByRound } from "../lib/races";
import { DRIVERS_2026, getDriverByNumber } from "../lib/drivers-data";
import { PREVISIONI_PUNTI } from "../lib/types";
import { useCdaCompleted } from "../lib/use-cda";
import { useLiveSession } from "../lib/use-live-session";
import { useProvisionalScores } from "../lib/provisional-scores";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";
const LiveTab = dynamic(() => import("../components/LiveTab"), { ssr: false });
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
  { id: "scudo", label: "Scudo Capitano", desc: "Capitano x2 solo bonus, malus x1", icon: ShieldCheck },
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

type Tab = "formazione" | "previsioni" | "dettaglio" | "live";

const PREVISIONE_LABELS: Record<string, string> = {
  safetyCar: "Safety Car",
  virtualSafetyCar: "Virtual Safety Car",
  redFlag: "Red Flag",
  gommeWet: "Gomme Wet",
  poleVince: "Pole vince",
  numeroDnf: "Numero DNF",
};

const CHIP_LABELS: Record<string, string> = {
  boost: "Boost Mode x3", halo: "Halo", scudo: "Scudo Capitano", sesto: "Sesto Uomo", wildcard: "Wildcard",
  sicura: "Prev. Sicura", doppia: "Prev. Doppia",
};

// ─── Driver row ───

const DriverRow = memo(function DriverRow({
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
      className={`relative flex items-center gap-3 rounded p-3 transition-colors ${
        isCaptain ? "bg-[#E8002D]/[0.05] border border-[#E8002D]/45 shadow-[0_0_18px_rgba(232,0,45,0.1)]"
        : isBoosted ? "bg-amber-500/[0.04] border border-amber-500/45"
        : isSestoUomo ? "bg-blue-500/[0.03] border border-blue-500/30 border-dashed"
        : "bg-[#0e0e14] border border-[#1c1c26]"
      }`}
    >
      {isCaptain && (
        <div className="absolute -top-1.5 left-3 bg-[#E8002D] text-white font-[family-name:var(--font-jetbrains)] text-[8px] font-bold tracking-[1.5px] px-2 py-0.5 rounded-sm">
          PRIMO PILOTA · x2
        </div>
      )}
      {isBoosted && !isCaptain && (
        <div className="absolute -top-1.5 left-3 bg-amber-500 text-black font-[family-name:var(--font-jetbrains)] text-[8px] font-bold tracking-[1.5px] px-2 py-0.5 rounded-sm">
          BOOST · x3
        </div>
      )}
      {isSestoUomo && (
        <div className="absolute -top-1.5 left-3 bg-blue-500 text-white font-[family-name:var(--font-jetbrains)] text-[8px] font-bold tracking-[1.5px] px-2 py-0.5 rounded-sm">
          SESTO UOMO
        </div>
      )}

      <div className="w-[3px] h-10 rounded shrink-0" style={{ backgroundColor: color }} />

      <div
        className="font-[family-name:var(--font-jetbrains)] text-[13px] font-extrabold w-8 text-center shrink-0 tabular-nums"
        style={{ color }}
      >
        {d.number}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isCaptain && <Crown size={11} className="text-[#E8002D] shrink-0" />}
          <span className="font-bold text-[13px] truncate tracking-[-0.2px]">{d.name}</span>
        </div>
        <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/35 tracking-[0.5px] uppercase mt-0.5">{d.team}</div>
      </div>

      {points != null && (
        <span className={`font-[family-name:var(--font-jetbrains)] font-extrabold text-[15px] shrink-0 tabular-nums ${points > 0 ? "text-green-400" : points < 0 ? "text-red-400" : "text-white/20"}`}>
          {points > 0 ? "+" : ""}{points}
        </span>
      )}

      {!locked && points == null && (
        <div className="flex gap-1 shrink-0">
          {!isCaptain && !isSestoUomo && onSetPrimoPilota && (
            <button
              onClick={onSetPrimoPilota}
              className="font-[family-name:var(--font-jetbrains)] text-[8px] tracking-[1.2px] font-bold uppercase border border-[#E8002D]/30 text-[#E8002D]/70 hover:bg-[#E8002D]/10 hover:text-[#E8002D] px-2 py-1.5 rounded transition-colors leading-tight"
            >
              PRIMO<br/>PILOTA
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[1.5px] font-bold uppercase border border-[#1c1c26] text-white/35 hover:bg-white/5 hover:text-white/60 px-2 py-1.5 rounded transition-colors"
            >
              {isSestoUomo ? "RIMUOVI" : "VENDI"}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════
// PAGINA GARA
// ═══════════════════════════════════════════

export default function GaraPageWrapper() {
  return (
    <Suspense>
      <GaraPage />
    </Suspense>
  );
}

function GaraPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const currentRound = getCurrentRound();
  const [viewRound, setViewRound] = useState(currentRound);

  const viewRace = getRaceByRound(viewRound) || getNextRace();
  const isCurrentRound = viewRound === currentRound;
  const deadline = getDeadline(viewRace);

  const sq = useSquadra(viewRound);
  const prev = usePrevisioni(viewRound);
  const { canPlay: cdaCanPlay } = useCdaCompleted();
  const { isLive: realIsLive, session: realLiveSession } = useLiveSession();
  const { legaId } = useLegaPreferita();
  const searchParams = useSearchParams();
  const debugLive = searchParams.get("debug_live") === "true";
  const isLive = realIsLive || debugLive;
  const liveSession = realLiveSession || (debugLive ? { sessionKey: 9999, sessionName: "Race", sessionType: "Race", meetingKey: 1 } : null);
  const { provisional } = useProvisionalScores(isLive, viewRound);

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

  const showProvisional = !isLive && !!provisional && isCurrentRound && !weekendResults;

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

  // Auto-switch al tab Live quando c'è sessione attiva o dati provvisori
  useEffect(() => {
    if ((isLive || showProvisional) && isCurrentRound && tab !== "live") {
      setTab("live");
    }
  }, [isLive, showProvisional, isCurrentRound]);

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
          // Previsioni e chip previsioni solo se la gara è stata calcolata
          const garaCalcolata = results.race.length > 0;
          const previsioniPerCalcolo = garaCalcolata ? prev.previsioni : {
            safetyCar: null, virtualSafetyCar: null, redFlag: null,
            gommeWet: null, poleVince: null, numeroDnf: null,
          };
          const chipPrevisioni: ChipPrevisioniConfig = garaCalcolata
            ? { chipAttivo: prev.chipAttivo, chipTarget: prev.chipTarget }
            : { chipAttivo: null, chipTarget: null };
          const calc = calcolaPuntiWeekend(
            sq.driverNumbers,
            sq.primoPilota,
            previsioniPerCalcolo,
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
  const selectableRounds = useMemo(() => {
    const pastRaces = RACES_2026.filter((r) => new Date(r.date) <= new Date() && r.round !== currentRound);
    return [
      RACES_2026.find((r) => r.round === currentRound)!,
      ...pastRaces.reverse(),
    ].filter(Boolean);
  }, [currentRound]);

  const handleConfermaFormazione = async () => {
    if (cdaCanPlay === false) return showToast("Completa il questionario CDA prima di giocare!");
    if (sq.drivers.length !== 5) return showToast("Devi avere 5 piloti");
    if (!sq.primoPilota) return showToast("Scegli un Primo Pilota");
    setConfirmingForm(true);
    const ok = await sq.conferma();
    setConfirmingForm(false);
    if (ok) showToast("Formazione confermata!");
  };

  const handleConfermaPrevisioni = async () => {
    if (cdaCanPlay === false) return showToast("Completa il questionario CDA prima di giocare!");
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
  const displayDrivers = useMemo(() => sq.driverNumbers
    .map((num) => {
      const d = getDriverByNumber(num);
      return d ? { driver_number: num, name: d.name, team: d.team, teamColour: d.teamColour, price: d.price } : null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null),
  [sq.driverNumbers]);

  const sestoUomoDriver = useMemo(() => sq.sestoUomo ? getDriverByNumber(sq.sestoUomo) : null, [sq.sestoUomo]);

  // Per il tab dettaglio con risultati, lookup punti per pilota
  const pilotiPointsMap = useMemo(() => {
    const map = new Map<number, number>();
    if (myWeekendScore) {
      for (const d of myWeekendScore.pilotiDettaglio) {
        map.set(d.driver_number, d.puntiFinali);
      }
    }
    return map;
  }, [myWeekendScore]);

  if (authLoading || !sq.loaded || !prev.loaded || !user) {
    return (
      <div className="min-h-screen bg-[#050507] text-white bg-grid">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] bg-[#E8002D] text-white text-[12px] font-bold tracking-[1.5px] uppercase px-5 py-3 rounded shadow-[0_0_30px_rgba(232,0,45,0.4)] font-[family-name:var(--font-jetbrains)]">
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
                className="w-full bg-[#0e0e14] border border-[#1c1c26] rounded px-4 py-3 text-white text-[13px] font-bold font-[family-name:var(--font-jetbrains)] tracking-[0.5px] outline-none focus:border-[#E8002D]/50 appearance-none pr-10"
              >
                {selectableRounds.map((race) => (
                  <option key={race.round} value={race.round} className="bg-[#050507]">
                    R{String(race.round).padStart(2, "0")} — {race.flag} {race.name} {race.round === currentRound ? "(ATTUALE)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E8002D] pointer-events-none" />
            </div>
          </div>
        )}

        {/* ═══ HEADER (HudCard) ═══ */}
        <div className="hud-card hud-card-accent mb-4">
          <div className="hud-card-head">
            <div className="hud-label">
              ROUND {String(viewRace.round).padStart(2, "0")} / 24
            </div>
            <div className="flex items-center gap-1.5">
              {viewRace.sprint && (
                <span className="font-[family-name:var(--font-jetbrains)] bg-[#E8002D]/15 border border-[#E8002D]/30 text-[#E8002D] px-2 py-0.5 rounded text-[9px] font-bold tracking-[1.5px]">SPRINT</span>
              )}
              {locked && (
                <span className="font-[family-name:var(--font-jetbrains)] bg-white/[0.04] border border-[#1c1c26] text-white/40 px-2 py-0.5 rounded text-[9px] font-bold tracking-[1.5px]">BLOCCATO</span>
              )}
              {hasResults && (
                <span className="font-[family-name:var(--font-jetbrains)] bg-green-500/10 border border-green-500/30 text-green-400 px-2 py-0.5 rounded text-[9px] font-bold tracking-[1.5px]">DONE</span>
              )}
              {isLive && isCurrentRound && (
                <span className="live-pill">
                  <span className="live-pill-dot" />
                  LIVE
                </span>
              )}
              {showProvisional && (
                <span className="font-[family-name:var(--font-jetbrains)] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold tracking-[1.5px]">PROVVISORIO</span>
              )}
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <CountryFlag countryCode={viewRace.countryCode} size={36} />
              <div className="flex-1 min-w-0">
                <h1 className="text-[22px] font-extrabold leading-[1.1] tracking-[-0.4px]">{viewRace.name}</h1>
                <p className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/35 tracking-[0.5px] uppercase mt-1 truncate">{viewRace.circuit}</p>
              </div>
            </div>
            {mounted && isCurrentRound && !locked && (
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 mt-4 bg-black/40 border border-[#1c1c26] rounded px-3 py-2.5">
                <Clock size={13} className="text-[#E8002D]" />
                <span className="hud-label">DEADLINE</span>
                <span className="font-[family-name:var(--font-jetbrains)] text-[14px] font-extrabold tabular-nums tracking-[0.5px]">
                  {countdown.days > 0 && (
                    <span className="text-[#E8002D]">{String(countdown.days).padStart(2, "0")}<span className="text-white/30 text-[10px] mx-0.5">G</span></span>
                  )}
                  {String(countdown.hours).padStart(2, "0")}<span className="text-white/30 mx-0.5">:</span>{String(countdown.minutes).padStart(2, "0")}<span className="text-white/30 mx-0.5">:</span>{String(countdown.seconds).padStart(2, "0")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ═══ TABS ═══ */}
        <div className="flex gap-1 mb-4">
          {([...((isLive && isCurrentRound) || showProvisional ? ["live" as Tab] : []), "formazione", "previsioni", ...(hasResults ? ["dettaglio" as Tab] : [])] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = { live: "LIVE", formazione: "FORMAZIONE", previsioni: "PREVISIONI", dettaglio: "DETTAGLIO" };
            const isActive = tab === t;
            let indicator: React.ReactNode = null;
            if (t === "live") indicator = <span className="w-1.5 h-1.5 bg-[#E8002D] rounded-full animate-live-pulse" />;
            if (t === "dettaglio" && hasResults) indicator = <Trophy size={11} className="text-[#E8002D]" />;
            if (t === "formazione" && sq.confirmed) indicator = <Check size={11} className="text-green-400" />;
            if (t === "previsioni" && prev.confirmed) indicator = <Check size={11} className="text-green-400" />;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[2px] font-bold transition-all border ${
                  isActive
                    ? "bg-[#E8002D]/12 border-[#E8002D]/45 text-[#E8002D] shadow-[inset_0_-2px_0_var(--accent)]"
                    : "bg-[#0e0e14] border-[#1c1c26] text-white/40 hover:text-white/70"
                }`}
              >
                {indicator}{labels[t]}
              </button>
            );
          })}
        </div>

        {/* Banner CDA: questionario non completato */}
        {cdaCanPlay === false && isCurrentRound && !locked && (
          <Link href="/cda"
            className="flex items-center gap-3 bg-[#E8002D]/8 border-l-[3px] border-l-[#E8002D] border border-[#E8002D]/20 rounded-r px-4 py-3 mb-4 hover:bg-[#E8002D]/12 transition-all"
          >
            <AlertTriangle size={16} className="text-[#E8002D] shrink-0" />
            <span className="text-[13px] text-[#E8002D] font-semibold">Completa il questionario CDA per poter confermare</span>
            <ChevronRight size={14} className="ml-auto text-[#E8002D]/50 shrink-0" />
          </Link>
        )}

        {/* Banner "Pronto per il GP" */}
        {isCurrentRound && !locked && sq.confirmed && prev.confirmed && (
          <div className="hud-card mb-4" style={{ borderColor: "rgba(0,255,136,0.25)" }}>
            <div className="hud-card-head" style={{ borderBottomColor: "rgba(0,255,136,0.12)" }}>
              <div className="hud-label" style={{ color: "var(--green)" }}>
                ▌ PRONTO PER LA GARA
              </div>
              <Check size={14} className="text-green-400" />
            </div>
            <div className="p-4">
              <div className="text-[13px] font-bold mb-3">Formazione e previsioni confermate per il <span className="text-[#E8002D]">{viewRace.name}</span></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/40 border border-[#1c1c26] rounded p-2.5">
                  <div className="hud-label mb-1">PRIMO PILOTA</div>
                  <div className="text-[12px] font-bold text-[#E8002D]">{sq.primoPilota ? getDriverByNumber(sq.primoPilota)?.name || "—" : "—"}</div>
                </div>
                <div className="bg-black/40 border border-[#1c1c26] rounded p-2.5">
                  <div className="hud-label mb-1">PREVISIONI</div>
                  <div className="text-[12px] font-bold font-[family-name:var(--font-jetbrains)]">{prev.completate}<span className="text-white/30"> / 6</span></div>
                </div>
                {sq.chipPiloti && (
                  <div className="bg-black/40 border border-[#1c1c26] rounded p-2.5">
                    <div className="hud-label mb-1">CHIP PILOTI</div>
                    <div className="text-[12px] font-bold text-amber-400">{CHIP_LABELS[sq.chipPiloti] || sq.chipPiloti}</div>
                  </div>
                )}
                {prev.chipAttivo && (
                  <div className="bg-black/40 border border-[#1c1c26] rounded p-2.5">
                    <div className="hud-label mb-1">CHIP PREVISIONI</div>
                    <div className="text-[12px] font-bold text-amber-400">{CHIP_LABELS[prev.chipAttivo] || prev.chipAttivo}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB PROVVISORIO (sessione finita, risultati non ancora calcolati) ═══ */}
        {tab === "live" && showProvisional && provisional && (
          <div>
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/[0.03] border border-amber-500/15 rounded-2xl p-4 text-center mb-4">
              <div className="text-[9px] tracking-[3px] text-amber-400/60 uppercase mb-1">Punteggio weekend provvisorio</div>
              <div className="font-[family-name:var(--font-jetbrains)] text-[32px] font-bold leading-none text-amber-400">
                {provisional.scores.find((s) => s.userId === user?.id)?.points ?? "—"}
              </div>
              {provisional.sessions.length > 0 && (
                <div className="flex justify-center gap-3 mt-2 text-[10px] text-white/30">
                  {provisional.sessions.map((sess) => {
                    const myPts = sess.scores[user?.id || ""] ?? 0;
                    return (
                      <span key={sess.sessionName}>
                        {sess.sessionName}: <span className="font-[family-name:var(--font-jetbrains)] text-amber-400/60">{myPts}</span>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="text-[10px] text-white/20 mt-2">In attesa dei risultati ufficiali</div>
            </div>

            <div className="hud-label mb-2">
              Classifica Weekend Provvisoria
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-hidden mb-4">
              {provisional.scores.map((entry, i) => {
                const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
                const isMe = entry.userId === user?.id;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between px-3.5 py-2.5 transition-all ${
                      i < provisional.scores.length - 1 ? "border-b border-white/[0.04]" : ""
                    } ${isMe ? "bg-amber-500/[0.05] border-l-[3px] border-l-amber-500" : ""}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-bold w-5 text-center ${
                        i === 0 ? "text-amber-400" : isMe ? "text-amber-400" : "text-white/30"
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <div className={`text-[13px] font-semibold ${isMe ? "text-white" : ""}`}>{entry.scuderiaName}</div>
                        <div className={`text-[10px] ${isMe ? "text-amber-400/50" : "text-white/25"}`}>@{entry.tpName}</div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`font-[family-name:var(--font-jetbrains)] text-base font-bold ${isMe ? "text-white" : "text-white/70"}`}>
                        {entry.points}
                      </span>
                      {i < 10 && (
                        <span className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/15">+{PUNTI_REALE[i]} CR</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ TAB LIVE ═══ */}
        {tab === "live" && isLive && liveSession && (
          <LiveTab
            sessionKey={liveSession.sessionKey}
            sessionType={liveSession.sessionName}
            meetingKey={liveSession.meetingKey}
            round={viewRound}
            userId={user?.id}
            legaId={legaId}
            driverNumbers={sq.driverNumbers}
            primoPilota={sq.primoPilota}
            chipPiloti={sq.chipPiloti ? { chipPiloti: sq.chipPiloti, chipPilotiTarget: sq.chipPilotiTarget, sestoUomo: sq.sestoUomo } : null}
            chipPrevisioni={prev.chipAttivo ? { chipAttivo: prev.chipAttivo, chipTarget: prev.chipTarget } : null}
            previsioni={prev.previsioni}
            debug={debugLive}
          />
        )}

        {/* ═══ TAB FORMAZIONE ═══ */}
        {tab === "formazione" && (
          <div className="space-y-4">
            <div>
              <div className="hud-label mb-2">
                I tuoi piloti ({displayDrivers.length}/5{sestoUomoDriver ? " +1" : ""})
              </div>

              {displayDrivers.length === 0 ? (
                isCurrentRound && !locked ? (
                  <Link href="/mercato" className="block text-center border border-dashed border-[#2a2a38] rounded p-8 text-white/20 hover:text-white/30 transition-all text-sm tracking-wider uppercase">
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
                <Link href="/mercato" className="flex items-center justify-center gap-2 mt-2 border border-dashed border-[#2a2a38] rounded p-3 text-white/20 hover:text-white/30 hover:border-white/15 transition-all text-[11px] tracking-wider uppercase">
                  + Aggiungi dal Mercato ({displayDrivers.length}/5) <ChevronRight size={14} />
                </Link>
              )}
            </div>

            {/* Chip piloti usati (read-only per round passati) */}
            {locked && (
              <div className="hud-card px-4 py-3">
                <div className="hud-label mb-1">Aggiornamento Piloti</div>
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
              <div className="hud-card p-4">
                <div className="hud-label mb-2">Aggiornamento Piloti</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHIP_PILOTI.map((chip) => {
                    const Icon = chip.icon;
                    const active = sq.chipPiloti === chip.id;
                    const usedRound = sq.chipPilotiUnavailable[chip.id];
                    const disabled = usedRound != null && !active;
                    return (
                      <button key={chip.id}
                        disabled={disabled}
                        onClick={() => { if (!disabled) sq.setChipPiloti(active ? null : chip.id); }}
                        className={`relative flex items-start gap-2 p-3 rounded text-left transition-colors ${
                          active
                            ? "bg-[#E8002D]/12 border border-[#E8002D]/45 shadow-[inset_0_-2px_0_var(--accent)]"
                            : disabled
                            ? "bg-[#0e0e14] border border-[#1c1c26] opacity-40 cursor-not-allowed"
                            : "bg-[#0e0e14] border border-[#1c1c26] hover:border-[#2a2a38]"
                        }`}
                      >
                        <Icon size={14} className={active ? "text-[#E8002D] mt-0.5" : "text-white/35 mt-0.5"} />
                        <div className="min-w-0">
                          <div className={`font-[family-name:var(--font-jetbrains)] text-[10px] font-bold tracking-[1.5px] uppercase ${active ? "text-[#E8002D]" : "text-white/55"}`}>{chip.label}</div>
                          <div className="text-[10px] text-white/30 mt-0.5 leading-tight">{disabled ? `Già usato (R${usedRound})` : chip.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Boost: scegli pilota */}
                {sq.chipPiloti === "boost" && (
                  <div className="mt-3 bg-black/40 border border-[#1c1c26] rounded p-3">
                    <div className="hud-label mb-2">SCEGLI PILOTA · BOOST x3</div>
                    <div className="grid grid-cols-1 gap-1">
                      {displayDrivers
                        .filter((d) => d.driver_number !== sq.primoPilota)
                        .map((d) => {
                          const sel = sq.chipPilotiTarget === d.driver_number;
                          return (
                            <button key={d.driver_number}
                              onClick={() => sq.setChipPilotiTarget(sel ? null : d.driver_number)}
                              className={`flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-all ${
                                sel ? "bg-amber-500/15 border border-amber-500/30 text-amber-300" : "bg-[#0e0e14] border border-[#1c1c26] text-white/50 hover:bg-white/[0.04]"
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
                  <div className="mt-3 bg-black/40 border border-[#1c1c26] rounded p-3">
                    <div className="hud-label mb-2">SCEGLI IL 6° PILOTA</div>
                    <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                      {DRIVERS_2026.filter((d) => !sq.driverNumbers.includes(d.number)).map((d: typeof DRIVERS_2026[number]) => (
                        <button key={d.number}
                          onClick={() => sq.setSestoUomo(d.number)}
                          className="flex items-center gap-2 p-2 rounded-lg text-left text-sm bg-[#0e0e14] border border-[#1c1c26] text-white/50 hover:bg-white/[0.04] transition-all"
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
              <div className="flex items-center gap-3 bg-amber-500/5 border-l-[3px] border-l-amber-500 border border-amber-500/20 rounded-r px-4 py-3">
                <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                <div className="flex-1 text-[12px] text-amber-400">
                  <span className="font-[family-name:var(--font-jetbrains)] tracking-[0.5px] uppercase text-[10px] text-amber-400/70 block">PENALITÀ CAMBI EXTRA</span>
                  <span className="font-bold font-[family-name:var(--font-jetbrains)] tabular-nums">−{sq.penalitaTotale}</span> punti sul weekend
                </div>
              </div>
            )}

            {sq.confirmed && (
              <div className="flex items-center gap-2 bg-green-500/8 border-l-[3px] border-l-green-500 border border-green-500/20 rounded-r px-4 py-3 text-[12px] text-green-400">
                <Check size={15} />
                <span className="font-bold tracking-[0.3px]">Formazione confermata</span>
                {!locked && <span className="text-green-400/45 text-[10px] ml-auto font-[family-name:var(--font-jetbrains)] tracking-[1px] uppercase">PUOI MODIFICARE</span>}
              </div>
            )}

            {/* Avviso: formazione OK ma previsioni no */}
            {sq.confirmed && !prev.confirmed && !locked && (
              <button onClick={() => setTab("previsioni")}
                className="flex items-center gap-2 bg-amber-500/8 border-l-[3px] border-l-amber-500 border border-amber-500/20 rounded-r px-4 py-3 text-[12px] text-amber-400 w-full text-left hover:bg-amber-500/12 transition-colors"
              >
                <AlertTriangle size={15} className="shrink-0" />
                <span>Mancano le previsioni — tocca per completarle</span>
                <ChevronRight size={14} className="ml-auto shrink-0 opacity-50" />
              </button>
            )}

            {isCurrentRound && !locked && (
              <button
                onClick={handleConfermaFormazione}
                disabled={confirmingForm || sq.drivers.length !== 5 || !sq.primoPilota}
                className={`w-full py-4 rounded font-[family-name:var(--font-jetbrains)] text-[12px] font-extrabold tracking-[2.5px] uppercase transition-all ${
                  sq.drivers.length === 5 && sq.primoPilota
                    ? "bg-[#E8002D] hover:bg-[#ff1a3d] text-white hover:shadow-[0_0_30px_rgba(232,0,45,0.35)]"
                    : "bg-[#0e0e14] border border-[#1c1c26] text-white/20 cursor-not-allowed"
                }`}
              >
                {confirmingForm ? "CONFERMA IN CORSO…"
                  : sq.drivers.length !== 5 ? `▶ SERVONO ${5 - sq.drivers.length} PILOTI`
                  : !sq.primoPilota ? "▶ SCEGLI UN PRIMO PILOTA"
                  : sq.confirmed ? "▶ RICONFERMA FORMAZIONE"
                  : "▶ CONFERMA FORMAZIONE"}
              </button>
            )}
          </div>
        )}

        {/* ═══ TAB PREVISIONI ═══ */}
        {tab === "previsioni" && (
          <div className="space-y-3">
            {PREVISIONI_CONFIG.map((p) => {
              const myAnswer = prev.previsioni[p.key];
              const garaCalcolata = (weekendResults?.race?.length ?? 0) > 0;
              const resultValue = garaCalcolata && weekendResults?.events
                ? p.key === "safetyCar" ? weekendResults.events.safety_car
                : p.key === "virtualSafetyCar" ? weekendResults.events.virtual_safety_car
                : p.key === "redFlag" ? weekendResults.events.red_flag
                : p.key === "gommeWet" ? weekendResults.events.wet_tyres
                : p.key === "poleVince" ? weekendResults.events.pole_won
                : null
                : null;
              const isCorrect = garaCalcolata && myAnswer !== null && myAnswer === resultValue;
              const isWrong = garaCalcolata && myAnswer !== null && myAnswer !== resultValue;

              return (
                <div key={p.key} className={`hud-card p-4 ${
                  isCorrect ? "border-green-500/35" : isWrong ? "border-red-500/25" : ""
                }`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-[14px] tracking-[-0.2px]">{p.label}</h3>
                      <p className="text-[11px] text-white/35 mt-0.5">{p.desc}</p>
                    </div>
                    {hasResults && resultValue !== null && (
                      <span className={`font-[family-name:var(--font-jetbrains)] text-[10px] font-bold tracking-[1.5px] px-2 py-1 rounded ${
                        resultValue ? "bg-green-500/12 border border-green-500/30 text-green-400" : "bg-white/[0.04] border border-[#1c1c26] text-white/60"
                      }`}>
                        {resultValue ? "SI" : "NO"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => !locked && togglePrevisione(p.key, true)} disabled={locked}
                      className={`flex-1 py-3 rounded font-[family-name:var(--font-jetbrains)] text-[12px] font-bold tracking-[1.5px] uppercase transition-colors ${
                        myAnswer === true
                          ? isCorrect ? "bg-green-500/15 border border-green-500/45 text-green-400"
                          : isWrong ? "bg-red-500/12 border border-red-500/35 text-red-400"
                          : "bg-green-500/15 border border-green-500/45 text-green-400 shadow-[inset_0_-2px_0_rgba(34,197,94,0.6)]"
                        : "bg-[#0e0e14] border border-[#1c1c26] text-white/30 hover:text-white/55"
                      } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                    >SI<span className="block text-[9px] font-normal mt-0.5 opacity-60 tabular-nums">+{p.si} PTS</span></button>
                    <button onClick={() => !locked && togglePrevisione(p.key, false)} disabled={locked}
                      className={`flex-1 py-3 rounded font-[family-name:var(--font-jetbrains)] text-[12px] font-bold tracking-[1.5px] uppercase transition-colors ${
                        myAnswer === false
                          ? isCorrect ? "bg-green-500/15 border border-green-500/45 text-green-400"
                          : isWrong ? "bg-red-500/12 border border-red-500/35 text-red-400"
                          : "bg-white/[0.06] border border-white/15 text-white shadow-[inset_0_-2px_0_rgba(255,255,255,0.25)]"
                        : "bg-[#0e0e14] border border-[#1c1c26] text-white/30 hover:text-white/55"
                      } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                    >NO<span className="block text-[9px] font-normal mt-0.5 opacity-60 tabular-nums">+{p.no} PTS</span></button>
                  </div>
                </div>
              );
            })}

            <div className={`hud-card p-4 ${
              (() => { const gc = (weekendResults?.race?.length ?? 0) > 0; return gc && prev.previsioni.numeroDnf !== null
                ? prev.previsioni.numeroDnf === weekendResults?.events.total_dnf ? "border-green-500/35" : "border-red-500/25"
                : ""; })()
            }`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-[14px] tracking-[-0.2px]">Numero DNF esatto</h3>
                {(weekendResults?.race?.length ?? 0) > 0 && (
                  <span className="font-[family-name:var(--font-jetbrains)] text-[10px] font-bold tracking-[1.5px] px-2 py-1 rounded bg-[#0e0e14] border border-[#1c1c26] text-white/60">
                    DNF · <span className="tabular-nums">{weekendResults?.events.total_dnf}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/35 mb-3">Quanti piloti si ritireranno? (+{PREVISIONI_PUNTI.numeroDnf.esatto} pts se indovini)</p>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 8 }, (_, i) => i).map((n) => {
                  const isSelected = prev.previsioni.numeroDnf === n;
                  const garaCalcolata = (weekendResults?.race?.length ?? 0) > 0;
                  const isExact = garaCalcolata && isSelected && n === weekendResults?.events.total_dnf;
                  const isMissed = garaCalcolata && isSelected && n !== weekendResults?.events.total_dnf;
                  return (
                    <button key={n} onClick={() => !locked && prev.setNumeroDnf(prev.previsioni.numeroDnf === n ? null : n)} disabled={locked}
                      className={`w-10 h-10 rounded font-[family-name:var(--font-jetbrains)] font-extrabold text-[14px] tabular-nums transition-colors ${
                        isExact ? "bg-green-500/15 border border-green-500/45 text-green-400"
                        : isMissed ? "bg-red-500/12 border border-red-500/35 text-red-400"
                        : isSelected ? "bg-[#E8002D]/15 border border-[#E8002D]/45 text-[#E8002D] shadow-[inset_0_-2px_0_var(--accent)]"
                        : "bg-[#0e0e14] border border-[#1c1c26] text-white/30 hover:text-white/55"
                      } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                    >{n}</button>
                  );
                })}
              </div>
            </div>

            {/* Chip previsioni usato (read-only per round passati) */}
            {locked && (
              <div className="hud-card px-4 py-3">
                <div className="hud-label mb-1">Aggiornamento Previsioni</div>
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
              <div className="hud-card p-4">
                <div className="hud-label mb-2">Aggiornamento Previsioni</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHIP_PREVISIONI.map((chip) => {
                    const Icon = chip.icon;
                    const active = prev.chipAttivo === chip.id;
                    const usedRound = prev.chipPrevisioniUnavailable[chip.id];
                    const disabled = usedRound != null && !active;
                    return (
                      <button key={chip.id}
                        disabled={disabled}
                        onClick={() => { if (!disabled) prev.setChipAttivo(active ? null : chip.id); }}
                        className={`flex items-start gap-2 p-3 rounded text-left transition-colors ${
                          active
                            ? "bg-[#E8002D]/12 border border-[#E8002D]/45 shadow-[inset_0_-2px_0_var(--accent)]"
                            : disabled
                            ? "bg-[#0e0e14] border border-[#1c1c26] opacity-40 cursor-not-allowed"
                            : "bg-[#0e0e14] border border-[#1c1c26] hover:border-[#2a2a38]"
                        }`}
                      >
                        <Icon size={14} className={active ? "text-[#E8002D] mt-0.5" : "text-white/35 mt-0.5"} />
                        <div className="min-w-0">
                          <div className={`font-[family-name:var(--font-jetbrains)] text-[10px] font-bold tracking-[1.5px] uppercase ${active ? "text-[#E8002D]" : "text-white/55"}`}>{chip.label}</div>
                          <div className="text-[10px] text-white/30 mt-0.5 leading-tight">{disabled ? `Già usato (R${usedRound})` : chip.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {(prev.chipAttivo === "sicura" || prev.chipAttivo === "doppia") && (
                  <div className="mt-3 bg-black/40 border border-[#1c1c26] rounded p-3">
                    <div className="hud-label mb-2">
                      APPLICA A QUALE PREVISIONE?
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {[...PREVISIONI_CONFIG.map(p => ({ id: p.key, label: p.label })), { id: "numeroDnf", label: "Numero DNF" }].map((p) => {
                        const sel = prev.chipTarget === p.id;
                        return (
                          <button key={p.id}
                            onClick={() => prev.setChipTarget(sel ? null : p.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-all ${
                              sel ? "bg-[#E8002D]/15 border border-[#E8002D]/30 text-[#E8002D]" : "bg-[#0e0e14] border border-[#1c1c26] text-white/50 hover:bg-white/[0.04]"
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
              <div className="flex items-center gap-2 bg-green-500/8 border-l-[3px] border-l-green-500 border border-green-500/20 rounded-r px-4 py-3 text-[12px] text-green-400">
                <Check size={15} />
                <span className="font-bold tracking-[0.3px]">Previsioni confermate <span className="font-[family-name:var(--font-jetbrains)] tabular-nums">({prev.completate}/6)</span></span>
                {!locked && <span className="text-green-400/45 text-[10px] ml-auto font-[family-name:var(--font-jetbrains)] tracking-[1px] uppercase">PUOI MODIFICARE</span>}
              </div>
            )}

            {/* Avviso: previsioni OK ma formazione no */}
            {prev.confirmed && !sq.confirmed && !locked && (
              <button onClick={() => setTab("formazione")}
                className="flex items-center gap-2 bg-amber-500/8 border-l-[3px] border-l-amber-500 border border-amber-500/20 rounded-r px-4 py-3 text-[12px] text-amber-400 w-full text-left hover:bg-amber-500/12 transition-colors"
              >
                <AlertTriangle size={15} className="shrink-0" />
                <span>Manca la formazione — tocca per completarla</span>
                <ChevronRight size={14} className="ml-auto shrink-0 opacity-50" />
              </button>
            )}

            {isCurrentRound && !locked && (
              <button onClick={handleConfermaPrevisioni} disabled={prev.completate < 6 || confirmingPrev}
                className={`w-full py-4 rounded font-[family-name:var(--font-jetbrains)] text-[12px] font-extrabold tracking-[2.5px] uppercase transition-all ${
                  prev.completate === 6 ? "bg-[#E8002D] hover:bg-[#ff1a3d] text-white hover:shadow-[0_0_30px_rgba(232,0,45,0.35)]" : "bg-[#0e0e14] border border-[#1c1c26] text-white/20 cursor-not-allowed"
                }`}
              >
                {confirmingPrev ? "CONFERMA IN CORSO…" : prev.confirmed ? "▶ AGGIORNA PREVISIONI" : `▶ CONFERMA PREVISIONI (${prev.completate}/6)`}
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
                    <div className="hud-card hud-card-accent">
                      <div className="hud-card-head">
                        <div className="hud-label">IL TUO WEEKEND</div>
                        <div className="hud-meta">R{viewRace.round}</div>
                      </div>
                      <div className="p-4">
                        <div className="big-num text-center">{myWeekendScore.total}</div>

                        <div className={`grid ${myWeekendScore.penalitaCambi > 0 ? "grid-cols-3" : "grid-cols-2"} gap-1.5 mt-4 mb-4`}>
                          <div className="bg-black/40 border border-[#1c1c26] rounded p-3 text-center">
                            <div className="num font-extrabold text-[18px] leading-none">{myWeekendScore.pilotiPoints}</div>
                            <div className="hud-label mt-1.5">PILOTI</div>
                          </div>
                          <div className="bg-black/40 border border-[#1c1c26] rounded p-3 text-center">
                            <div className="num font-extrabold text-[18px] leading-none">{myWeekendScore.previsioniPoints}</div>
                            <div className="hud-label mt-1.5">PREVISIONI</div>
                          </div>
                          {myWeekendScore.penalitaCambi > 0 && (
                            <div className="bg-black/40 border border-amber-500/30 rounded p-3 text-center">
                              <div className="num font-extrabold text-[18px] leading-none text-amber-400">−{myWeekendScore.penalitaCambi}</div>
                              <div className="hud-label mt-1.5" style={{color: "rgba(255,176,0,0.6)"}}>PENALITÀ</div>
                            </div>
                          )}
                        </div>

                      {/* Dettaglio piloti */}
                      <div className="hud-label mb-2">Dettaglio Piloti</div>
                      <div className="space-y-1 mb-4">
                        {myWeekendScore.pilotiDettaglio.map((d) => {
                          const color = getDriverByNumber(d.driver_number)?.teamColour;
                          return (
                            <div key={d.driver_number} className="flex items-center justify-between text-[13px] bg-black/30 border border-[#1c1c26] rounded px-3 py-2">
                              <span className="flex items-center gap-2">
                                {color && <span className="w-[3px] h-5 rounded shrink-0" style={{ backgroundColor: `#${color}` }} />}
                                <span className={d.moltiplicatore === 2 ? "text-[#E8002D] font-bold" : d.moltiplicatore === 3 ? "text-amber-400 font-bold" : d.isSestoUomo ? "text-blue-400" : "text-white/75"}>
                                  {d.name}
                                </span>
                                {d.moltiplicatore === 2 && <span className="font-[family-name:var(--font-jetbrains)] text-[9px] text-[#E8002D]/70 tracking-[1px]">x2</span>}
                                {d.moltiplicatore === 3 && <Zap size={11} className="text-amber-400" />}
                                {d.isSestoUomo && <Users size={11} className="text-blue-400" />}
                                {d.haloApplicato && <Shield size={11} className="text-green-400" />}
                              </span>
                              <span className={`font-[family-name:var(--font-jetbrains)] font-bold tabular-nums ${d.puntiFinali > 0 ? "text-green-400" : d.puntiFinali < 0 ? "text-red-400" : "text-white/20"}`}>
                                {d.puntiFinali > 0 ? "+" : ""}{d.puntiFinali}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Dettaglio previsioni */}
                      <div className="hud-label mb-2">Dettaglio Previsioni</div>
                      <div className="space-y-1">
                        {Object.entries(myWeekendScore.previsioniDettaglio).map(([key, pts]) => (
                          <div key={key} className="flex items-center justify-between text-[13px] bg-black/30 border border-[#1c1c26] rounded px-3 py-2">
                            <span className="text-white/60">{PREVISIONE_LABELS[key] || key}</span>
                            <span className={`font-[family-name:var(--font-jetbrains)] font-bold tabular-nums ${pts > 0 ? "text-green-400" : "text-white/20"}`}>
                              {pts > 0 ? `+${pts}` : "0"}
                            </span>
                          </div>
                        ))}
                      </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <div className="text-white/20 text-sm">Non hai confermato la formazione per questa gara</div>
                  </div>
                )}

                {/* Eventi della gara — solo se la gara è stata calcolata */}
                {weekendResults.race.length > 0 && <div className="hud-card p-4">
                  <div className="hud-label mb-3">Eventi della gara</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "Safety Car", value: weekendResults.events.safety_car },
                      { label: "VSC", value: weekendResults.events.virtual_safety_car },
                      { label: "Red Flag", value: weekendResults.events.red_flag },
                      { label: "Gomme Wet", value: weekendResults.events.wet_tyres },
                      { label: "Pole ha vinto", value: weekendResults.events.pole_won },
                    ].map((e) => (
                      <div key={e.label} className="flex items-center justify-between text-[12px] px-3 py-2 bg-black/30 border border-[#1c1c26] rounded">
                        <span className="text-white/45">{e.label}</span>
                        <span className={`font-[family-name:var(--font-jetbrains)] tracking-[1px] ${e.value ? "text-green-400 font-bold" : "text-white/25"}`}>
                          {e.value ? "SI" : "NO"}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-[12px] px-3 py-2 bg-black/30 border border-[#1c1c26] rounded">
                      <span className="text-white/45">DNF totali</span>
                      <span className="font-[family-name:var(--font-jetbrains)] font-bold text-white/70 tabular-nums">
                        {weekendResults.events.total_dnf}
                      </span>
                    </div>
                  </div>
                </div>}

                <Link href="/classifica"
                  className="flex items-center justify-center gap-2 bg-[#E8002D]/10 text-[#E8002D] font-bold text-[11px] tracking-wider uppercase py-3 rounded-xl hover:bg-[#E8002D]/20 transition-all"
                >
                  Classifica completa <ChevronRight size={14} />
                </Link>
              </>
            ) : null}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

"use client";
import { useState, useEffect, useMemo, memo } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import { useSquadra, usePrevisioni } from "../lib/store";
import { createClient, isSupabaseConfigured } from "../lib/supabase";
import { getCurrentRound, getNextRace, getRaceByRound, isAfterDeadline } from "../lib/races";
import { DRIVERS_2026, getDriverByNumber } from "../lib/drivers-data";
import { PREVISIONI_PUNTI } from "../lib/types";
import { useCdaCompleted } from "../lib/use-cda";
import {
  calcolaPuntiWeekend,
  type RaceWeekendResults,
  type PilotaDettaglio,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "../lib/scoring";
import {
  Crown, Check, ChevronRight, AlertTriangle, Trophy,
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
  { id: "doppia", label: "Prev. Doppia", desc: "Punti x2 su 1 previsione", icon: CopyIcon },
];

type GestioneTab = "formazione" | "previsioni" | "dettaglio";

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
// MURETTO — gestione Formazione / Previsioni / Dettaglio (round corrente)
// ═══════════════════════════════════════════

export default function MurettoTabs() {
  const { user } = useAuth();
  const viewRound = getCurrentRound();
  const viewRace = getRaceByRound(viewRound) || getNextRace();

  const sq = useSquadra(viewRound);
  const prev = usePrevisioni(viewRound);
  const { canPlay: cdaCanPlay } = useCdaCompleted();

  const [tab, setTab] = useState<GestioneTab>("formazione");
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

        if (sq.loaded && sq.confirmed && sq.driverNumbers.length > 0) {
          const chipPiloti: ChipPilotiConfig = {
            chipPiloti: sq.chipPiloti,
            chipPilotiTarget: sq.chipPilotiTarget,
            sestoUomo: sq.sestoUomo,
          };
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

  const displayDrivers = useMemo(() => sq.driverNumbers
    .map((num) => {
      const d = getDriverByNumber(num);
      return d ? { driver_number: num, name: d.name, team: d.team, teamColour: d.teamColour, price: d.price } : null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null),
  [sq.driverNumbers]);

  const sestoUomoDriver = useMemo(() => sq.sestoUomo ? getDriverByNumber(sq.sestoUomo) : null, [sq.sestoUomo]);

  const pilotiPointsMap = useMemo(() => {
    const map = new Map<number, number>();
    if (myWeekendScore) {
      for (const d of myWeekendScore.pilotiDettaglio) {
        map.set(d.driver_number, d.puntiFinali);
      }
    }
    return map;
  }, [myWeekendScore]);

  if (!sq.loaded || !prev.loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-7 h-7 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] bg-[#E8002D] text-white text-[12px] font-bold tracking-[1.5px] uppercase px-5 py-3 rounded shadow-[0_0_30px_rgba(232,0,45,0.4)] font-[family-name:var(--font-jetbrains)]">
          {toast}
        </div>
      )}

      {/* ═══ TABS GESTIONE ═══ */}
      <div className="flex gap-1 mb-4">
        {(["formazione", "previsioni", ...(hasResults ? ["dettaglio" as GestioneTab] : [])] as GestioneTab[]).map((t) => {
          const labels: Record<GestioneTab, string> = { formazione: "FORMAZIONE", previsioni: "PREVISIONI", dettaglio: "DETTAGLIO" };
          const isActive = tab === t;
          let indicator: React.ReactNode = null;
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
      {cdaCanPlay === false && !locked && (
        <Link href="/cda"
          className="flex items-center gap-3 bg-[#E8002D]/8 border-l-[3px] border-l-[#E8002D] border border-[#E8002D]/20 rounded-r px-4 py-3 mb-4 hover:bg-[#E8002D]/12 transition-all"
        >
          <AlertTriangle size={16} className="text-[#E8002D] shrink-0" />
          <span className="text-[13px] text-[#E8002D] font-semibold">Completa il questionario CDA per poter confermare</span>
          <ChevronRight size={14} className="ml-auto text-[#E8002D]/50 shrink-0" />
        </Link>
      )}

      {/* Banner "Pronto per il GP" */}
      {!locked && sq.confirmed && prev.confirmed && (
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

      {/* ═══ FORMAZIONE ═══ */}
      {tab === "formazione" && (
        <div className="space-y-4">
          <div>
            <div className="hud-label mb-2">
              I tuoi piloti ({displayDrivers.length}/5{sestoUomoDriver ? " +1" : ""})
            </div>

            {displayDrivers.length === 0 ? (
              !locked ? (
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

            {displayDrivers.length < 5 && !locked && (
              <Link href="/mercato" className="flex items-center justify-center gap-2 mt-2 border border-dashed border-[#2a2a38] rounded p-3 text-white/20 hover:text-white/30 hover:border-white/15 transition-all text-[11px] tracking-wider uppercase">
                + Aggiungi dal Mercato ({displayDrivers.length}/5) <ChevronRight size={14} />
              </Link>
            )}
          </div>

          {/* Chip piloti usati (read-only round bloccato) */}
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

          {!locked && (
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

      {/* ═══ PREVISIONI ═══ */}
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

          {/* Chip previsioni usato (read-only round bloccato) */}
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

              {prev.chipAttivo === "doppia" && (
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

          {!locked && (
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

      {/* ═══ DETTAGLIO (punteggio post-gara) ═══ */}
      {tab === "dettaglio" && hasResults && weekendResults && (
        <div className="space-y-4">
          {myWeekendScore ? (
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
          ) : (
            <div className="text-center py-10">
              <div className="text-white/20 text-sm">Non hai confermato la formazione per questa gara</div>
            </div>
          )}

          {/* Eventi della gara */}
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
        </div>
      )}
    </div>
  );
}

"use client";
import Link from "next/link";
import { Check, Circle, AlertTriangle, ChevronRight, Lock } from "lucide-react";
import CountryFlag from "../CountryFlag";
import type { Race } from "../../lib/types";
import { formatDateTimeLocal, formatRelative, msToDeadline, type RoundPhase } from "../../lib/races";

export interface HeroStep {
  label: string;
  done: boolean;
  optional?: boolean;
}

export type HeroStatus =
  | { kind: "todo"; text: string }
  | { kind: "ok"; text: string }
  | { kind: "modified"; text: string }
  | { kind: "locked"; text: string };

/**
 * La card in cima al Muretto: dice una cosa sola, cosa devi fare adesso e
 * quanto manca. Deadline assoluta in ora locale (VEN 9 OTT · 14:30), relativa
 * accanto, rossa sotto le 24 ore. Quattro tappe con lo stato reale.
 */
export function MurettoHero({
  race, phase, now, steps, status, isLive, liveLabel, weekendScore,
}: {
  race: Race;
  phase: RoundPhase;
  now: Date;
  steps: HeroStep[];
  status: HeroStatus;
  isLive?: boolean;
  liveLabel?: string;
  /** Punteggio del weekend in corso (provvisorio o ufficiale) */
  weekendScore?: { total: number; official: boolean } | null;
}) {
  const ms = msToDeadline(race, now);
  const urgent = ms > 0 && ms < 24 * 3600 * 1000;
  const soon = ms > 0 && ms < 72 * 3600 * 1000;
  const rel = formatRelative(race.deadline, now);
  const raceTime = formatDateTimeLocal(race.date);

  return (
    <div className="hud-card hud-card-accent mb-4">
      <div className="hud-card-head">
        <div className="hud-label">ROUND {String(race.round).padStart(2, "0")} / 24</div>
        <div className="flex items-center gap-2">
          {race.sprint && <span className="pill pill-accent">SPRINT</span>}
          {isLive && <span className="live-pill"><span className="live-pill-dot" />LIVE</span>}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-4">
          <CountryFlag countryCode={race.countryCode} size={30} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-extrabold leading-[1.1] tracking-[-0.4px]">{race.name}</h2>
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 tracking-[0.5px] uppercase mt-1 truncate">
              {race.circuit} · GARA {raceTime}
            </div>
          </div>
        </div>

        {phase === "prepara" ? (
          <>
            <div className="hud-label mb-1">{race.sprint ? "CHIUSURA FORMAZIONE · PRIMA DELLA SPRINT SHOOTOUT" : "CHIUSURA FORMAZIONE · PRIMA DELLE QUALIFICHE"}</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className={`font-[family-name:var(--font-jetbrains)] text-[24px] font-extrabold tabular-nums tracking-[-0.5px] leading-none ${urgent ? "text-[#E8002D]" : soon ? "text-[#ffb000]" : "text-white"}`}>
                {formatDateTimeLocal(race.deadline)}
              </div>
              {rel && <div className={`font-[family-name:var(--font-jetbrains)] text-[12px] ${urgent ? "text-[#E8002D]" : "text-white/55"}`}>{rel}</div>}
            </div>
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/45 mt-1 tracking-[0.3px]">
              {race.sprint ? "Hai visto solo le FP1 · poi Shootout, Sprint, Qualifiche, Gara" : "Hai visto FP1, FP2 e FP3 · poi Qualifiche e Gara"}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-white/70">
            <Lock size={13} className="text-white/45" />
            <span>Formazione chiusa {formatDateTimeLocal(race.deadline)}</span>
          </div>
        )}

        {/* Tappe */}
        <div className="grid grid-cols-4 gap-1.5 mt-4">
          {steps.map((s) => (
            <div key={s.label} className={`rounded px-2 py-2 border text-center ${s.done ? "border-[#2ee59d]/35 bg-[#2ee59d]/[0.06]" : s.optional ? "border-[#1c1c26] bg-black/30" : "border-[#ffb000]/30 bg-[#ffb000]/[0.05]"}`}>
              <div className="flex justify-center mb-1">
                {s.done ? <Check size={13} className="text-[#2ee59d]" /> : <Circle size={13} className={s.optional ? "text-white/50" : "text-[#ffb000]"} />}
              </div>
              <div className={`font-[family-name:var(--font-jetbrains)] text-[10px] leading-tight tracking-[0.3px] ${s.done ? "text-[#2ee59d]" : s.optional ? "text-white/45" : "text-[#ffb000]"}`}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Stato */}
        <div className={`mt-3 flex items-center gap-2 rounded px-3 py-2.5 text-[13px] font-bold ${
          status.kind === "ok" ? "bg-[#2ee59d]/[0.08] text-[#2ee59d]"
          : status.kind === "modified" ? "bg-[#ffb000]/[0.08] text-[#ffb000]"
          : status.kind === "locked" ? "bg-white/[0.04] text-white/70"
          : "bg-[#ffb000]/[0.08] text-[#ffb000]"
        }`}>
          {status.kind === "ok" ? <Check size={15} /> : status.kind === "locked" ? <Lock size={14} /> : <AlertTriangle size={15} />}
          <span className="flex-1">{status.text}</span>
        </div>

        {phase === "weekend" && (
          <div className="mt-3 space-y-2">
            {weekendScore && (
              <div className="flex items-baseline justify-between">
                <span className="hud-label">IL TUO WEEKEND FINORA</span>
                <span className="font-[family-name:var(--font-jetbrains)] text-[20px] font-extrabold tabular-nums">
                  {weekendScore.total > 0 ? "+" : ""}{weekendScore.total}
                  <span className="text-[11px] text-white/45 font-normal ml-2">{weekendScore.official ? "UFFICIALE" : "PROVVISORIO"}</span>
                </span>
              </div>
            )}
            <Link href="/gara" className={isLive ? "btn-primary" : "btn-secondary w-full"}>
              {isLive ? `▶ SEGUI IL LIVE${liveLabel ? ` · ${liveLabel}` : ""}` : "PUNTEGGI DEL WEEKEND"} <ChevronRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

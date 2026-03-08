"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useSquadra, useAggiornamenti, useDashboardStats } from "../lib/store";
import { useAuth } from "../lib/auth";
import { getNextRace, getCurrentRound, getDeadline } from "../lib/races";
import { getDriverByNumber } from "../lib/drivers-data";
import {
  Crown, AlertTriangle, ChevronRight,
  Zap, Shield, UserPlus, Users, ShieldCheck, Copy, Clock, Shuffle,
} from "lucide-react";

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

const CHIP_ICONS: Record<string, typeof Zap> = {
  boost: Zap, halo: Shield, sesto: Users, wildcard: Shuffle,
  sicura: ShieldCheck, doppia: Copy,
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const nextRace = getNextRace();
  const round = getCurrentRound();
  const sq = useSquadra(round);
  const aggiornamenti = useAggiornamenti();
  const dashStats = useDashboardStats();
  const deadline = getDeadline(nextRace);
  const [countdown, setCountdown] = useState(getTimeUntil(deadline));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCountdown(getTimeUntil(deadline)), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (authLoading || !sq.loaded || !user) {
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

  const hasConfirmed = sq.confirmed;

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        {/* Riepilogo personale */}
        <div className="mb-6">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">Team Principal</div>
          <h1 className="text-2xl font-black font-[family-name:var(--font-oswald)] leading-tight">
            {profile?.scuderia_name?.toUpperCase() || "LA MIA SCUDERIA"}
          </h1>
          <div className="text-xs text-white/40 mt-0.5">{profile?.team_principal_name || "—"}</div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { value: dashStats.loaded ? String(dashStats.totalPoints) : "...", label: "PUNTI TOTALI", accent: true },
            { value: dashStats.loaded ? (dashStats.position ? `${dashStats.position}°/${dashStats.totalPlayers}` : "-") : "...", label: "POSIZIONE", accent: false },
            { value: dashStats.loaded ? `${dashStats.gareGiocate}/24` : "...", label: "GARE GIOCATE", accent: false },
            { value: dashStats.loaded ? (dashStats.mediaPunti !== null ? String(dashStats.mediaPunti) : "-") : "...", label: "MEDIA PUNTI", accent: false },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
              <div className={`font-[family-name:var(--font-jetbrains)] text-xl font-bold ${stat.accent ? "text-[#E8002D]" : "text-white/60"}`}>
                {stat.value}
              </div>
              <div className="text-[8px] tracking-[2px] text-white/30 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Prossima gara */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6">
          <div className="flex items-start justify-between mb-3">
            <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold">Prossima Gara</div>
            <div className="flex items-center gap-2 text-[10px] text-white/30">
              R{nextRace.round}/24
              {nextRace.sprint && (
                <span className="bg-[#E8002D]/20 text-[#E8002D] px-2 py-0.5 rounded text-[9px] font-bold tracking-wider">SPRINT</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl">{nextRace.flag}</div>
            <div>
              <h2 className="text-lg font-bold font-[family-name:var(--font-oswald)]">{nextRace.name}</h2>
              <p className="text-white/40 text-sm">{nextRace.circuit}</p>
            </div>
          </div>

          {mounted && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { value: countdown.days, label: "GG" },
                { value: countdown.hours, label: "ORE" },
                { value: countdown.minutes, label: "MIN" },
                { value: countdown.seconds, label: "SEC" },
              ].map((item) => (
                <div key={item.label} className="bg-black/40 rounded-lg p-2 text-center">
                  <div className="text-lg font-black font-[family-name:var(--font-jetbrains)] tabular-nums">
                    {String(item.value).padStart(2, "0")}
                  </div>
                  <div className="text-[8px] tracking-[1px] text-white/30">{item.label}</div>
                </div>
              ))}
            </div>
          )}

          {!hasConfirmed ? (
            <Link href="/gara"
              className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 transition-all hover:bg-amber-500/15"
            >
              <AlertTriangle size={18} className="text-amber-400 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-bold text-amber-400">Non hai ancora confermato!</div>
                <div className="text-[11px] text-amber-400/60">Formazione e previsioni da completare</div>
              </div>
              <ChevronRight size={16} className="text-amber-400/40" />
            </Link>
          ) : (
            <Link href="/gara"
              className="flex items-center justify-center gap-2 bg-[#E8002D]/10 text-[#E8002D] font-bold text-[11px] tracking-wider uppercase py-3 rounded-xl hover:bg-[#E8002D]/20 transition-all"
            >
              Vai alla gara <ChevronRight size={14} />
            </Link>
          )}
        </div>

        {/* La tua scuderia */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] tracking-[4px] text-white/30 uppercase font-bold">La tua scuderia</div>
            <div className="text-right">
              <span className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-[#E8002D]">{sq.budget}</span>
              <span className="text-[9px] text-white/30 ml-1">/ 100</span>
            </div>
          </div>

          {sq.drivers.length === 0 ? (
            <Link href="/mercato" className="block text-center border-2 border-dashed border-white/10 rounded-xl p-8 text-white/20 hover:text-white/40 transition-all text-sm tracking-wider uppercase">
              Vai al Mercato per scegliere i tuoi piloti
            </Link>
          ) : (
            <div className="space-y-2">
              {sq.drivers.map((driver) => {
                const d = getDriverByNumber(driver.driver_number);
                if (!d) return null;
                const color = `#${d.teamColour}`;
                const isCaptain = driver.driver_number === sq.primoPilota;
                return (
                  <div key={driver.driver_number}
                    className={`relative flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 ${
                      isCaptain ? "border border-[#E8002D]/40" : "border border-white/[0.06]"
                    }`}
                  >
                    {isCaptain && (
                      <div className="absolute -top-1.5 left-3 bg-[#E8002D] text-white text-[8px] font-bold tracking-wider px-2 py-0.5 rounded">PRIMO PILOTA x2</div>
                    )}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: `${color}25`, color }}
                    >
                      <span className="font-[family-name:var(--font-jetbrains)]">{d.number}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isCaptain && <Crown size={12} className="text-[#E8002D] shrink-0" />}
                        <span className={`font-bold text-sm truncate ${isCaptain ? "text-[#E8002D]" : ""}`}>{d.name}</span>
                      </div>
                      <div className="text-[11px] text-white/30 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        {d.team}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-[family-name:var(--font-jetbrains)] font-bold text-sm" style={{ color }}>{d.price}</div>
                      <div className="text-[8px] text-white/20 tracking-wider">SOLDINI</div>
                    </div>
                  </div>
                );
              })}
              {sq.drivers.length < 5 && (
                <Link href="/mercato" className="flex items-center justify-center gap-2 border border-dashed border-white/10 rounded-xl p-3 text-white/20 hover:text-white/30 transition-all text-[11px] tracking-wider uppercase">
                  + {5 - sq.drivers.length} slot da riempire
                </Link>
              )}
              {sq.penalitaTotale > 0 && (
                <div className="flex items-center gap-2 mt-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2.5">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <span className="text-[11px] text-amber-400">
                    Penalità cambi: <span className="font-bold font-[family-name:var(--font-jetbrains)]">-{sq.penalitaTotale} pts</span> sul weekend
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Aggiornamenti */}
        <div className="mb-6">
          <div className="text-[10px] tracking-[4px] text-white/30 uppercase font-bold mb-3">Aggiornamenti disponibili</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[...aggiornamenti.pilotiChips, ...aggiornamenti.previsioniChips].map((chip) => {
              const Icon = CHIP_ICONS[chip.id] || Zap;
              const used = (chip.usedPrePausa ? 1 : 0) + (chip.usedPostPausa ? 1 : 0);
              return (
                <div key={chip.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-3 text-center">
                  <Icon size={16} className="mx-auto mb-1.5 text-white/30" />
                  <div className="text-[10px] font-bold text-white/50 tracking-wider">{chip.label}</div>
                  <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/40 font-bold mt-1.5">
                    {2 - used}/2
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

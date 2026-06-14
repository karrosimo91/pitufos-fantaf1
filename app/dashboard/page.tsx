"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import CountryFlag from "../components/CountryFlag";
import { useSquadra, usePrevisioni, useDashboardStats, useLeghe, useLegaPreferita } from "../lib/store";
import MurettoTabs from "../components/MurettoTabs";
import { useAuth } from "../lib/auth";
import { getNextRace, getCurrentRound, getDeadline } from "../lib/races";
import { isAfterDeadline } from "../lib/races";
import { AlertTriangle, Check, Trophy } from "lucide-react";

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

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const nextRace = getNextRace();
  const round = getCurrentRound();
  const sq = useSquadra(round);
  const prev = usePrevisioni(round);
  const { leghe, loaded: legheLoaded } = useLeghe();
  const { legaId: legaPreferita, loaded: legaPrefLoaded } = useLegaPreferita();
  const dashStats = useDashboardStats(legaPrefLoaded ? legaPreferita : undefined);
  const currentLega = leghe.find((l) => l.id === legaPreferita);
  const locked = isAfterDeadline(nextRace);
  const deadline = getDeadline(nextRace);
  const [countdown, setCountdown] = useState(getTimeUntil(deadline));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCountdown(getTimeUntil(deadline)), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (authLoading || !sq.loaded || !user) {
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
      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        {/* Riepilogo personale */}
        <div className="mb-6">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">Team Principal</div>
          <h1 className="text-2xl font-black font-[family-name:var(--font-oswald)] leading-tight">
            {profile?.scuderia_name?.toUpperCase() || "LA MIA SCUDERIA"}
          </h1>
          <div className="text-xs text-white/40 mt-0.5">{profile?.team_principal_name || "—"}</div>
        </div>

        {/* Lega preferita badge */}
        {legheLoaded && currentLega && (
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={12} className="text-[#E8002D]" />
            <span className="text-[10px] tracking-[2px] text-white/40 uppercase font-bold">
              {currentLega.is_generale ? "Classifica Generale" : currentLega.name}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { value: dashStats.loaded ? String(dashStats.totalPoints) : "...", label: "PUNTI TOTALI", accent: true },
            { value: dashStats.loaded ? (dashStats.position ? `${dashStats.position}°/${dashStats.totalPlayers}` : "-") : "...", label: "POSIZIONE", accent: false },
            { value: dashStats.loaded ? `${dashStats.gareGiocate}/24` : "...", label: "GARE GIOCATE", accent: false },
            { value: dashStats.loaded ? (dashStats.mediaPunti !== null ? String(dashStats.mediaPunti) : "-") : "...", label: "MEDIA PUNTI", accent: false },
          ].map((stat) => (
            <div key={stat.label} className="hud-card p-4 text-center">
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
            <CountryFlag countryCode={nextRace.countryCode} size={40} />
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

          {locked ? (
            <div className="flex items-center justify-center gap-2 bg-white/[0.03] border border-white/[0.06] text-white/40 font-bold text-[11px] tracking-wider uppercase py-3 rounded-xl">
              Deadline passata
            </div>
          ) : sq.confirmed && prev.confirmed ? (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
              <Check size={18} className="text-green-400 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-bold text-green-400">Tutto confermato!</div>
                <div className="text-[11px] text-green-400/60">Formazione e previsioni pronte</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="text-amber-400 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-bold text-amber-400">Da completare</div>
                <div className="text-[11px] text-amber-400/60 flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1">
                    {sq.confirmed ? <Check size={11} className="text-green-400" /> : <AlertTriangle size={11} />}
                    Formazione
                  </span>
                  <span className="flex items-center gap-1">
                    {prev.confirmed ? <Check size={11} className="text-green-400" /> : <AlertTriangle size={11} />}
                    Previsioni
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MURETTO: gestione Formazione / Previsioni / Dettaglio ═══ */}
        <MurettoTabs />
      </main>
      <BottomNav />
    </div>
  );
}

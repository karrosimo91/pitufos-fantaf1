"use client";
import { useState, useEffect } from "react";
import { useAuth } from "./lib/auth";
import { RACES_2026, getNextRace, getUpcomingRaces } from "./lib/races";

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

export default function Home() {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const nextRace = getNextRace();
  const upcoming = getUpcomingRaces(5);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setCountdown(getTimeUntil(nextRace.date));
    }, 1000);
    setCountdown(getTimeUntil(nextRace.date));
    return () => clearInterval(timer);
  }, [nextRace.date]);

  const stats = [
    { value: "24", label: "GRAN PREMI" },
    { value: "6", label: "SPRINT" },
    { value: "22", label: "PILOTI" },
    { value: "11", label: "SCUDERIE" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#E8002D] opacity-[0.03] blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#E8002D] opacity-[0.02] blur-[100px] rounded-full" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#E8002D] to-[#ff4466] flex items-center justify-center font-black text-xs tracking-wider">
            LP
          </div>
          <span className="font-bold text-sm tracking-[3px] uppercase">Los Pitufos</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] tracking-[2px] text-white/30 uppercase">Stagione 2026</div>
          {user ? (
            <a href="/dashboard" className="text-[10px] tracking-[2px] uppercase px-3 py-2 rounded-lg bg-[#E8002D]/10 text-[#E8002D] font-bold hover:bg-[#E8002D]/20 transition-all">
              Dashboard
            </a>
          ) : (
            <a href="/login" className="text-[10px] tracking-[2px] uppercase px-3 py-2 rounded-lg bg-[#E8002D]/10 text-[#E8002D] font-bold hover:bg-[#E8002D]/20 transition-all">
              Accedi
            </a>
          )}
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="text-center mb-12">
          <div className="text-[10px] tracking-[6px] text-[#E8002D] uppercase mb-4 font-bold">
            Fantasy Racing League
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none mb-2 font-[family-name:var(--font-oswald)]">
            LOS
            <span className="text-[#E8002D]"> PITUFOS</span>
          </h1>
          <div className="text-lg md:text-xl font-light tracking-[8px] text-white/40 uppercase mt-2 font-[family-name:var(--font-oswald)]">
            FantaF1
          </div>
        </div>

        <div className="w-full max-w-lg mb-10">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase mb-3 font-bold text-center">
            Prossima Gara
          </div>
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">{nextRace.flag}</div>
            <h2 className="text-xl font-bold mb-1">{nextRace.name}</h2>
            <p className="text-white/40 text-sm mb-1">{nextRace.circuit}</p>
            <div className="flex items-center justify-center gap-2 text-xs text-white/30">
              <span>Round {nextRace.round}/24</span>
              {nextRace.sprint && (
                <span className="bg-[#E8002D]/20 text-[#E8002D] px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                  SPRINT
                </span>
              )}
            </div>

            {mounted && (
              <div className="grid grid-cols-4 gap-3 mt-6">
                {[
                  { value: countdown.days, label: "GIORNI" },
                  { value: countdown.hours, label: "ORE" },
                  { value: countdown.minutes, label: "MIN" },
                  { value: countdown.seconds, label: "SEC" },
                ].map((item) => (
                  <div key={item.label} className="bg-black/40 rounded-xl p-3">
                    <div className="text-2xl md:text-3xl font-black font-[family-name:var(--font-jetbrains)] tabular-nums text-white">
                      {String(item.value).padStart(2, "0")}
                    </div>
                    <div className="text-[9px] tracking-[2px] text-white/30 mt-1">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 w-full max-w-lg mb-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-black text-[#E8002D] font-[family-name:var(--font-jetbrains)]">{stat.value}</div>
              <div className="text-[8px] tracking-[2px] text-white/30 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4 mb-16">
          <a
            href={user ? "/dashboard" : "/registrati"}
            className="bg-[#E8002D] hover:bg-[#ff1a3d] text-white font-bold text-sm tracking-[2px] uppercase px-8 py-4 rounded-xl transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(232,0,45,0.3)] inline-block"
          >
            {user ? "Vai alla Dashboard" : "Crea la tua Scuderia"}
          </a>
          <p className="text-white/20 text-xs">Gratuito — Aperto a tutti</p>
        </div>

        <div className="w-full max-w-lg">
          <a href="/calendario" className="text-[10px] tracking-[4px] text-white/30 uppercase mb-4 font-bold text-center block hover:text-white/50 transition-all">
            Prossime Gare
          </a>
          <div className="space-y-2">
            {upcoming.map((race) => (
              <div
                key={race.round}
                className="flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] rounded-lg px-4 py-3 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{race.flag}</span>
                  <div>
                    <div className="text-sm font-semibold">{race.name}</div>
                    <div className="text-[11px] text-white/30">{race.circuit}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-[family-name:var(--font-jetbrains)] text-white/60">
                    {new Date(race.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                  </div>
                  {race.sprint && (
                    <span className="text-[9px] text-[#E8002D] font-bold tracking-wider">SPRINT</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <a href="/calendario" className="block text-center text-[11px] text-white/20 hover:text-white/40 mt-3 transition-all">
            Vedi tutto il calendario →
          </a>
        </div>
      </main>

      <footer className="relative z-10 text-center py-8 text-white/10 text-[10px] tracking-[3px] uppercase">
        Los Pitufos FantaF1 — Stagione 2026 — v0.8
      </footer>
    </div>
  );
}

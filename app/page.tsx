"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "./lib/auth";
import { RACES_2026, getNextRace, getUpcomingRaces, getDeadline } from "./lib/races";
import { APP_VERSION } from "./lib/types";
import CountryFlag from "./components/CountryFlag";
import { Brand } from "./components/ui/Brand";
import { HudCard } from "./components/ui/HudCard";
import { SectionHead } from "./components/ui/SectionHead";

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
  const deadline = getDeadline(nextRace);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCountdown(getTimeUntil(deadline)), 1000);
    setCountdown(getTimeUntil(deadline));
    return () => clearInterval(timer);
  }, [deadline]);

  const stats = [
    { value: "24", label: "GP" },
    { value: "6", label: "SPRINT" },
    { value: "22", label: "PILOTI" },
    { value: "11", label: "SCUDERIE" },
  ];

  return (
    <div className="min-h-screen bg-grid text-white">
      {/* TopBar */}
      <header className="sticky top-0 z-40 bg-[#050507]/92 backdrop-blur-xl border-b border-[#1c1c26] px-4 py-2.5 flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/30 tracking-[2px]">STAGIONE 2026</span>
          {user ? (
            <Link href="/dashboard" className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1.5px] uppercase px-2.5 py-1.5 rounded bg-[#E8002D]/10 border border-[#E8002D]/30 text-[#E8002D] font-bold hover:bg-[#E8002D]/20 transition-all">
              DASHBOARD
            </Link>
          ) : (
            <Link href="/login" className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1.5px] uppercase px-2.5 py-1.5 rounded bg-[#E8002D]/10 border border-[#E8002D]/30 text-[#E8002D] font-bold hover:bg-[#E8002D]/20 transition-all">
              ACCEDI
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-16">
        {/* Page head */}
        <div className="pt-7 pb-4">
          <div className="font-[family-name:var(--font-jetbrains)] text-[9px] text-[#E8002D] tracking-[2.5px] mb-2 uppercase font-bold">
            FANTASY RACING LEAGUE
          </div>
          <h1 className="text-[44px] font-extrabold tracking-[-1.5px] leading-[0.95]">
            LOS<br /><span className="text-[#E8002D]">PITUFOS</span>
            <span className="text-white/30 text-2xl font-mono"> .FantaF1</span>
          </h1>
        </div>

        {/* Next race HUD */}
        <HudCard
          label={`ROUND ${nextRace.round} / 24 · PROSSIMA`}
          meta={nextRace.sprint ? <span className="text-[#E8002D] font-bold">SPRINT</span> : null}
          className="mb-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[22px] font-extrabold leading-[1.1] tracking-[-0.4px]">
                {nextRace.name}
              </div>
              <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/40 mt-1 tracking-[0.5px] uppercase">
                {nextRace.circuit}
              </div>
            </div>
            <CountryFlag countryCode={nextRace.countryCode} size={32} />
          </div>

          {mounted && (
            <div className="grid grid-cols-4 gap-1.5 mt-4">
              {[
                { value: countdown.days, label: "G" },
                { value: countdown.hours, label: "H" },
                { value: countdown.minutes, label: "M" },
                { value: countdown.seconds, label: "S" },
              ].map((item) => (
                <div key={item.label} className="bg-black/40 border border-[#1c1c26] rounded p-2.5 text-center">
                  <div className="num font-extrabold text-[22px] leading-none">
                    {String(item.value).padStart(2, "0")}
                  </div>
                  <div className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/30 mt-1.5 tracking-[1.5px]">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </HudCard>

        {/* Stat strip */}
        <div className="hud-card mb-6">
          <div className="grid grid-cols-4 divide-x divide-[#1c1c26]">
            {stats.map((s) => (
              <div key={s.label} className="px-2 py-3 text-center">
                <div className="num font-extrabold text-[20px] leading-none text-[#E8002D]">{s.value}</div>
                <div className="font-[family-name:var(--font-jetbrains)] text-[8px] text-white/30 mt-1.5 tracking-[1.5px]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Link
          href={user ? "/dashboard" : "/registrati"}
          className="block bg-[#E8002D] hover:bg-[#ff1a3d] text-white font-extrabold text-sm tracking-[2px] uppercase text-center py-4 rounded transition-all hover:shadow-[0_0_30px_rgba(232,0,45,0.35)]"
        >
          {user ? "▶ Vai alla Dashboard" : "▶ Crea la tua Scuderia"}
        </Link>
        <p className="font-[family-name:var(--font-jetbrains)] text-white/25 text-[10px] mt-2 text-center tracking-[1.5px]">
          GRATUITO · APERTO A TUTTI
        </p>

        {/* Calendario */}
        <SectionHead
          title="Prossime gare"
          right={
            <Link href="/calendario" className="hover:text-white/60 transition-colors">VEDI TUTTE →</Link>
          }
        />
        <div className="hud-card overflow-hidden">
          {upcoming.map((race, i) => (
            <Link
              key={race.round}
              href="/calendario"
              className={`flex items-center justify-between px-3.5 py-3 hover:bg-white/[0.02] transition-colors ${
                i < upcoming.length - 1 ? "border-b border-[#1c1c26]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="num text-[13px] font-extrabold text-white/30 w-7 tabular-nums">
                  {String(race.round).padStart(2, "0")}
                </div>
                <CountryFlag countryCode={race.countryCode} size={20} />
                <div>
                  <div className="text-[13px] font-bold leading-tight">{race.name}</div>
                  <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/30 tracking-[0.5px] uppercase mt-0.5">
                    {race.circuit}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="num font-bold text-[11px] text-white/60">
                  {new Date(race.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" }).toUpperCase()}
                </div>
                {race.sprint && (
                  <span className="font-[family-name:var(--font-jetbrains)] text-[9px] text-[#E8002D] font-bold tracking-[1.5px]">SPRINT</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="text-center pb-8 pt-4 font-[family-name:var(--font-jetbrains)] text-white/15 text-[9px] tracking-[2.5px] uppercase">
        Los Pitufos FantaF1 · {APP_VERSION}
      </footer>
    </div>
  );
}

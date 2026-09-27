"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "./lib/auth";
import { getNextRace, getUpcomingRaces, formatDateTimeLocal, formatRelative, TOTAL_ROUNDS } from "./lib/races";
import { APP_VERSION } from "./lib/types";
import CountryFlag from "./components/CountryFlag";
import { Brand } from "./components/ui/Brand";
import { HudCard } from "./components/ui/HudCard";
import { SectionHead } from "./components/ui/SectionHead";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const { user } = useAuth();
  const nextRace = getNextRace();
  const upcoming = getUpcomingRaces(5);

  // Orari in ora locale solo dopo il mount: il server non conosce il fuso.
  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const rel = now ? formatRelative(nextRace.deadline, now) : null;

  const steps = [
    { n: "5", title: "piloti con 100 Soldini", text: "Compra e vendi al Mercato, 2 cambi gratis a round." },
    { n: "×2", title: "il Primo Pilota", text: "Uno dei cinque raddoppia: bonus e malus." },
    { n: "6", title: "previsioni SÌ/NO", text: "Safety Car, bandiera rossa, pioggia, pole, ritiri. L'evento raro paga di più." },
  ];

  return (
    <div className="min-h-screen bg-grid text-white">
      <header className="sticky top-0 z-40 bg-[#050507]/92 backdrop-blur-xl border-b border-[#1c1c26] px-4 py-2.5 flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/50 tracking-[2px]">STAGIONE 2026</span>
          {user ? (
            <Link href="/dashboard" className="pill pill-accent">MURETTO</Link>
          ) : (
            <Link href="/login" className="pill pill-accent">ACCEDI</Link>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-16">
        <div className="pt-7 pb-4">
          <div className="hud-label text-[#E8002D] mb-2">FANTASY RACING LEAGUE</div>
          <h1 className="text-[44px] font-extrabold tracking-[-1.5px] leading-[0.95]">
            LOS<br /><span className="text-[#E8002D]">PITUFOS</span>
            <span className="text-white/50 text-2xl font-mono"> .FantaF1</span>
          </h1>
        </div>

        <HudCard
          label={`ROUND ${nextRace.round} / ${TOTAL_ROUNDS} · PROSSIMA`}
          meta={nextRace.sprint ? <span className="pill pill-accent">SPRINT</span> : null}
          className="mb-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[22px] font-extrabold leading-[1.1] tracking-[-0.4px]">{nextRace.name}</div>
              <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 mt-1 tracking-[0.5px] uppercase">{nextRace.circuit}</div>
            </div>
            <CountryFlag countryCode={nextRace.countryCode} size={32} />
          </div>
          {mounted && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="bg-black/40 border border-[#1c1c26] rounded p-3">
                <div className="hud-label mb-1">CHIUSURA FORMAZIONE</div>
                <div className="font-[family-name:var(--font-jetbrains)] text-[15px] font-extrabold tabular-nums">{formatDateTimeLocal(nextRace.deadline)}</div>
                <div className="text-[11px] text-white/55 mt-0.5">{rel ?? "chiusa"}</div>
              </div>
              <div className="bg-black/40 border border-[#1c1c26] rounded p-3">
                <div className="hud-label mb-1">GARA</div>
                <div className="font-[family-name:var(--font-jetbrains)] text-[15px] font-extrabold tabular-nums">{formatDateTimeLocal(nextRace.date)}</div>
                <div className="text-[11px] text-white/55 mt-0.5">ora locale</div>
              </div>
            </div>
          )}
        </HudCard>

        <SectionHead title="Come si gioca" className="mt-0" />
        <div className="space-y-2 mb-6">
          {steps.map((s) => (
            <div key={s.n} className="hud-card p-3.5 flex items-start gap-3">
              <div className="font-[family-name:var(--font-jetbrains)] text-[22px] font-extrabold text-[#E8002D] w-10 shrink-0 leading-none">{s.n}</div>
              <div>
                <div className="text-[14px] font-bold">{s.title}</div>
                <div className="text-[12px] text-white/60 mt-0.5">{s.text}</div>
              </div>
            </div>
          ))}
        </div>

        <Link href={user ? "/dashboard" : "/registrati"} className="btn-primary">
          {user ? "▶ VAI AL MURETTO" : "▶ CREA LA TUA SCUDERIA"}
        </Link>
        <p className="font-[family-name:var(--font-jetbrains)] text-white/50 text-[11px] mt-2 text-center tracking-[1.5px]">
          GRATUITO · APERTO A TUTTI · 23 GP · 22 PILOTI
        </p>

        <SectionHead
          title="Prossime gare"
          right={<Link href="/calendario" className="hover:text-white/80 transition-colors">VEDI TUTTE →</Link>}
        />
        <div className="hud-card overflow-hidden">
          {upcoming.map((race, i) => (
            <Link
              key={race.round}
              href="/calendario"
              className={`flex items-center justify-between px-3.5 py-3 hover:bg-white/[0.02] transition-colors ${i < upcoming.length - 1 ? "border-b border-[#1c1c26]" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="num text-[13px] font-extrabold text-white/50 w-7 tabular-nums">{String(race.round).padStart(2, "0")}</div>
                <CountryFlag countryCode={race.countryCode} size={20} />
                <div>
                  <div className="text-[13px] font-bold leading-tight">{race.name}</div>
                  <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/50 tracking-[0.5px] uppercase mt-0.5">{race.circuit}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="num font-bold text-[11px] text-white/70">
                  {new Date(race.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }).toUpperCase()}
                </div>
                {race.sprint && <span className="pill pill-accent text-[10px] px-1.5 py-0">SPRINT</span>}
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="text-center pb-8 pt-4 font-[family-name:var(--font-jetbrains)] text-white/40 text-[11px] tracking-[2px] uppercase">
        Los Pitufos FantaF1 · {APP_VERSION}
      </footer>
    </div>
  );
}

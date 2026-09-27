"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import CountryFlag from "../components/CountryFlag";
import { RACES_2026, getNextRace, raceEndDate, formatDateTimeLocal } from "../lib/races";
import { useAllWeekendResults } from "../lib/use-weekend-results";
import { ChevronRight } from "lucide-react";

export default function CalendarioPage() {
  const nextRace = getNextRace();
  const [mounted, setMounted] = useState(false);
  const { rows } = useAllWeekendResults();
  const archived = new Set(rows.filter((r) => (r.data.race?.length ?? 0) > 0 || (r.data.qualifying?.length ?? 0) > 0).map((r) => r.round));
  useEffect(() => { setMounted(true); }, []);
  const now = new Date();

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-5 pb-bottomnav">
        <div className="mb-5">
          <div className="hud-label text-[#E8002D] mb-1">STAGIONE 2026 · 23 GRAN PREMI · 6 SPRINT · BAHRAIN A SEPANG IL 4 OTTOBRE</div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.6px] leading-none">Calendario</h1>
          <div className="text-[12px] text-white/55 mt-2">Orari nella tua ora locale. La formazione chiude prima delle qualifiche, nei weekend sprint prima della Sprint Shootout (venerdì).</div>
        </div>

        <div className="space-y-2">
          {RACES_2026.map((race) => {
            const isPast = raceEndDate(race) <= now;
            const isNext = race.round === nextRace.round;
            const hasRecap = archived.has(race.round);
            const inner = (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`font-[family-name:var(--font-jetbrains)] font-bold text-[13px] w-7 ${isNext ? "text-[#E8002D]" : "text-white/50"}`}>{String(race.round).padStart(2, "0")}</div>
                  <CountryFlag countryCode={race.countryCode} size={22} />
                  <div className="min-w-0">
                    <div className={`text-[14px] font-bold truncate ${isNext ? "text-white" : ""}`}>{race.name}</div>
                    <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 mt-0.5">
                      {mounted ? `Gara ${formatDateTimeLocal(race.date)}` : race.date.slice(0, 10)}
                      {mounted && !isPast && <span className="text-white/40"> · chiude {formatDateTimeLocal(race.deadline)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {race.sprint && <span className="pill pill-accent text-[10px] px-1.5 py-0">SPRINT</span>}
                  {isNext && <span className="pill pill-green text-[10px] px-1.5 py-0">PROSSIMA</span>}
                  {hasRecap && <ChevronRight size={14} className="text-white/45" />}
                </div>
              </>
            );
            const cls = `flex items-center justify-between rounded-lg px-3.5 py-3 border ${isNext ? "bg-[#E8002D]/[0.06] border-[#E8002D]/35" : isPast ? "bg-[#0e0e14] border-[#1c1c26] opacity-70" : "bg-[#0e0e14] border-[#1c1c26]"}`;
            return hasRecap ? (
              <Link key={race.round} href={`/risultati?round=${race.round}`} className={`${cls} tap`}>{inner}</Link>
            ) : (
              <div key={race.round} className={cls}>{inner}</div>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

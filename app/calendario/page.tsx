"use client";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import CountryFlag from "../components/CountryFlag";
import { RACES_2026, getNextRace } from "../lib/races";
import { APP_VERSION } from "../lib/types";

export default function CalendarioPage() {
  const nextRace = getNextRace();
  const now = new Date();

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-bottomnav">
        <div className="mb-8">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
            Stagione 2026 — 24 Gran Premi
          </div>
          <h1 className="text-3xl font-black font-[family-name:var(--font-oswald)]">
            CALENDARIO
          </h1>
        </div>

        <div className="space-y-2">
          {RACES_2026.map((race) => {
            const raceDate = new Date(race.date);
            const isPast = raceDate <= now;
            const isNext = race.round === nextRace.round;

            return (
              <div
                key={race.round}
                className={`flex items-center justify-between rounded-xl px-4 py-4 transition-all ${
                  isNext
                    ? "bg-[#E8002D]/10 border border-[#E8002D]/30"
                    : isPast
                    ? "bg-white/[0.01] border border-white/[0.03] opacity-50"
                    : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`font-[family-name:var(--font-jetbrains)] font-bold text-sm w-8 ${isNext ? "text-[#E8002D]" : "text-white/30"}`}>
                    {String(race.round).padStart(2, "0")}
                  </div>
                  <CountryFlag countryCode={race.countryCode} size={24} />
                  <div>
                    <div className={`text-sm font-semibold ${isNext ? "text-white" : ""}`}>{race.name}</div>
                    <div className="text-[11px] text-white/30">{race.circuit}</div>
                  </div>
                </div>

                <div className="text-right flex items-center gap-3">
                  {race.sprint && (
                    <span className="bg-[#E8002D]/20 text-[#E8002D] px-2 py-0.5 rounded text-[9px] font-bold tracking-wider">
                      SPRINT
                    </span>
                  )}
                  <div>
                    <div className="text-xs font-[family-name:var(--font-jetbrains)] text-white/60">
                      {raceDate.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                    </div>
                    {isNext && (
                      <div className="text-[9px] text-[#E8002D] font-bold tracking-wider">PROSSIMA</div>
                    )}
                    {isPast && (
                      <div className="text-[9px] text-white/20 tracking-wider">COMPLETATO</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="text-center py-8 pb-bottomnav text-white/10 text-[10px] tracking-[3px] uppercase">
        Los Pitufos FantaF1 — Stagione 2026 — {APP_VERSION}
      </footer>
      <BottomNav />
    </div>
  );
}

"use client";
import { useState } from "react";
import Navbar from "../components/Navbar";

// Mock classifica data
const MOCK_CLASSIFICA = [
  { position: 1, teamPrincipal: "Simone", scuderiaName: "Pitufos Racing", totalPoints: 142, weekendPoints: 38, realPoints: 75 },
  { position: 2, teamPrincipal: "Marco", scuderiaName: "Scuderia Inferno", totalPoints: 128, weekendPoints: 25, realPoints: 54 },
  { position: 3, teamPrincipal: "Luca", scuderiaName: "Team Azzurro", totalPoints: 115, weekendPoints: 31, realPoints: 47 },
  { position: 4, teamPrincipal: "Andrea", scuderiaName: "Racing Bulls FC", totalPoints: 102, weekendPoints: 22, realPoints: 36 },
  { position: 5, teamPrincipal: "Giovanni", scuderiaName: "Veloce GP", totalPoints: 98, weekendPoints: 28, realPoints: 33 },
  { position: 6, teamPrincipal: "Paolo", scuderiaName: "Turbo Team", totalPoints: 87, weekendPoints: 19, realPoints: 25 },
  { position: 7, teamPrincipal: "Davide", scuderiaName: "Red Arrows", totalPoints: 76, weekendPoints: 15, realPoints: 18 },
  { position: 8, teamPrincipal: "Federico", scuderiaName: "Night Racing", totalPoints: 65, weekendPoints: 12, realPoints: 12 },
  { position: 9, teamPrincipal: "Lorenzo", scuderiaName: "Storm GP", totalPoints: 54, weekendPoints: 8, realPoints: 8 },
  { position: 10, teamPrincipal: "Alberto", scuderiaName: "Apex Legends", totalPoints: 43, weekendPoints: 5, realPoints: 4 },
];

const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

type Tab = "somma" | "reale";

export default function ClassificaPage() {
  const [tab, setTab] = useState<Tab>("somma");

  const classifica = [...MOCK_CLASSIFICA].sort((a, b) =>
    tab === "somma" ? b.totalPoints - a.totalPoints : b.realPoints - a.realPoints
  );

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
            Stagione 2026
          </div>
          <h1 className="text-3xl font-black font-[family-name:var(--font-oswald)]">
            CLASSIFICA
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("somma")}
            className={`flex-1 py-3 rounded-xl text-[11px] tracking-[2px] uppercase font-bold transition-all ${
              tab === "somma"
                ? "bg-[#E8002D]/10 border border-[#E8002D]/30 text-[#E8002D]"
                : "bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/60"
            }`}
          >
            Somma Punti
          </button>
          <button
            onClick={() => setTab("reale")}
            className={`flex-1 py-3 rounded-xl text-[11px] tracking-[2px] uppercase font-bold transition-all ${
              tab === "reale"
                ? "bg-[#E8002D]/10 border border-[#E8002D]/30 text-[#E8002D]"
                : "bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/60"
            }`}
          >
            Classifica Reale
          </button>
        </div>

        {/* Podio */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[classifica[1], classifica[0], classifica[2]].map((entry, i) => {
            const podiumPos = [2, 1, 3][i];
            const heights = ["h-24", "h-32", "h-20"];
            const colors = ["text-gray-300", "text-[#E8002D]", "text-amber-600"];
            return (
              <div key={entry.teamPrincipal} className="flex flex-col items-center">
                <div className="text-xs font-bold text-white/60 mb-1">{entry.teamPrincipal}</div>
                <div className="text-[10px] text-white/30 mb-2 truncate max-w-full">{entry.scuderiaName}</div>
                <div
                  className={`w-full ${heights[i]} bg-white/[0.03] border border-white/[0.06] rounded-t-xl flex flex-col items-center justify-center`}
                >
                  <div className={`text-2xl font-black font-[family-name:var(--font-oswald)] ${colors[i]}`}>
                    {podiumPos}
                  </div>
                  <div className="font-[family-name:var(--font-jetbrains)] text-sm font-bold mt-1">
                    {tab === "somma" ? entry.totalPoints : entry.realPoints}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabella completa */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 text-[9px] tracking-[2px] text-white/30 uppercase border-b border-white/[0.06]">
            <span>Pos</span>
            <span>Team Principal</span>
            <span className="text-right">Weekend</span>
            <span className="text-right">Totale</span>
          </div>

          {classifica.map((entry, i) => (
            <div
              key={entry.teamPrincipal}
              className={`grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 items-center transition-all hover:bg-white/[0.02] ${
                i < classifica.length - 1 ? "border-b border-white/[0.03]" : ""
              }`}
            >
              <span
                className={`font-[family-name:var(--font-jetbrains)] font-bold text-sm w-8 ${
                  i === 0 ? "text-[#E8002D]" : i < 3 ? "text-white/80" : "text-white/30"
                }`}
              >
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-semibold">{entry.teamPrincipal}</div>
                <div className="text-[11px] text-white/30">{entry.scuderiaName}</div>
              </div>
              <div className="text-right">
                <span className="font-[family-name:var(--font-jetbrains)] text-xs text-white/40">
                  {tab === "somma" ? `+${entry.weekendPoints}` : PUNTI_REALE[i] !== undefined ? `+${PUNTI_REALE[i]}` : "+0"}
                </span>
              </div>
              <div className="text-right">
                <span className="font-[family-name:var(--font-jetbrains)] font-bold text-sm">
                  {tab === "somma" ? entry.totalPoints : entry.realPoints}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Legenda classifica reale */}
        {tab === "reale" && (
          <div className="mt-4 bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
            <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-2">
              Come funziona
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Ogni weekend i giocatori vengono classificati per punteggio. I top 10 ricevono punti F1:
              25-18-15-12-10-8-6-4-2-1. Gli altri ricevono 0 punti.
            </p>
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-white/10 text-[10px] tracking-[3px] uppercase">
        Los Pitufos FantaF1 — Stagione 2026 — v0.2
      </footer>
    </div>
  );
}

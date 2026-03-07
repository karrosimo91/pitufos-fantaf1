"use client";
import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { createClient, isSupabaseConfigured } from "../lib/supabase";

interface ClassificaEntry {
  user_id: string;
  team_principal_name: string;
  scuderia_name: string;
  total_points: number;
  last_weekend_points: number;
  real_points: number;
}

const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

type Tab = "somma" | "reale";

export default function ClassificaPage() {
  const [tab, setTab] = useState<Tab>("somma");
  const [classifica, setClassifica] = useState<ClassificaEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const supabase = createClient()!;
    supabase
      .from("classifica_totale")
      .select("*")
      .then(({ data }) => {
        if (data) setClassifica(data);
        setLoading(false);
      });
  }, []);

  const sorted = [...classifica].sort((a, b) =>
    tab === "somma" ? b.total_points - a.total_points : b.real_points - a.real_points
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

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-white/20 text-sm">Nessun giocatore registrato ancora</div>
            <p className="text-white/10 text-xs mt-2">La classifica si popolera con i primi risultati</p>
          </div>
        ) : (
          <>
            {/* Podio (solo se almeno 3 giocatori) */}
            {sorted.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[sorted[1], sorted[0], sorted[2]].map((entry, i) => {
                  const podiumPos = [2, 1, 3][i];
                  const heights = ["h-24", "h-32", "h-20"];
                  const colors = ["text-gray-300", "text-[#E8002D]", "text-amber-600"];
                  return (
                    <div key={entry.user_id} className="flex flex-col items-center">
                      <div className="text-xs font-bold text-white/60 mb-1">{entry.team_principal_name}</div>
                      <div className="text-[10px] text-white/30 mb-2 truncate max-w-full">{entry.scuderia_name}</div>
                      <div
                        className={`w-full ${heights[i]} bg-white/[0.03] border border-white/[0.06] rounded-t-xl flex flex-col items-center justify-center`}
                      >
                        <div className={`text-2xl font-black font-[family-name:var(--font-oswald)] ${colors[i]}`}>
                          {podiumPos}
                        </div>
                        <div className="font-[family-name:var(--font-jetbrains)] text-sm font-bold mt-1">
                          {tab === "somma" ? entry.total_points : entry.real_points}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tabella completa */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 text-[9px] tracking-[2px] text-white/30 uppercase border-b border-white/[0.06]">
                <span>Pos</span>
                <span>Team Principal</span>
                <span className="text-right">Weekend</span>
                <span className="text-right">Totale</span>
              </div>

              {sorted.map((entry, i) => (
                <div
                  key={entry.user_id}
                  className={`grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 items-center transition-all hover:bg-white/[0.02] ${
                    i < sorted.length - 1 ? "border-b border-white/[0.03]" : ""
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
                    <div className="text-sm font-semibold">{entry.team_principal_name}</div>
                    <div className="text-[11px] text-white/30">{entry.scuderia_name}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-[family-name:var(--font-jetbrains)] text-xs text-white/40">
                      {tab === "somma"
                        ? `+${entry.last_weekend_points}`
                        : PUNTI_REALE[i] !== undefined
                        ? `+${PUNTI_REALE[i]}`
                        : "+0"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-[family-name:var(--font-jetbrains)] font-bold text-sm">
                      {tab === "somma" ? entry.total_points : entry.real_points}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

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
        Los Pitufos FantaF1 — Stagione 2026 — v0.81
      </footer>
    </div>
  );
}

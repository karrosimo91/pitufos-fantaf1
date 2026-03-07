"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { useAuth } from "../lib/auth";
import { createClient, isSupabaseConfigured } from "../lib/supabase";
import { getNextRace, getPastRaces, RACES_2026 } from "../lib/races";
import { getDriverByNumber } from "../lib/drivers-data";
import {
  calcolaPuntiWeekend,
  type RaceWeekendResults,
} from "../lib/scoring";
import type { Previsioni } from "../lib/types";

interface PlayerResult {
  teamPrincipal: string;
  scuderiaName: string;
  pilotiPoints: number;
  previsioniPoints: number;
  total: number;
  pilotiDettaglio: { driver_number: number; name: string; points: number; isPrimo: boolean }[];
  previsioniDettaglio: Record<string, number>;
}

const PREVISIONE_LABELS: Record<string, string> = {
  safetyCar: "Safety Car",
  virtualSafetyCar: "Virtual Safety Car",
  redFlag: "Red Flag",
  gommeWet: "Gomme Wet",
  poleVince: "Pole vince",
  numeroDnf: "Numero DNF",
};

export default function RisultatiPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [results, setResults] = useState<PlayerResult[] | null>(null);
  const [myResult, setMyResult] = useState<PlayerResult | null>(null);
  const [weekendResults, setWeekendResults] = useState<RaceWeekendResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState(1);

  const race = RACES_2026.find((r) => r.round === selectedRound) || RACES_2026[0];

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    loadResults(selectedRound);
  }, [user, selectedRound]);

  async function loadResults(round: number) {
    setLoading(true);
    const supabase = createClient()!;

    // Carica risultati weekend (salvati dall'admin)
    const { data: weekendData } = await supabase
      .from("weekend_results")
      .select("*")
      .eq("round", round)
      .single();

    if (!weekendData) {
      setWeekendResults(null);
      setResults(null);
      setMyResult(null);
      setLoading(false);
      return;
    }

    const parsedResults: RaceWeekendResults = weekendData.data;
    setWeekendResults(parsedResults);

    // Carica tutti i giocatori con le loro scuderie e previsioni
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, team_principal_name, scuderia_name, scuderia_confirmed");

    if (!profiles) {
      setLoading(false);
      return;
    }

    const confirmedProfiles = profiles.filter((p) => p.scuderia_confirmed);
    const playerResults: PlayerResult[] = [];

    for (const profile of confirmedProfiles) {
      // Piloti del giocatore
      const { data: drivers } = await supabase
        .from("scuderia_drivers")
        .select("*")
        .eq("user_id", profile.id);

      // Previsioni del giocatore
      const { data: prev } = await supabase
        .from("previsioni")
        .select("*")
        .eq("user_id", profile.id)
        .eq("round", round)
        .single();

      if (!drivers || drivers.length === 0) continue;

      const driverNumbers = drivers.map((d) => d.driver_number);
      const primoPilota = drivers.find((d) => d.is_primo_pilota)?.driver_number || null;

      const previsioni: Previsioni = prev
        ? {
            safetyCar: prev.safety_car,
            virtualSafetyCar: prev.virtual_safety_car,
            redFlag: prev.red_flag,
            gommeWet: prev.gomme_wet,
            poleVince: prev.pole_vince,
            numeroDnf: prev.numero_dnf,
          }
        : {
            safetyCar: null,
            virtualSafetyCar: null,
            redFlag: null,
            gommeWet: null,
            poleVince: null,
            numeroDnf: null,
          };

      const calc = calcolaPuntiWeekend(driverNumbers, primoPilota, previsioni, parsedResults);

      playerResults.push({
        teamPrincipal: profile.team_principal_name,
        scuderiaName: profile.scuderia_name,
        pilotiPoints: calc.pilotiPoints,
        previsioniPoints: calc.previsioniPoints,
        total: calc.total,
        pilotiDettaglio: calc.pilotiDettaglio.map((d) => ({
          ...d,
          name: getDriverByNumber(d.driver_number)?.name || `#${d.driver_number}`,
          isPrimo: d.driver_number === primoPilota,
        })),
        previsioniDettaglio: calc.previsioniDettaglio,
      });
    }

    playerResults.sort((a, b) => b.total - a.total);
    setResults(playerResults);

    // Trova il risultato dell'utente corrente
    const currentProfile = confirmedProfiles.find((p) => p.id === user!.id);
    if (currentProfile) {
      const mine = playerResults.find((r) => r.teamPrincipal === currentProfile.team_principal_name);
      setMyResult(mine || null);
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
            {race.flag} {race.name} — Round {race.round}
          </div>
          <h1 className="text-3xl font-black font-[family-name:var(--font-oswald)]">
            RISULTATI
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
          </div>
        ) : !weekendResults ? (
          <div className="text-center py-20">
            <div className="text-white/20 text-sm">Risultati non ancora disponibili</div>
            <p className="text-white/10 text-xs mt-2">Verranno pubblicati dopo la gara</p>
          </div>
        ) : (
          <>
            {/* Il mio risultato */}
            {myResult && (
              <div className="bg-white/[0.03] border border-[#E8002D]/20 rounded-xl p-5 mb-6">
                <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-4">
                  Il tuo weekend
                </div>

                {/* Totale */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/40 text-sm">Punteggio Totale</span>
                  <span className="font-[family-name:var(--font-jetbrains)] text-2xl font-black text-[#E8002D]">
                    {myResult.total}
                  </span>
                </div>

                {/* Breakdown piloti */}
                <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-2">
                  Piloti ({myResult.pilotiPoints} pts)
                </div>
                <div className="space-y-1 mb-4">
                  {myResult.pilotiDettaglio.map((d) => (
                    <div key={d.driver_number} className="flex items-center justify-between text-sm">
                      <span className={d.isPrimo ? "text-[#E8002D] font-bold" : "text-white/60"}>
                        {d.name} {d.isPrimo ? "(x2)" : ""}
                      </span>
                      <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${d.points >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {d.points > 0 ? "+" : ""}{d.points}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Breakdown previsioni */}
                <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-2">
                  Previsioni ({myResult.previsioniPoints} pts)
                </div>
                <div className="space-y-1">
                  {Object.entries(myResult.previsioniDettaglio).map(([key, pts]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-white/60">{PREVISIONE_LABELS[key] || key}</span>
                      <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${pts > 0 ? "text-green-400" : "text-white/20"}`}>
                        {pts > 0 ? `+${pts}` : "0"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Classifica weekend */}
            {results && results.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="text-[10px] tracking-[4px] text-white/30 uppercase font-bold px-4 py-3 border-b border-white/[0.06]">
                  Classifica Weekend
                </div>
                {results.map((r, i) => (
                  <div
                    key={r.teamPrincipal}
                    className={`flex items-center justify-between px-4 py-3 ${
                      i < results.length - 1 ? "border-b border-white/[0.03]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-[family-name:var(--font-jetbrains)] font-bold text-sm w-6 ${i === 0 ? "text-[#E8002D]" : i < 3 ? "text-white/80" : "text-white/30"}`}>
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-sm font-semibold">{r.teamPrincipal}</div>
                        <div className="text-[11px] text-white/30">{r.scuderiaName}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-[family-name:var(--font-jetbrains)] font-bold">
                        {r.total}
                      </div>
                      <div className="text-[9px] text-white/30">
                        P:{r.pilotiPoints} + Prev:{r.previsioniPoints}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Eventi gara */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mt-6">
              <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-3">
                Eventi della gara
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Safety Car", value: weekendResults.events.safety_car },
                  { label: "VSC", value: weekendResults.events.virtual_safety_car },
                  { label: "Red Flag", value: weekendResults.events.red_flag },
                  { label: "Gomme Wet", value: weekendResults.events.wet_tyres },
                  { label: "Pole ha vinto", value: weekendResults.events.pole_won },
                ].map((e) => (
                  <div key={e.label} className="flex items-center justify-between text-sm px-3 py-2 bg-white/[0.02] rounded-lg">
                    <span className="text-white/40">{e.label}</span>
                    <span className={e.value ? "text-green-400 font-bold" : "text-white/20"}>
                      {e.value ? "SI" : "NO"}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm px-3 py-2 bg-white/[0.02] rounded-lg">
                  <span className="text-white/40">DNF totali</span>
                  <span className="font-[family-name:var(--font-jetbrains)] font-bold text-white/60">
                    {weekendResults.events.total_dnf}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="text-center py-8 text-white/10 text-[10px] tracking-[3px] uppercase">
        Los Pitufos FantaF1 — Stagione 2026 — v0.7
      </footer>
    </div>
  );
}

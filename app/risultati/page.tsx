"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth";
import { createClient, isSupabaseConfigured } from "../lib/supabase";
import { RACES_2026 } from "../lib/races";
import { getDriverByNumber } from "../lib/drivers-data";
import {
  calcolaPuntiWeekend,
  type RaceWeekendResults,
  type PilotaDettaglio,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "../lib/scoring";
import type { Previsioni } from "../lib/types";
import { ChevronLeft, ChevronRight, Shield, Zap, Users } from "lucide-react";

interface PlayerResult {
  userId: string;
  teamPrincipal: string;
  scuderiaName: string;
  pilotiPoints: number;
  previsioniPoints: number;
  total: number;
  pilotiDettaglio: (PilotaDettaglio & { name: string })[];
  previsioniDettaglio: Record<string, number>;
  chipPiloti: string | null;
  chipPrevisioni: string | null;
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
  }, [user, selectedRound]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Carica tutti i profili
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, team_principal_name, scuderia_name");

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Carica tutte le formazioni confermate per questo round
    const { data: formazioni } = await supabase
      .from("formazioni")
      .select("*")
      .eq("round", round)
      .eq("confirmed", true);

    // Carica tutte le previsioni confermate per questo round
    const { data: previsioniData } = await supabase
      .from("previsioni")
      .select("*")
      .eq("round", round)
      .eq("confirmed", true);

    const playerResults: PlayerResult[] = [];

    for (const formazione of formazioni || []) {
      const profile = profiles.find((p) => p.id === formazione.user_id);
      if (!profile) continue;

      const driverNumbers: number[] = (formazione.driver_numbers || []).map(Number);
      if (driverNumbers.length === 0) continue;

      const primoPilota: number | null = formazione.primo_pilota;

      // Chip piloti
      const chipPiloti: ChipPilotiConfig = {
        chipPiloti: formazione.chip_piloti,
        chipPilotiTarget: formazione.chip_piloti_target,
        sestoUomo: formazione.sesto_uomo,
      };

      // Previsioni
      const prev = previsioniData?.find((p) => p.user_id === formazione.user_id);
      const previsioni: Previsioni = prev
        ? {
            safetyCar: prev.safety_car,
            virtualSafetyCar: prev.virtual_safety_car,
            redFlag: prev.red_flag,
            gommeWet: prev.gomme_wet,
            poleVince: prev.pole_vince,
            numeroDnf: prev.numero_dnf,
          }
        : { safetyCar: null, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null };

      // Chip previsioni
      const chipPrevisioni: ChipPrevisioniConfig = {
        chipAttivo: prev?.chip_attivo || null,
        chipTarget: prev?.chip_target || null,
      };

      const calc = calcolaPuntiWeekend(driverNumbers, primoPilota, previsioni, parsedResults, chipPiloti, chipPrevisioni);

      playerResults.push({
        userId: formazione.user_id,
        teamPrincipal: profile.team_principal_name,
        scuderiaName: profile.scuderia_name,
        pilotiPoints: calc.pilotiPoints,
        previsioniPoints: calc.previsioniPoints,
        total: calc.total,
        pilotiDettaglio: calc.pilotiDettaglio.map((d) => ({
          ...d,
          name: getDriverByNumber(d.driver_number)?.name || `#${d.driver_number}`,
        })),
        previsioniDettaglio: calc.previsioniDettaglio,
        chipPiloti: formazione.chip_piloti,
        chipPrevisioni: prev?.chip_attivo || null,
      });
    }

    playerResults.sort((a, b) => b.total - a.total);
    setResults(playerResults);

    const mine = playerResults.find((r) => r.userId === user!.id);
    setMyResult(mine || null);

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        {/* Selettore round */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setSelectedRound(Math.max(1, selectedRound - 1))}
            disabled={selectedRound <= 1}
            className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] disabled:opacity-20"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
              Round {race.round}/24
            </div>
            <h1 className="text-xl font-black font-[family-name:var(--font-oswald)]">
              {race.flag} {race.name}
            </h1>
          </div>
          <button
            onClick={() => setSelectedRound(Math.min(24, selectedRound + 1))}
            disabled={selectedRound >= 24}
            className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] disabled:opacity-20"
          >
            <ChevronRight size={18} />
          </button>
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

                {/* Chip attivi */}
                {(myResult.chipPiloti || myResult.chipPrevisioni) && (
                  <div className="flex gap-2 mb-4">
                    {myResult.chipPiloti && (
                      <span className="text-[9px] tracking-wider uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-1 rounded font-bold">
                        {myResult.chipPiloti === "boost" && "Boost x3"}
                        {myResult.chipPiloti === "halo" && "Halo"}
                        {myResult.chipPiloti === "sostituzione" && "Sost. Griglia"}
                        {myResult.chipPiloti === "sesto" && "Sesto Uomo"}
                      </span>
                    )}
                    {myResult.chipPrevisioni && (
                      <span className="text-[9px] tracking-wider uppercase bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-1 rounded font-bold">
                        {myResult.chipPrevisioni === "sicura" && "Prev. Sicura"}
                        {myResult.chipPrevisioni === "doppia" && "Prev. Doppia"}
                        {myResult.chipPrevisioni === "tardiva" && "Prev. Tardiva"}
                      </span>
                    )}
                  </div>
                )}

                {/* Breakdown piloti */}
                <div className="text-[10px] tracking-[3px] text-white/30 uppercase font-bold mb-2">
                  Piloti ({myResult.pilotiPoints} pts)
                </div>
                <div className="space-y-1 mb-4">
                  {myResult.pilotiDettaglio.map((d) => (
                    <div key={d.driver_number} className="flex items-center justify-between text-sm">
                      <span className={`flex items-center gap-1.5 ${d.moltiplicatore === 2 ? "text-[#E8002D] font-bold" : d.moltiplicatore === 3 ? "text-amber-400 font-bold" : d.isSestoUomo ? "text-blue-400" : "text-white/60"}`}>
                        {d.name}
                        {d.moltiplicatore === 2 && " (x2)"}
                        {d.moltiplicatore === 3 && <Zap size={12} />}
                        {d.isSestoUomo && <Users size={12} />}
                        {d.haloApplicato && <Shield size={12} className="text-green-400" />}
                      </span>
                      <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${d.puntiFinali >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {d.puntiFinali > 0 ? "+" : ""}{d.puntiFinali}
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
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden mb-6">
                <div className="text-[10px] tracking-[4px] text-white/30 uppercase font-bold px-4 py-3 border-b border-white/[0.06]">
                  Classifica Weekend
                </div>
                {results.map((r, i) => (
                  <div
                    key={r.userId}
                    className={`flex items-center justify-between px-4 py-3 ${
                      r.userId === user?.id ? "bg-[#E8002D]/5" : ""
                    } ${i < results.length - 1 ? "border-b border-white/[0.03]" : ""}`}
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
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
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

      <BottomNav />
    </div>
  );
}

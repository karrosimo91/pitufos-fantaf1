"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { usePrevisioni } from "../lib/store";
import { useAuth } from "../lib/auth";
import { getNextRace, getCurrentRound } from "../lib/races";
import { PREVISIONI_PUNTI } from "../lib/types";

const PREVISIONI_CONFIG = [
  {
    key: "safetyCar" as const,
    label: "Safety Car",
    description: "Ci sara almeno una Safety Car durante la gara?",
    puntiSi: PREVISIONI_PUNTI.safetyCar.si,
    puntiNo: PREVISIONI_PUNTI.safetyCar.no,
  },
  {
    key: "virtualSafetyCar" as const,
    label: "Virtual Safety Car",
    description: "Ci sara almeno una VSC durante la gara?",
    puntiSi: PREVISIONI_PUNTI.virtualSafetyCar.si,
    puntiNo: PREVISIONI_PUNTI.virtualSafetyCar.no,
  },
  {
    key: "redFlag" as const,
    label: "Red Flag",
    description: "Ci sara almeno una bandiera rossa?",
    puntiSi: PREVISIONI_PUNTI.redFlag.si,
    puntiNo: PREVISIONI_PUNTI.redFlag.no,
  },
  {
    key: "gommeWet" as const,
    label: "Gomme Wet",
    description: "Verranno usate gomme da bagnato in gara?",
    puntiSi: PREVISIONI_PUNTI.gommeWet.si,
    puntiNo: PREVISIONI_PUNTI.gommeWet.no,
  },
  {
    key: "poleVince" as const,
    label: "Pole vince la gara",
    description: "Il poleman vincera il Gran Premio?",
    puntiSi: PREVISIONI_PUNTI.poleVince.si,
    puntiNo: PREVISIONI_PUNTI.poleVince.no,
  },
];

type PrevisioneKey = (typeof PREVISIONI_CONFIG)[number]["key"];

export default function PrevisioniPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const nextRace = getNextRace();
  const round = getCurrentRound();
  const { previsioni, chipAttivo, completate, confirmed, loaded, setPrevisione, setNumeroDnf, setChipAttivo, confermaPrevisioni } = usePrevisioni(round);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const togglePrevisione = (key: PrevisioneKey, value: boolean) => {
    if (confirmed) return;
    const current = previsioni[key];
    setPrevisione(key, current === value ? null : value);
  };

  const handleConferma = async () => {
    setConfirming(true);
    const ok = await confermaPrevisioni();
    setConfirming(false);
    if (ok) {
      setToast("Previsioni confermate!");
      setTimeout(() => setToast(null), 2500);
    }
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur-md border border-white/10 text-white text-sm px-6 py-3 rounded-xl animate-pulse">
          {toast}
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
              {nextRace.name} — Round {nextRace.round}
            </div>
            <h1 className="text-3xl font-black font-[family-name:var(--font-oswald)]">
              PREVISIONI
            </h1>
          </div>
          <div className="text-right">
            <div className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-[#E8002D]">
              {completate}/6
            </div>
            <div className="text-[9px] tracking-[2px] text-white/30">COMPLETATE</div>
          </div>
        </div>

        {confirmed && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400 mb-6">
            Previsioni confermate! Non puoi piu modificarle per questo weekend.
          </div>
        )}

        {/* Previsioni SI/NO */}
        <div className="space-y-3 mb-6">
          {PREVISIONI_CONFIG.map((prev) => (
            <div
              key={prev.key}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm">{prev.label}</h3>
                  <p className="text-[11px] text-white/30 mt-0.5">{prev.description}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => togglePrevisione(prev.key, true)}
                  className={`flex-1 py-3 rounded-lg text-sm font-bold tracking-wider uppercase transition-all ${
                    previsioni[prev.key] === true
                      ? "bg-green-500/20 border border-green-500/40 text-green-400"
                      : "bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50"
                  }`}
                >
                  SI
                  <span className="block text-[9px] font-normal mt-0.5 opacity-60">
                    +{prev.puntiSi} pts
                  </span>
                </button>
                <button
                  onClick={() => togglePrevisione(prev.key, false)}
                  className={`flex-1 py-3 rounded-lg text-sm font-bold tracking-wider uppercase transition-all ${
                    previsioni[prev.key] === false
                      ? "bg-blue-500/20 border border-blue-500/40 text-blue-400"
                      : "bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50"
                  }`}
                >
                  NO
                  <span className="block text-[9px] font-normal mt-0.5 opacity-60">
                    +{prev.puntiNo} pts
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Numero DNF */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-6">
          <h3 className="font-bold text-sm mb-1">Numero DNF esatto</h3>
          <p className="text-[11px] text-white/30 mb-4">
            Quanti piloti si ritireranno dalla gara? (+{PREVISIONI_PUNTI.numeroDnf.esatto} pts se indovini)
          </p>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 8 }, (_, i) => i).map((n) => (
              <button
                key={n}
                onClick={() => setNumeroDnf(previsioni.numeroDnf === n ? null : n)}
                className={`w-10 h-10 rounded-lg font-[family-name:var(--font-jetbrains)] font-bold text-sm transition-all ${
                  previsioni.numeroDnf === n
                    ? "bg-[#E8002D]/20 border border-[#E8002D]/40 text-[#E8002D]"
                    : "bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Chip Previsioni */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-8">
          <div className="text-[10px] tracking-[4px] text-white/30 uppercase font-bold mb-3">
            Aggiornamento Previsioni
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: "sicura", label: "Prev. Sicura", desc: "1 previsione vale comunque" },
              { id: "doppia", label: "Prev. Doppia", desc: "Punti x2 su 1 previsione" },
              { id: "tardiva", label: "Prev. Tardiva", desc: "Cambia 1 dopo le qualifiche" },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setChipAttivo(chipAttivo === chip.id ? null : chip.id)}
                className={`px-4 py-3 rounded-xl text-left transition-all ${
                  chipAttivo === chip.id
                    ? "bg-[#E8002D]/10 border border-[#E8002D]/30"
                    : "bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]"
                }`}
              >
                <div className={`text-[11px] font-bold ${chipAttivo === chip.id ? "text-[#E8002D]" : "text-white/60"}`}>
                  {chip.label}
                </div>
                <div className="text-[9px] text-white/30 mt-0.5">{chip.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        {!confirmed && (
          <button
            onClick={handleConferma}
            disabled={completate < 6 || confirming}
            className={`w-full py-4 rounded-xl text-sm font-bold tracking-[2px] uppercase transition-all ${
              completate === 6
                ? "bg-[#E8002D] hover:bg-[#ff1a3d] text-white hover:shadow-[0_0_30px_rgba(232,0,45,0.3)]"
                : "bg-white/5 text-white/20 cursor-not-allowed"
            }`}
          >
            {confirming ? "Conferma in corso..." : `Conferma Previsioni (${completate}/6)`}
          </button>
        )}
      </main>

      <footer className="text-center py-8 text-white/10 text-[10px] tracking-[3px] uppercase">
        Los Pitufos FantaF1 — Stagione 2026 — v0.7
      </footer>
    </div>
  );
}

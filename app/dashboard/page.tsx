"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import DriverCard from "../components/DriverCard";
import { useScuderia } from "../lib/store";
import { useAuth } from "../lib/auth";
import { getNextRace } from "../lib/races";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { drivers, primoPilota, budget, confirmed, loaded, vendi, setPrimoPilota, confermaScuderia } = useScuderia();
  const nextRace = getNextRace();
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const totalValue = drivers.reduce((sum, d) => sum + d.price, 0);

  const handleConferma = async () => {
    if (drivers.length !== 5) {
      setToast("Devi avere 5 piloti");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    if (!primoPilota) {
      setToast("Scegli un Primo Pilota");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setConfirming(true);
    const ok = await confermaScuderia();
    setConfirming(false);
    if (ok) {
      setToast("Squadra confermata!");
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (authLoading || !loaded || !user) {
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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#E8002D] text-white text-sm font-bold px-8 py-4 rounded-xl shadow-[0_0_30px_rgba(232,0,45,0.4)]">
          {toast}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
              {confirmed ? "Squadra confermata" : "La tua scuderia"}
            </div>
            <h1 className="text-3xl font-black font-[family-name:var(--font-oswald)]">
              {profile?.scuderia_name?.toUpperCase() || "LA MIA SCUDERIA"}
            </h1>
          </div>
          <div className="flex gap-6">
            <div className="text-right">
              <div className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-[#E8002D]">
                {budget}
              </div>
              <div className="text-[9px] tracking-[2px] text-white/30">SOLDINI DISPONIBILI</div>
            </div>
            <div className="text-right">
              <div className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-white/60">
                {totalValue}
              </div>
              <div className="text-[9px] tracking-[2px] text-white/30">VALORE SQUADRA</div>
            </div>
          </div>
        </div>

        {confirmed && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400 mb-6">
            Squadra confermata! Primo Pilota: {drivers.find(d => d.driver_number === primoPilota)?.name || "-"}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Scuderia */}
          <div className="lg:col-span-2 space-y-3">
            <div className="text-[10px] tracking-[4px] text-white/30 uppercase font-bold mb-2">
              I tuoi piloti ({drivers.length}/5)
            </div>
            {drivers.map((driver) => (
              <DriverCard
                key={driver.driver_number}
                name={driver.name}
                team={driver.team}
                teamColour={driver.teamColour}
                price={driver.price}
                number={driver.driver_number}
                isPrimoPilota={driver.driver_number === primoPilota}
                onSetPrimoPilota={confirmed ? undefined : () => setPrimoPilota(driver.driver_number)}
                onSelect={confirmed ? undefined : () => vendi(driver.driver_number)}
                actionLabel="Vendi"
                showActions={!confirmed}
              />
            ))}
            {drivers.length === 0 && (
              <div className="text-center py-12 text-white/20 text-sm">
                Non hai ancora nessun pilota. Vai al mercato per acquistarne!
              </div>
            )}
            {drivers.length < 5 && !confirmed && (
              <a
                href="/mercato"
                className="block text-center border-2 border-dashed border-white/10 rounded-xl p-6 text-white/20 hover:text-white/40 hover:border-white/20 transition-all text-sm tracking-wider uppercase"
              >
                + Aggiungi Pilota
              </a>
            )}

            {/* Bottone conferma */}
            {!confirmed && drivers.length > 0 && (
              <button
                onClick={handleConferma}
                disabled={confirming || drivers.length !== 5 || !primoPilota}
                className={`w-full py-4 rounded-xl text-sm font-bold tracking-[2px] uppercase transition-all mt-4 ${
                  drivers.length === 5 && primoPilota
                    ? "bg-[#E8002D] hover:bg-[#ff1a3d] text-white hover:shadow-[0_0_30px_rgba(232,0,45,0.3)]"
                    : "bg-white/5 text-white/20 cursor-not-allowed"
                }`}
              >
                {confirming
                  ? "Conferma in corso..."
                  : drivers.length !== 5
                  ? `Servono ${5 - drivers.length} piloti`
                  : !primoPilota
                  ? "Scegli un Primo Pilota (CAP)"
                  : "Conferma Squadra"}
              </button>
            )}
          </div>

          {/* Right: Info weekend */}
          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-3">
                Prossimo Weekend
              </div>
              <div className="text-3xl mb-2">{nextRace.flag}</div>
              <h3 className="font-bold text-lg">{nextRace.name}</h3>
              <p className="text-white/40 text-sm">{nextRace.circuit}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-white/30">
                <span>Round {nextRace.round}/24</span>
                {nextRace.sprint && (
                  <span className="bg-[#E8002D]/20 text-[#E8002D] px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                    SPRINT
                  </span>
                )}
              </div>

              {/* Quick link previsioni */}
              {confirmed && (
                <a
                  href="/previsioni"
                  className="block mt-4 text-center text-[11px] tracking-wider uppercase bg-[#E8002D]/10 text-[#E8002D] font-bold py-2 rounded-lg hover:bg-[#E8002D]/20 transition-all"
                >
                  Compila Previsioni →
                </a>
              )}
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <div className="text-[10px] tracking-[4px] text-white/30 uppercase font-bold mb-4">
                Riepilogo Stagione
              </div>
              <div className="space-y-3">
                {[
                  { label: "Punti Totali", value: "0", color: "text-white" },
                  { label: "Classifica Punti", value: "-", color: "text-white/60" },
                  { label: "Classifica Reale", value: "-", color: "text-white/60" },
                  { label: "Miglior Weekend", value: "-", color: "text-white/60" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between">
                    <span className="text-xs text-white/40">{stat.label}</span>
                    <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${stat.color}`}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <div className="text-[10px] tracking-[4px] text-white/30 uppercase font-bold mb-4">
                Aggiornamenti
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["Boost Mode", "Halo", "Sost. Griglia", "Sesto Uomo", "Prev. Sicura", "Prev. Doppia", "Prev. Tardiva"].map(
                  (chip) => (
                    <div
                      key={chip}
                      className="text-[10px] tracking-wider text-white/30 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-center"
                    >
                      {chip}
                      <div className="text-[8px] text-white/20 mt-0.5">2/2</div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-8 text-white/10 text-[10px] tracking-[3px] uppercase">
        Los Pitufos FantaF1 — Stagione 2026 — v0.81
      </footer>
    </div>
  );
}

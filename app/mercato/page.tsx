"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import DriverCard from "../components/DriverCard";
import { DRIVERS_2026 } from "../lib/drivers-data";
import { useSquadra } from "../lib/store";
import { useAuth } from "../lib/auth";
import { getCurrentRound } from "../lib/races";
import { ArrowRightLeft, AlertTriangle } from "lucide-react";

export default function MercatoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"price" | "name" | "team">("price");
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ driverNumber: number; name: string } | null>(null);

  const round = getCurrentRound();
  const squadra = useSquadra(round);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const squadraPiena = squadra.drivers.length >= 5;

  const handleAcquista = async (driverNumber: number) => {
    const driver = DRIVERS_2026.find(d => d.number === driverNumber);
    if (!driver) return;

    // Se il prossimo cambio costa punti, chiedi conferma
    if (squadra.penalitaProssimoCambio > 0) {
      setConfirmDialog({ driverNumber, name: driver.name });
      return;
    }

    const result = await squadra.acquista(driverNumber);
    if (result.ok) {
      showToast(`${driver.name} acquistato!`);
    } else {
      showToast(result.error || "Errore");
    }
  };

  const handleConfirmAcquisto = async () => {
    if (!confirmDialog) return;
    const result = await squadra.acquista(confirmDialog.driverNumber);
    if (result.ok) {
      showToast(`${confirmDialog.name} acquistato! (-${squadra.PENALITA_CAMBIO_EXTRA} punti weekend)`);
    } else {
      showToast(result.error || "Errore");
    }
    setConfirmDialog(null);
  };

  const handleVendi = async (driverNumber: number) => {
    const driver = DRIVERS_2026.find(d => d.number === driverNumber);
    const success = await squadra.vendi(driverNumber);
    if (success && driver) showToast(`${driver.name} venduto`);
  };

  const filtered = DRIVERS_2026
    .filter((d) => {
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.team.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "price") return b.price - a.price;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return a.team.localeCompare(b.team);
    });

  const isOwned = (num: number) => squadra.driverNumbers.includes(num);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#E8002D] text-white text-sm font-bold px-8 py-4 rounded-xl shadow-[0_0_30px_rgba(232,0,45,0.4)]">
          {toast}
        </div>
      )}

      {/* Dialog conferma cambio a pagamento */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setConfirmDialog(null)}>
          <div className="bg-[#12121e] border border-amber-500/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(232,0,45,0.15)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={20} className="text-amber-400" />
              <h3 className="font-bold text-lg">Cambio a pagamento</h3>
            </div>
            <p className="text-sm text-white/60 mb-1">
              Vuoi acquistare <span className="text-white font-bold">{confirmDialog.name}</span>?
            </p>
            <p className="text-sm text-amber-400 font-bold mb-5">
              Questo cambio costa -{squadra.PENALITA_CAMBIO_EXTRA} punti sul weekend.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold border border-white/10 text-white/50 hover:bg-white/5 transition-all"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmAcquisto}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#E8002D] text-white hover:bg-[#ff1a3d] transition-all"
              >
                Conferma (-{squadra.PENALITA_CAMBIO_EXTRA} pts)
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 pb-bottomnav">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
              Compra e vendi piloti
            </div>
            <h1 className="text-3xl font-black font-[family-name:var(--font-oswald)]">MERCATO</h1>
          </div>
          <div className="flex gap-6">
            <div className="text-right">
              <div className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-[#E8002D]">{squadra.budget}</div>
              <div className="text-[9px] tracking-[2px] text-white/30">SOLDINI</div>
            </div>
            <div className="text-right">
              <div className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-white/60">{squadra.drivers.length}/5</div>
              <div className="text-[9px] tracking-[2px] text-white/30">PILOTI</div>
            </div>
          </div>
        </div>

        {/* Info cambi */}
        <div className={`mb-6 rounded-xl p-4 border ${
          squadra.penalitaProssimoCambio > 0
            ? "bg-amber-500/5 border-amber-500/20"
            : "bg-white/[0.03] border-white/[0.06]"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowRightLeft size={16} className={squadra.penalitaProssimoCambio > 0 ? "text-amber-400" : "text-white/40"} />
              <div>
                <div className="text-sm font-bold">
                  Cambi: <span className="font-[family-name:var(--font-jetbrains)]">{squadra.cambiRound}/{squadra.CAMBI_GRATIS}</span>
                  <span className="text-white/30 font-normal ml-1">gratis usati</span>
                </div>
                {squadra.chipPiloti === "wildcard" ? (
                  <div className="text-[11px] text-green-400 mt-0.5">
                    Wildcard attiva — cambi illimitati senza penalità
                  </div>
                ) : squadra.penalitaProssimoCambio > 0 ? (
                  <div className="text-[11px] text-amber-400 flex items-center gap-1 mt-0.5">
                    <AlertTriangle size={11} />
                    Prossimo cambio: -{squadra.PENALITA_CAMBIO_EXTRA} punti weekend
                  </div>
                ) : (
                  <div className="text-[11px] text-white/30 mt-0.5">
                    {squadra.cambiGratisRimasti} cambi gratis rimasti questo round
                  </div>
                )}
              </div>
            </div>
            {squadra.penalitaTotale > 0 && (
              <div className="text-right">
                <div className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-amber-400">-{squadra.penalitaTotale} pts</div>
                <div className="text-[8px] tracking-[1px] text-amber-400/60">SUL WEEKEND</div>
              </div>
            )}
          </div>
        </div>

        {/* Filtri */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca pilota o team..."
            className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#E8002D]/30 transition-all"
          />
          <div className="flex gap-2">
            {(["price", "name", "team"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`text-[10px] tracking-wider uppercase px-4 py-3 rounded-xl border transition-all font-bold ${
                  sortBy === s
                    ? "bg-[#E8002D]/10 border-[#E8002D]/30 text-[#E8002D]"
                    : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/60"
                }`}
              >
                {s === "price" ? "Prezzo" : s === "name" ? "Nome" : "Team"}
              </button>
            ))}
          </div>
        </div>

        {/* Lista piloti */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((driver) => {
            const owned = isOwned(driver.number);
            return (
              <DriverCard
                key={driver.number}
                name={driver.name}
                team={driver.team}
                teamColour={driver.teamColour}
                price={driver.price}
                number={driver.number}
                actionLabel={owned ? "Vendi" : "Acquista"}
                showActions={owned || !squadraPiena}
                onSelect={owned ? () => handleVendi(driver.number) : () => handleAcquista(driver.number)}
              />
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

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
import { useLiveSession } from "../lib/use-live-session";
import { useDriverPrices, getDriverPrice } from "../lib/use-driver-prices";
import { ArrowRightLeft, AlertTriangle, Radio } from "lucide-react";

export default function MercatoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"price" | "name" | "team">("price");
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ driverNumber: number; name: string } | null>(null);

  const round = getCurrentRound();
  const squadra = useSquadra(round);
  const { isLive } = useLiveSession();
  const { prices: dynamicPrices } = useDriverPrices(round);

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
    .map((d) => ({ ...d, price: getDriverPrice(dynamicPrices, d.number) }))
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
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#E8002D] text-white text-[12px] font-bold tracking-[1.5px] uppercase px-5 py-3 rounded font-[family-name:var(--font-jetbrains)] shadow-[0_0_30px_rgba(232,0,45,0.4)]">
          {toast}
        </div>
      )}

      {/* Dialog conferma cambio a pagamento */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setConfirmDialog(null)}>
          <div className="hud-card hud-card-accent max-w-sm w-full shadow-[0_0_40px_rgba(232,0,45,0.18)]" onClick={(e) => e.stopPropagation()}>
            <div className="hud-card-head">
              <div className="hud-label" style={{ color: "var(--amber)" }}>CAMBIO A PAGAMENTO</div>
              <AlertTriangle size={14} className="text-amber-400" />
            </div>
            <div className="p-5">
              <p className="text-[13px] text-white/70 mb-1">
                Vuoi acquistare <span className="text-white font-bold">{confirmDialog.name}</span>?
              </p>
              <p className="text-[12px] text-amber-400 font-bold mb-5 font-[family-name:var(--font-jetbrains)] tracking-[0.5px]">
                COSTO: −{squadra.PENALITA_CAMBIO_EXTRA} PUNTI WEEKEND
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-3 rounded font-[family-name:var(--font-jetbrains)] text-[11px] font-bold tracking-[1.5px] uppercase border border-[#1c1c26] text-white/50 hover:bg-white/[0.04] transition-colors"
                >
                  ANNULLA
                </button>
                <button
                  onClick={handleConfirmAcquisto}
                  className="flex-1 py-3 rounded font-[family-name:var(--font-jetbrains)] text-[11px] font-bold tracking-[1.5px] uppercase bg-[#E8002D] text-white hover:bg-[#ff1a3d] transition-colors"
                >
                  CONFERMA −{squadra.PENALITA_CAMBIO_EXTRA}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6 pb-bottomnav">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
          <div>
            <div className="font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[2.5px] text-[#E8002D] uppercase font-bold mb-1.5">
              MERCATO · ROUND {round}
            </div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.8px] leading-none">Mercato</h1>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="hud-card text-right p-3">
              <div className="hud-label mb-1">SOLDINI</div>
              <div className="num font-extrabold text-[20px] text-[#E8002D] leading-none">{squadra.budget}</div>
            </div>
            <div className="hud-card text-right p-3">
              <div className="hud-label mb-1">PILOTI</div>
              <div className="num font-extrabold text-[20px] leading-none">
                {squadra.drivers.length}<span className="text-white/30 text-[14px]"> / 5</span>
              </div>
            </div>
          </div>
        </div>

        {/* Banner blocco durante sessione live */}
        {isLive && (
          <div className="mb-5 hud-card hud-card-accent">
            <div className="hud-card-head">
              <div className="hud-label" style={{ color: "var(--accent)" }}>
                <span className="inline-flex items-center gap-1.5">
                  <Radio size={11} className="animate-live-pulse" /> MERCATO BLOCCATO
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="text-[12px] text-white/60">Sessione in corso — il mercato riapre al termine della sessione</div>
            </div>
          </div>
        )}

        {/* Info cambi */}
        <div className={`mb-5 hud-card ${
          squadra.penalitaProssimoCambio > 0 ? "border-amber-500/30" : ""
        }`}>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowRightLeft size={16} className={squadra.penalitaProssimoCambio > 0 ? "text-amber-400" : "text-white/40"} />
              <div>
                <div className="text-[13px] font-bold">
                  Cambi: <span className="font-[family-name:var(--font-jetbrains)] tabular-nums">{squadra.cambiRound}/{squadra.CAMBI_GRATIS}</span>
                  <span className="text-white/30 font-normal ml-1.5 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1px] uppercase">gratis usati</span>
                </div>
                {squadra.chipPiloti === "wildcard" ? (
                  <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-green-400 mt-1 tracking-[0.5px] uppercase">
                    WILDCARD ATTIVA · CAMBI ILLIMITATI
                  </div>
                ) : squadra.penalitaProssimoCambio > 0 ? (
                  <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-amber-400 flex items-center gap-1 mt-1 tracking-[0.5px] uppercase">
                    <AlertTriangle size={10} />
                    PROSSIMO CAMBIO: −{squadra.PENALITA_CAMBIO_EXTRA} PUNTI WEEKEND
                  </div>
                ) : (
                  <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/30 mt-1 tracking-[0.5px] uppercase">
                    {squadra.cambiGratisRimasti} CAMBI GRATIS RIMASTI
                  </div>
                )}
              </div>
            </div>
            {squadra.penalitaTotale > 0 && (
              <div className="text-right">
                <div className="font-[family-name:var(--font-jetbrains)] text-[15px] font-extrabold text-amber-400 tabular-nums">−{squadra.penalitaTotale}</div>
                <div className="hud-label" style={{ color: "rgba(255,176,0,0.5)" }}>PTS WEEKEND</div>
              </div>
            )}
          </div>
        </div>

        {/* Filtri */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca pilota o team..."
            className="flex-1 bg-[#0e0e14] border border-[#1c1c26] rounded px-4 py-3 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-[#E8002D]/50 transition-colors"
          />
          <div className="flex gap-1.5">
            {(["price", "name", "team"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`font-[family-name:var(--font-jetbrains)] text-[10px] font-bold tracking-[1.5px] uppercase px-4 py-3 rounded border transition-colors ${
                  sortBy === s
                    ? "bg-[#E8002D]/12 border-[#E8002D]/45 text-[#E8002D]"
                    : "bg-[#0e0e14] border-[#1c1c26] text-white/40 hover:text-white/70"
                }`}
              >
                {s === "price" ? "PREZZO" : s === "name" ? "NOME" : "TEAM"}
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
                showActions={!isLive && (owned || !squadraPiena)}
                onSelect={isLive ? undefined : (owned ? () => handleVendi(driver.number) : () => handleAcquista(driver.number))}
              />
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import DriverCard from "../components/DriverCard";
import { DRIVERS_2026 } from "../lib/drivers-data";
import { useScuderia } from "../lib/store";
import { useAuth } from "../lib/auth";

export default function MercatoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"price" | "name" | "team">("price");
  const [toast, setToast] = useState<string | null>(null);

  const scuderia = useScuderia();

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleAcquista = async (driver: typeof DRIVERS_2026[number]) => {
    if (scuderia.confirmed) {
      showToast("Squadra gia confermata");
      return;
    }
    const success = await scuderia.acquista({
      driver_number: driver.number,
      name: driver.name,
      team: driver.team,
      price: driver.price,
      teamColour: driver.teamColour,
    });
    if (success) {
      showToast(`${driver.name} acquistato!`);
    } else if (scuderia.drivers.length >= 5) {
      showToast("Squadra piena (5/5)");
    } else if (scuderia.drivers.some((d) => d.driver_number === driver.number)) {
      showToast("Pilota gia in squadra");
    } else {
      showToast("Budget insufficiente");
    }
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

  const isOwned = (num: number) => scuderia.drivers.some((d) => d.driver_number === num);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#E8002D] text-white text-sm font-bold px-8 py-4 rounded-xl shadow-[0_0_30px_rgba(232,0,45,0.4)]">
          {toast}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
              {scuderia.confirmed ? "Squadra confermata" : "Compra piloti"}
            </div>
            <h1 className="text-3xl font-black font-[family-name:var(--font-oswald)]">
              MERCATO
            </h1>
          </div>
          <div className="flex gap-6">
            <div className="text-right">
              <div className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-[#E8002D]">
                {scuderia.budget}
              </div>
              <div className="text-[9px] tracking-[2px] text-white/30">SOLDINI</div>
            </div>
            <div className="text-right">
              <div className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-white/60">
                {scuderia.drivers.length}/5
              </div>
              <div className="text-[9px] tracking-[2px] text-white/30">PILOTI</div>
            </div>
          </div>
        </div>

        {scuderia.confirmed && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400 mb-6">
            La tua squadra e stata confermata. Non puoi piu fare modifiche per questo weekend.
          </div>
        )}

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
          {filtered.map((driver) => (
            <DriverCard
              key={driver.number}
              name={driver.name}
              team={driver.team}
              teamColour={driver.teamColour}
              price={driver.price}
              number={driver.number}
              actionLabel={isOwned(driver.number) ? "In squadra" : "Acquista"}
              showActions={!isOwned(driver.number) && !scuderia.confirmed}
              onSelect={isOwned(driver.number) || scuderia.confirmed ? undefined : () => handleAcquista(driver)}
            />
          ))}
        </div>
      </main>

      <footer className="text-center py-8 text-white/10 text-[10px] tracking-[3px] uppercase">
        Los Pitufos FantaF1 — Stagione 2026 — v0.81
      </footer>
    </div>
  );
}

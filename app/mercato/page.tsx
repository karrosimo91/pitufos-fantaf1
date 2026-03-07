"use client";
import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import DriverCard from "../components/DriverCard";
import { getDrivers } from "../lib/api";
import { getDriverPrice } from "../lib/drivers-data";
import { useScuderia } from "../lib/store";
import type { Driver } from "../lib/types";

export default function MercatoPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"price" | "name" | "team">("price");
  const [toast, setToast] = useState<string | null>(null);

  const scuderia = useScuderia();

  useEffect(() => {
    getDrivers()
      .then((data) => {
        const unique = new Map<number, Driver>();
        data.forEach((d) => unique.set(d.driver_number, d));
        setDrivers(Array.from(unique.values()));
      })
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAcquista = (driver: Driver) => {
    const price = getDriverPrice(driver.driver_number);
    const success = scuderia.acquista({
      driver_number: driver.driver_number,
      name: driver.full_name,
      team: driver.team_name,
      price,
      teamColour: driver.team_colour || "666666",
    });
    if (success) {
      showToast(`${driver.full_name} acquistato!`);
    } else if (scuderia.drivers.length >= 5) {
      showToast("Squadra piena (5/5)");
    } else if (scuderia.drivers.some((d) => d.driver_number === driver.driver_number)) {
      showToast("Pilota gia in squadra");
    } else {
      showToast("Budget insufficiente");
    }
  };

  const filtered = drivers
    .filter((d) => {
      const q = search.toLowerCase();
      return (
        d.full_name?.toLowerCase().includes(q) ||
        d.team_name?.toLowerCase().includes(q) ||
        d.name_acronym?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "price") return getDriverPrice(b.driver_number) - getDriverPrice(a.driver_number);
      if (sortBy === "name") return (a.full_name || "").localeCompare(b.full_name || "");
      return (a.team_name || "").localeCompare(b.team_name || "");
    });

  const isOwned = (num: number) => scuderia.drivers.some((d) => d.driver_number === num);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur-md border border-white/10 text-white text-sm px-6 py-3 rounded-xl animate-pulse">
          {toast}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
              Compra e vendi piloti
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
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
            <p className="text-white/30 text-sm mt-4">Caricamento piloti...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">
            Nessun pilota trovato
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((driver) => (
              <DriverCard
                key={driver.driver_number}
                name={driver.full_name}
                team={driver.team_name}
                teamColour={driver.team_colour || "666666"}
                price={getDriverPrice(driver.driver_number)}
                number={driver.driver_number}
                headshot={driver.headshot_url}
                actionLabel={isOwned(driver.driver_number) ? "In squadra" : "Acquista"}
                showActions={!isOwned(driver.driver_number)}
                onSelect={isOwned(driver.driver_number) ? undefined : () => handleAcquista(driver)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-white/10 text-[10px] tracking-[3px] uppercase">
        Los Pitufos FantaF1 — Stagione 2026 — v0.2
      </footer>
    </div>
  );
}

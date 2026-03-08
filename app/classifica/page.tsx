"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useLeghe, useClassificaLega } from "../lib/store";
import { useAuth } from "../lib/auth";
import { ChevronDown } from "lucide-react";

const LEGA_GENERALE_ID = "00000000-0000-0000-0000-000000000001";

export default function ClassificaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a12] text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
      </div>
    }>
      <ClassificaContent />
    </Suspense>
  );
}

function ClassificaContent() {
  const searchParams = useSearchParams();
  const legaParam = searchParams.get("lega");
  const { user } = useAuth();
  const { leghe, loaded: legheLoaded } = useLeghe();
  const [selectedLega, setSelectedLega] = useState(legaParam || LEGA_GENERALE_ID);

  // Aggiorna se il parametro URL cambia
  useEffect(() => {
    if (legaParam) setSelectedLega(legaParam);
  }, [legaParam]);

  const { classifica, loading } = useClassificaLega(selectedLega);
  const currentLega = leghe.find((l) => l.id === selectedLega);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-bottomnav">
        <div className="mb-6">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
            Stagione 2026
          </div>
          <h1 className="text-3xl font-black font-[family-name:var(--font-oswald)]">
            CLASSIFICA
          </h1>
        </div>

        {/* Selettore lega */}
        {legheLoaded && leghe.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <select
                value={selectedLega}
                onChange={(e) => setSelectedLega(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none focus:border-[#E8002D]/40 appearance-none pr-10"
              >
                {leghe.map((l) => (
                  <option key={l.id} value={l.id} className="bg-[#0a0a12]">
                    {l.name} (R{l.round_start}–R{l.round_end})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
            {currentLega && !currentLega.is_generale && (
              <div className="text-[11px] text-white/30 mt-2 px-1">
                Round {currentLega.round_start} → {currentLega.round_end} — {currentLega.is_public ? "Pubblica" : "Privata"}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
          </div>
        ) : classifica.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-white/20 text-sm">Nessun giocatore in questa lega</div>
            <p className="text-white/10 text-xs mt-2">La classifica si popolera' con i primi risultati</p>
          </div>
        ) : (
          <>
            {/* Podio (solo se almeno 3 giocatori con punti) */}
            {classifica.filter((e) => e.total_points > 0).length >= 3 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[classifica[1], classifica[0], classifica[2]].map((entry, i) => {
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
                          {entry.total_points}
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

              {classifica.map((entry, i) => (
                <div
                  key={entry.user_id}
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
                    <div className="text-sm font-semibold">{entry.team_principal_name}</div>
                    <div className="text-[11px] text-white/30">{entry.scuderia_name}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-[family-name:var(--font-jetbrains)] text-xs text-white/40">
                      +{entry.last_weekend_points}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-[family-name:var(--font-jetbrains)] font-bold text-sm">
                      {entry.total_points}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

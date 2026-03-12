"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useLeghe, useClassificaLega } from "../lib/store";
import { useAuth } from "../lib/auth";
import { createClient, isSupabaseConfigured } from "../lib/supabase";
import { getDriverByNumber } from "../lib/drivers-data";
import { ChevronDown, X, Eye } from "lucide-react";
import { RACES_2026, getRaceByRound, isAfterDeadline } from "../lib/races";

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

// ─── Dati squadra di un giocatore ───
interface PlayerSquadData {
  userId: string;
  teamPrincipalName: string;
  scuderiaName: string;
  driverNumbers: number[];
  primoPilota: number | null;
  sestoUomo: number | null;
  chipPiloti: string | null;
  chipPilotiTarget: number | null;
  previsioni: {
    safety_car: boolean | null;
    virtual_safety_car: boolean | null;
    red_flag: boolean | null;
    gomme_wet: boolean | null;
    pole_vince: boolean | null;
    numero_dnf: number | null;
  } | null;
  chipPrevisioni: string | null;
  chipPrevisioniTarget: string | null;
}

const CHIP_LABELS: Record<string, { label: string; icon: string }> = {
  boost: { label: "Boost Mode x3", icon: "⚡" },
  halo: { label: "Halo", icon: "🛡️" },
  sesto: { label: "Sesto Uomo", icon: "👤" },
  wildcard: { label: "Wildcard", icon: "🃏" },
  sicura: { label: "Prev. Sicura", icon: "✅" },
  doppia: { label: "Prev. Doppia", icon: "✨" },
};

const PREVISIONI_LABELS: { key: string; label: string }[] = [
  { key: "safety_car", label: "Safety Car" },
  { key: "virtual_safety_car", label: "Virtual SC" },
  { key: "red_flag", label: "Red Flag" },
  { key: "gomme_wet", label: "Gomme Wet" },
  { key: "pole_vince", label: "Pole vince" },
  { key: "numero_dnf", label: "N° DNF" },
];

function ClassificaContent() {
  const searchParams = useSearchParams();
  const legaParam = searchParams.get("lega");
  const { user } = useAuth();
  const { leghe, loaded: legheLoaded } = useLeghe();
  const [selectedLega, setSelectedLega] = useState(legaParam || LEGA_GENERALE_ID);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [playerModal, setPlayerModal] = useState<PlayerSquadData | null>(null);
  const [loadingPlayer, setLoadingPlayer] = useState(false);

  useEffect(() => {
    if (legaParam) setSelectedLega(legaParam);
  }, [legaParam]);

  const { classifica, loading } = useClassificaLega(selectedLega, selectedRound);
  const currentLega = leghe.find((l) => l.id === selectedLega);

  // Può vedere le squadre? Solo lega non-generale, round selezionato, dopo deadline
  const canViewSquads = (() => {
    if (!currentLega || currentLega.is_generale) return false;
    if (!selectedRound) return false;
    const race = getRaceByRound(selectedRound);
    if (!race) return false;
    return isAfterDeadline(race);
  })();

  const openPlayerModal = useCallback(async (entry: { user_id: string; team_principal_name: string; scuderia_name: string }) => {
    if (!canViewSquads || !selectedRound || !isSupabaseConfigured) return;
    setLoadingPlayer(true);

    const supabase = createClient()!;

    const [formRes, prevRes] = await Promise.all([
      supabase
        .from("formazioni")
        .select("driver_numbers, primo_pilota, sesto_uomo, chip_piloti, chip_piloti_target")
        .eq("user_id", entry.user_id)
        .eq("round", selectedRound)
        .eq("confirmed", true)
        .single(),
      supabase
        .from("previsioni")
        .select("safety_car, virtual_safety_car, red_flag, gomme_wet, pole_vince, numero_dnf, chip_attivo, chip_target")
        .eq("user_id", entry.user_id)
        .eq("round", selectedRound)
        .eq("confirmed", true)
        .single(),
    ]);

    const form = formRes.data;
    const prev = prevRes.data;

    setPlayerModal({
      userId: entry.user_id,
      teamPrincipalName: entry.team_principal_name,
      scuderiaName: entry.scuderia_name,
      driverNumbers: form?.driver_numbers ? (form.driver_numbers as number[]).map(Number) : [],
      primoPilota: form?.primo_pilota ?? null,
      sestoUomo: form?.sesto_uomo ?? null,
      chipPiloti: form?.chip_piloti ?? null,
      chipPilotiTarget: form?.chip_piloti_target ?? null,
      previsioni: prev ? {
        safety_car: prev.safety_car,
        virtual_safety_car: prev.virtual_safety_car,
        red_flag: prev.red_flag,
        gomme_wet: prev.gomme_wet,
        pole_vince: prev.pole_vince,
        numero_dnf: prev.numero_dnf,
      } : null,
      chipPrevisioni: prev?.chip_attivo ?? null,
      chipPrevisioniTarget: prev?.chip_target ?? null,
    });

    setLoadingPlayer(false);
  }, [canViewSquads, selectedRound]);

  // Round disponibili per la lega selezionata
  const roundStart = currentLega?.round_start ?? 1;
  const roundEnd = currentLega?.round_end ?? 24;
  const availableRounds = RACES_2026.filter(
    (r) => r.round >= roundStart && r.round <= roundEnd && isAfterDeadline(r)
  );

  const selectedRace = selectedRound ? RACES_2026.find((r) => r.round === selectedRound) : null;
  const isSeasonView = selectedRound === null;

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
          <div className="mb-4">
            <div className="relative">
              <select
                value={selectedLega}
                onChange={(e) => { setSelectedLega(e.target.value); setSelectedRound(null); }}
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

        {/* Filtro round */}
        <div className="mb-6">
          <div className="relative">
            <select
              value={selectedRound ?? ""}
              onChange={(e) => setSelectedRound(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none focus:border-[#E8002D]/40 appearance-none pr-10"
            >
              <option value="" className="bg-[#0a0a12]">Stagione completa</option>
              {availableRounds.map((race) => (
                <option key={race.round} value={race.round} className="bg-[#0a0a12]">
                  R{race.round} — {race.flag} {race.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
          </div>
        ) : classifica.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-white/20 text-sm">
              {isSeasonView ? "Nessun giocatore in questa lega" : "Nessun risultato per questo round"}
            </div>
            <p className="text-white/10 text-xs mt-2">
              {isSeasonView ? "La classifica si popolera' con i primi risultati" : "I punteggi verranno calcolati dopo la gara"}
            </p>
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
              <div className={`grid ${selectedRound ? "grid-cols-[auto_1fr_auto_auto_auto]" : "grid-cols-[auto_1fr_auto_auto]"} gap-3 px-4 py-3 text-[9px] tracking-[2px] text-white/30 uppercase border-b border-white/[0.06]`}>
                <span>Pos</span>
                <span>Team Principal</span>
                {selectedRound && <span className="text-right">Piloti</span>}
                {selectedRound && <span className="text-right">Prev</span>}
                {!selectedRound && <span className="text-right">Weekend</span>}
                <span className="text-right">{selectedRound ? "Tot" : "Totale"}</span>
              </div>

              {classifica.map((entry, i) => (
                <div
                  key={entry.user_id}
                  onClick={() => canViewSquads ? openPlayerModal(entry) : undefined}
                  className={`grid ${selectedRound ? "grid-cols-[auto_1fr_auto_auto_auto]" : "grid-cols-[auto_1fr_auto_auto]"} gap-3 px-4 py-3 items-center transition-all hover:bg-white/[0.02] ${
                    i < classifica.length - 1 ? "border-b border-white/[0.03]" : ""
                  } ${canViewSquads ? "cursor-pointer active:bg-white/[0.04]" : ""}`}
                >
                  <span
                    className={`font-[family-name:var(--font-jetbrains)] font-bold text-sm w-8 ${
                      i === 0 ? "text-[#E8002D]" : i < 3 ? "text-white/80" : "text-white/30"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{entry.team_principal_name}</div>
                      <div className="text-[11px] text-white/30 truncate">{entry.scuderia_name}</div>
                    </div>
                    {canViewSquads && (
                      <Eye size={13} className="text-white/15 shrink-0" />
                    )}
                  </div>
                  {selectedRound ? (
                    <>
                      <div className="text-right">
                        <span className="font-[family-name:var(--font-jetbrains)] text-xs text-white/40">
                          {entry.piloti_points}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-[family-name:var(--font-jetbrains)] text-xs text-white/40">
                          {entry.previsioni_points}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-right">
                      <span className="font-[family-name:var(--font-jetbrains)] text-xs text-white/40">
                        +{entry.last_weekend_points}
                      </span>
                    </div>
                  )}
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
        {/* Hint: tap per vedere squadra */}
        {canViewSquads && classifica.length > 0 && (
          <div className="text-center mt-4 text-[11px] text-white/20 flex items-center justify-center gap-1.5">
            <Eye size={12} />
            Tocca un giocatore per vedere la sua squadra
          </div>
        )}
      </main>

      {/* Loading overlay */}
      {loadingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
        </div>
      )}

      {/* Modal squadra giocatore */}
      {playerModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4" onClick={() => setPlayerModal(null)}>
          <div
            className="bg-[#12121e] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto shadow-[0_0_60px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#12121e] border-b border-white/[0.06] px-5 py-4 flex items-center justify-between z-10">
              <div>
                <div className="font-bold text-base">{playerModal.teamPrincipalName}</div>
                <div className="text-[11px] text-white/30">{playerModal.scuderiaName} — R{selectedRound}</div>
              </div>
              <button onClick={() => setPlayerModal(null)} className="text-white/30 hover:text-white/60 transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Rosa piloti */}
              <div>
                <div className="text-[9px] tracking-[3px] text-[#E8002D] uppercase font-bold mb-3">Rosa Piloti</div>
                <div className="space-y-2">
                  {playerModal.driverNumbers.length > 0 ? playerModal.driverNumbers.map((num) => {
                    const d = getDriverByNumber(num);
                    if (!d) return null;
                    const isPP = num === playerModal.primoPilota;
                    const isSesto = num === playerModal.sestoUomo;
                    const isBoostTarget = playerModal.chipPiloti === "boost" && num === playerModal.chipPilotiTarget;
                    const color = `#${d.teamColour}`;
                    return (
                      <div
                        key={num}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isPP
                            ? "border-[#E8002D]/40 bg-[#E8002D]/5"
                            : isBoostTarget
                            ? "border-amber-400/40 bg-amber-400/5"
                            : isSesto
                            ? "border-blue-400/30 bg-blue-400/5"
                            : "border-white/[0.06] bg-white/[0.02]"
                        }`}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ backgroundColor: `${color}30`, color }}
                        >
                          <span className="font-[family-name:var(--font-jetbrains)]">{num}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{d.name}</div>
                          <div className="text-[10px] text-white/30">{d.team}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPP && (
                            <span className="text-[8px] tracking-wider font-bold text-[#E8002D] bg-[#E8002D]/10 px-2 py-0.5 rounded">
                              x2
                            </span>
                          )}
                          {isBoostTarget && (
                            <span className="text-[8px] tracking-wider font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                              x3
                            </span>
                          )}
                          {isSesto && (
                            <span className="text-[8px] tracking-wider font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                              6°
                            </span>
                          )}
                          <div className="font-[family-name:var(--font-jetbrains)] text-xs font-bold" style={{ color }}>
                            {d.price}
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-white/20 text-sm text-center py-4">Nessuna formazione confermata</div>
                  )}
                </div>
              </div>

              {/* Chip piloti */}
              {playerModal.chipPiloti && (
                <div>
                  <div className="text-[9px] tracking-[3px] text-white/40 uppercase font-bold mb-2">Chip Piloti</div>
                  <div className="inline-flex items-center gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
                    <span className="text-sm">{CHIP_LABELS[playerModal.chipPiloti]?.icon || "🔧"}</span>
                    <span className="text-xs font-bold text-amber-400">
                      {CHIP_LABELS[playerModal.chipPiloti]?.label || playerModal.chipPiloti}
                    </span>
                  </div>
                </div>
              )}

              {/* Previsioni */}
              <div>
                <div className="text-[9px] tracking-[3px] text-[#E8002D] uppercase font-bold mb-3">Previsioni</div>
                {playerModal.previsioni ? (
                  <div className="grid grid-cols-2 gap-2">
                    {PREVISIONI_LABELS.map(({ key, label }) => {
                      const val = playerModal.previsioni![key as keyof typeof playerModal.previsioni];
                      const isChipTarget = playerModal.chipPrevisioniTarget === key;
                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between p-2.5 rounded-lg border ${
                            isChipTarget
                              ? "border-amber-400/30 bg-amber-400/5"
                              : "border-white/[0.06] bg-white/[0.02]"
                          }`}
                        >
                          <span className="text-[11px] text-white/50">{label}</span>
                          <span className={`font-[family-name:var(--font-jetbrains)] text-xs font-bold ${
                            key === "numero_dnf"
                              ? "text-white"
                              : val === true
                              ? "text-green-400"
                              : val === false
                              ? "text-red-400"
                              : "text-white/20"
                          }`}>
                            {key === "numero_dnf"
                              ? (val !== null ? val : "—")
                              : val === true
                              ? "SÌ"
                              : val === false
                              ? "NO"
                              : "—"
                            }
                            {isChipTarget && (
                              <span className="ml-1 text-amber-400">
                                {playerModal.chipPrevisioni === "doppia" ? "x2" : "✓"}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-white/20 text-sm text-center py-4">Nessuna previsione confermata</div>
                )}
              </div>

              {/* Chip previsioni */}
              {playerModal.chipPrevisioni && (
                <div>
                  <div className="text-[9px] tracking-[3px] text-white/40 uppercase font-bold mb-2">Chip Previsioni</div>
                  <div className="inline-flex items-center gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
                    <span className="text-sm">{CHIP_LABELS[playerModal.chipPrevisioni]?.icon || "🔧"}</span>
                    <span className="text-xs font-bold text-amber-400">
                      {CHIP_LABELS[playerModal.chipPrevisioni]?.label || playerModal.chipPrevisioni}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

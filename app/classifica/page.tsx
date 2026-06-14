"use client";
import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useLeghe, useClassificaLega, useLegaPreferita } from "../lib/store";
import { useAuth } from "../lib/auth";
import { createClient, isSupabaseConfigured } from "../lib/supabase";
import { getDriverByNumber } from "../lib/drivers-data";
import { ChevronDown, X, Eye, Zap, Shield, Users } from "lucide-react";
import { RACES_2026, getRaceByRound, isAfterDeadline, getCurrentRound } from "../lib/races";
import { useProvisionalScores } from "../lib/provisional-scores";
import {
  calcolaPuntiWeekend,
  type RaceWeekendResults,
  type PilotaDettaglio,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "../lib/scoring";

const LEGA_GENERALE_ID = "00000000-0000-0000-0000-000000000001";

export default function ClassificaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050507] text-white bg-grid flex items-center justify-center">
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
  // Score calcolato (se weekend_results disponibili)
  score: {
    pilotiPoints: number;
    previsioniPoints: number;
    penalitaCambi: number;
    total: number;
    pilotiDettaglio: (PilotaDettaglio & { name: string })[];
    previsioniDettaglio: Record<string, number>;
  } | null;
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

const PREVISIONE_SCORE_LABELS: Record<string, string> = {
  safetyCar: "Safety Car",
  virtualSafetyCar: "Virtual SC",
  redFlag: "Red Flag",
  gommeWet: "Gomme Wet",
  poleVince: "Pole vince",
  numeroDnf: "N° DNF",
};

function ClassificaContent() {
  const searchParams = useSearchParams();
  const legaParam = searchParams.get("lega");
  const { user } = useAuth();
  const { leghe, loaded: legheLoaded } = useLeghe();
  const { legaId: legaPreferita, loaded: legaPrefLoaded } = useLegaPreferita();
  const defaultLega = legaParam || (legaPrefLoaded ? legaPreferita : LEGA_GENERALE_ID);
  const [selectedLega, setSelectedLega] = useState(defaultLega);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [playerModal, setPlayerModal] = useState<PlayerSquadData | null>(null);
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Imposta la lega preferita come default (una sola volta al mount, quando le
  // preferenze async sono caricate). Init di stato intenzionale e una-tantum.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialized) return;
    if (!legaPrefLoaded) return;
    if (legaParam) {
      setSelectedLega(legaParam);
    } else {
      setSelectedLega(legaPreferita);
    }
    setInitialized(true);
  }, [legaParam, legaPreferita, legaPrefLoaded, initialized]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { classifica: rawClassifica, loading } = useClassificaLega(selectedLega, selectedRound);
  const currentLega = leghe.find((l) => l.id === selectedLega);
  const currentRound = getCurrentRound();
  // La classifica generale NON mostra il punteggio in tempo reale: durante una
  // sessione live resta al provvisorio di fine sessione (e agli ufficiali post-gara).
  // La classifica live in tempo reale vive nel tab Live di /gara.
  const { provisional } = useProvisionalScores(false, currentRound);

  // Classifica con punti provvisori (fine sessione) aggiunti
  const hasProvisionalData = !!provisional && !selectedRound;

  const classifica = useMemo(() => {
    if (selectedRound) return rawClassifica;

    // Punti provvisori (ultima sessione conclusa, risultati non ancora ufficiali)
    if (hasProvisionalData && provisional) {
      const provMap = new Map<string, number>();
      for (const s of provisional.scores) provMap.set(s.userId, s.points);

      return rawClassifica.map((entry) => {
        const provBonus = provMap.get(entry.user_id) || 0;
        return { ...entry, total_points: entry.total_points + provBonus, last_weekend_points: provBonus };
      }).sort((a, b) => b.total_points - a.total_points);
    }

    return rawClassifica;
  }, [rawClassifica, hasProvisionalData, provisional, selectedRound]);

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

    const [formRes, prevRes, wrRes, cambiRes] = await Promise.all([
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
      supabase
        .from("weekend_results")
        .select("data")
        .eq("round", selectedRound)
        .single(),
      supabase
        .from("mercato_cambi")
        .select("id")
        .eq("user_id", entry.user_id)
        .eq("round", selectedRound),
    ]);

    const form = formRes.data;
    const prev = prevRes.data;
    const weekendResults: RaceWeekendResults | null = wrRes.data?.data ?? null;
    const driverNumbers = form?.driver_numbers ? (form.driver_numbers as number[]).map(Number) : [];
    const numCambi = (cambiRes.data || []).length;
    const isWildcard = form?.chip_piloti === "wildcard";
    const penalitaCambi = isWildcard ? 0 : Math.max(0, numCambi - 2) * 10;

    // Calcola score se ci sono risultati e formazione
    let score: PlayerSquadData["score"] = null;
    if (weekendResults && driverNumbers.length > 0) {
      const chipPiloti: ChipPilotiConfig = {
        chipPiloti: form?.chip_piloti ?? null,
        chipPilotiTarget: form?.chip_piloti_target ?? null,
        sestoUomo: form?.sesto_uomo ?? null,
      };
      const garaCalcolata = weekendResults.race.length > 0;
      const previsioniPerCalcolo = garaCalcolata && prev ? {
        safetyCar: prev.safety_car,
        virtualSafetyCar: prev.virtual_safety_car,
        redFlag: prev.red_flag,
        gommeWet: prev.gomme_wet,
        poleVince: prev.pole_vince,
        numeroDnf: prev.numero_dnf,
      } : {
        safetyCar: null, virtualSafetyCar: null, redFlag: null,
        gommeWet: null, poleVince: null, numeroDnf: null,
      };
      const chipPrevisioni: ChipPrevisioniConfig = garaCalcolata && prev
        ? { chipAttivo: prev.chip_attivo || null, chipTarget: prev.chip_target || null }
        : { chipAttivo: null, chipTarget: null };

      const calc = calcolaPuntiWeekend(driverNumbers, form?.primo_pilota ?? null, previsioniPerCalcolo, weekendResults, chipPiloti, chipPrevisioni);
      score = {
        pilotiPoints: calc.pilotiPoints,
        previsioniPoints: calc.previsioniPoints,
        penalitaCambi,
        total: calc.total - penalitaCambi,
        pilotiDettaglio: calc.pilotiDettaglio.map((d) => ({
          ...d,
          name: getDriverByNumber(d.driver_number)?.name || `#${d.driver_number}`,
        })),
        previsioniDettaglio: calc.previsioniDettaglio,
      };
    }

    setPlayerModal({
      userId: entry.user_id,
      teamPrincipalName: entry.team_principal_name,
      scuderiaName: entry.scuderia_name,
      driverNumbers,
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
      score,
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
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        <div className="mb-5">
          <div className="font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[2.5px] text-[#E8002D] uppercase font-bold mb-1.5">
            RANKING · STAGIONE 2026
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[28px] font-extrabold tracking-[-0.8px] leading-none">
              Classifica
            </h1>
            {hasProvisionalData && !selectedRound && (
              <span className="font-[family-name:var(--font-jetbrains)] inline-flex items-center bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-1 rounded text-[9px] font-bold tracking-[1.5px]">
                PROVVISORIO
              </span>
            )}
          </div>
        </div>

        {/* Selettore lega */}
        {legheLoaded && leghe.length > 0 && (
          <div className="mb-3">
            <div className="hud-label mb-1.5">LEGA</div>
            <div className="relative">
              <select
                value={selectedLega}
                onChange={(e) => { setSelectedLega(e.target.value); setSelectedRound(null); }}
                className="w-full bg-[#0e0e14] border border-[#1c1c26] rounded px-4 py-3 text-white text-[13px] font-bold font-[family-name:var(--font-jetbrains)] tracking-[0.3px] outline-none focus:border-[#E8002D]/50 appearance-none pr-10"
              >
                {leghe.map((l) => (
                  <option key={l.id} value={l.id} className="bg-[#050507]">
                    {l.name} (R{l.round_start}–R{l.round_end})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E8002D] pointer-events-none" />
            </div>
            {currentLega && !currentLega.is_generale && (
              <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/30 mt-2 px-1 tracking-[0.5px] uppercase">
                R{currentLega.round_start} → R{currentLega.round_end} · {currentLega.is_public ? "PUBBLICA" : "PRIVATA"}
              </div>
            )}
          </div>
        )}

        {/* Filtro round */}
        <div className="mb-5">
          <div className="hud-label mb-1.5">ROUND</div>
          <div className="relative">
            <select
              value={selectedRound ?? ""}
              onChange={(e) => setSelectedRound(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-[#0e0e14] border border-[#1c1c26] rounded px-4 py-3 text-white text-[13px] font-bold font-[family-name:var(--font-jetbrains)] tracking-[0.3px] outline-none focus:border-[#E8002D]/50 appearance-none pr-10"
            >
              <option value="" className="bg-[#050507]">STAGIONE COMPLETA</option>
              {availableRounds.map((race) => (
                <option key={race.round} value={race.round} className="bg-[#050507]">
                  R{race.round} — {race.flag} {race.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E8002D] pointer-events-none" />
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
              <div className="grid grid-cols-3 gap-2 mb-6 items-end">
                {[classifica[1], classifica[0], classifica[2]].map((entry, i) => {
                  const podiumPos = [2, 1, 3][i];
                  const heights = ["h-24", "h-32", "h-20"];
                  const colors = ["text-gray-300", "text-[#E8002D]", "text-amber-600"];
                  const labels = ["SILVER", "GOLD", "BRONZE"];
                  return (
                    <div key={entry.user_id} className="flex flex-col items-center">
                      <div className="text-[11px] font-bold text-white/70 mb-0.5 truncate max-w-full">{entry.team_principal_name}</div>
                      <div className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/30 mb-2 truncate max-w-full tracking-[0.5px] uppercase">{entry.scuderia_name}</div>
                      <div
                        className={`w-full ${heights[i]} bg-[#0e0e14] border border-[#1c1c26] ${i === 1 ? "border-[#E8002D]/30 shadow-[0_-2px_24px_rgba(232,0,45,0.15)]" : ""} rounded-t flex flex-col items-center justify-center relative`}
                      >
                        <div className="font-[family-name:var(--font-jetbrains)] text-[8px] tracking-[2px] text-white/30 absolute top-1.5">{labels[i]}</div>
                        <div className={`text-[34px] font-extrabold font-[family-name:var(--font-jetbrains)] ${colors[i]} leading-none`}>
                          {podiumPos}
                        </div>
                        <div className="font-[family-name:var(--font-jetbrains)] text-[13px] font-extrabold mt-1.5 tabular-nums">
                          {entry.total_points}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tabella completa */}
            <div className="hud-card overflow-hidden">
              <div className={`grid ${selectedRound ? "grid-cols-[44px_1fr_auto_auto_auto]" : "grid-cols-[44px_1fr_auto_auto]"} gap-3 px-3.5 py-2.5 hud-label border-b border-[#1c1c26]`}>
                <span>POS</span>
                <span>TEAM PRINCIPAL</span>
                {selectedRound && <span className="text-right">PILOTI</span>}
                {selectedRound && <span className="text-right">PREV</span>}
                {!selectedRound && <span className="text-right">WEEKEND</span>}
                <span className="text-right">{selectedRound ? "TOT" : "TOTALE"}</span>
              </div>

              {classifica.map((entry, i) => {
                const leaderPoints = classifica[0]?.total_points ?? 0;
                const previousPoints = i > 0 ? classifica[i - 1].total_points : null;
                const gapLeader = i === 0 ? null : entry.total_points - leaderPoints; // negativo
                const gapPrev = previousPoints === null ? null : entry.total_points - previousPoints; // negativo o 0
                return (
                <div
                  key={entry.user_id}
                  onClick={() => canViewSquads ? openPlayerModal(entry) : undefined}
                  className={`grid ${selectedRound ? "grid-cols-[44px_1fr_auto_auto_auto]" : "grid-cols-[44px_1fr_auto_auto]"} gap-3 px-3.5 py-3 items-center transition-colors hover:bg-white/[0.025] ${
                    i < classifica.length - 1 ? "border-b border-[#1c1c26]" : ""
                  } ${canViewSquads ? "cursor-pointer active:bg-white/[0.05]" : ""} ${i === 0 ? "bg-[#E8002D]/[0.04]" : ""}`}
                >
                  <div className="flex flex-col items-start">
                    <span
                      className={`font-[family-name:var(--font-jetbrains)] font-extrabold text-[15px] tabular-nums leading-none ${
                        i === 0 ? "text-[#E8002D]" : i < 3 ? "text-white" : "text-white/30"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {gapLeader !== null && !selectedRound && (
                      <span className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/25 tabular-nums mt-1 tracking-[-0.3px]">
                        {gapLeader}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold truncate leading-tight">{entry.team_principal_name}</div>
                      <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/30 truncate tracking-[0.5px] uppercase mt-0.5">{entry.scuderia_name}</div>
                    </div>
                    {canViewSquads && (
                      <Eye size={12} className="text-white/15 shrink-0" />
                    )}
                  </div>
                  {selectedRound ? (
                    <>
                      <div className="text-right">
                        <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/40 tabular-nums">
                          {entry.piloti_points}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/40 tabular-nums">
                          {entry.previsioni_points}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-right">
                      <span className={`font-[family-name:var(--font-jetbrains)] text-[11px] font-bold tabular-nums ${
                        hasProvisionalData ? "text-amber-400" : "text-white/40"
                      }`}>
                        +{entry.last_weekend_points}
                      </span>
                    </div>
                  )}
                  <div className="text-right flex flex-col items-end">
                    <span className="font-[family-name:var(--font-jetbrains)] font-extrabold text-[15px] tabular-nums leading-none">
                      {entry.total_points}
                    </span>
                    {gapPrev !== null && !selectedRound && (
                      <span className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/35 tabular-nums mt-1 tracking-[-0.3px]">
                        {gapPrev === 0 ? "= " : ""}{gapPrev}
                      </span>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </>
        )}
        {/* Hint: tap per vedere squadra */}
        {canViewSquads && classifica.length > 0 && (
          <div className="text-center mt-4 font-[family-name:var(--font-jetbrains)] text-[10px] text-white/20 flex items-center justify-center gap-1.5 tracking-[1px] uppercase">
            <Eye size={11} />
            Tocca un giocatore per la sua squadra
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

            <div className="px-5 py-4 space-y-4">
              {playerModal.score ? (
                <>
                  {/* Punteggio totale */}
                  <div className="bg-white/[0.03] border border-[#E8002D]/20 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold">Weekend R{selectedRound}</div>
                      <span className="font-[family-name:var(--font-jetbrains)] text-3xl font-black text-[#E8002D]">
                        {playerModal.score.total}
                      </span>
                    </div>

                    <div className={`grid ${playerModal.score.penalitaCambi > 0 ? "grid-cols-3" : "grid-cols-2"} gap-3 mb-4`}>
                      <div className="bg-black/20 rounded-lg p-3 text-center">
                        <div className="font-[family-name:var(--font-jetbrains)] text-lg font-bold">{playerModal.score.pilotiPoints}</div>
                        <div className="text-[8px] tracking-[2px] text-white/30 mt-0.5">PILOTI</div>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3 text-center">
                        <div className="font-[family-name:var(--font-jetbrains)] text-lg font-bold">{playerModal.score.previsioniPoints}</div>
                        <div className="text-[8px] tracking-[2px] text-white/30 mt-0.5">PREVISIONI</div>
                      </div>
                      {playerModal.score.penalitaCambi > 0 && (
                        <div className="bg-black/20 rounded-lg p-3 text-center">
                          <div className="font-[family-name:var(--font-jetbrains)] text-lg font-bold text-amber-400">-{playerModal.score.penalitaCambi}</div>
                          <div className="text-[8px] tracking-[2px] text-amber-400/50 mt-0.5">PENALITÀ</div>
                        </div>
                      )}
                    </div>

                    {/* Dettaglio piloti */}
                    <div className="hud-label mb-2">Dettaglio Piloti</div>
                    <div className="space-y-1 mb-4">
                      {playerModal.score.pilotiDettaglio.map((d) => {
                        const color = getDriverByNumber(d.driver_number)?.teamColour;
                        return (
                          <div key={d.driver_number} className="flex items-center justify-between text-sm bg-white/[0.02] rounded-lg px-3 py-2">
                            <span className="flex items-center gap-2">
                              {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `#${color}` }} />}
                              <span className={d.moltiplicatore === 2 ? "text-[#E8002D] font-bold" : d.moltiplicatore === 3 ? "text-amber-400 font-bold" : d.isSestoUomo ? "text-blue-400" : "text-white/70"}>
                                {d.name}
                              </span>
                              {d.moltiplicatore === 2 && <span className="text-[9px] text-[#E8002D]/60">x2</span>}
                              {d.moltiplicatore === 3 && <Zap size={11} className="text-amber-400" />}
                              {d.isSestoUomo && <Users size={11} className="text-blue-400" />}
                              {d.haloApplicato && <Shield size={11} className="text-green-400" />}
                            </span>
                            <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${d.puntiFinali > 0 ? "text-green-400" : d.puntiFinali < 0 ? "text-red-400" : "text-white/20"}`}>
                              {d.puntiFinali > 0 ? "+" : ""}{d.puntiFinali}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Dettaglio previsioni */}
                    <div className="hud-label mb-2">Dettaglio Previsioni</div>
                    <div className="space-y-1">
                      {Object.entries(playerModal.score.previsioniDettaglio).map(([key, pts]) => (
                        <div key={key} className="flex items-center justify-between text-sm bg-white/[0.02] rounded-lg px-3 py-2">
                          <span className="text-white/60">{PREVISIONE_SCORE_LABELS[key] || key}</span>
                          <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${pts > 0 ? "text-green-400" : "text-white/20"}`}>
                            {pts > 0 ? `+${pts}` : "0"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chip attivi */}
                  {(playerModal.chipPiloti || playerModal.chipPrevisioni) && (
                    <div className="flex flex-wrap gap-2">
                      {playerModal.chipPiloti && (
                        <div className="inline-flex items-center gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
                          <span className="text-sm">{CHIP_LABELS[playerModal.chipPiloti]?.icon || "🔧"}</span>
                          <span className="text-xs font-bold text-amber-400">
                            {CHIP_LABELS[playerModal.chipPiloti]?.label || playerModal.chipPiloti}
                          </span>
                        </div>
                      )}
                      {playerModal.chipPrevisioni && (
                        <div className="inline-flex items-center gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
                          <span className="text-sm">{CHIP_LABELS[playerModal.chipPrevisioni]?.icon || "🔧"}</span>
                          <span className="text-xs font-bold text-amber-400">
                            {CHIP_LABELS[playerModal.chipPrevisioni]?.label || playerModal.chipPrevisioni}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Pre-gara: mostra rosa e previsioni senza punti */}
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
                              isPP ? "border-[#E8002D]/40 bg-[#E8002D]/5"
                              : isBoostTarget ? "border-amber-400/40 bg-amber-400/5"
                              : isSesto ? "border-blue-400/30 bg-blue-400/5"
                              : "border-white/[0.06] bg-white/[0.02]"
                            }`}
                          >
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ backgroundColor: `${color}30`, color }}>
                              <span className="font-[family-name:var(--font-jetbrains)]">{num}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm truncate">{d.name}</div>
                              <div className="text-[10px] text-white/30">{d.team}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isPP && <span className="text-[8px] tracking-wider font-bold text-[#E8002D] bg-[#E8002D]/10 px-2 py-0.5 rounded">x2</span>}
                              {isBoostTarget && <span className="text-[8px] tracking-wider font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">x3</span>}
                              {isSesto && <span className="text-[8px] tracking-wider font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">6°</span>}
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="text-white/20 text-sm text-center py-4">Nessuna formazione confermata</div>
                      )}
                    </div>
                  </div>

                  {/* Previsioni pre-gara */}
                  <div>
                    <div className="text-[9px] tracking-[3px] text-[#E8002D] uppercase font-bold mb-3">Previsioni</div>
                    {playerModal.previsioni ? (
                      <div className="grid grid-cols-2 gap-2">
                        {PREVISIONI_LABELS.map(({ key, label }) => {
                          const val = playerModal.previsioni![key as keyof typeof playerModal.previsioni];
                          return (
                            <div key={key} className="flex items-center justify-between p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                              <span className="text-[11px] text-white/50">{label}</span>
                              <span className={`font-[family-name:var(--font-jetbrains)] text-xs font-bold ${
                                key === "numero_dnf" ? "text-white"
                                : val === true ? "text-green-400"
                                : val === false ? "text-red-400"
                                : "text-white/20"
                              }`}>
                                {key === "numero_dnf" ? (val !== null ? val : "—") : val === true ? "SÌ" : val === false ? "NO" : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-white/20 text-sm text-center py-4">Nessuna previsione confermata</div>
                    )}
                  </div>

                  {/* Chip */}
                  {(playerModal.chipPiloti || playerModal.chipPrevisioni) && (
                    <div className="flex flex-wrap gap-2">
                      {playerModal.chipPiloti && (
                        <div className="inline-flex items-center gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
                          <span className="text-sm">{CHIP_LABELS[playerModal.chipPiloti]?.icon || "🔧"}</span>
                          <span className="text-xs font-bold text-amber-400">{CHIP_LABELS[playerModal.chipPiloti]?.label || playerModal.chipPiloti}</span>
                        </div>
                      )}
                      {playerModal.chipPrevisioni && (
                        <div className="inline-flex items-center gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
                          <span className="text-sm">{CHIP_LABELS[playerModal.chipPrevisioni]?.icon || "🔧"}</span>
                          <span className="text-xs font-bold text-amber-400">{CHIP_LABELS[playerModal.chipPrevisioni]?.label || playerModal.chipPrevisioni}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

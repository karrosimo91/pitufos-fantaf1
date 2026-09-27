"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import CountryFlag from "../components/CountryFlag";
import { FormSpark } from "../components/rivali/FormSpark";
import { PlayerSeasonSheet, type SeasonRow } from "../components/rivali/PlayerSeasonSheet";
import { ChiHaChi, type MatrixPlayer } from "../components/rivali/ChiHaChi";
import { ClassificaWeekendList } from "../components/live/ClassificaWeekendList";
import { PlayerDetailModal } from "../components/live/PlayerDetailModal";
import { useLeghe, useClassificaLega, useLegaPreferita } from "../lib/store";
import { useAuth } from "../lib/auth";
import { useWeekend } from "../lib/weekend-context";
import { useStatistiche } from "../lib/use-statistiche";
import { useWeekendClassifica } from "../lib/use-weekend-classifica";
import { useProvisionalScores } from "../lib/provisional-scores";
import { RACES_2026, getRaceByRound, isAfterDeadline, LAST_ROUND } from "../lib/races";
import type { LiveSnapshot } from "../lib/build-live-results";
import { CHIP_PILOTI_RULES, CHIP_PREVISIONI_RULES, remainingChips } from "../lib/chip-rules";
import { ChevronDown, BarChart3, ChevronRight, Eye } from "lucide-react";

const LEGA_GENERALE_ID = "00000000-0000-0000-0000-000000000001";
const EMPTY_SNAP: LiveSnapshot = { positions: new Map(), raceControl: [], fastestLap: null, stints: [] };
const EMPTY_GRID = new Map<number, number>();

export default function ClassificaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050507] text-white bg-grid" />}>
      <RivaliContent />
    </Suspense>
  );
}

type Mode = "somma" | "reale";

function RivaliContent() {
  const searchParams = useSearchParams();
  const legaParam = searchParams.get("lega");
  const { user } = useAuth();
  const { round: currentRound, locked, recapRace } = useWeekend();
  const { leghe, loaded: legheLoaded } = useLeghe();
  const { legaId: legaPreferita, loaded: legaPrefLoaded } = useLegaPreferita();
  const [selectedLega, setSelectedLega] = useState<string>(legaParam || LEGA_GENERALE_ID);
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<Mode>("somma");
  const [viewRound, setViewRound] = useState<number | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [roundPlayer, setRoundPlayer] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialized || !legaPrefLoaded) return;
    setSelectedLega(legaParam || legaPreferita);
    setInitialized(true);
  }, [legaParam, legaPreferita, legaPrefLoaded, initialized]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const currentLega = leghe.find((l) => l.id === selectedLega);
  const roundStart = currentLega?.round_start ?? 1;
  const roundEnd = currentLega?.round_end ?? LAST_ROUND;
  const { classifica: totals, loading } = useClassificaLega(selectedLega, null);
  const stats = useStatistiche(selectedLega, roundStart, roundEnd);
  const { provisional } = useProvisionalScores(false, currentRound);

  // Round della matrice "chi ha chi": il corrente se chiuso, altrimenti l'ultimo concluso
  const matrixRound = locked ? currentRound : (recapRace?.round ?? stats.rounds[stats.rounds.length - 1] ?? null);

  const rows = useMemo<SeasonRow[]>(() => {
    const byId = new Map(stats.summaries.map((s) => [s.userId, s]));
    const seasonRows = totals.map((t, i) => {
      const s = byId.get(t.user_id);
      const sp = stats.season.get(t.user_id);
      // Chip rimasti nella metà stagione corrente (gli usi dell'altra metà non contano)
      // Solo round già chiusi: il chip scelto per il weekend in preparazione non si vede.
      const closedRound = (r: number) => { const race = getRaceByRound(r); return !!race && isAfterDeadline(race); };
      const usedPiloti = stats.formazioni.filter((f) => f.user_id === t.user_id && f.chip_piloti && closedRound(f.round)).map((f) => ({ chip: f.chip_piloti as string, round: f.round }));
      const usedPrev = stats.previsioni.filter((p) => p.user_id === t.user_id && p.chip_attivo && closedRound(p.round)).map((p) => ({ chip: p.chip_attivo as string, round: p.round }));
      const rosterForm = matrixRound ? stats.formazioni.find((f) => f.user_id === t.user_id && f.round === matrixRound) : undefined;
      return {
        userId: t.user_id,
        tpName: t.team_principal_name,
        scuderiaName: t.scuderia_name,
        points: t.total_points,
        realPoints: s?.realPoints ?? 0,
        position: i + 1,
        prevPosition: s?.prevPosition ?? null,
        gp: s?.gp ?? 0,
        wins: s?.wins ?? 0,
        podiums: s?.podiums ?? 0,
        best: s?.best ?? null,
        worst: s?.worst ?? null,
        avg: s?.avg ?? null,
        perRound: sp ? sp.perRound.map((r) => (r ? Number(r.total_points) : null)) : [],
        chipsPiloti: remainingChips(CHIP_PILOTI_RULES, usedPiloti, currentRound).map((c) => c.id),
        chipsPrevisioni: remainingChips(CHIP_PREVISIONI_RULES, usedPrev, currentRound).map((c) => c.id),
        roster: rosterForm && matrixRound && (locked || matrixRound !== currentRound)
          ? { drivers: (rosterForm.driver_numbers ?? []).map(Number), captain: rosterForm.primo_pilota, round: matrixRound }
          : null,
      };
    });
    if (mode === "reale") {
      return [...seasonRows].sort((a, b) => b.realPoints - a.realPoints || b.points - a.points).map((r, i) => ({ ...r, position: i + 1 }));
    }
    return seasonRows;
  }, [totals, stats.summaries, stats.season, stats.formazioni, stats.previsioni, matrixRound, locked, currentRound, mode]);

  const me = user ? rows.find((r) => r.userId === user.id) ?? null : null;
  const leader = rows[0] ?? null;
  const ahead = me && me.position > 1 ? rows[me.position - 2] : null;
  const behind = me && me.position < rows.length ? rows[me.position] : null;
  const provMine = user && provisional ? provisional.scores.find((s) => s.userId === user.id) ?? null : null;

  const matrixPlayers = useMemo<MatrixPlayer[]>(() => {
    if (!matrixRound) return [];
    if (matrixRound === currentRound && !locked) return [];
    const memberIds = new Set(totals.map((t) => t.user_id));
    return stats.formazioni
      .filter((f) => f.round === matrixRound && memberIds.has(f.user_id))
      .map((f) => ({ userId: f.user_id, name: totals.find((t) => t.user_id === f.user_id)?.team_principal_name ?? "—", drivers: (f.driver_numbers ?? []).map(Number), captain: f.primo_pilota, isMe: f.user_id === user?.id }))
      .sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : a.name.localeCompare(b.name)));
  }, [stats.formazioni, matrixRound, currentRound, locked, totals, user?.id]);

  const availableRounds = RACES_2026.filter((r) => r.round >= roundStart && r.round <= roundEnd && isAfterDeadline(r) && stats.rounds.includes(r.round)).map((r) => r.round).sort((a, b) => b - a);
  const sheetRow = sheet ? rows.find((r) => r.userId === sheet) ?? null : null;

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-5 pb-bottomnav">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <div className="hud-label text-[#E8002D] mb-1">RIVALI · STAGIONE 2026</div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.6px] leading-none">Classifica</h1>
          </div>
          <Link href="/statistiche" className="btn-secondary py-2 px-3 text-[10px]"><BarChart3 size={12} /> STATISTICHE</Link>
        </div>

        {legheLoaded && leghe.length > 1 && (
          <div className="relative mb-3">
            <select
              value={selectedLega}
              onChange={(e) => { setSelectedLega(e.target.value); setViewRound(null); }}
              className="w-full bg-[#0e0e14] border border-[#1c1c26] rounded px-4 py-2.5 text-white text-[13px] font-bold font-[family-name:var(--font-jetbrains)] outline-none appearance-none pr-10"
            >
              {leghe.map((l) => <option key={l.id} value={l.id} className="bg-[#050507]">{l.name} (R{l.round_start}–R{l.round_end})</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
          </div>
        )}

        {/* Rail round */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-3">
          <button onClick={() => setViewRound(null)} className={`pill shrink-0 ${viewRound === null ? "border-white/60 text-white bg-white/[0.08]" : ""}`}>STAGIONE</button>
          {availableRounds.map((r) => {
            const race = getRaceByRound(r);
            return (
              <button key={r} onClick={() => setViewRound(r)} className={`pill shrink-0 ${viewRound === r ? "border-white/60 text-white bg-white/[0.08]" : ""}`}>
                {race && <CountryFlag countryCode={race.countryCode} size={10} />} R{r}
              </button>
            );
          })}
        </div>

        {viewRound === null ? (
          <>
            {/* Toggle somma / reale */}
            <div className="flex gap-1 mb-3">
              {([["somma", "SOMMA PUNTI"], ["reale", "CLASSIFICA REALE"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setMode(id)}
                  className={`flex-1 py-2 rounded font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1px] font-bold border tap ${mode === id ? "bg-white/[0.08] border-white/45 text-white" : "bg-[#0e0e14] border-[#1c1c26] text-white/55"}`}>
                  {label}
                </button>
              ))}
            </div>
            {mode === "reale" && (
              <div className="text-[12px] text-white/55 mb-3">Ogni weekend i primi 10 prendono 25-18-15-12-10-8-6-4-2-1, come in F1. Somma dei weekend calcolati.</div>
            )}

            {/* Hero: la mia riga */}
            {me && (
              <div className="hud-card hud-card-accent p-4 mb-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="hud-label mb-1">TU · {me.tpName.toUpperCase()}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-[family-name:var(--font-jetbrains)] text-[34px] font-extrabold tabular-nums leading-none">{me.position}°</span>
                      <span className="text-[13px] text-white/55">su {rows.length}</span>
                      {me.prevPosition && me.prevPosition !== me.position && (
                        <span className={`font-[family-name:var(--font-jetbrains)] text-[12px] font-bold ${me.prevPosition > me.position ? "text-[#2ee59d]" : "text-[#E8002D]"}`}>{me.prevPosition > me.position ? "▲" : "▼"} {Math.abs(me.prevPosition - me.position)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-[family-name:var(--font-jetbrains)] text-[26px] font-extrabold tabular-nums leading-none">{mode === "reale" ? me.realPoints : me.points}</div>
                    <div className="hud-label mt-1">{mode === "reale" ? "PUNTI REALE" : "PUNTI"}</div>
                  </div>
                </div>
                <div className="text-[13px] text-white/80 mt-3">
                  {ahead ? <><span className="text-[#E8002D] font-bold">−{(mode === "reale" ? ahead.realPoints - me.realPoints : ahead.points - me.points)}</span> da {ahead.tpName}</> : <span className="text-[#2ee59d] font-bold">Sei in testa</span>}
                  {behind && <><span className="text-white/50"> · </span><span className="text-[#2ee59d] font-bold">+{(mode === "reale" ? me.realPoints - behind.realPoints : me.points - behind.points)}</span> su {behind.tpName}</>}
                  {leader && ahead && leader.userId !== ahead.userId && <><span className="text-white/50"> · </span>−{(mode === "reale" ? leader.realPoints - me.realPoints : leader.points - me.points)} dal leader</>}
                </div>
                {provMine && mode === "somma" && (
                  <div className="text-[12px] text-[#ffb000] mt-1">Weekend in corso: {provMine.points > 0 ? "+" : ""}{provMine.points} provvisori, non ancora in classifica</div>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <span className="hud-label">FORMA</span>
                  <FormSpark values={me.perRound.slice(-6)} />
                </div>
              </div>
            )}

            {/* Tabella */}
            {loading && rows.length === 0 ? (
              <div className="space-y-2"><div className="skeleton h-14" /><div className="skeleton h-14" /><div className="skeleton h-14" /></div>
            ) : rows.length === 0 ? (
              <div className="hud-card p-6 text-center text-[13px] text-white/55">Nessun giocatore in questa lega.</div>
            ) : (
              <div className="hud-card overflow-hidden">
                {rows.map((r, i) => {
                  const isMe = r.userId === user?.id;
                  const value = mode === "reale" ? r.realPoints : r.points;
                  const gapMe = me && !isMe ? value - (mode === "reale" ? me.realPoints : me.points) : null;
                  const delta = r.prevPosition && r.prevPosition !== r.position ? r.prevPosition - r.position : 0;
                  return (
                    <button key={r.userId} onClick={() => setSheet(r.userId)} className={`w-full flex items-center gap-3 px-3.5 py-3 text-left tap ${i < rows.length - 1 ? "border-b border-[#1c1c26]" : ""} ${isMe ? "bg-white/[0.04]" : ""}`}>
                      <div className="w-8 shrink-0">
                        <div className={`font-[family-name:var(--font-jetbrains)] font-extrabold text-[16px] tabular-nums leading-none ${i === 0 ? "text-[#E8002D]" : "text-white"}`}>{r.position}</div>
                        {delta !== 0 && <div className={`font-[family-name:var(--font-jetbrains)] text-[10px] mt-0.5 ${delta > 0 ? "text-[#2ee59d]" : "text-[#E8002D]"}`}>{delta > 0 ? "▲" : "▼"}{Math.abs(delta)}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold truncate">{r.tpName}{isMe ? " · tu" : ""}</div>
                        <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/50 uppercase tracking-[0.3px] truncate">{r.scuderiaName}</div>
                      </div>
                      <FormSpark values={r.perRound.slice(-5)} />
                      <div className="text-right w-16 shrink-0">
                        <div className="font-[family-name:var(--font-jetbrains)] font-extrabold text-[16px] tabular-nums leading-none">{value}</div>
                        {gapMe !== null && <div className={`font-[family-name:var(--font-jetbrains)] text-[10px] mt-0.5 tabular-nums ${gapMe > 0 ? "text-[#E8002D]" : "text-[#2ee59d]"}`}>{gapMe > 0 ? `+${gapMe}` : gapMe} vs te</div>}
                      </div>
                      <ChevronRight size={14} className="text-white/50 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Chi ha chi */}
            <div className="mt-5">
              <button onClick={() => setShowMatrix((v) => !v)} className="w-full flex items-center justify-between mb-2">
                <h3 className="section-marker">Chi ha chi</h3>
                <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 flex items-center gap-1"><Eye size={12} /> {showMatrix ? "NASCONDI" : "MOSTRA"}</span>
              </button>
              {showMatrix && (
                <ChiHaChi players={matrixPlayers} roundLabel={matrixRound ? `R${matrixRound} ${getRaceByRound(matrixRound)?.circuit ?? ""}` : "—"} />
              )}
            </div>
          </>
        ) : (
          <RoundView round={viewRound} legaId={selectedLega} userId={user?.id} onSelect={setRoundPlayer} selected={roundPlayer} onClose={() => setRoundPlayer(null)} />
        )}
      </main>

      {sheetRow && <PlayerSeasonSheet row={sheetRow} me={me} rounds={stats.rounds} onClose={() => setSheet(null)} />}
      <BottomNav />
    </div>
  );
}

/** Classifica di un singolo round con dettaglio al tocco e link al recap. */
function RoundView({ round, legaId, userId, onSelect, selected, onClose }: { round: number; legaId: string; userId?: string; onSelect: (id: string) => void; selected: string | null; onClose: () => void }) {
  const data = useWeekendClassifica({ round, sessionType: "", sessionKey: null, legaId, userId });
  const race = getRaceByRound(round);
  const selectedForm = selected ? data.formazioni.find((f) => f.user_id === selected) : null;
  const selectedEntry = selected ? data.classifica.find((c) => c.userId === selected) : null;
  if (!data.previousLoaded) return <div className="space-y-2"><div className="skeleton h-14" /><div className="skeleton h-14" /></div>;
  return (
    <div>
      <Link href={`/risultati?round=${round}`} className="flex items-center gap-3 hud-card hud-card-accent p-3.5 mb-3 tap">
        <div className="flex-1 text-[13px] font-bold">Recap di {race?.circuit ?? `R${round}`}: scontrino, rimpianti, condividi</div>
        <ChevronRight size={16} className="text-white/45" />
      </Link>
      {data.classifica.length === 0 ? (
        <div className="hud-card p-6 text-center text-[13px] text-white/55">Nessun punteggio per questo round.</div>
      ) : (
        <ClassificaWeekendList classifica={data.classifica} onSelect={onSelect} />
      )}
      {selectedForm && selectedEntry && (
        <PlayerDetailModal
          player={selectedForm}
          entry={selectedEntry}
          previsioniRow={data.previsioniByUser.get(selectedForm.user_id)}
          snap={EMPTY_SNAP}
          gridPositions={EMPTY_GRID}
          previousResults={data.previousResults}
          sessionType=""
          penalitaCambi={data.penalitaByUser.get(selectedForm.user_id) ?? 0}
          onClose={onClose}
        />
      )}
    </div>
  );
}

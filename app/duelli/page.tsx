"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Trophy } from "lucide-react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { DuelliLive } from "../components/live/DuelliLive";
import { LivePill } from "../components/ui/LivePill";
import { useLeghe, useLegaPreferita } from "../lib/store";
import { useAuth } from "../lib/auth";
import { useWeekend } from "../lib/weekend-context";
import { useStatistiche } from "../lib/use-statistiche";
import { useWeekendClassifica } from "../lib/use-weekend-classifica";
import { useClassificaGeneraleLive } from "../lib/use-classifica-generale-live";
import { buildDuelloStorico, type DuelloLive } from "../lib/classifica-generale-live";
import { getRaceByRound, LAST_ROUND } from "../lib/races";

const LEGA_GENERALE_ID = "00000000-0000-0000-0000-000000000001";
const EMPTY_POINTS = new Map<string, number>();

export default function DuelliPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050507] text-white bg-grid" />}>
      <DuelliContent />
    </Suspense>
  );
}

/**
 * Pagina dei duelli: testa a testa fra posizioni adiacenti della Classifica
 * Generale della lega. Durante una sessione live il weekend in corso è
 * sommato in tempo reale; a formazione chiusa senza sessione valgono le
 * sessioni già in archivio; fuori dal weekend è la classifica di stagione.
 * Ogni duello porta anche il bilancio stagionale fra i due.
 */
function DuelliContent() {
  const searchParams = useSearchParams();
  const legaParam = searchParams.get("lega");
  const { user } = useAuth();
  const { round, race, locked, live } = useWeekend();
  const { leghe, loaded: legheLoaded } = useLeghe();
  const { legaId: legaPreferita, loaded: legaPrefLoaded } = useLegaPreferita();
  const [selectedLega, setSelectedLega] = useState<string>(legaParam || LEGA_GENERALE_ID);
  const [initialized, setInitialized] = useState(false);

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
  const stats = useStatistiche(selectedLega, roundStart, roundEnd);

  // Weekend in corso: live (WebSocket) se c'è una sessione, altrimenti le
  // sessioni in archivio del round. Solo a formazione chiusa: prima
  // rivelerebbe i punti del weekend degli altri.
  const session = live.session;
  const weekend = useWeekendClassifica({
    round,
    sessionType: session?.sessionName ?? "",
    sessionKey: session?.sessionKey ?? null,
    meetingKey: session?.meetingKey,
    legaId: selectedLega,
    userId: user?.id,
  });
  const weekendPoints = useMemo(() => {
    if (!locked) return EMPTY_POINTS;
    const m = new Map<string, number>();
    for (const c of weekend.classifica) m.set(c.userId, c.points);
    return m;
  }, [locked, weekend.classifica]);
  const weekendAttivo = locked && weekendPoints.size > 0;

  const generale = useClassificaGeneraleLive({ legaId: selectedLega, round, liveWeekendPoints: weekendPoints, userId: user?.id });

  const storico = useMemo(() => {
    const rounds = stats.rounds;
    const season = stats.season;
    return (d: DuelloLive) => {
      const a = season.get(d.ahead.userId);
      const b = season.get(d.behind.userId);
      if (!a || !b || rounds.length === 0) return null;
      return buildDuelloStorico(
        rounds,
        a.perRound.map((r) => (r ? Number(r.total_points) : null)),
        b.perRound.map((r) => (r ? Number(r.total_points) : null)),
      );
    };
  }, [stats.rounds, stats.season]);

  const me = user ? generale.rows.find((r) => r.userId === user.id) ?? null : null;
  const ahead = me && me.position > 1 ? generale.rows[me.position - 2] : null;
  const behind = me && me.position < generale.rows.length ? generale.rows[me.position] : null;
  const stato = live.isLive && locked
    ? `${race.circuit} · ${session?.sessionName ?? "sessione"} in corso`
    : weekendAttivo
      ? `${race.circuit} · sessioni in archivio`
      : "Classifica di stagione";

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-5 pb-bottomnav">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <div className="hud-label text-[#E8002D] mb-1">RIVALI · DUELLI</div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.6px] leading-none">Testa a testa</h1>
          </div>
          <Link href={`/classifica?lega=${selectedLega}`} className="btn-secondary py-2 px-3 text-[10px]"><Trophy size={12} /> CLASSIFICA</Link>
        </div>

        {legheLoaded && leghe.length > 1 && (
          <div className="relative mb-3">
            <select
              value={selectedLega}
              onChange={(e) => setSelectedLega(e.target.value)}
              className="w-full bg-[#0e0e14] border border-[#1c1c26] rounded px-4 py-2.5 text-white text-[13px] font-bold font-[family-name:var(--font-jetbrains)] outline-none appearance-none pr-10"
            >
              {leghe.map((l) => <option key={l.id} value={l.id} className="bg-[#050507]">{l.name} (R{l.round_start}–R{l.round_end})</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
          </div>
        )}

        <div className="flex items-center gap-2 mb-3 text-[12px] text-white/55">
          {live.isLive && locked && <LivePill />}
          <span>{stato}</span>
        </div>

        {me && (
          <div className="hud-card hud-card-accent p-4 mb-3">
            <div className="hud-label mb-1">TU · {me.tpName.toUpperCase()}</div>
            <div className="flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-jetbrains)] text-[34px] font-extrabold tabular-nums leading-none">{me.position}°</span>
              <span className="text-[13px] text-white/55">su {generale.rows.length}</span>
              {me.positionBefore !== me.position && (
                <span className={`font-[family-name:var(--font-jetbrains)] text-[12px] font-bold ${me.positionBefore > me.position ? "text-[#2ee59d]" : "text-[#E8002D]"}`}>
                  {me.positionBefore > me.position ? "▲" : "▼"} {Math.abs(me.positionBefore - me.position)} nel weekend
                </span>
              )}
            </div>
            <div className="text-[13px] text-white/80 mt-3">
              {ahead ? <><span className="text-[#E8002D] font-bold">−{ahead.total - me.total}</span> da {ahead.tpName}</> : <span className="text-[#2ee59d] font-bold">Sei in testa</span>}
              {behind && <><span className="text-white/50"> · </span><span className="text-[#2ee59d] font-bold">+{me.total - behind.total}</span> su {behind.tpName}</>}
            </div>
          </div>
        )}

        <DuelliLive
          duelli={generale.duelli}
          loading={generale.loading}
          weekendAttivo={weekendAttivo}
          storico={storico}
          title={weekendAttivo ? `Duelli · ${getRaceByRound(round)?.circuit ?? `R${round}`}` : "Duelli · stagione"}
        />

        {stats.rounds.length > 0 && (
          <div className="text-[12px] text-white/45 mb-4">
            Storico su {stats.rounds.length} weekend calcolati. Nei chip R{"n"} A–B: punti del weekend di chi precede e di chi insegue; rosso se ha vinto chi precede, verde chi insegue.
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import CountryFlag from "../components/CountryFlag";
import { WeekendRecap } from "../components/recap/WeekendRecap";
import { ClassificaWeekendList } from "../components/live/ClassificaWeekendList";
import { PlayerDetailModal } from "../components/live/PlayerDetailModal";
import { FormazioniSvelate } from "../components/live/FormazioniSvelate";
import { useAuth } from "../lib/auth";
import { useLeghe, useLegaPreferita } from "../lib/store";
import { useWeekendClassifica } from "../lib/use-weekend-classifica";
import { useAllWeekendResults } from "../lib/use-weekend-results";
import { useDriverPrices } from "../lib/use-driver-prices";
import { useProvisionalScores } from "../lib/provisional-scores";
import { getRaceByRound, RACES_2026 } from "../lib/races";
import type { LiveSnapshot } from "../lib/build-live-results";

const EMPTY_SNAP: LiveSnapshot = { positions: new Map(), raceControl: [], fastestLap: null, stints: [] };
const EMPTY_GRID = new Map<number, number>();

export default function RisultatiPageWrapper() {
  return <Suspense><RisultatiPage /></Suspense>;
}

function RisultatiPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { legaId } = useLegaPreferita();
  const { leghe } = useLeghe();
  const all = useAllWeekendResults();
  const archived = useMemo(() => all.rows.filter((r) => (r.data.race?.length ?? 0) > 0 || (r.data.qualifying?.length ?? 0) > 0).map((r) => r.round).sort((a, b) => b - a), [all.rows]);
  const paramRound = Number(params.get("round"));
  const round = Number.isInteger(paramRound) && paramRound > 0 ? paramRound : (archived[0] ?? null);
  const race = round ? getRaceByRound(round) : undefined;
  const [tab, setTab] = useState<"mio" | "classifica" | "formazioni">("mio");
  const [selected, setSelected] = useState<string | null>(null);

  const data = useWeekendClassifica({ round: round ?? 0, sessionType: "", sessionKey: null, legaId, userId: user?.id });
  const { prices } = useDriverPrices(round ?? 1);
  const { provisional } = useProvisionalScores(false, round ?? 0);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const lega = leghe.find((l) => l.id === legaId);
  const legaName = lega ? (lega.is_generale ? "Classifica generale" : lega.name) : null;
  const myForm = user ? data.formazioni.find((f) => f.user_id === user.id) ?? null : null;
  const selectedForm = selected ? data.formazioni.find((f) => f.user_id === selected) : null;
  const selectedEntry = selected ? data.classifica.find((c) => c.userId === selected) : null;

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#050507] text-white bg-grid"><Navbar /><div className="max-w-3xl mx-auto px-4 py-6 space-y-3"><div className="skeleton h-24" /><div className="skeleton h-40" /></div><BottomNav /></div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-5 pb-bottomnav">
        <div className="hud-label text-[#E8002D] mb-1">RECAP WEEKEND</div>
        <h1 className="text-[26px] font-extrabold tracking-[-0.6px] leading-none mb-3">{race ? race.name : "Risultati"}</h1>

        {/* Round rail */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-4">
          {archived.map((r) => {
            const rr = RACES_2026.find((x) => x.round === r);
            const active = r === round;
            return (
              <button key={r} onClick={() => router.replace(`/risultati?round=${r}`)} className={`pill shrink-0 ${active ? "border-white/60 text-white bg-white/[0.08]" : ""}`}>
                {rr && <CountryFlag countryCode={rr.countryCode} size={10} />} R{r} {rr?.circuit ?? ""}
              </button>
            );
          })}
          {!all.loaded && <span className="skeleton h-7 w-24" />}
        </div>

        {!race || !round ? (
          <div className="hud-card p-6 text-center text-[13px] text-white/55">{all.loaded ? "Nessun weekend calcolato finora." : "Caricamento…"}</div>
        ) : !data.previousLoaded ? (
          <div className="space-y-3"><div className="skeleton h-14" /><div className="skeleton h-40" /></div>
        ) : !data.previousResults ? (
          <div className="hud-card p-6 text-center text-[13px] text-white/55">Questo round non è in archivio.</div>
        ) : (
          <>
            <div className="flex gap-1 mb-4">
              {([["mio", "IL MIO WEEKEND"], ["classifica", "CLASSIFICA"], ["formazioni", "FORMAZIONI"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex-1 py-2 rounded font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1px] font-bold border tap ${tab === id ? "bg-white/[0.08] border-white/45 text-white" : "bg-[#0e0e14] border-[#1c1c26] text-white/55"}`}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "mio" && (
              <WeekendRecap
                race={race}
                results={data.previousResults}
                formazione={myForm}
                previsioniRow={data.previsioniByUser.get(user.id)}
                penalita={data.penalitaByUser.get(user.id) ?? 0}
                prices={prices}
                classifica={data.classifica}
                provisional={provisional}
                legaName={legaName}
                userId={user.id}
              />
            )}
            {tab === "classifica" && <ClassificaWeekendList classifica={data.classifica} onSelect={setSelected} />}
            {tab === "formazioni" && (
              <FormazioniSvelate formazioni={data.formazioni} previsioniByUser={data.previsioniByUser} userId={user.id} raceName={race.name} members={data.memberIds} />
            )}
          </>
        )}
      </main>
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
          onClose={() => setSelected(null)}
        />
      )}
      <BottomNav />
    </div>
  );
}

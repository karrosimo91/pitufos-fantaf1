"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import CountryFlag from "../components/CountryFlag";
import { ProvisionalView } from "../components/live/ProvisionalView";
import { useLegaPreferita } from "../lib/store";
import { useWeekend } from "../lib/weekend-context";
import { useAuth } from "../lib/auth";
import { useProvisionalScores } from "../lib/provisional-scores";
import { useWeekendResults } from "../lib/use-weekend-results";
import { useLegaMembers } from "../lib/use-lega-members";
import { formatDateTimeLocal, formatRelative } from "../lib/races";
import { ChevronRight } from "lucide-react";

const LiveTab = dynamic(() => import("../components/LiveTab"), { ssr: false });
const WeekendArchivioTab = dynamic(() => import("../components/WeekendArchivioTab"), { ssr: false });

export default function GaraPageWrapper() {
  return (
    <Suspense>
      <GaraPage />
    </Suspense>
  );
}

function GaraPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { round, race, phase, locked, now, live, recapRace, squadra: sq, previsioni: prev } = useWeekend();
  const { legaId } = useLegaPreferita();
  const { members } = useLegaMembers(legaId);
  const searchParams = useSearchParams();
  const debugLive = searchParams.get("debug_live") === "true";
  const isLive = live.isLive || debugLive;
  const liveSession = live.session || (debugLive ? { sessionKey: 9999, sessionName: "Race", sessionType: "Race", meetingKey: 1 } : null);
  const { provisional } = useProvisionalScores(isLive, round);
  const wr = useWeekendResults(round);
  const showProvisional = !isLive && !!provisional;

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  if (authLoading || !sq.loaded || !prev.loaded || !user) {
    return (
      <div className="min-h-screen bg-[#050507] text-white bg-grid">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-3"><div className="skeleton h-24" /><div className="skeleton h-40" /></div>
        <BottomNav />
      </div>
    );
  }

  // Cosa mostrare: live → provvisorio → archivio del round → (prima della
  // deadline) recap del GP precedente → attesa.
  const showRecapOfPrevious = !isLive && !showProvisional && !locked && !!recapRace && recapRace.round !== round;
  const headerRace = showRecapOfPrevious && recapRace ? recapRace : race;
  const raceStarted = now >= new Date(race.date);

  let emptyTitle = "";
  let emptyText = "";
  if (locked && !wr.anyArchived) {
    emptyTitle = raceStarted ? "Gara conclusa, punteggi in arrivo" : race.sprint ? "Weekend sprint in corso" : "Weekend in corso";
    emptyText = raceStarted
      ? "Il calcolo ufficiale (griglia reale, Driver of the Day, penalità) arriva poco dopo la bandiera a scacchi."
      : `Durante ogni sessione qui vedi il punteggio in tempo reale. Gara ${formatDateTimeLocal(race.date)}.`;
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-4 pb-bottomnav">
        <div className="hud-card hud-card-accent mb-4">
          <div className="hud-card-head">
            <div className="hud-label">ROUND {String(headerRace.round).padStart(2, "0")} / 24{showRecapOfPrevious ? " · APPENA CONCLUSO" : ""}</div>
            <div className="flex items-center gap-1.5">
              {headerRace.sprint && <span className="pill pill-accent">SPRINT</span>}
              {isLive && <span className="live-pill"><span className="live-pill-dot" />LIVE</span>}
              {showProvisional && <span className="pill pill-amber">PROVVISORIO</span>}
              {!isLive && !showProvisional && wr.raceArchived && <span className="pill pill-green">UFFICIALE</span>}
            </div>
          </div>
          <div className="p-4 flex items-start gap-3">
            <CountryFlag countryCode={headerRace.countryCode} size={34} />
            <div className="flex-1 min-w-0">
              <h1 className="text-[22px] font-extrabold leading-[1.1] tracking-[-0.4px]">{headerRace.name}</h1>
              <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 tracking-[0.5px] uppercase mt-1 truncate">{headerRace.circuit} · gara {formatDateTimeLocal(headerRace.date)}</p>
            </div>
          </div>
        </div>

        {isLive && liveSession ? (
          <LiveTab
            sessionKey={liveSession.sessionKey}
            sessionType={liveSession.sessionName}
            meetingKey={liveSession.meetingKey}
            round={round}
            userId={user.id}
            legaId={legaId}
            raceName={race.name}
            driverNumbers={sq.driverNumbers}
            primoPilota={sq.primoPilota}
            chipPiloti={sq.chipPiloti ? { chipPiloti: sq.chipPiloti, chipPilotiTarget: sq.chipPilotiTarget, sestoUomo: sq.sestoUomo } : null}
            chipPrevisioni={prev.chipAttivo ? { chipAttivo: prev.chipAttivo, chipTarget: prev.chipTarget } : null}
            previsioni={prev.previsioni}
            debug={debugLive}
          />
        ) : showProvisional && provisional ? (
          <ProvisionalView provisional={provisional} userId={user.id} members={members} />
        ) : locked ? (
          <WeekendArchivioTab
            round={round}
            userId={user.id}
            legaId={legaId}
            raceName={race.name}
            emptyTitle={emptyTitle}
            emptyText={emptyText}
            showRecapLink
          />
        ) : showRecapOfPrevious && recapRace ? (
          <>
            <WeekendArchivioTab
              round={recapRace.round}
              userId={user.id}
              legaId={legaId}
              raceName={recapRace.name}
              emptyTitle="Nessun punteggio in archivio"
              emptyText="Il weekend non è stato calcolato."
              showRecapLink
            />
            <div className="hud-card p-4 mt-4">
              <div className="hud-label mb-1">PROSSIMO · {race.name.toUpperCase()}</div>
              <div className="text-[13px] text-white/80">Chiusura formazione {formatDateTimeLocal(race.deadline)}{formatRelative(race.deadline, now) ? ` · ${formatRelative(race.deadline, now)}` : ""}</div>
              <Link href="/dashboard" className="btn-secondary w-full mt-3">PREPARA IL WEEKEND <ChevronRight size={14} /></Link>
            </div>
          </>
        ) : (
          <div className="hud-card p-6 text-center">
            <div className="text-[15px] font-bold">{phase === "prepara" ? "Il weekend non è ancora iniziato" : "Nessuna sessione in corso"}</div>
            <div className="text-[13px] text-white/60 mt-1.5">
              Chiusura formazione {formatDateTimeLocal(race.deadline)}{formatRelative(race.deadline, now) ? ` (${formatRelative(race.deadline, now)})` : ""}. Dalle qualifiche in poi qui vedi il punteggio in tempo reale e le formazioni di tutti.
            </div>
            <Link href="/dashboard" className="btn-primary mt-4">PREPARA IL WEEKEND <ChevronRight size={14} /></Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

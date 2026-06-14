"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import CountryFlag from "../components/CountryFlag";
import { useSquadra, usePrevisioni, useLegaPreferita } from "../lib/store";
import { useAuth } from "../lib/auth";
import { getNextRace, getCurrentRound } from "../lib/races";
import { useLiveSession } from "../lib/use-live-session";
import { useProvisionalScores } from "../lib/provisional-scores";

const LiveTab = dynamic(() => import("../components/LiveTab"), { ssr: false });

const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

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
  const currentRound = getCurrentRound();
  const race = getNextRace();

  const sq = useSquadra(currentRound);
  const prev = usePrevisioni(currentRound);
  const { isLive: realIsLive, session: realLiveSession } = useLiveSession();
  const { legaId } = useLegaPreferita();
  const searchParams = useSearchParams();
  const debugLive = searchParams.get("debug_live") === "true";
  const isLive = realIsLive || debugLive;
  const liveSession = realLiveSession || (debugLive ? { sessionKey: 9999, sessionName: "Race", sessionType: "Race", meetingKey: 1 } : null);
  const { provisional } = useProvisionalScores(isLive, currentRound);
  const showProvisional = !isLive && !!provisional;

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  if (authLoading || !sq.loaded || !prev.loaded || !user) {
    return (
      <div className="min-h-screen bg-[#050507] text-white bg-grid">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-4 pb-bottomnav">
        {/* ═══ HEADER GARA ═══ */}
        <div className="hud-card hud-card-accent mb-4">
          <div className="hud-card-head">
            <div className="hud-label">ROUND {String(race.round).padStart(2, "0")} / 24</div>
            <div className="flex items-center gap-1.5">
              {race.sprint && (
                <span className="font-[family-name:var(--font-jetbrains)] bg-[#E8002D]/15 border border-[#E8002D]/30 text-[#E8002D] px-2 py-0.5 rounded text-[9px] font-bold tracking-[1.5px]">SPRINT</span>
              )}
              {isLive && (
                <span className="live-pill">
                  <span className="live-pill-dot" />
                  LIVE
                </span>
              )}
              {showProvisional && (
                <span className="font-[family-name:var(--font-jetbrains)] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold tracking-[1.5px]">PROVVISORIO</span>
              )}
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <CountryFlag countryCode={race.countryCode} size={36} />
              <div className="flex-1 min-w-0">
                <h1 className="text-[22px] font-extrabold leading-[1.1] tracking-[-0.4px]">{race.name}</h1>
                <p className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/35 tracking-[0.5px] uppercase mt-1 truncate">{race.circuit}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ LIVE ═══ */}
        {isLive && liveSession ? (
          <LiveTab
            sessionKey={liveSession.sessionKey}
            sessionType={liveSession.sessionName}
            meetingKey={liveSession.meetingKey}
            round={currentRound}
            userId={user?.id}
            legaId={legaId}
            driverNumbers={sq.driverNumbers}
            primoPilota={sq.primoPilota}
            chipPiloti={sq.chipPiloti ? { chipPiloti: sq.chipPiloti, chipPilotiTarget: sq.chipPilotiTarget, sestoUomo: sq.sestoUomo } : null}
            chipPrevisioni={prev.chipAttivo ? { chipAttivo: prev.chipAttivo, chipTarget: prev.chipTarget } : null}
            previsioni={prev.previsioni}
            debug={debugLive}
          />
        ) : showProvisional && provisional ? (
          /* ═══ PROVVISORIO (sessione finita, risultati non ancora ufficiali) ═══ */
          <div>
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/[0.03] border border-amber-500/15 rounded-2xl p-4 text-center mb-4">
              <div className="text-[9px] tracking-[3px] text-amber-400/60 uppercase mb-1">Punteggio weekend provvisorio</div>
              <div className="font-[family-name:var(--font-jetbrains)] text-[32px] font-bold leading-none text-amber-400">
                {provisional.scores.find((s) => s.userId === user?.id)?.points ?? "—"}
              </div>
              {provisional.sessions.length > 0 && (
                <div className="flex justify-center gap-3 mt-2 text-[10px] text-white/30">
                  {provisional.sessions.map((sess) => {
                    const myPts = sess.scores[user?.id || ""] ?? 0;
                    return (
                      <span key={sess.sessionName}>
                        {sess.sessionName}: <span className="font-[family-name:var(--font-jetbrains)] text-amber-400/60">{myPts}</span>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="text-[10px] text-white/20 mt-2">In attesa dei risultati ufficiali</div>
            </div>

            <div className="hud-label mb-2">Classifica Weekend Provvisoria</div>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-hidden mb-4">
              {provisional.scores.map((entry, i) => {
                const isMe = entry.userId === user?.id;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between px-3.5 py-2.5 transition-all ${
                      i < provisional.scores.length - 1 ? "border-b border-white/[0.04]" : ""
                    } ${isMe ? "bg-amber-500/[0.05] border-l-[3px] border-l-amber-500" : ""}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-bold w-5 text-center ${
                        i === 0 ? "text-amber-400" : isMe ? "text-amber-400" : "text-white/30"
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <div className={`text-[13px] font-semibold ${isMe ? "text-white" : ""}`}>{entry.scuderiaName}</div>
                        <div className={`text-[10px] ${isMe ? "text-amber-400/50" : "text-white/25"}`}>@{entry.tpName}</div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`font-[family-name:var(--font-jetbrains)] text-base font-bold ${isMe ? "text-white" : "text-white/70"}`}>
                        {entry.points}
                      </span>
                      {i < 10 && (
                        <span className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/15">+{PUNTI_REALE[i]} CR</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ═══ NESSUNA SESSIONE LIVE ═══ */
          <div className="hud-card p-10 text-center">
            <div className="text-white/30 text-sm font-semibold">Nessuna sessione live al momento</div>
            <div className="text-white/15 text-[12px] mt-2">
              Durante il weekend di gara qui vedrai il punteggio in tempo reale.
              Imposta formazione e previsioni dalla Home.
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

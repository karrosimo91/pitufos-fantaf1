"use client";
import { useEffect, useState } from "react";
import { latestFlag, FLAG_LABEL, type FlagState } from "../../lib/live-events";
import type { LiveRaceControl } from "../../lib/use-live-ws";
import { classifySession } from "../../lib/build-live-results";

const SESSION_LABEL: Record<string, string> = {
  qualifying: "QUALIFICHE", sprint_shootout: "SPRINT SHOOTOUT", sprint: "SPRINT", race: "GARA", unknown: "SESSIONE",
};

const FLAG_CLASS: Record<FlagState, string> = {
  green: "text-[#2ee59d]", yellow: "text-[#ffb000]", sc: "text-[#ffb000]", vsc: "text-[#ffb000]",
  red: "text-[#E8002D]", chequered: "text-white", none: "text-white/50",
};

/** Barra di sessione: cosa sta succedendo in pista e quanto sono freschi i dati. */
export function SessionBar({
  sessionType, currentLap, raceControl, lastDataAt, connected, mode,
}: {
  sessionType: string;
  currentLap: number | null;
  raceControl: LiveRaceControl[];
  lastDataAt: number;
  connected: boolean;
  mode?: "init" | "mqtt" | "polling";
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const kind = classifySession(sessionType);
  const flag = latestFlag(raceControl);
  const ageS = lastDataAt > 0 ? Math.max(0, Math.round((now - lastDataAt) / 1000)) : null;
  const fresh = ageS !== null && ageS <= 20;
  const stale = ageS !== null && ageS > 60;

  return (
    <div className="hud-card mb-3 px-3 py-2 flex items-center justify-between gap-2 font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[1px] uppercase">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-bold text-white">{SESSION_LABEL[kind]}</span>
        {(kind === "race" || kind === "sprint") && currentLap != null && (
          <><span className="text-white/25">·</span><span className="text-white/80">GIRO {currentLap}</span></>
        )}
        <span className="text-white/25">·</span>
        <span className={`font-bold ${FLAG_CLASS[flag]} truncate`}>{FLAG_LABEL[flag]}</span>
      </div>
      <div className={`shrink-0 flex items-center gap-1.5 ${stale ? "text-[#ffb000]" : "text-white/55"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${fresh ? "bg-[#2ee59d] animate-live-pulse" : stale ? "bg-[#ffb000]" : "bg-white/40"}`} />
        {ageS === null ? (connected ? "in attesa dati" : mode === "polling" ? "polling" : "collegamento…") : ageS < 5 ? "adesso" : `${ageS} s fa`}
      </div>
    </div>
  );
}

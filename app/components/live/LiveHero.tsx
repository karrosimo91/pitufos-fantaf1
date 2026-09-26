"use client";
import { HudCard } from "../ui/HudCard";
import { ConnectedPill } from "../ui/LivePill";
import type { WeekendClassificaEntry } from "../../lib/use-weekend-classifica";

/**
 * Un numero e un rivale: il mio punteggio provvisorio, la posizione nel
 * weekend e il distacco da chi mi precede e da chi mi segue.
 */
export function LiveHero({
  points, piloti, previsioni, penalita, isRace, classifica, userId, connected, mode, ended, label = "PUNTEGGIO PROVVISORIO",
}: {
  points: number;
  piloti: number;
  previsioni: number;
  penalita: number;
  isRace: boolean;
  classifica: WeekendClassificaEntry[];
  userId?: string;
  connected?: boolean;
  mode?: "init" | "mqtt" | "polling";
  ended?: boolean;
  label?: string;
}) {
  const idx = userId ? classifica.findIndex((c) => c.userId === userId) : -1;
  const me = idx >= 0 ? classifica[idx] : null;
  const ahead = idx > 0 ? classifica[idx - 1] : null;
  const behind = idx >= 0 && idx < classifica.length - 1 ? classifica[idx + 1] : null;

  return (
    <HudCard
      label={ended ? "BANDIERA A SCACCHI · PROVVISORIO" : label}
      meta={connected !== undefined ? <ConnectedPill connected={connected} mode={mode} /> : undefined}
      className="mb-3"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="big-num">{points > 0 ? "+" : ""}{points}</div>
        {me && (
          <div className="text-right">
            <div className="font-[family-name:var(--font-jetbrains)] text-[22px] font-extrabold leading-none">{idx + 1}°<span className="text-[13px] text-white/50 font-normal"> su {classifica.length}</span></div>
            <div className="text-[11px] text-white/55 mt-1">nel weekend</div>
          </div>
        )}
      </div>
      <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 tracking-[1px] uppercase mt-3">
        PILOTI <span className="text-white/85 ml-1">{piloti}</span>
        {isRace && (<><span className="mx-2 text-white/50">·</span>PREVISIONI <span className="text-white/85 ml-1">{previsioni}</span></>)}
        {penalita > 0 && (<><span className="mx-2 text-white/50">·</span>CAMBI <span className="text-[#ffb000] ml-1">−{penalita}</span></>)}
      </div>
      {me && (ahead || behind) && (
        <div className="mt-2 text-[13px] text-white/80">
          {ahead && <span><span className="text-[#E8002D] font-bold">−{ahead.points - me.points}</span> da {ahead.tpName}</span>}
          {ahead && behind && <span className="text-white/50"> · </span>}
          {behind && <span><span className="text-[#2ee59d] font-bold">+{me.points - behind.points}</span> su {behind.tpName}</span>}
          {!ahead && behind && <span className="text-white/55"> · sei in testa</span>}
        </div>
      )}
    </HudCard>
  );
}

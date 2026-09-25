"use client";
import { useMemo, useState } from "react";
import { useWeekendClassifica } from "../lib/use-weekend-classifica";
import type { LiveSnapshot } from "../lib/build-live-results";
import { ClassificaWeekendList } from "./live/ClassificaWeekendList";
import { ClassificaGeneraleLive } from "./live/ClassificaGeneraleLive";
import { PlayerDetailModal } from "./live/PlayerDetailModal";
import { HudCard } from "./ui/HudCard";

const EMPTY_SNAP: LiveSnapshot = { positions: new Map(), raceControl: [], fastestLap: null, stints: [] };
const EMPTY_GRID = new Map<number, number>();

/**
 * Weekend in corso ma nessuna sessione live: punteggi di tutti i Team
 * Principal calcolati dalle sessioni già in archivio (`weekend_results`),
 * con lo stesso calcolo e gli stessi componenti del Live. Tocca un giocatore
 * (anche te stesso) per il dettaglio piloti e previsioni.
 */
export default function WeekendArchivioTab({
  round,
  userId,
  legaId,
}: {
  round: number;
  userId?: string;
  legaId?: string;
}) {
  const data = useWeekendClassifica({ round, sessionType: "", sessionKey: null, legaId, userId });
  const [subTab, setSubTab] = useState<"weekend" | "generale">("weekend");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const weekendPoints = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data.classifica) m.set(c.userId, c.points);
    return m;
  }, [data.classifica]);

  const sessioni = useMemo(() => {
    const r = data.previousResults;
    if (!r) return [];
    const out: string[] = [];
    if (r.qualifying?.length) out.push("Qualifica");
    if (r.sprint_shootout?.length) out.push("Shootout");
    if (r.sprint?.length) out.push("Sprint");
    if (r.race?.length) out.push("Gara");
    return out;
  }, [data.previousResults]);

  if (!data.previousLoaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data.previousResults || sessioni.length === 0) {
    return (
      <div className="hud-card p-10 text-center">
        <div className="text-white/30 text-sm font-semibold">Nessuna sessione live al momento</div>
        <div className="text-white/15 text-[12px] mt-2">
          I punteggi del weekend compaiono qui appena viene calcolata la prima sessione.
        </div>
      </div>
    );
  }

  const me = data.classifica.find((c) => c.isMe);
  const myPenalita = userId ? data.penalitaByUser.get(userId) ?? 0 : 0;
  const selectedFormazione = selectedPlayer ? data.formazioni.find((f) => f.user_id === selectedPlayer) : null;
  const selectedEntry = selectedPlayer ? data.classifica.find((c) => c.userId === selectedPlayer) : null;

  return (
    <div>
      <HudCard label="PUNTEGGIO WEEKEND" meta="UFFICIALE" className="mb-4">
        <div className="big-num">{me ? me.points : "—"}</div>
        <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/30 tracking-[1.5px] uppercase mt-3">
          {sessioni.join(" · ")}
          {myPenalita > 0 && (
            <>
              <span className="mx-2 text-white/15">·</span>
              CAMBI <span className="text-amber-400/80 ml-1">−{myPenalita}</span>
            </>
          )}
        </div>
        <div className="text-[10px] text-white/20 mt-2">
          Sessioni già calcolate. Tocca un Team Principal per il dettaglio.
        </div>
      </HudCard>

      <div className="flex gap-1 mb-4">
        {([
          ["weekend", "CLASSIFICA WEEKEND"],
          ["generale", "GENERALE"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex-1 py-2 rounded font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[1.2px] font-bold transition-all border ${
              subTab === id
                ? "bg-[#E8002D]/12 border-[#E8002D]/45 text-[#E8002D]"
                : "bg-[#0e0e14] border-[#1c1c26] text-white/40 hover:text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === "weekend" && (
        <ClassificaWeekendList classifica={data.classifica} onSelect={setSelectedPlayer} />
      )}
      {subTab === "generale" && (
        <ClassificaGeneraleLive legaId={legaId} round={round} liveWeekendPoints={weekendPoints} userId={userId} />
      )}

      {selectedFormazione && selectedEntry && (
        <PlayerDetailModal
          player={selectedFormazione}
          entry={selectedEntry}
          previsioniRow={data.previsioniByUser.get(selectedFormazione.user_id)}
          snap={EMPTY_SNAP}
          gridPositions={EMPTY_GRID}
          previousResults={data.previousResults}
          sessionType=""
          penalitaCambi={data.penalitaByUser.get(selectedFormazione.user_id) ?? 0}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

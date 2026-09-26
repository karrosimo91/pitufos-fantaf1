"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Share2 } from "lucide-react";
import { useWeekendClassifica } from "../lib/use-weekend-classifica";
import type { LiveSnapshot } from "../lib/build-live-results";
import { ClassificaWeekendList } from "./live/ClassificaWeekendList";
import { ClassificaGeneraleLive } from "./live/ClassificaGeneraleLive";
import { PlayerDetailModal } from "./live/PlayerDetailModal";
import { FormazioniSvelate } from "./live/FormazioniSvelate";
import { LiveHero } from "./live/LiveHero";
import { shareText } from "../lib/share";
import { useToast } from "./ui/Toast";

const EMPTY_SNAP: LiveSnapshot = { positions: new Map(), raceControl: [], fastestLap: null, stints: [] };
const EMPTY_GRID = new Map<number, number>();

type SubTab = "weekend" | "formazioni" | "generale";

/**
 * Weekend senza sessione live: punteggi di tutti dalle sessioni in archivio
 * (`weekend_results`), formazioni svelate e classifica generale. Se non c'è
 * ancora nulla in archivio, dice cosa si aspetta invece di "nessuna
 * sessione live".
 */
export default function WeekendArchivioTab({
  round, userId, legaId, raceName, emptyTitle, emptyText, showRecapLink = false,
}: {
  round: number;
  userId?: string;
  legaId?: string;
  raceName: string;
  emptyTitle: string;
  emptyText: string;
  showRecapLink?: boolean;
}) {
  const data = useWeekendClassifica({ round, sessionType: "", sessionKey: null, legaId, userId });
  const [subTab, setSubTab] = useState<SubTab>("weekend");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const toast = useToast();

  const weekendPoints = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data.classifica) m.set(c.userId, c.points);
    return m;
  }, [data.classifica]);

  const sessioni = useMemo(() => {
    const r = data.previousResults;
    if (!r) return [];
    const out: string[] = [];
    if (r.qualifying?.length) out.push("Qualifiche");
    if (r.sprint_shootout?.length) out.push("Shootout");
    if (r.sprint?.length) out.push("Sprint");
    if (r.race?.length) out.push("Gara");
    return out;
  }, [data.previousResults]);

  if (!data.previousLoaded) {
    return <div className="space-y-3"><div className="skeleton h-28" /><div className="skeleton h-40" /></div>;
  }

  const hasData = !!data.previousResults && sessioni.length > 0;
  const me = data.classifica.find((c) => c.isMe);
  const myPenalita = userId ? data.penalitaByUser.get(userId) ?? 0 : 0;
  const selectedFormazione = selectedPlayer ? data.formazioni.find((f) => f.user_id === selectedPlayer) : null;
  const selectedEntry = selectedPlayer ? data.classifica.find((c) => c.userId === selectedPlayer) : null;
  const raceDone = (data.previousResults?.race?.length ?? 0) > 0;

  const onShare = async () => {
    const lines = data.classifica.map((c, i) => `${i + 1}. ${c.tpName} ${c.points}`);
    const r = await shareText(`${raceName} · classifica weekend`, [`${raceName} · ${sessioni.join(" + ")}`, ...lines].join("\n"));
    if (r === "copied") toast.show("Classifica copiata", { kind: "success", detail: "Incollala nel gruppo" });
    else if (r === "failed") toast.show("Condivisione non riuscita", { kind: "error" });
  };

  return (
    <div>
      {hasData ? (
        <>
          <LiveHero
            label={`${sessioni.join(" · ").toUpperCase()} · ${raceDone ? "UFFICIALE" : "PARZIALE"}`}
            points={me ? me.points : 0}
            piloti={0}
            previsioni={0}
            penalita={myPenalita}
            isRace={false}
            classifica={data.classifica}
            userId={userId}
          />
          {showRecapLink && raceDone && (
            <Link href={`/risultati?round=${round}`} className="flex items-center gap-3 hud-card hud-card-accent p-3.5 mb-3 tap">
              <div className="flex-1 text-[13px] font-bold">Apri il recap: scontrino, rimpianti, weekend perfetto</div>
              <ChevronRight size={16} className="text-white/45" />
            </Link>
          )}
        </>
      ) : (
        <div className="hud-card p-6 text-center mb-3">
          <div className="text-[15px] font-bold">{emptyTitle}</div>
          <div className="text-[13px] text-white/60 mt-1.5">{emptyText}</div>
        </div>
      )}

      <div className="flex gap-1 mb-4">
        {([["weekend", "WEEKEND"], ["formazioni", "FORMAZIONI"], ["generale", "GENERALE"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`flex-1 py-2 rounded font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1px] font-bold border tap ${subTab === id ? "bg-white/[0.08] border-white/45 text-white" : "bg-[#0e0e14] border-[#1c1c26] text-white/55"}`}>
            {label}
          </button>
        ))}
      </div>

      {subTab === "weekend" && (
        hasData ? (
          <>
            <ClassificaWeekendList classifica={data.classifica} onSelect={setSelectedPlayer} />
            <button onClick={onShare} className="btn-secondary w-full"><Share2 size={14} /> CONDIVIDI LA CLASSIFICA</button>
          </>
        ) : (
          <div className="text-[13px] text-white/50 text-center py-6">La classifica del weekend compare appena viene calcolata la prima sessione.</div>
        )
      )}
      {subTab === "formazioni" && (
        <FormazioniSvelate formazioni={data.formazioni} previsioniByUser={data.previsioniByUser} userId={userId} raceName={raceName} members={data.memberIds} />
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

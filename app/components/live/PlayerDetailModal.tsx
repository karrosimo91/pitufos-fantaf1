"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { RaceWeekendResults } from "../../lib/scoring";
import type { PlayerFormazione, PlayerPrevisioni, WeekendClassificaEntry } from "../../lib/use-weekend-classifica";
import type { LiveSnapshot } from "../../lib/build-live-results";
import { buildPilotaBreakdown, computePlayerWeekendDetail } from "../../lib/player-breakdown";
import { PilotaLiveRow } from "./PilotaLiveRow";

export function PlayerDetailModal({
  player,
  entry,
  previsioniRow,
  snap,
  gridPositions,
  previousResults,
  sessionType,
  onClose,
}: {
  player: PlayerFormazione;
  entry: WeekendClassificaEntry;
  previsioniRow?: PlayerPrevisioni;
  snap: LiveSnapshot;
  gridPositions: Map<number, number>;
  previousResults: RaceWeekendResults | null;
  sessionType: string;
  onClose: () => void;
}) {
  const [expandedDriver, setExpandedDriver] = useState<number | null>(null);

  const detail = useMemo(
    () => computePlayerWeekendDetail(player, previsioniRow, snap, gridPositions, previousResults, sessionType),
    [player, previsioniRow, snap, gridPositions, previousResults, sessionType],
  );

  const isMainRace = sessionType.toLowerCase().includes("race") && !sessionType.toLowerCase().includes("sprint");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4"
      onMouseDown={onClose}
      onTouchEnd={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-[#12121e] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 bg-[#12121e] border-b border-white/[0.06] px-5 py-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-base">{entry.tpName}</div>
            <div className="text-[11px] text-white/30">{entry.scuderiaName}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-[#E8002D]">{entry.points}</span>
            <button onClick={onClose} className="text-white/30 hover:text-white/60 p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        <div
          className="overflow-y-auto flex-1 min-h-0 px-5 py-4 space-y-4 overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          <div>
            <div className="text-[9px] tracking-[3px] text-white/30 uppercase font-bold mb-2">Piloti</div>
            <div className="space-y-1.5">
              {detail.piloti.map((p) => {
                const sections = buildPilotaBreakdown(
                  p.driver_number,
                  p.driver_number === player.primo_pilota,
                  player.chip_piloti,
                  player.chip_piloti_target,
                  previousResults,
                  detail.liveResults,
                  sessionType,
                );
                return (
                  <PilotaLiveRow
                    key={p.driver_number}
                    p={p}
                    primoPilota={player.primo_pilota}
                    chipPiloti={player.chip_piloti}
                    breakdownSections={sections}
                    expanded={expandedDriver === p.driver_number}
                    onToggle={() => setExpandedDriver(expandedDriver === p.driver_number ? null : p.driver_number)}
                  />
                );
              })}
            </div>
          </div>

          {isMainRace && previsioniRow && (
            <PrevisioniGrid previsioniRow={previsioniRow} events={detail.events} />
          )}

          {player.chip_piloti && (
            <div>
              <div className="text-[9px] tracking-[3px] text-white/30 uppercase font-bold mb-2">Aggiornamento</div>
              <div className="inline-flex items-center gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
                <span className="text-xs font-bold text-amber-400">{player.chip_piloti}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PrevisioniGrid({
  previsioniRow,
  events,
}: {
  previsioniRow: PlayerPrevisioni;
  events: RaceWeekendResults["events"];
}) {
  const items: { label: string; value: boolean | null; happened: boolean | null }[] = [
    { label: "Safety Car", value: previsioniRow.safety_car, happened: events.safety_car },
    { label: "Virtual SC", value: previsioniRow.virtual_safety_car, happened: events.virtual_safety_car },
    { label: "Red Flag", value: previsioniRow.red_flag, happened: events.red_flag },
    { label: "Gomme Wet", value: previsioniRow.gomme_wet, happened: events.wet_tyres },
    { label: "Pole vince", value: previsioniRow.pole_vince, happened: null },
  ];

  return (
    <div>
      <div className="text-[9px] tracking-[3px] text-white/30 uppercase font-bold mb-2">Previsioni</div>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((p) => {
          const isCorrect = (p.happened === true && p.value === true) || (p.happened === false && p.value === false);
          const isWrong = (p.happened === true && p.value === false) || (p.happened === false && p.value === true);
          return (
            <div key={p.label} className={`rounded-lg px-3 py-2 border text-[12px] ${
              isCorrect ? "border-green-500/30 bg-green-500/[0.06]"
              : isWrong ? "border-red-500/15 bg-red-500/[0.04]"
              : "border-white/[0.06] bg-white/[0.02]"
            }`}>
              <div className="text-[10px] text-white/40">{p.label}</div>
              <div className={`font-bold ${isCorrect ? "text-green-400" : isWrong ? "text-red-400" : "text-white/30"}`}>
                {p.value === true ? "SI" : p.value === false ? "NO" : "—"}
                {isCorrect ? " ✓" : isWrong ? " ✗" : ""}
              </div>
            </div>
          );
        })}
        <div className={`rounded-lg px-3 py-2 border col-span-2 text-[12px] ${
          previsioniRow.numero_dnf !== null && previsioniRow.numero_dnf === events.total_dnf
            ? "border-green-500/30 bg-green-500/[0.06]"
            : "border-white/[0.06] bg-white/[0.02]"
        }`}>
          <div className="text-[10px] text-white/40">N. DNF</div>
          <div className={`font-bold ${
            previsioniRow.numero_dnf !== null && previsioniRow.numero_dnf === events.total_dnf
              ? "text-green-400" : "text-white/30"
          }`}>
            {previsioniRow.numero_dnf ?? "—"}
            {previsioniRow.numero_dnf !== null && previsioniRow.numero_dnf === events.total_dnf ? " ✓" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

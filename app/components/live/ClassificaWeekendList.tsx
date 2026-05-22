"use client";
import type { WeekendClassificaEntry } from "../../lib/use-weekend-classifica";

const PUNTI_REALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export function ClassificaWeekendList({
  classifica,
  onSelect,
}: {
  classifica: WeekendClassificaEntry[];
  onSelect: (userId: string) => void;
}) {
  if (classifica.length === 0) return null;

  return (
    <>
      <div className="text-[9px] tracking-[3px] text-white/30 uppercase font-bold mb-2 mt-4">
        Classifica Weekend
      </div>
      <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-hidden mb-4">
        {classifica.map((entry, i) => (
          <button
            key={entry.userId}
            onClick={() => onSelect(entry.userId)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 transition-all text-left hover:bg-white/[0.04] ${
              i < classifica.length - 1 ? "border-b border-white/[0.04]" : ""
            } ${entry.isMe ? "bg-[#E8002D]/[0.05] border-l-[3px] border-l-[#E8002D]" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-bold w-5 text-center ${
                i === 0 ? "text-[#E8002D]" : entry.isMe ? "text-[#E8002D]" : "text-white/30"
              }`}>
                {i + 1}
              </div>
              <div>
                <div className={`text-[13px] font-semibold ${entry.isMe ? "text-white" : ""}`}>
                  {entry.scuderiaName}
                </div>
                <div className={`text-[10px] ${entry.isMe ? "text-[#E8002D]/50" : "text-white/25"}`}>
                  @{entry.tpName}
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-[family-name:var(--font-jetbrains)] text-base font-bold ${
                entry.isMe ? "text-white" : "text-white/70"
              }`}>
                {entry.points}
              </span>
              {i < 10 && (
                <span className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/15">
                  +{PUNTI_REALE[i]} CR
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

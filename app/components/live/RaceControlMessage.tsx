"use client";
import type { LiveRaceControl } from "../../lib/use-live-ws";

export function RaceControlMessage({ rc }: { rc: LiveRaceControl }) {
  const msg = (rc.message || "").toUpperCase();
  const isSC = msg.includes("SAFETY CAR") && !msg.includes("VIRTUAL");
  const isVSC = msg.includes("VIRTUAL SAFETY CAR") || msg.includes("VSC");
  const isRF = msg.includes("RED FLAG") || (rc.flag || "").toUpperCase() === "RED";
  const isDNF = msg.includes("RETIRED") || msg.includes("OUT OF THE RACE");
  const isPenalty = msg.includes("PENALTY");
  const isGreen = msg.includes("GREEN") || msg.includes("LIGHTS OUT");

  const borderColor = isRF ? "border-l-[#E8002D] bg-[#E8002D]/[0.04]"
    : isSC ? "border-l-amber-500 bg-amber-500/[0.04]"
    : isVSC ? "border-l-amber-500 bg-amber-500/[0.03]"
    : isDNF ? "border-l-red-400"
    : isPenalty ? "border-l-purple-400 bg-purple-500/[0.04]"
    : isGreen ? "border-l-green-400"
    : "border-l-white/10";

  const time = rc.date ? new Date(rc.date).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className={`flex items-start gap-2 p-2 border-l-2 mb-1 text-[11px] ${borderColor}`}>
      <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/20 min-w-[40px]">{time}</span>
      <span className="text-white/60">{rc.message}</span>
    </div>
  );
}

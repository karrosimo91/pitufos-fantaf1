"use client";
import { Flag, AlertTriangle, ShieldAlert, XCircle, Gavel, Play, CheckCircle2 } from "lucide-react";
import type { LiveEventCard } from "../../lib/live-events";

const ICON: Record<LiveEventCard["kind"], React.ReactNode> = {
  sc: <ShieldAlert size={15} className="text-[#ffb000]" />,
  vsc: <ShieldAlert size={15} className="text-[#ffb000]" />,
  red: <Flag size={15} className="text-[#E8002D]" />,
  dnf: <XCircle size={15} className="text-[#E8002D]" />,
  penalty: <Gavel size={15} className="text-[#b026ff]" />,
  start: <Play size={15} className="text-[#2ee59d]" />,
  end: <CheckCircle2 size={15} className="text-white" />,
  green: <Flag size={15} className="text-[#2ee59d]" />,
  wet: <AlertTriangle size={15} className="text-[#3987e5]" />,
  other: <AlertTriangle size={15} className="text-white/50" />,
};

/** Gli eventi di gara tradotti, con cosa cambiano per il mio punteggio. */
export function EventiPerTe({ cards, limit = 12 }: { cards: LiveEventCard[]; limit?: number }) {
  if (cards.length === 0) {
    return <div className="hud-card p-4 text-[13px] text-white/50">Nessun evento ancora: partenza, Safety Car, ritiri e penalità compariranno qui, con l&apos;effetto sui tuoi punti.</div>;
  }
  return (
    <div className="space-y-1.5">
      {cards.slice(0, limit).map((c, i) => {
        const time = c.date ? new Date(c.date).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";
        return (
          <div key={`${c.date}-${i}`} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${c.sign === "up" ? "border-[#2ee59d]/30 bg-[#2ee59d]/[0.04]" : c.sign === "down" ? "border-[#E8002D]/30 bg-[#E8002D]/[0.04]" : "border-[#1c1c26] bg-[#0e0e14]"}`}>
            <div className="mt-0.5 shrink-0">{ICON[c.kind]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold">{c.title}</div>
              {c.impact && <div className={`text-[12px] mt-0.5 ${c.sign === "up" ? "text-[#2ee59d]" : c.sign === "down" ? "text-[#E8002D]" : "text-white/60"}`}>{c.impact}</div>}
            </div>
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/40 shrink-0">{time}</div>
          </div>
        );
      })}
    </div>
  );
}

"use client";
import type { ReactNode } from "react";
import { Crown, Zap, UserPlus } from "lucide-react";
import { getDriverByNumber } from "../lib/drivers-data";

export type DriverRole = "captain" | "boost" | "sesto" | null;

export interface DriverTileProps {
  driverNumber: number;
  price?: number;
  priceDelta?: number;
  /** Ultimi weekend: punti base, dal più recente */
  form?: { round: number; points: number; raced: boolean }[];
  /** Es. "3/5 in lega · capitano di 2" */
  metaLine?: string | null;
  /** Es. "Non ha corso a Baku" */
  warnLabel?: string | null;
  role?: DriverRole;
  /** Riga sotto il ruolo, es. "+50 se vince · −20 se ritiro" */
  roleHint?: string | null;
  /** Es. "come a Baku · tocca per riconfermare" */
  proposedHint?: string | null;
  selected?: boolean;
  dimmed?: boolean;
  onTap?: () => void;
  /** Area azione a destra (bottoni) */
  right?: ReactNode;
  /** Punti weekend da mostrare a destra */
  points?: number | null;
  className?: string;
}

const ROLE_TAB: Record<Exclude<DriverRole, null>, { label: string; icon: ReactNode }> = {
  captain: { label: "PRIMO PILOTA ×2", icon: <Crown size={10} /> },
  boost: { label: "BOOST ×3", icon: <Zap size={10} /> },
  sesto: { label: "SESTO UOMO", icon: <UserPlus size={10} /> },
};

/**
 * Scheda pilota unica per Mercato, Muretto e selettori chip: colore scuderia
 * solo sulla barra e sul numero; ruolo (capitano/boost/sesto) come linguetta
 * bianca con parole, mai come cornice colorata; verde/rosso solo per i punti.
 */
export default function DriverTile({
  driverNumber, price, priceDelta, form, metaLine, warnLabel, role = null, roleHint, proposedHint,
  selected, dimmed, onTap, right, points, className = "",
}: DriverTileProps) {
  const d = getDriverByNumber(driverNumber);
  if (!d) return null;
  const color = `#${d.teamColour}`;
  const tab = role ? ROLE_TAB[role] : null;
  const Wrapper = onTap ? "button" : "div";

  return (
    <Wrapper
      type={onTap ? "button" : undefined}
      onClick={onTap}
      className={`relative w-full text-left rounded-lg border px-3 py-3 transition-colors ${onTap ? "tap" : ""} ${
        selected
          ? "bg-white/[0.06] border-white/40"
          : role === "sesto"
            ? "bg-[#0e0e14] border-dashed border-white/25"
            : "bg-[#0e0e14] border-[#1c1c26]"
      } ${dimmed ? "opacity-45" : ""} ${className}`}
    >
      {tab && (
        <div className="absolute -top-2 left-3 flex items-center gap-1 bg-white text-black font-[family-name:var(--font-jetbrains)] text-[10px] font-extrabold tracking-[1.2px] px-2 py-0.5 rounded-sm">
          {tab.icon}{tab.label}
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="w-[3px] h-11 rounded shrink-0" style={{ backgroundColor: color }} />
        <div
          className="w-10 h-10 rounded flex items-center justify-center shrink-0 border border-[#1c1c26] font-[family-name:var(--font-jetbrains)] text-[14px] font-extrabold tabular-nums"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {d.number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] truncate tracking-[-0.2px]">{d.name}</div>
          {warnLabel && <div className="mt-0.5"><span className="pill pill-amber text-[10px] px-1.5 py-0">{warnLabel}</span></div>}
          <div className="flex items-center gap-2 mt-0.5 font-[family-name:var(--font-jetbrains)] text-[11px] text-white/60 tracking-[0.3px] min-w-0">
            <span className="uppercase truncate">{d.team}</span>
            {price != null && (
              <span className="shrink-0 text-white/85 font-bold tabular-nums">
                {price} <span className="text-white/45 font-normal">S</span>
                {priceDelta != null && priceDelta !== 0 && (
                  <span className={`ml-1 ${priceDelta > 0 ? "text-[#2ee59d]" : "text-[#E8002D]"}`}>
                    {priceDelta > 0 ? "▲" : "▼"}{Math.abs(priceDelta)}
                  </span>
                )}
              </span>
            )}
            {form && form.length > 0 && (
              <span className="shrink-0 tabular-nums" title="Punti base negli ultimi weekend">
                {form.map((f, i) => (
                  <span key={f.round}>
                    {i > 0 && <span className="text-white/50"> · </span>}
                    <span className={!f.raced ? "text-white/50" : f.points > 0 ? "text-[#2ee59d]" : f.points < 0 ? "text-[#E8002D]" : "text-white/45"}>
                      {f.raced ? (f.points > 0 ? `+${f.points}` : f.points) : "—"}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </div>
          {(metaLine || roleHint || proposedHint) && (
            <div className="mt-1 text-[11px] leading-snug">
              {roleHint && <span className="text-white/70">{roleHint}</span>}
              {roleHint && (metaLine || proposedHint) && <span className="text-white/50"> · </span>}
              {proposedHint && <span className="text-[#ffb000]">{proposedHint}</span>}
              {proposedHint && metaLine && <span className="text-white/50"> · </span>}
              {metaLine && <span className="text-white/45">{metaLine}</span>}
            </div>
          )}
        </div>
        {points != null && (
          <span className={`font-[family-name:var(--font-jetbrains)] font-extrabold text-[17px] shrink-0 tabular-nums ${points > 0 ? "text-[#2ee59d]" : points < 0 ? "text-[#E8002D]" : "text-white/40"}`}>
            {points > 0 ? "+" : ""}{points}
          </span>
        )}
        {right && <div className="shrink-0 flex items-center gap-1.5">{right}</div>}
      </div>
    </Wrapper>
  );
}

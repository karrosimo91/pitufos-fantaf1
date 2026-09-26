"use client";
import { Crown } from "lucide-react";
import { DRIVERS_2026 } from "../../lib/drivers-data";

export interface MatrixPlayer {
  userId: string;
  name: string;
  drivers: number[];
  captain: number | null;
  isMe: boolean;
}

/** Matrice "chi ha chi": piloti in riga, Team Principal in colonna. */
export function ChiHaChi({ players, roundLabel }: { players: MatrixPlayer[]; roundLabel: string }) {
  if (players.length === 0) return <div className="hud-card p-4 text-[13px] text-white/55">Formazioni non ancora visibili: si svelano alla chiusura della formazione.</div>;
  const owned = new Map<number, number>();
  for (const p of players) for (const n of p.drivers) owned.set(n, (owned.get(n) ?? 0) + 1);
  const rows = DRIVERS_2026.filter((d) => owned.has(d.number)).sort((a, b) => (owned.get(b.number)! - owned.get(a.number)!) || b.price - a.price);
  const short = (s: string) => (s.length > 7 ? s.slice(0, 6) + "…" : s);

  return (
    <div className="hud-card overflow-x-auto no-scrollbar">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[#1c1c26]">
            <th className="text-left px-3 py-2 hud-label font-bold">{roundLabel}</th>
            {players.map((p) => (
              <th key={p.userId} className={`px-1 py-2 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[0.3px] uppercase text-center ${p.isMe ? "text-white" : "text-white/55"}`} title={p.name}>{p.isMe ? "TU" : short(p.name)}</th>
            ))}
            <th className="px-2 py-2 hud-label text-right">TOT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.number} className="border-b border-[#1c1c26] last:border-b-0">
              <td className="px-3 py-1.5 whitespace-nowrap">
                <span className="inline-block w-1 h-3 rounded mr-2 align-middle" style={{ backgroundColor: `#${d.teamColour}` }} />
                <span className="font-semibold">{d.name.split(" ").pop()}</span>
              </td>
              {players.map((p) => {
                const has = p.drivers.includes(d.number);
                const cap = p.captain === d.number;
                return (
                  <td key={p.userId} className="text-center py-1.5">
                    {has ? (cap ? <Crown size={12} className="inline text-white" /> : <span className={`inline-block w-2 h-2 rounded-full ${p.isMe ? "bg-white" : "bg-white/50"}`} />) : <span className="text-white/15">·</span>}
                  </td>
                );
              })}
              <td className="text-right px-2 py-1.5 font-[family-name:var(--font-jetbrains)] text-white/60 tabular-nums">{owned.get(d.number)}/{players.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

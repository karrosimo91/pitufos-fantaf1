"use client";
import { X } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { FormSpark } from "./FormSpark";
import { getRaceByRound } from "../../lib/races";
import { getDriverByNumber } from "../../lib/drivers-data";
import { chipLabel } from "../../lib/chip-labels";

export interface SeasonRow {
  userId: string;
  tpName: string;
  scuderiaName: string;
  points: number;
  realPoints: number;
  position: number;
  prevPosition: number | null;
  gp: number;
  wins: number;
  podiums: number;
  best: { round: number; points: number } | null;
  worst: { round: number; points: number } | null;
  avg: number | null;
  /** Punti weekend per round (null = non giocato), ordine dei round */
  perRound: (number | null)[];
  /** Chip ancora disponibili nella metà stagione corrente */
  chipsPiloti: string[];
  chipsPrevisioni: string[];
  /** Rosa del round mostrato nella matrice (solo a formazione chiusa) */
  roster: { drivers: number[]; captain: number | null; round: number } | null;
}

/** Scheda stagione di un rivale: testa a testa con me, forma, record, chip usati. */
export function PlayerSeasonSheet({ row, me, rounds, onClose }: { row: SeasonRow; me: SeasonRow | null; rounds: number[]; onClose: () => void }) {
  const isMe = me?.userId === row.userId;
  let won = 0, lost = 0, tied = 0;
  const h2hRounds: { round: number; him: number; me: number }[] = [];
  if (me && !isMe) {
    rounds.forEach((r, i) => {
      const a = row.perRound[i];
      const b = me.perRound[i];
      if (a === null || a === undefined || b === null || b === undefined) return;
      h2hRounds.push({ round: r, him: a, me: b });
      if (a > b) won++; else if (a < b) lost++; else tied++;
    });
  }
  const gap = me && !isMe ? row.points - me.points : 0;
  const streak = (() => {
    let s = 0;
    for (let i = h2hRounds.length - 1; i >= 0; i--) {
      const x = h2hRounds[i];
      const sign = x.him > x.me ? 1 : x.him < x.me ? -1 : 0;
      if (i === h2hRounds.length - 1) { s = sign; continue; }
      if (sign === Math.sign(s) && sign !== 0) s += sign; else break;
    }
    return s;
  })();

  return (
    <BottomSheet
      onClose={onClose}
      header={
        <>
          <div className="min-w-0">
            <div className="font-bold text-base truncate">{row.tpName}{isMe ? " · tu" : ""}</div>
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/50 uppercase tracking-[0.5px] truncate">{row.scuderiaName}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="font-[family-name:var(--font-jetbrains)] text-[20px] font-extrabold tabular-nums leading-none">{row.points}</div>
              <div className="hud-label">{row.position}° · {row.realPoints} reale</div>
            </div>
            <button onClick={onClose} className="text-white/40 p-1"><X size={20} /></button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        {me && !isMe && (
          <div className="hud-card hud-card-accent p-3.5">
            <div className="hud-label mb-1">TESTA A TESTA · TU vs {row.tpName.toUpperCase()}</div>
            <div className="text-[14px] font-bold">
              {gap > 0 ? `Ti precede di ${gap} punti` : gap < 0 ? `Lo precedi di ${-gap} punti` : "Pari punti"}
            </div>
            <div className="text-[12px] text-white/65 mt-1">
              Weekend: hai vinto {lost}, perso {won}{tied > 0 ? `, pari ${tied}` : ""} su {h2hRounds.length}.
              {streak !== 0 && ` ${streak > 0 ? `Ha vinto gli ultimi ${streak}` : `Hai vinto gli ultimi ${-streak}`}${Math.abs(streak) === 1 ? " weekend" : " weekend"}.`}
            </div>
            {h2hRounds.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {h2hRounds.slice(-8).map((x) => (
                  <span key={x.round} className={`font-[family-name:var(--font-jetbrains)] text-[10px] px-1.5 py-0.5 rounded border ${x.him > x.me ? "border-[#E8002D]/40 text-[#E8002D]" : x.him < x.me ? "border-[#2ee59d]/40 text-[#2ee59d]" : "border-white/20 text-white/50"}`} title={`R${x.round}: ${x.him} vs ${x.me}`}>
                    R{x.round} {x.him > x.me ? "L" : x.him < x.me ? "W" : "="}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="GP" value={String(row.gp)} />
          <Stat label="MEDIA" value={row.avg !== null ? String(row.avg) : "—"} />
          <Stat label="WEEKEND VINTI" value={String(row.wins)} sub={`${row.podiums} podi`} />
        </div>

        <div>
          <div className="hud-label mb-2">Forma · ultimi weekend</div>
          <FormSpark values={row.perRound.slice(-8)} height={28} />
          <div className="text-[12px] text-white/55 mt-1.5">
            {row.best && <>Miglior weekend {row.best.points} a {getRaceByRound(row.best.round)?.circuit ?? `R${row.best.round}`}</>}
            {row.worst && <> · peggiore {row.worst.points} a {getRaceByRound(row.worst.round)?.circuit ?? `R${row.worst.round}`}</>}
          </div>
        </div>

        {row.roster && (
          <div>
            <div className="hud-label mb-2">Rosa · {getRaceByRound(row.roster.round)?.circuit ?? `R${row.roster.round}`}</div>
            <div className="flex flex-wrap gap-1.5">
              {row.roster.drivers.map((n) => {
                const d = getDriverByNumber(n);
                const cap = n === row.roster!.captain;
                return (
                  <span key={n} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[12px] border ${cap ? "border-white/60 bg-white/[0.08] font-bold" : "border-[#1c1c26] bg-black/30"}`}>
                    <span className="w-1 h-3 rounded" style={{ backgroundColor: `#${d?.teamColour ?? "555"}` }} />
                    {d?.name.split(" ").pop() ?? `#${n}`}{cap ? " (C)" : ""}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="hud-label mb-2">Chip ancora disponibili · questa metà stagione</div>
          {row.chipsPiloti.length + row.chipsPrevisioni.length === 0 ? (
            <div className="text-[12px] text-white/50">Nessuno: li ha usati tutti.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {[...row.chipsPiloti, ...row.chipsPrevisioni].map((c, i) => <span key={`${c}-${i}`} className="pill pill-green">{chipLabel(c)}</span>)}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-black/30 border border-[#1c1c26] rounded p-3 text-center">
      <div className="font-[family-name:var(--font-jetbrains)] text-[18px] font-extrabold tabular-nums leading-none">{value}</div>
      <div className="hud-label mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-white/45 mt-0.5">{sub}</div>}
    </div>
  );
}

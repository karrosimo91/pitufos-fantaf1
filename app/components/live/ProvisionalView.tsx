"use client";
import { useState } from "react";
import { X } from "lucide-react";
import type { ProvisionalData } from "../../lib/provisional-scores";
import { BottomSheet } from "../ui/BottomSheet";
import { SectionHead } from "../ui/SectionHead";
import { PUNTI_REALE } from "../../lib/classifica-reale";

const SESSION_IT: Record<string, string> = { Qualifying: "Qualifiche", "Sprint Qualifying": "Sprint Shootout", Sprint: "Sprint", Race: "Gara" };

/**
 * Classifica provvisoria a sessione conclusa (risultati non ancora
 * ufficiali): righe toccabili con lo spacchettamento per sessione.
 */
export function ProvisionalView({ provisional, userId, members }: { provisional: ProvisionalData; userId?: string; members: Set<string> | null }) {
  const [sel, setSel] = useState<string | null>(null);
  const rows = members ? provisional.scores.filter((s) => members.has(s.userId)) : provisional.scores;
  const selected = sel ? rows.find((r) => r.userId === sel) : null;
  const sessions = provisional.sessions ?? [];

  return (
    <div>
      <div className="hud-card p-3.5 mb-3 text-[12px] text-white/70">
        <span className="pill pill-amber mr-2">PROVVISORIO</span>
        {SESSION_IT[provisional.currentSessionName] ?? provisional.currentSessionName} conclusa: punteggi dal live, in attesa del calcolo ufficiale (Driver of the Day, penalità post-gara, griglia reale).
      </div>
      <SectionHead title="Classifica weekend" right={`${rows.length} TEAM`} className="mt-0" />
      <div className="hud-card overflow-hidden mb-4">
        {rows.map((entry, i) => {
          const isMe = entry.userId === userId;
          return (
            <button key={entry.userId} onClick={() => setSel(entry.userId)} className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left tap ${i < rows.length - 1 ? "border-b border-[#1c1c26]" : ""} ${isMe ? "bg-[#ffb000]/[0.06] border-l-[3px] border-l-[#ffb000]" : ""}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-bold w-5 text-center ${i === 0 || isMe ? "text-[#ffb000]" : "text-white/45"}`}>{i + 1}</div>
                <div className="min-w-0">
                  <div className={`text-[13px] font-semibold truncate ${isMe ? "text-white" : ""}`}>{entry.scuderiaName}</div>
                  <div className="text-[11px] text-white/45 truncate">@{entry.tpName}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-[family-name:var(--font-jetbrains)] text-base font-bold ${isMe ? "text-white" : "text-white/80"}`}>{entry.points}</span>
                {i < 10 && <span className="pill pill-muted text-[10px] px-1.5 py-0">{PUNTI_REALE[i]} REALE</span>}
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <BottomSheet onClose={() => setSel(null)} header={
          <>
            <div className="min-w-0"><div className="font-bold text-base truncate">{selected.tpName}</div><div className="text-[12px] text-white/50 truncate">{selected.scuderiaName}</div></div>
            <div className="flex items-center gap-3"><span className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-[#ffb000]">{selected.points}</span><button onClick={() => setSel(null)} className="text-white/40 p-1"><X size={20} /></button></div>
          </>
        }>
          <div className="hud-label mb-2">Per sessione · provvisorio</div>
          <div className="space-y-1">
            {sessions.map((s) => (
              <div key={s.sessionName} className="flex items-center justify-between text-[13px] px-3 py-2 bg-black/30 border border-[#1c1c26] rounded">
                <span className="text-white/70">{SESSION_IT[s.sessionName] ?? s.sessionName}</span>
                <span className="font-[family-name:var(--font-jetbrains)] font-bold tabular-nums">{s.scores[selected.userId] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="text-[12px] text-white/50 mt-3">Il dettaglio per pilota arriva con il calcolo ufficiale.</div>
        </BottomSheet>
      )}
    </div>
  );
}

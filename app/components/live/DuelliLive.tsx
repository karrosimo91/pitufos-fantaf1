"use client";
import type { DuelloLive } from "../../lib/classifica-generale-live";
import { SectionHead } from "../ui/SectionHead";

/**
 * Duelli della Classifica Generale live: primo contro secondo, secondo contro
 * terzo, e così via. Per ogni coppia il distacco attuale e come si è mosso
 * nel weekend in corso (chi insegue recupera, chi precede allunga, sorpasso).
 * I duelli che riguardano me sono evidenziati.
 */
export function DuelliLive({ duelli, loading }: { duelli: DuelloLive[]; loading: boolean }) {
  if (loading && duelli.length === 0) {
    return <div className="text-center py-8 text-white/45 text-sm">Caricamento duelli…</div>;
  }
  if (duelli.length === 0) {
    return <div className="text-center py-8 text-white/45 text-sm">Servono almeno due Team Principal in classifica.</div>;
  }

  return (
    <>
      <SectionHead title="Duelli" right={`${duelli.length} TESTA A TESTA`} />
      <div className="text-[12px] text-white/55 mb-2">Posizioni adiacenti della Classifica Generale, con il weekend in corso. Il distacco si muove in tempo reale.</div>
      <div className="space-y-2 mb-4">
        {duelli.map((d) => <DuelloCard key={`${d.ahead.userId}-${d.behind.userId}`} d={d} />)}
      </div>
    </>
  );
}

function DuelloCard({ d }: { d: DuelloLive }) {
  const trend = d.sorpasso
    ? { text: `Sorpasso: ${d.ahead.tpName} era dietro a inizio weekend`, cls: "text-[#ffb000]" }
    : d.delta < 0
      ? { text: `${d.behind.tpName} recupera ${-d.delta} nel weekend`, cls: "text-[#2ee59d]" }
      : d.delta > 0
        ? { text: `${d.ahead.tpName} allunga di ${d.delta} nel weekend`, cls: "text-[#E8002D]" }
        : { text: "Distacco invariato nel weekend", cls: "text-white/45" };

  return (
    <div className={`hud-card p-3.5 ${d.involvesMe ? "hud-card-accent" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="hud-label">P{d.position} vs P{d.position + 1}</div>
        {d.involvesMe && <span className="pill pill-accent text-[10px] px-1.5 py-0">IL TUO DUELLO</span>}
      </div>
      <div className="flex items-center gap-3">
        <Contendente row={d.ahead} align="left" />
        <div className="text-center shrink-0 min-w-[64px]">
          <div className="font-[family-name:var(--font-jetbrains)] text-[22px] font-extrabold tabular-nums leading-none">
            {d.gap === 0 ? "=" : d.gap}
          </div>
          <div className="hud-label mt-1">{d.gap === 0 ? "PARI" : "PUNTI"}</div>
        </div>
        <Contendente row={d.behind} align="right" />
      </div>
      <div className={`text-[12px] mt-2.5 ${trend.cls}`}>{trend.text}</div>
    </div>
  );
}

function Contendente({ row, align }: { row: DuelloLive["ahead"]; align: "left" | "right" }) {
  return (
    <div className={`flex-1 min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <div className={`text-[14px] font-bold truncate ${row.isMe ? "text-white" : "text-white/85"}`}>
        {row.tpName}{row.isMe ? " · tu" : ""}
      </div>
      <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/50 uppercase tracking-[0.3px] truncate">
        {row.scuderiaName}
      </div>
      <div className="font-[family-name:var(--font-jetbrains)] text-[13px] font-bold tabular-nums mt-1">
        {row.total}
      </div>
    </div>
  );
}

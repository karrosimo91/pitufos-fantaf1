"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DuelloLive, DuelloStorico } from "../../lib/classifica-generale-live";
import { SectionHead } from "../ui/SectionHead";

/**
 * Duelli della Classifica Generale: primo contro secondo, secondo contro
 * terzo, e così via. Per ogni coppia il distacco attuale e, se il weekend è
 * in corso (`weekendAttivo`), come si è mosso nel weekend (chi insegue
 * recupera, chi precede allunga, sorpasso). Con `storico` aggiunge il
 * bilancio stagionale fra i due (weekend vinti, ultimi confronti, ultimo GP).
 * I duelli che riguardano me sono evidenziati.
 */
export function DuelliLive({
  duelli, loading, weekendAttivo = true, storico, pageHref, title = "Duelli",
}: {
  duelli: DuelloLive[];
  loading: boolean;
  /** Il weekend è in corso: mostra il movimento del distacco nel weekend */
  weekendAttivo?: boolean;
  /** Storico stagionale di un duello (null se non disponibile) */
  storico?: (d: DuelloLive) => DuelloStorico | null;
  /** Link alla pagina dedicata ai duelli */
  pageHref?: string;
  title?: string;
}) {
  if (loading && duelli.length === 0) {
    return <div className="text-center py-8 text-white/45 text-sm">Caricamento duelli…</div>;
  }
  if (duelli.length === 0) {
    return <div className="text-center py-8 text-white/45 text-sm">Servono almeno due Team Principal in classifica.</div>;
  }

  return (
    <>
      <SectionHead title={title} right={`${duelli.length} TESTA A TESTA`} />
      <div className="text-[12px] text-white/55 mb-2">
        Posizioni adiacenti della Classifica Generale{weekendAttivo ? ", con il weekend in corso. Il distacco si muove in tempo reale." : "."}
      </div>
      <div className="space-y-2 mb-4">
        {duelli.map((d) => <DuelloCard key={`${d.ahead.userId}-${d.behind.userId}`} d={d} weekendAttivo={weekendAttivo} storico={storico?.(d) ?? null} />)}
      </div>
      {pageHref && (
        <Link href={pageHref} className="flex items-center gap-3 hud-card p-3.5 mb-4 tap">
          <div className="flex-1 text-[13px] font-bold">Pagina Duelli: storico stagionale di ogni testa a testa</div>
          <ChevronRight size={16} className="text-white/45" />
        </Link>
      )}
    </>
  );
}

function DuelloCard({ d, weekendAttivo, storico }: { d: DuelloLive; weekendAttivo: boolean; storico: DuelloStorico | null }) {
  const trend = !weekendAttivo
    ? null
    : d.sorpasso
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
      {trend && <div className={`text-[12px] mt-2.5 ${trend.cls}`}>{trend.text}</div>}
      {storico && <Storico d={d} s={storico} />}
    </div>
  );
}

function Storico({ d, s }: { d: DuelloLive; s: DuelloStorico }) {
  const giocati = s.wonAhead + s.wonBehind + s.tied;
  if (giocati === 0) return null;
  const ultimo = s.ultimoGp;
  return (
    <div className="mt-2.5 pt-2.5 border-t border-[#1c1c26]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] text-white/65">
          Weekend: <span className="font-[family-name:var(--font-jetbrains)] font-bold text-white/85 tabular-nums">{s.wonAhead}</span>
          <span className="text-white/45"> {d.ahead.tpName}</span>
          <span className="text-white/45"> · </span>
          <span className="font-[family-name:var(--font-jetbrains)] font-bold text-white/85 tabular-nums">{s.wonBehind}</span>
          <span className="text-white/45"> {d.behind.tpName}</span>
          {s.tied > 0 && <span className="text-white/45"> · {s.tied} pari</span>}
        </div>
        {ultimo && (
          <div className={`font-[family-name:var(--font-jetbrains)] text-[11px] tabular-nums shrink-0 ${ultimo.delta > 0 ? "text-[#E8002D]" : ultimo.delta < 0 ? "text-[#2ee59d]" : "text-white/45"}`} title={`Ultimo GP giocato da entrambi: R${ultimo.round}`}>
            R{ultimo.round} {ultimo.delta > 0 ? `+${ultimo.delta}` : ultimo.delta === 0 ? "=" : ultimo.delta}
          </div>
        )}
      </div>
      {s.recent.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {s.recent.map((x) => {
            const aheadWins = x.ahead > x.behind;
            const behindWins = x.ahead < x.behind;
            return (
              <span
                key={x.round}
                className={`font-[family-name:var(--font-jetbrains)] text-[10px] px-1.5 py-0.5 rounded border ${aheadWins ? "border-[#E8002D]/40 text-[#E8002D]" : behindWins ? "border-[#2ee59d]/40 text-[#2ee59d]" : "border-white/20 text-white/50"}`}
                title={`R${x.round}: ${d.ahead.tpName} ${x.ahead} · ${d.behind.tpName} ${x.behind}`}
              >
                R{x.round} {x.ahead}–{x.behind}
              </span>
            );
          })}
        </div>
      )}
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

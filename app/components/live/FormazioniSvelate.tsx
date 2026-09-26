"use client";
import { useMemo } from "react";
import { Crown, Zap, UserPlus, Share2 } from "lucide-react";
import { getDriverByNumber } from "../../lib/drivers-data";
import type { PlayerFormazione, PlayerPrevisioni } from "../../lib/use-weekend-classifica";
import { chipLabel } from "../../lib/chip-labels";
import { shareText } from "../../lib/share";
import { useToast } from "../ui/Toast";
import { SectionHead } from "../ui/SectionHead";

function last(n: number): string {
  return getDriverByNumber(n)?.name.split(" ").pop() ?? `#${n}`;
}

function prevLine(p: PlayerPrevisioni | undefined): string {
  if (!p) return "Nessuna previsione";
  const yn = (v: boolean | null) => (v === true ? "SÌ" : v === false ? "NO" : "—");
  return `SC ${yn(p.safety_car)} · VSC ${yn(p.virtual_safety_car)} · Rossa ${yn(p.red_flag)} · Wet ${yn(p.gomme_wet)} · Pole ${yn(p.pole_vince)} · Ritiri ${p.numero_dnf ?? "—"}`;
}

/**
 * Formazioni svelate: alla deadline, una card per Team Principal con rosa,
 * Primo Pilota, aggiornamenti e previsioni, più "vs te" (piloti in comune e
 * diversi). Si condivide nel gruppo con un tocco.
 */
export function FormazioniSvelate({
  formazioni, previsioniByUser, userId, raceName, members,
}: {
  formazioni: PlayerFormazione[];
  previsioniByUser: Map<string, PlayerPrevisioni>;
  userId?: string;
  raceName: string;
  members: Set<string> | null;
}) {
  const toast = useToast();
  const rows = useMemo(() => {
    const list = members ? formazioni.filter((f) => members.has(f.user_id)) : formazioni;
    return [...list].sort((a, b) => (a.user_id === userId ? -1 : b.user_id === userId ? 1 : a.tp_name.localeCompare(b.tp_name)));
  }, [formazioni, members, userId]);
  const me = rows.find((f) => f.user_id === userId) ?? null;

  const onShare = async () => {
    const text = [`Formazioni ${raceName}`, ...rows.map((f) => `${f.tp_name}: ${f.driver_numbers.map((n) => (n === f.primo_pilota ? `${last(n)} (C)` : last(n))).join(", ")}${f.chip_piloti ? ` · ${chipLabel(f.chip_piloti)}` : ""}`)].join("\n");
    const r = await shareText(`Formazioni ${raceName}`, text);
    if (r === "copied") toast.show("Formazioni copiate", { kind: "success", detail: "Incollale nel gruppo" });
    else if (r === "failed") toast.show("Condivisione non riuscita", { kind: "error" });
  };

  if (rows.length === 0) {
    return <div className="hud-card p-6 text-center text-[13px] text-white/55">Nessuna formazione confermata in questa lega per questo round.</div>;
  }

  return (
    <div>
      <SectionHead title="Formazioni svelate" right={<button onClick={onShare} className="flex items-center gap-1 text-white/70"><Share2 size={12} /> CONDIVIDI</button>} className="mt-0" />
      <div className="space-y-2.5">
        {rows.map((f) => {
          const isMe = f.user_id === userId;
          const prev = previsioniByUser.get(f.user_id);
          const shared = me && !isMe ? f.driver_numbers.filter((n) => me.driver_numbers.includes(n)) : [];
          const onlyHim = me && !isMe ? f.driver_numbers.filter((n) => !me.driver_numbers.includes(n)) : [];
          const onlyMe = me && !isMe ? me.driver_numbers.filter((n) => !f.driver_numbers.includes(n)) : [];
          return (
            <div key={f.user_id} className={`hud-card p-3.5 ${isMe ? "border-white/30" : ""}`}>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="font-bold text-[14px] truncate">{f.tp_name}{isMe ? " · tu" : ""}</div>
                  <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/50 uppercase tracking-[0.5px] truncate">{f.scuderia_name}</div>
                </div>
                {f.chip_piloti && <span className="pill pill-amber">{chipLabel(f.chip_piloti)}</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {f.driver_numbers.map((n) => {
                  const d = getDriverByNumber(n);
                  const cap = n === f.primo_pilota;
                  const boost = f.chip_piloti === "boost" && f.chip_piloti_target === n;
                  const dim = me && !isMe && me.driver_numbers.includes(n);
                  return (
                    <span key={n} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[12px] border ${cap ? "border-white/60 bg-white/[0.08] font-bold" : "border-[#1c1c26] bg-black/30"} ${dim ? "opacity-50" : ""}`}>
                      <span className="w-1 h-3 rounded" style={{ backgroundColor: `#${d?.teamColour ?? "555"}` }} />
                      {last(n)}{cap && <Crown size={10} />}{boost && <Zap size={10} className="text-[#ffb000]" />}
                    </span>
                  );
                })}
                {f.chip_piloti === "sesto" && f.sesto_uomo && (
                  <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12px] border border-dashed border-white/30">
                    <UserPlus size={10} />{last(f.sesto_uomo)}
                  </span>
                )}
              </div>
              <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/60 tracking-[0.3px]">
                {prevLine(prev)}{prev?.chip_attivo ? ` · ${chipLabel(prev.chip_attivo)}` : ""}
              </div>
              {me && !isMe && (
                <div className="mt-2 pt-2 border-t border-dashed border-[#1c1c26] text-[12px] text-white/70">
                  <span className="hud-label mr-2">VS TE</span>
                  {shared.length} in comune
                  {onlyHim.length > 0 && <> · lui: <span className="text-white">{onlyHim.map(last).join(", ")}</span></>}
                  {onlyMe.length > 0 && <> · tu: <span className="text-white">{onlyMe.map(last).join(", ")}</span></>}
                  {f.primo_pilota && me.primo_pilota && (f.primo_pilota === me.primo_pilota
                    ? <> · stesso capitano</>
                    : <> · capitano {last(f.primo_pilota)} vs {last(me.primo_pilota)}</>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

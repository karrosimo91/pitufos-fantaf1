"use client";
import { useMemo, useState } from "react";
import { HelpCircle, X, Search } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import DriverTile from "../DriverTile";
import { CHIP_PILOTI_RULES, CHIP_PREVISIONI_RULES, chipStatusText, chipRule, chipRemaining, halfEndRound, type ChipRule } from "../../lib/chip-rules";
import { PAUSA_ESTIVA_ROUND, type ChipUsage } from "../../lib/store";
import { getRaceByRound } from "../../lib/races";
import { DRIVERS_2026 } from "../../lib/drivers-data";
import type { DriverInsight } from "../../lib/use-driver-insights";
import { PREVISIONI_LABELS } from "./previsioni-config";

/**
 * "Aggiornamenti dalla fabbrica": inventario dei chip con i due usi (uno
 * prima e uno dopo la pausa estiva), stato in parole, regola al tocco su "?",
 * tile "Nessuno" esplicita. Bersagli (Boost, Sesto Uomo, Doppia) scelti qui.
 */
export function AggiornamentiSection({
  round, locked,
  chipPiloti, chipPilotiTarget, sestoUomo, chipPilotiUnavailable, pilotiUsage,
  chipPrevisioni, chipPrevisioniTarget, chipPrevisioniUnavailable, previsioniUsage,
  driverNumbers, primoPilota, insights, prices,
  onChipPiloti, onChipPilotiTarget, onSestoUomo, onChipPrevisioni, onChipPrevisioniTarget,
}: {
  round: number;
  locked: boolean;
  chipPiloti: string | null;
  chipPilotiTarget: number | null;
  sestoUomo: number | null;
  chipPilotiUnavailable: Record<string, number>;
  pilotiUsage: ChipUsage[];
  chipPrevisioni: string | null;
  chipPrevisioniTarget: string | null;
  chipPrevisioniUnavailable: Record<string, number>;
  previsioniUsage: ChipUsage[];
  driverNumbers: number[];
  primoPilota: number | null;
  insights: Map<number, DriverInsight>;
  prices: Map<number, number>;
  onChipPiloti: (id: string | null) => void;
  onChipPilotiTarget: (n: number | null) => void;
  onSestoUomo: (n: number | null) => void;
  onChipPrevisioni: (id: string | null) => void;
  onChipPrevisioniTarget: (k: string | null) => void;
}) {
  const [ruleSheet, setRuleSheet] = useState<ChipRule | null>(null);
  const [sestoSheet, setSestoSheet] = useState(false);
  const [search, setSearch] = useState("");
  const half = round < PAUSA_ESTIVA_ROUND ? "prima" : "dopo";
  const halfEnd = halfEndRound(round);
  const halfEndRace = getRaceByRound(halfEnd);

  const usageOf = (list: ChipUsage[], id: string) => list.find((u) => u.id === id);

  const sestoCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DRIVERS_2026
      .filter((d) => !driverNumbers.includes(d.number))
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.team.toLowerCase().includes(q))
      .sort((a, b) => (prices.get(b.number) ?? b.price) - (prices.get(a.number) ?? a.price));
  }, [driverNumbers, search, prices]);

  const renderChip = (c: ChipRule, active: boolean, usedRound: number | null, _usage: ChipUsage | undefined, onSelect: () => void) => {
    const disabled = usedRound != null && !active;
    const left = chipRemaining(round, usedRound);
    return (
      <div key={c.id} className={`relative rounded-lg border p-3 tap ${active ? "bg-white/[0.06] border-white/45" : disabled ? "bg-[#0e0e14] border-[#1c1c26] opacity-50" : "bg-[#0e0e14] border-[#1c1c26]"}`}>
        <button
          type="button"
          disabled={disabled || locked}
          onClick={onSelect}
          className="w-full text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-[family-name:var(--font-jetbrains)] text-[12px] font-bold tracking-[1px] uppercase">{c.label}</div>
            <span className={`pill text-[10px] px-1.5 py-0 ${active ? "pill-accent" : left > 0 ? "pill-green" : "pill-muted"}`} title={`Usi rimasti in questa metà stagione (round ${half === "prima" ? `1–${PAUSA_ESTIVA_ROUND - 1}` : `${PAUSA_ESTIVA_ROUND}–24`})`}>
              {active ? "IN USO" : left > 0 ? "1 RIMASTO" : "0 RIMASTI"}
            </span>
          </div>
          <div className="text-[12px] text-white/70 mt-1 leading-snug">{c.desc}</div>
          <div className={`font-[family-name:var(--font-jetbrains)] text-[11px] mt-1.5 pr-6 ${usedRound != null ? "text-[#ffb000]" : "text-white/45"}`}>
            {active ? "Attivo questo weekend" : chipStatusText(round, usedRound)}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setRuleSheet(c)}
          aria-label={`Regola ${c.label}`}
          className="absolute bottom-2 right-2 text-white/40 p-1"
        >
          <HelpCircle size={15} />
        </button>
      </div>
    );
  };

  const noneTile = (active: boolean, onSelect: () => void, label: string) => (
    <button
      type="button"
      disabled={locked}
      onClick={onSelect}
      className={`rounded-lg border p-3 text-left tap ${active ? "bg-white/[0.06] border-white/45" : "bg-[#0e0e14] border-[#1c1c26] border-dashed"}`}
    >
      <div className="font-[family-name:var(--font-jetbrains)] text-[12px] font-bold tracking-[1px] uppercase text-white/80">{label}</div>
      <div className="text-[12px] text-white/55 mt-1">Tieni i chip per un altro weekend</div>
    </button>
  );

  const boostTarget = chipPilotiTarget ? driverNumbers.includes(chipPilotiTarget) && chipPilotiTarget !== primoPilota : false;

  return (
    <section className="mb-5">
      <div className="flex items-end justify-between mb-2">
        <h3 className="section-marker">Aggiornamenti dalla fabbrica</h3>
        <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 tracking-[0.5px]">1 piloti + 1 previsioni</div>
      </div>
      <div className="text-[12px] text-white/55 mb-3">
        Un uso per chip in questa metà stagione ({half === "prima" ? `round 1–${PAUSA_ESTIVA_ROUND - 1}` : `round ${PAUSA_ESTIVA_ROUND}–24`}){halfEndRace ? `, scade dopo ${halfEndRace.circuit}` : ""}. Quelli non usati si perdono{half === "prima" ? "; dopo la pausa estiva tornano tutti disponibili" : ""}.
      </div>

      <div className="hud-label mb-2">PILOTI</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {CHIP_PILOTI_RULES.map((c) =>
          renderChip(c, chipPiloti === c.id, chipPilotiUnavailable[c.id] ?? null, usageOf(pilotiUsage, c.id), () => onChipPiloti(chipPiloti === c.id ? null : c.id)),
        )}
        {noneTile(chipPiloti === null, () => onChipPiloti(null), "Nessuno")}
      </div>

      {chipPiloti === "boost" && !locked && (
        <div className="hud-card p-3 mb-3">
          <div className="hud-label mb-2">BOOST ×3 · SCEGLI IL PILOTA (NON IL PRIMO PILOTA)</div>
          {!boostTarget && <div className="text-[12px] text-[#ffb000] mb-2">Scegli il pilota per il Boost: senza, il chip non vale.</div>}
          <div className="space-y-2 pt-1">
            {driverNumbers.filter((n) => n !== primoPilota).map((n) => (
              <DriverTile
                key={n}
                driverNumber={n}
                form={insights.get(n)?.form}
                selected={chipPilotiTarget === n}
                onTap={() => onChipPilotiTarget(chipPilotiTarget === n ? null : n)}
              />
            ))}
          </div>
        </div>
      )}

      {chipPiloti === "sesto" && !locked && (
        <div className="hud-card p-3 mb-3">
          <div className="hud-label mb-2">SESTO UOMO · SOLO QUESTO WEEKEND</div>
          {sestoUomo ? (
            <div className="pt-1">
              <DriverTile
                driverNumber={sestoUomo}
                price={prices.get(sestoUomo)}
                form={insights.get(sestoUomo)?.form}
                role="sesto"
                right={<button onClick={() => onSestoUomo(null)} className="btn-secondary py-2 px-3 text-[10px]">CAMBIA</button>}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setSestoSheet(true)} className="btn-secondary w-full">SCEGLI IL 6° PILOTA</button>
          )}
        </div>
      )}

      <div className="hud-label mb-2 mt-3">PREVISIONI</div>
      <div className="grid grid-cols-2 gap-2">
        {CHIP_PREVISIONI_RULES.map((c) =>
          renderChip(c, chipPrevisioni === c.id, chipPrevisioniUnavailable[c.id] ?? null, usageOf(previsioniUsage, c.id), () => onChipPrevisioni(chipPrevisioni === c.id ? null : c.id)),
        )}
        {noneTile(chipPrevisioni === null, () => onChipPrevisioni(null), "Nessuna")}
      </div>

      {chipPrevisioni === "doppia" && !locked && (
        <div className="hud-card p-3 mt-2">
          <div className="hud-label mb-2">PREVISIONE DOPPIA · SU QUALE?</div>
          {!chipPrevisioniTarget && <div className="text-[12px] text-[#ffb000] mb-2">Scegli la previsione da raddoppiare.</div>}
          <div className="grid grid-cols-2 gap-1.5">
            {PREVISIONI_LABELS.map((p) => {
              const sel = chipPrevisioniTarget === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onChipPrevisioniTarget(sel ? null : p.key)}
                  className={`rounded px-3 py-2.5 text-left text-[13px] border tap ${sel ? "bg-white/[0.06] border-white/45 font-bold" : "bg-[#0e0e14] border-[#1c1c26] text-white/70"}`}
                >
                  {p.label}{sel ? " ×2" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {ruleSheet && (
        <BottomSheet
          onClose={() => setRuleSheet(null)}
          header={
            <>
              <div className="font-bold text-base">{ruleSheet.label}</div>
              <button onClick={() => setRuleSheet(null)} className="text-white/40 p-1"><X size={20} /></button>
            </>
          }
        >
          <p className="text-[14px] text-white/85 leading-relaxed">{ruleSheet.rule}</p>
          <p className="text-[12px] text-white/50 mt-3">Un uso per metà stagione: uno nei round 1–{PAUSA_ESTIVA_ROUND - 1}, uno nei round {PAUSA_ESTIVA_ROUND}–24; alla pausa estiva i contatori si azzerano. Massimo un chip piloti e un chip previsioni per weekend.</p>
        </BottomSheet>
      )}

      {sestoSheet && (
        <BottomSheet
          onClose={() => { setSestoSheet(false); setSearch(""); }}
          header={
            <>
              <div className="min-w-0">
                <div className="font-bold text-base">Sesto Uomo</div>
                <div className="text-[12px] text-white/50">Un pilota in più, solo per questo weekend</div>
              </div>
              <button onClick={() => { setSestoSheet(false); setSearch(""); }} className="text-white/40 p-1"><X size={20} /></button>
            </>
          }
        >
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca pilota o team"
              className="w-full bg-[#0e0e14] border border-[#1c1c26] rounded px-9 py-2.5 text-[14px] outline-none focus:border-white/30"
            />
          </div>
          <div className="space-y-2 pt-1">
            {sestoCandidates.map((d) => (
              <DriverTile
                key={d.number}
                driverNumber={d.number}
                price={prices.get(d.number) ?? d.price}
                form={insights.get(d.number)?.form}
                warnLabel={insights.get(d.number)?.racedLast === false ? "Non ha corso l'ultimo GP" : null}
                onTap={() => { onSestoUomo(d.number); setSestoSheet(false); setSearch(""); }}
              />
            ))}
            {sestoCandidates.length === 0 && <div className="text-center text-white/45 text-[13px] py-6">Nessun pilota trovato</div>}
          </div>
        </BottomSheet>
      )}
    </section>
  );
}

export { chipRule };

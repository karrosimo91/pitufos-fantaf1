"use client";
import { X } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { getDriverByNumber } from "../../lib/drivers-data";
import { getRaceByRound } from "../../lib/races";
import type { DriverInsight } from "../../lib/use-driver-insights";
import type { RoundResults } from "../../lib/season-insights";
import { driverFormByRound } from "../../lib/season-insights";

/** Scheda pilota: forma round per round, storico quotazione, chi lo ha in lega. */
export function DriverSheet({
  driverNumber, price, insight, resultRows, locked, members, onClose, footer,
}: {
  driverNumber: number;
  price: number;
  insight: DriverInsight;
  resultRows: RoundResults[];
  locked: boolean;
  members: number;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const d = getDriverByNumber(driverNumber);
  if (!d) return null;
  const form = driverFormByRound(resultRows, driverNumber);
  const raced = form.filter((f) => f.raced);
  const total = raced.reduce((s, f) => s + f.points, 0);
  const avg = raced.length > 0 ? Math.round((total / raced.length) * 10) / 10 : null;
  const best = raced.length > 0 ? raced.reduce((a, b) => (b.points > a.points ? b : a)) : null;
  const hist = insight.priceHistory;
  const maxP = Math.max(...hist.map((h) => h.price), 1);

  return (
    <BottomSheet
      onClose={onClose}
      header={
        <>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-[3px] h-9 rounded" style={{ backgroundColor: `#${d.teamColour}` }} />
            <div className="min-w-0">
              <div className="font-bold text-base truncate">{d.name}</div>
              <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 uppercase tracking-[0.5px]">#{d.number} · {d.team}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="font-[family-name:var(--font-jetbrains)] text-[20px] font-extrabold tabular-nums leading-none">{price}</div>
              <div className="hud-label">Soldini</div>
            </div>
            <button onClick={onClose} className="text-white/40 p-1"><X size={20} /></button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        {insight.racedLast === false && (
          <div className="pill pill-amber">Non ha corso l&apos;ultimo GP in archivio</div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="MEDIA A GP" value={avg !== null ? String(avg) : "—"} />
          <Stat label="MIGLIOR GP" value={best ? `${best.points > 0 ? "+" : ""}${best.points}` : "—"} sub={best ? getRaceByRound(best.round)?.circuit : undefined} />
          <Stat label="TOTALE" value={raced.length > 0 ? String(total) : "—"} sub={`${raced.length} GP`} />
        </div>

        <div>
          <div className="hud-label mb-2">Ultimi weekend · punti base</div>
          {form.length === 0 ? (
            <div className="text-[13px] text-white/50">Nessun risultato in archivio</div>
          ) : (
            <div className="space-y-1">
              {form.slice(0, 8).map((f) => {
                const race = getRaceByRound(f.round);
                return (
                  <div key={f.round} className="flex items-center justify-between text-[13px] px-3 py-2 bg-black/30 border border-[#1c1c26] rounded">
                    <span className="text-white/70">R{f.round} · {race?.circuit ?? ""}</span>
                    <span className={`font-[family-name:var(--font-jetbrains)] font-bold tabular-nums ${!f.raced ? "text-white/35" : f.points > 0 ? "text-[#2ee59d]" : f.points < 0 ? "text-[#E8002D]" : "text-white/50"}`}>
                      {f.raced ? (f.points > 0 ? `+${f.points}` : f.points) : "non ha corso"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="hud-label mb-2">Quotazione</div>
          <div className="flex items-end gap-1 h-12">
            {hist.map((h, i) => (
              <div key={`${h.round}-${i}`} className="flex-1 flex flex-col items-center justify-end h-full" title={`R${h.round}: ${h.price}`}>
                <div className="w-full rounded-t bg-white/25" style={{ height: `${Math.max(8, (h.price / maxP) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between font-[family-name:var(--font-jetbrains)] text-[11px] text-white/45 mt-1">
            <span>inizio {hist[0]?.price ?? d.price}</span>
            <span>
              ora {price}
              {insight.priceDelta !== 0 && <span className={insight.priceDelta > 0 ? "text-[#2ee59d]" : "text-[#E8002D]"}> ({insight.priceDelta > 0 ? "+" : ""}{insight.priceDelta} dall&apos;ultimo GP)</span>}
            </span>
          </div>
        </div>

        <div>
          <div className="hud-label mb-2">In lega</div>
          <div className="text-[13px] text-white/80">
            {insight.owners === 0 ? "Nessuno lo ha in rosa" : `${insight.owners} su ${members} lo hanno in rosa`}
            {insight.captains > 0 ? ` · capitano di ${insight.captains}` : ""}
          </div>
          {locked && insight.ownerNames.length > 0 && (
            <div className="text-[12px] text-white/55 mt-1">In rosa di: {insight.ownerNames.join(", ")}</div>
          )}
          {!locked && insight.owners > 0 && (
            <div className="text-[12px] text-white/45 mt-1">I nomi si vedono a formazione chiusa.</div>
          )}
        </div>

        {footer}
      </div>
    </BottomSheet>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-black/30 border border-[#1c1c26] rounded p-3 text-center">
      <div className="font-[family-name:var(--font-jetbrains)] text-[18px] font-extrabold tabular-nums leading-none">{value}</div>
      <div className="hud-label mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-white/45 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { getDriverByNumber } from "../../lib/drivers-data";

/**
 * Vendita con conseguenze visibili: se è il Primo Pilota chiede chi diventa
 * capitano; se è il bersaglio del Boost avvisa. Mai silenzioso.
 */
export function SellSheet({
  driver, roster, isCaptain, isBoostTarget, priceOut, cassa, onConfirm, onClose,
}: {
  driver: number;
  roster: number[];
  isCaptain: boolean;
  isBoostTarget: boolean;
  priceOut: number;
  cassa: number;
  onConfirm: (nextCaptain: number | null) => Promise<void>;
  onClose: () => void;
}) {
  const [nextCaptain, setNextCaptain] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const d = getDriverByNumber(driver);
  const others = roster.filter((n) => n !== driver);

  return (
    <BottomSheet
      onClose={onClose}
      header={
        <>
          <div className="min-w-0">
            <div className="font-bold text-base truncate">Vendi {d?.name ?? `#${driver}`}</div>
            <div className="text-[12px] text-white/55">Incassi {priceOut} · cassa {cassa} → {cassa + priceOut}</div>
          </div>
          <button onClick={onClose} className="text-white/40 p-1"><X size={20} /></button>
        </>
      }
    >
      {isCaptain && (
        <div className="hud-card p-3 mb-3">
          <div className="hud-label mb-2">È il tuo Primo Pilota · chi diventa capitano?</div>
          <div className="grid grid-cols-2 gap-1.5">
            {others.map((n) => {
              const od = getDriverByNumber(n);
              const sel = nextCaptain === n;
              return (
                <button key={n} type="button" onClick={() => setNextCaptain(sel ? null : n)}
                  className={`rounded px-3 py-2.5 text-left text-[13px] border tap ${sel ? "bg-white/[0.06] border-white/45 font-bold" : "bg-[#0e0e14] border-[#1c1c26] text-white/70"}`}>
                  {od?.name ?? `#${n}`}
                </button>
              );
            })}
            <button type="button" onClick={() => setNextCaptain(null)}
              className={`rounded px-3 py-2.5 text-left text-[13px] border border-dashed tap ${nextCaptain === null ? "bg-white/[0.06] border-white/45 font-bold" : "bg-[#0e0e14] border-[#1c1c26] text-white/70"}`}>
              Decido dopo nel Muretto
            </button>
          </div>
        </div>
      )}
      {isBoostTarget && (
        <div className="text-[12px] text-[#ffb000] mb-3">Boost Mode perde il bersaglio: dovrai sceglierne un altro nel Muretto.</div>
      )}
      <div className="text-[12px] text-white/55 mb-3">Ricomprarlo dopo conta come un cambio se non era nella rosa di partenza.</div>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(nextCaptain); setBusy(false); }} className="btn-primary">
        {busy ? "VENDITA IN CORSO…" : `VENDI · +${priceOut} SOLDINI`}
      </button>
    </BottomSheet>
  );
}

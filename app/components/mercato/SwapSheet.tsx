"use client";
import { useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import DriverTile from "../DriverTile";
import { getDriverByNumber } from "../../lib/drivers-data";

/**
 * Scambio in un gesto: chi esce per far entrare `driverIn`. Ogni riga dice
 * cosa succede alla cassa prima di confermare. Se esce il Primo Pilota,
 * chiede chi diventa capitano.
 */
export function SwapSheet({
  driverIn, roster, primoPilota, boostTarget, cassa, priceOf, penaltyNext, wildcard,
  onConfirm, onClose,
}: {
  driverIn: number;
  roster: number[];
  primoPilota: number | null;
  boostTarget: number | null;
  cassa: number;
  priceOf: (n: number) => number;
  /** Punti di penalità del prossimo cambio (0 se gratis) */
  penaltyNext: number;
  wildcard: boolean;
  onConfirm: (driverOut: number, nextCaptain: number | null) => Promise<void>;
  onClose: () => void;
}) {
  const [out, setOut] = useState<number | null>(null);
  const [nextCaptain, setNextCaptain] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const dIn = getDriverByNumber(driverIn);
  const priceIn = priceOf(driverIn);
  const captainLeaves = out !== null && out === primoPilota;
  const others = roster.filter((n) => n !== out);

  const confirm = async () => {
    if (out === null || busy) return;
    setBusy(true);
    await onConfirm(out, captainLeaves ? nextCaptain : null);
    setBusy(false);
  };

  return (
    <BottomSheet
      onClose={onClose}
      header={
        <>
          <div className="min-w-0">
            <div className="font-bold text-base truncate">Chi esce per {dIn?.name ?? `#${driverIn}`}?</div>
            <div className="text-[12px] text-white/55">Entra a {priceIn} Soldini · cassa ora {cassa}</div>
          </div>
          <button onClick={onClose} className="text-white/40 p-1"><X size={20} /></button>
        </>
      }
    >
      <div className="space-y-2 pt-1">
        {roster.map((n) => {
          const pOut = priceOf(n);
          const after = cassa + pOut - priceIn;
          const ok = after >= 0;
          const sel = out === n;
          return (
            <DriverTile
              key={n}
              driverNumber={n}
              price={pOut}
              role={n === primoPilota ? "captain" : boostTarget === n ? "boost" : null}
              selected={sel}
              dimmed={!ok}
              onTap={ok ? () => setOut(sel ? null : n) : undefined}
              metaLine={ok ? `cassa ${cassa} → ${after}` : `non basta: ti mancano ${-after}`}
              right={<span className={`font-[family-name:var(--font-jetbrains)] text-[11px] font-bold ${ok ? "text-[#2ee59d]" : "text-[#E8002D]"}`}>{ok ? "OK" : "NO"}</span>}
            />
          );
        })}
      </div>

      {captainLeaves && (
        <div className="mt-4 hud-card p-3">
          <div className="hud-label mb-2">Stai cedendo il Primo Pilota · chi diventa capitano?</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[...others, driverIn].map((n) => {
              const d = getDriverByNumber(n);
              const sel = nextCaptain === n;
              return (
                <button key={n} type="button" onClick={() => setNextCaptain(sel ? null : n)}
                  className={`rounded px-3 py-2.5 text-left text-[13px] border tap ${sel ? "bg-white/[0.06] border-white/45 font-bold" : "bg-[#0e0e14] border-[#1c1c26] text-white/70"}`}>
                  {d?.name ?? `#${n}`}
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

      {out !== null && boostTarget === out && (
        <div className="mt-3 text-[12px] text-[#ffb000]">Boost Mode perde il bersaglio: dovrai sceglierne un altro nel Muretto.</div>
      )}

      <div className="mt-4">
        {penaltyNext > 0 && !wildcard && (
          <div className="text-[12px] text-[#ffb000] font-bold mb-2">Questo cambio costa −{penaltyNext} punti sul weekend (dal 3° in poi).</div>
        )}
        {wildcard && <div className="text-[12px] text-[#2ee59d] mb-2">Wildcard attiva: cambio senza penalità.</div>}
        <button type="button" disabled={out === null || busy} onClick={confirm} className="btn-primary">
          {busy ? "SCAMBIO IN CORSO…" : out === null ? "SCEGLI CHI ESCE" : (
            <><span>{getDriverByNumber(out)?.name.split(" ").pop()}</span><ArrowRight size={14} /><span>{dIn?.name.split(" ").pop()}</span>{penaltyNext > 0 && !wildcard ? ` · −${penaltyNext} PT` : ""}</>
          )}
        </button>
      </div>
    </BottomSheet>
  );
}

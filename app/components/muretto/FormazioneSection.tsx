"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import DriverTile from "../DriverTile";
import type { DriverInsight } from "../../lib/use-driver-insights";
import { PUNTI_GARA } from "../../lib/types";
import { getRaceByRound } from "../../lib/races";

export function FormazioneSection({
  driverNumbers, primoPilota, sestoUomo, chipPiloti, chipPilotiTarget,
  locked, insights, pointsMap, onSetCaptain, onRemoveSesto, proposedFromRound, lastRacedRound, prices, ownershipRound,
}: {
  driverNumbers: number[];
  primoPilota: number | null;
  sestoUomo: number | null;
  chipPiloti: string | null;
  chipPilotiTarget: number | null;
  locked: boolean;
  insights: Map<number, DriverInsight>;
  pointsMap?: Map<number, number> | null;
  onSetCaptain: (n: number) => void;
  onRemoveSesto: () => void;
  proposedFromRound: number | null;
  lastRacedRound: number | null;
  prices: Map<number, number>;
  /** Round a cui si riferisce "N in lega" (null = non mostrare) */
  ownershipRound?: number | null;
}) {
  const hasPoints = !!pointsMap && pointsMap.size > 0;
  const captainHint = `+${PUNTI_GARA[1] * 2} se vince · −20 se ritiro`;
  const proposedRace = proposedFromRound ? getRaceByRound(proposedFromRound) : null;
  const lastRace = lastRacedRound ? getRaceByRound(lastRacedRound) : null;
  const ownRace = ownershipRound ? getRaceByRound(ownershipRound) : null;
  const ownSuffix = ownershipRound && !locked ? ` a ${ownRace?.circuit ?? `R${ownershipRound}`}` : "";

  const rows = [...driverNumbers];

  return (
    <section className="mb-5">
      <div className="flex items-end justify-between mb-2">
        <h3 className="section-marker">La tua formazione</h3>
        <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 tracking-[1px]">
          {driverNumbers.length} / 5{sestoUomo ? " +1" : ""}
        </div>
      </div>

      {rows.length === 0 ? (
        locked ? (
          <div className="hud-card p-6 text-center text-[13px] text-white/55">Nessuna formazione per questo round</div>
        ) : (
          <Link href="/mercato" className="btn-primary">SCEGLI I TUOI 5 PILOTI · 100 SOLDINI <ChevronRight size={14} /></Link>
        )
      ) : (
        <div className="space-y-2.5 pt-1">
          {!locked && (
            <div className="text-[12px] text-white/55 -mt-1 mb-1">Tocca un pilota per farne il Primo Pilota (×2).</div>
          )}
          {rows.map((num) => {
            const ins = insights.get(num);
            const isCaptain = num === primoPilota;
            const isBoost = chipPiloti === "boost" && chipPilotiTarget === num && !isCaptain;
            const proposed = isCaptain && proposedFromRound != null;
            return (
              <DriverTile
                key={num}
                driverNumber={num}
                price={prices.get(num)}
                priceDelta={ins?.priceDelta}
                form={ins?.form}
                role={isCaptain ? "captain" : isBoost ? "boost" : null}
                roleHint={isCaptain ? captainHint : null}
                proposedHint={proposed ? `come a ${proposedRace?.circuit ?? `R${proposedFromRound}`} · da confermare` : null}
                warnLabel={ins?.racedLast === false && lastRace ? `Non ha corso a ${lastRace.circuit}` : null}
                metaLine={ins && ins.owners > 0 ? `${ins.owners} in lega${ownSuffix}${ins.captains > 0 ? ` · capitano di ${ins.captains}` : ""}` : null}
                onTap={!locked && !hasPoints && !isCaptain ? () => onSetCaptain(num) : undefined}
                points={hasPoints ? (pointsMap!.get(num) ?? null) : null}
                className={isCaptain ? "border-white/40" : ""}
              />
            );
          })}
          {sestoUomo && (
            <DriverTile
              driverNumber={sestoUomo}
              price={prices.get(sestoUomo)}
              form={insights.get(sestoUomo)?.form}
              role="sesto"
              roleHint="Solo questo weekend · x1"
              points={hasPoints ? (pointsMap!.get(sestoUomo) ?? null) : null}
              right={!locked && !hasPoints ? (
                <button onClick={onRemoveSesto} className="btn-secondary py-2 px-3 text-[10px]">RIMUOVI</button>
              ) : undefined}
            />
          )}
          {driverNumbers.length < 5 && !locked && (
            <Link href="/mercato" className="btn-secondary w-full border-dashed">
              + AGGIUNGI DAL MERCATO ({driverNumbers.length}/5) <ChevronRight size={14} />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

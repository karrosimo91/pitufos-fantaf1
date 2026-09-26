"use client";
import { Check, AlertTriangle } from "lucide-react";

/**
 * Un solo bottone per tutto il round, fisso sopra la barra di navigazione.
 * Tre stati: manca qualcosa (disabilitato, con l'elenco), da confermare,
 * modifiche non confermate (ambra).
 */
export function ConfermaBar({
  missing, modified, confirming, penaltyLine, onConfirm,
}: {
  missing: string[];
  modified: boolean;
  confirming: boolean;
  penaltyLine?: string | null;
  onConfirm: () => void;
}) {
  const disabled = missing.length > 0 || confirming;
  return (
    <div className="sticky-bar">
      <div className="max-w-3xl mx-auto px-4 py-3">
        {(modified || penaltyLine) && (
          <div className="flex items-center justify-between gap-3 mb-2 text-[12px]">
            {modified ? (
              <span className="flex items-center gap-1.5 text-[#ffb000] font-bold"><AlertTriangle size={13} /> Modifiche non confermate</span>
            ) : <span />}
            {penaltyLine && <span className="text-[#ffb000] shrink-0">{penaltyLine}</span>}
          </div>
        )}
        <button type="button" onClick={onConfirm} disabled={disabled} className="btn-primary">
          {confirming ? "CONFERMA IN CORSO…"
            : missing.length > 0 ? `MANCA: ${missing.join(" · ").toUpperCase()}`
            : <><Check size={15} /> CONFERMA WEEKEND</>}
        </button>
      </div>
    </div>
  );
}

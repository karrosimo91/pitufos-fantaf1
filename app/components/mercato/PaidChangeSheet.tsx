"use client";
import { X, AlertTriangle, Shuffle } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";

/**
 * Cambio a pagamento (dal 3° in poi, −10): conferma, oppure attiva la
 * Wildcard da qui se è ancora disponibile in questa metà stagione.
 */
export function PaidChangeSheet({
  driverName, penalty, wildcardAvailable, wildcardStatus, onConfirm, onWildcard, onClose,
}: {
  driverName: string;
  penalty: number;
  wildcardAvailable: boolean;
  wildcardStatus: string;
  onConfirm: () => void;
  onWildcard: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      onClose={onClose}
      header={
        <>
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={16} className="text-[#ffb000] shrink-0" />
            <div className="font-bold text-base truncate">Cambio a pagamento</div>
          </div>
          <button onClick={onClose} className="text-white/40 p-1"><X size={20} /></button>
        </>
      }
    >
      <p className="text-[14px] text-white/85 mb-1">Hai già usato i 2 cambi gratis di questo round.</p>
      <p className="text-[13px] text-white/60 mb-4">Prendere <span className="text-white font-bold">{driverName}</span> costa <span className="text-[#ffb000] font-bold">−{penalty} punti</span> sul weekend.</p>
      <div className="space-y-2">
        <button type="button" onClick={onConfirm} className="btn-primary">CONFERMA · −{penalty} PT</button>
        <button type="button" disabled={!wildcardAvailable} onClick={onWildcard} className="btn-secondary w-full">
          <Shuffle size={14} /> ATTIVA WILDCARD · CAMBI ILLIMITATI
        </button>
        <div className="text-[11px] text-white/50 text-center">{wildcardStatus}</div>
        <button type="button" onClick={onClose} className="btn-secondary w-full border-transparent text-white/60">ANNULLA</button>
      </div>
    </BottomSheet>
  );
}

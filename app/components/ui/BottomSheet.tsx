"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Modale "a cassetto" per mobile (centrato da sm in su): header fisso e corpo
 * che scorre.
 *
 * Perché un portal su <body> con z-[60]: la BottomNav è `fixed z-50` ed è
 * renderizzata DOPO il contenuto della pagina, quindi a parità di z-index
 * copriva la parte bassa del modale (ancorato in basso su mobile). L'ultima
 * parte del dettaglio finiva sotto la barra e i tocchi lì andavano alla nav:
 * sembrava che il modale non scorresse fino in fondo.
 *
 * `dvh` invece di `vh`: su iOS Safari `vh` è l'altezza con la barra degli
 * indirizzi nascosta, quindi con la barra visibile il fondo usciva dallo
 * schermo. Il padding in fondo rispetta la home indicator (PWA installata).
 */
export function BottomSheet({
  header,
  children,
  onClose,
}: {
  header: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  // Scroll-lock della pagina sotto, altrimenti su mobile lo scroll "scappa"
  // alla pagina e sembra che il modale non scorra.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4"
      onMouseDown={onClose}
      onTouchEnd={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-[#12121e] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[88dvh] overflow-hidden flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.5)]"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 bg-[#12121e] border-b border-white/[0.06] px-5 py-4 flex items-center justify-between gap-3">
          {header}
        </div>
        {/* min-h-0 è indispensabile: senza, il figlio flex non si comprime e il
            contenuto viene tagliato invece di scorrere. */}
        <div
          className="overflow-y-auto flex-1 min-h-0 overscroll-contain px-5 pt-4"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";
import { VIZ } from "./chart-tokens";

export interface HBarItem {
  id: string | number;
  label: string;
  value: number;
  /** Valore mostrato a destra (default: `value`) */
  display?: string;
  /** Colore proprio dell'entità (es. colore scuderia). Default: slot 1. */
  color?: string;
  /** Riga sotto l'etichetta */
  sub?: string;
  highlight?: boolean;
}

/**
 * Barre orizzontali con etichetta diretta e valore sempre visibile fuori
 * dalla barra: nessun testo dentro la barra da tagliare, nessun valore
 * leggibile solo via tooltip.
 */
export function HBarChart({
  items,
  max,
  emptyLabel = "Nessun dato",
}: {
  items: HBarItem[];
  max?: number;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <div className="text-center py-6 text-white/20 text-[12px]">{emptyLabel}</div>;
  }
  const top = max ?? Math.max(...items.map((i) => Math.abs(i.value)), 1);

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const pct = Math.max(0, Math.min(100, (Math.abs(it.value) / top) * 100));
        return (
          <div key={it.id} className="flex items-center gap-2.5">
            <div className="w-[104px] sm:w-[140px] shrink-0 min-w-0">
              <div className={`text-[12px] truncate leading-tight ${it.highlight ? "text-white font-bold" : "text-white/70"}`}>
                {it.label}
              </div>
              {it.sub && <div className="text-[9px] text-white/25 truncate leading-tight">{it.sub}</div>}
            </div>
            <div className="flex-1 h-2.5 rounded-full min-w-0" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div
                className="h-2.5 rounded-full"
                style={{ width: `${pct}%`, backgroundColor: it.color || VIZ.stack1 }}
              />
            </div>
            <div className="w-9 text-right font-[family-name:var(--font-jetbrains)] text-[12px] font-bold tabular-nums text-white/80 shrink-0">
              {it.display ?? it.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

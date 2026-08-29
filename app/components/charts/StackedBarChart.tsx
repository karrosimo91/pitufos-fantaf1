"use client";
import { useMemo, useState } from "react";
import { VIZ, niceTicks, scaleLinear } from "./chart-tokens";
import { useMeasure } from "./useMeasure";

export interface StackedBarRow {
  label: string;
  /** Segmenti impilati, nell'ordine di `seriesLabels`. Ammessi valori negativi. */
  values: number[];
  /** Extra mostrato nel tooltip (es. penalità cambi) */
  note?: string;
}

/**
 * Barre verticali impilate (max 2-3 segmenti). Distanziatore di 2px colore
 * superficie tra i segmenti e tra le barre: niente bordi disegnati.
 * Estremità dati arrotondate 4px, ancorate alla baseline.
 */
export function StackedBarChart({
  rows,
  seriesLabels,
  colors = [VIZ.stack1, VIZ.stack2, VIZ.third],
  height = 200,
  xTitle,
}: {
  rows: StackedBarRow[];
  seriesLabels: string[];
  colors?: string[];
  height?: number;
  xTitle?: string;
}) {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 30;
  const padR = 8;
  const padT = 10;
  const padB = 24;

  const geom = useMemo(() => {
    const w = Math.max(0, width - padL - padR);
    const totals = rows.map((r) => r.values.reduce((a, b) => a + b, 0));
    const posMax = Math.max(0, ...rows.map((r) => r.values.filter((v) => v > 0).reduce((a, b) => a + b, 0)));
    const negMin = Math.min(0, ...rows.map((r) => r.values.filter((v) => v < 0).reduce((a, b) => a + b, 0)));
    const pad = (posMax - negMin) * 0.08 || 1;
    const d1 = posMax + pad;
    const d0 = negMin < 0 ? negMin - pad : 0;
    const y = scaleLinear(d0, d1, height - padB, padT);
    const slot = w / Math.max(1, rows.length);
    const barW = Math.max(4, Math.min(28, slot - 4)); // 2px di gap per lato
    const x = (i: number) => padL + slot * i + slot / 2;
    return { w, y, x, slot, barW, ticks: niceTicks(d0, d1, 4), totals, zero: y(0) };
  }, [width, height, rows]);

  if (width === 0) return <div ref={ref} style={{ height }} />;
  if (rows.length === 0) {
    return (
      <div ref={ref} style={{ height }} className="flex items-center justify-center text-white/20 text-[12px]">
        Nessun dato
      </div>
    );
  }

  const xStep = Math.max(1, Math.ceil(rows.length / 12));

  return (
    <div ref={ref} className="relative select-none">
      <svg width={width} height={height} role="img" aria-label={xTitle || "Grafico a barre"}>
        {geom.ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={geom.y(t)} y2={geom.y(t)} stroke={VIZ.grid} strokeWidth={1} />
            <text x={padL - 6} y={geom.y(t) + 3} textAnchor="end" fontSize={9} fill={VIZ.ink3} style={{ fontVariantNumeric: "tabular-nums" }}>
              {t}
            </text>
          </g>
        ))}

        {rows.map((row, i) => {
          const cx = geom.x(i);
          let posTop = geom.zero;
          let negBottom = geom.zero;
          const isHover = hover === i;
          return (
            <g key={i} opacity={hover === null || isHover ? 1 : 0.45}>
              {row.values.map((v, si) => {
                if (v === 0) return null;
                const h = Math.abs(geom.y(v) - geom.zero);
                let yTop: number;
                if (v > 0) {
                  yTop = posTop - h;
                  posTop = yTop;
                } else {
                  yTop = negBottom;
                  negBottom = yTop + h;
                }
                // 2px di distanziatore colore superficie tra i segmenti
                const drawH = Math.max(1, h - (si > 0 ? 2 : 0));
                return (
                  <rect
                    key={si}
                    x={cx - geom.barW / 2}
                    y={v > 0 ? yTop : yTop}
                    width={geom.barW}
                    height={drawH}
                    rx={3}
                    fill={colors[si % colors.length]}
                  />
                );
              })}
            </g>
          );
        })}

        <line x1={padL} x2={width - padR} y1={geom.zero} y2={geom.zero} stroke={VIZ.axis} strokeWidth={1} />
        {rows.map((r, i) =>
          i % xStep === 0 || i === rows.length - 1 ? (
            <text key={i} x={geom.x(i)} y={height - padB + 13} textAnchor="middle" fontSize={9} fill={VIZ.ink3} style={{ fontVariantNumeric: "tabular-nums" }}>
              {r.label}
            </text>
          ) : null,
        )}

        {rows.map((_, i) => (
          <rect
            key={i}
            x={geom.x(i) - geom.slot / 2}
            y={0}
            width={Math.max(24, geom.slot)}
            height={height}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
            onPointerLeave={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 bg-[#14141c] border border-[#2a2a38] rounded-lg px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] min-w-[120px]"
          style={{ left: Math.min(Math.max(4, geom.x(hover) - 60), Math.max(4, width - 140)) }}
        >
          <div className="font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[1.5px] text-white/35 uppercase mb-1">
            {xTitle ? `${xTitle} ${rows[hover].label}` : rows[hover].label}
          </div>
          {rows[hover].values.map((v, si) => (
            <div key={si} className="flex items-center gap-1.5 text-[11px] leading-[1.5]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colors[si % colors.length] }} />
              <span className="text-white/55">{seriesLabels[si]}</span>
              <span className="ml-auto font-[family-name:var(--font-jetbrains)] font-bold tabular-nums text-white/85">{v}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[11px] leading-[1.5] mt-1 pt-1 border-t border-white/10">
            <span className="text-white/40">Totale</span>
            <span className="ml-auto font-[family-name:var(--font-jetbrains)] font-bold tabular-nums text-white">
              {geom.totals[hover]}
            </span>
          </div>
          {rows[hover].note && <div className="text-[10px] text-amber-400/70 mt-1">{rows[hover].note}</div>}
        </div>
      )}
    </div>
  );
}

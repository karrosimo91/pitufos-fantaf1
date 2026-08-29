"use client";
import { useMemo, useState } from "react";
import { VIZ, linePath, niceDomain, niceTicks, scaleLinear } from "./chart-tokens";
import { useMeasure } from "./useMeasure";

export interface LineSeries {
  id: string;
  label: string;
  /** Un valore per ogni x, `null` dove il dato manca (linea interrotta). */
  values: (number | null)[];
  /** me = rosso brand, alt = blu, muted = grigio recessivo. */
  tone: "me" | "alt" | "muted";
}

const TONE_COLOR = { me: VIZ.me, alt: VIZ.alt, muted: VIZ.muted } as const;

/**
 * Grafico a linee multi-serie con pattern "emphasis": al massimo due tinte
 * categoriche a schermo (tu + avversario selezionato), tutte le altre serie
 * in grigio recessivo. Crosshair + tooltip al passaggio/tocco.
 *
 * `invertY` per le classifiche (posizione 1 in alto).
 */
export function LineChart({
  xLabels,
  series,
  height = 220,
  invertY = false,
  formatValue = (v: number) => String(v),
  xTitle,
}: {
  xLabels: string[];
  series: LineSeries[];
  height?: number;
  invertY?: boolean;
  formatValue?: (v: number) => string;
  xTitle?: string;
}) {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 34;
  const padR = 12;
  const padT = 10;
  const padB = 26; // banda dell'asse x: inclusa nell'altezza, mai tagliata

  const geom = useMemo(() => {
    const w = Math.max(0, width - padL - padR);
    const h = Math.max(0, height - padT - padB);
    const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
    const [d0, d1] = invertY
      ? [Math.max(1, Math.max(...(all.length ? all : [1]))), 1]
      : niceDomain(all);
    const y = scaleLinear(d0, d1, h + padT, padT);
    const n = Math.max(1, xLabels.length - 1);
    const x = (i: number) => padL + (n === 0 ? w / 2 : (i / n) * w);
    const ticks = invertY
      ? Array.from(new Set([1, ...niceTicks(1, d0, 3).map(Math.round)])).filter((t) => t >= 1 && t <= d0)
      : niceTicks(d0, d1, 4);
    return { w, h, x, y, ticks, d0, d1 };
  }, [width, height, series, xLabels.length, invertY]);

  if (width === 0) return <div ref={ref} style={{ height }} />;
  if (xLabels.length === 0) {
    return (
      <div ref={ref} style={{ height }} className="flex items-center justify-center text-white/20 text-[12px]">
        Nessun dato
      </div>
    );
  }

  // Etichette x diradate: al massimo ~8, sempre prima e ultima
  const xStep = Math.max(1, Math.ceil(xLabels.length / 8));

  const ordered = [
    ...series.filter((s) => s.tone === "muted"),
    ...series.filter((s) => s.tone === "alt"),
    ...series.filter((s) => s.tone === "me"),
  ];

  const hoverRows =
    hover === null
      ? []
      : series
          .map((s) => ({ label: s.label, tone: s.tone, value: s.values[hover] }))
          .filter((r): r is { label: string; tone: LineSeries["tone"]; value: number } => r.value !== null && r.value !== undefined)
          .sort((a, b) => (invertY ? a.value - b.value : b.value - a.value));

  return (
    <div ref={ref} className="relative select-none">
      <svg width={width} height={height} role="img" aria-label={xTitle || "Grafico a linee"}>
        {/* Griglia orizzontale — hairline solide, mai tratteggiate */}
        {geom.ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={geom.y(t)} y2={geom.y(t)} stroke={VIZ.grid} strokeWidth={1} />
            <text x={padL - 6} y={geom.y(t) + 3} textAnchor="end" fontSize={9} fill={VIZ.ink3} style={{ fontVariantNumeric: "tabular-nums" }}>
              {invertY ? `P${t}` : t}
            </text>
          </g>
        ))}

        {/* Crosshair */}
        {hover !== null && (
          <line x1={geom.x(hover)} x2={geom.x(hover)} y1={padT} y2={height - padB} stroke={VIZ.axis} strokeWidth={1} />
        )}

        {/* Serie: prima le recessive, poi quelle evidenziate */}
        {ordered.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : { x: geom.x(i), y: geom.y(v) }));
          const color = TONE_COLOR[s.tone];
          const last = [...pts].reverse().find(Boolean) as { x: number; y: number } | undefined;
          return (
            <g key={s.id}>
              <path
                d={linePath(pts)}
                fill="none"
                stroke={color}
                strokeWidth={s.tone === "muted" ? 1 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.tone !== "muted" && last && (
                <circle cx={last.x} cy={last.y} r={4} fill={color} stroke={VIZ.surface} strokeWidth={2} />
              )}
              {hover !== null && s.tone !== "muted" && pts[hover] && (
                <circle cx={pts[hover]!.x} cy={pts[hover]!.y} r={4.5} fill={color} stroke={VIZ.surface} strokeWidth={2} />
              )}
            </g>
          );
        })}

        {/* Asse x */}
        <line x1={padL} x2={width - padR} y1={height - padB} y2={height - padB} stroke={VIZ.axis} strokeWidth={1} />
        {xLabels.map((l, i) =>
          i % xStep === 0 || i === xLabels.length - 1 ? (
            <text key={i} x={geom.x(i)} y={height - padB + 13} textAnchor="middle" fontSize={9} fill={VIZ.ink3} style={{ fontVariantNumeric: "tabular-nums" }}>
              {l}
            </text>
          ) : null,
        )}

        {/* Livello di hover: area di hit generosa, una fascia per indice */}
        {xLabels.map((_, i) => {
          const half = geom.w / Math.max(1, xLabels.length - 1) / 2;
          return (
            <rect
              key={i}
              x={geom.x(i) - half}
              y={0}
              width={Math.max(24, half * 2)}
              height={height}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
            />
          );
        })}
      </svg>

      {hover !== null && hoverRows.length > 0 && (
        <div
          className="pointer-events-none absolute top-1 z-10 bg-[#14141c] border border-[#2a2a38] rounded-lg px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] min-w-[110px]"
          style={{
            left: Math.min(Math.max(4, geom.x(hover) - 60), Math.max(4, width - 130)),
          }}
        >
          <div className="font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[1.5px] text-white/35 uppercase mb-1">
            {xTitle ? `${xTitle} ${xLabels[hover]}` : xLabels[hover]}
          </div>
          {hoverRows.slice(0, 6).map((r) => (
            <div key={r.label} className="flex items-center gap-1.5 text-[11px] leading-[1.5]">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: TONE_COLOR[r.tone] }}
              />
              <span className="text-white/55 truncate max-w-[100px]">{r.label}</span>
              <span className="ml-auto font-[family-name:var(--font-jetbrains)] font-bold tabular-nums text-white/85">
                {formatValue(r.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

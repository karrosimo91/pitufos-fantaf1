// ─── Token grafici per i chart delle statistiche ───
//
// Palette validata (categorical, superficie scura #0e0e14) con lo script
// `validate_palette.js`: banda di luminosità, chroma, separazione CVD
// (all-pairs) e contrasto vs superficie passano tutti.
//
// Regola: mai più di 3 tinte categoriche contemporaneamente su uno stesso
// grafico. Nel grafico stagionale usiamo il pattern "emphasis": la tua linea
// in rosso, l'eventuale avversario selezionato in blu, tutti gli altri in
// grigio recessivo. Così il numero di tinte resta 2 comunque vada.

export const VIZ = {
  /** Serie principale — il giocatore loggato (rosso F1 del brand) */
  me: "#E8002D",
  /** Serie di confronto — l'avversario selezionato */
  alt: "#3987e5",
  /** Terza tinta categorica (usata dove servono 3 serie) */
  third: "#199e70",
  /** Seconda tinta per le barre impilate (piloti / previsioni) */
  stack1: "#3987e5",
  stack2: "#d95926",
  /** Serie non evidenziate: recessive, mai identificate dal colore */
  muted: "rgba(255,255,255,0.16)",
  /** Griglia e assi: hairline solidi, una tacca sopra la superficie */
  grid: "rgba(255,255,255,0.07)",
  axis: "rgba(255,255,255,0.14)",
  /** Testo: token di inchiostro, mai il colore della serie */
  ink1: "rgba(240,240,245,0.9)",
  ink2: "rgba(240,240,245,0.5)",
  ink3: "rgba(240,240,245,0.28)",
  /** Superficie del chart (per i distanziatori da 2px tra i segmenti) */
  surface: "#0e0e14",
} as const;

/** Scala lineare da dominio a range. */
export function scaleLinear(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/**
 * Tick "belli" per un asse: al più `count` valori su passi 1/2/2.5/5 × 10^n.
 * Include sempre lo 0 se il dominio lo attraversa.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!isFinite(min) || !isFinite(max)) return [0];
  if (min === max) return [min];
  const raw = (max - min) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2.5 ? 5 : norm >= 2 ? 2.5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) {
    out.push(Math.round(v * 1000) / 1000);
  }
  return out.length ? out : [min, max];
}

/** Dominio arrotondato ai tick, con un filo di respiro sopra e sotto. */
export function niceDomain(values: number[], includeZero = true): [number, number] {
  const vals = values.filter((v) => Number.isFinite(v));
  if (vals.length === 0) return [0, 1];
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}

/** Path SVG di una spezzata, interrompendola sui buchi (null). */
export function linePath(points: ({ x: number; y: number } | null)[]): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

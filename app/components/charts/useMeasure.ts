"use client";
import { useCallback, useState } from "react";

/**
 * Misura la larghezza di un contenitore (ref callback + ResizeObserver).
 * I chart SVG sono disegnati in pixel reali: niente `preserveAspectRatio`
 * che deformerebbe spessori di linea e testo.
 */
export function useMeasure(): [(node: HTMLDivElement | null) => void, number] {
  const [width, setWidth] = useState(0);

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

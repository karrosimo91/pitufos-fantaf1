import type { ReactNode } from "react";

export function HudCard({
  label,
  meta,
  accent = true,
  children,
  className = "",
}: {
  label?: string;
  meta?: ReactNode;
  accent?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`hud-card ${accent ? "hud-card-accent" : ""} ${className}`}>
      {(label || meta) && (
        <div className="hud-card-head">
          {label && <div className="hud-label">{label}</div>}
          {meta && <div className="hud-meta">{meta}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

import type { ReactNode } from "react";

export function SectionHead({
  title,
  right,
  className = "",
}: {
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between mb-2 mt-5 ${className}`}>
      <h3 className="section-marker">{title}</h3>
      {right && <div className="text-[10px] font-[family-name:var(--font-jetbrains)] text-white/30 tracking-[1.5px] uppercase">{right}</div>}
    </div>
  );
}

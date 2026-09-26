"use client";

/** Mini barre degli ultimi weekend (punti), verde sopra la media, rosso sotto zero. */
export function FormSpark({ values, height = 18 }: { values: (number | null)[]; height?: number }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return <span className="text-[11px] text-white/35">—</span>;
  const max = Math.max(...nums.map((v) => Math.abs(v)), 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }} aria-label={`Ultimi weekend: ${nums.join(", ")}`}>
      {values.map((v, i) => {
        if (v === null) return <div key={i} className="w-[6px] rounded-sm bg-white/10" style={{ height: 3 }} />;
        const h = Math.max(3, Math.round((Math.abs(v) / max) * height));
        return <div key={i} className={`w-[6px] rounded-sm ${v < 0 ? "bg-[#E8002D]" : v === 0 ? "bg-white/25" : "bg-[#2ee59d]"}`} style={{ height: h }} title={String(v)} />;
      })}
    </div>
  );
}

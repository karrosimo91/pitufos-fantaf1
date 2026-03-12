"use client";

interface DriverCardProps {
  name: string;
  team: string;
  teamColour: string;
  price: number;
  number: number;
  headshot?: string | null;
  isPrimoPilota?: boolean;
  onSelect?: () => void;
  onSetPrimoPilota?: () => void;
  actionLabel?: string;
  showActions?: boolean;
  highlight?: boolean;
}

export default function DriverCard({
  name,
  team,
  teamColour,
  price,
  number,
  headshot,
  isPrimoPilota,
  onSelect,
  onSetPrimoPilota,
  actionLabel = "Acquista",
  showActions = true,
  highlight = false,
}: DriverCardProps) {
  const color = `#${teamColour}`;

  return (
    <div
      className={`relative bg-white/[0.03] border rounded-xl p-4 transition-all hover:bg-white/[0.06] ${
        highlight ? "border-amber-400/50 bg-amber-400/5" : isPrimoPilota ? "border-[#E8002D]/50 shadow-[0_0_15px_rgba(232,0,45,0.1)]" : "border-white/[0.06]"
      }`}
    >
      {isPrimoPilota && (
        <div className="absolute -top-2 left-3 bg-[#E8002D] text-white text-[9px] font-bold tracking-wider px-2 py-0.5 rounded">
          PRIMO PILOTA x2
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Driver photo or placeholder */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: `${color}30`, color }}
        >
          {headshot ? (
            <img src={headshot} alt={name} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <span className="font-[family-name:var(--font-jetbrains)]">{number}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{name}</div>
          <div className="text-[11px] text-white/40 truncate">{team}</div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-[family-name:var(--font-jetbrains)] font-bold text-sm" style={{ color }}>
            {price}
          </div>
          <div className="text-[9px] text-white/30 tracking-wider">SOLDINI</div>
        </div>
      </div>

      {showActions && (
        <div className="flex gap-2 mt-3">
          {onSelect && (
            <button
              onClick={onSelect}
              className="flex-1 text-[10px] tracking-wider font-bold uppercase bg-[#E8002D] hover:bg-[#ff1a3d] text-white py-2 rounded-lg transition-all"
            >
              {actionLabel}
            </button>
          )}
          {onSetPrimoPilota && (
            <button
              onClick={onSetPrimoPilota}
              className="text-[10px] tracking-wider font-bold uppercase border border-[#E8002D]/30 text-[#E8002D] hover:bg-[#E8002D]/10 px-3 py-2 rounded-lg transition-all"
            >
              Primo Pilota
            </button>
          )}
        </div>
      )}
    </div>
  );
}

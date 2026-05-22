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
  actionLabel = "ACQUISTA",
  showActions = true,
  highlight = false,
}: DriverCardProps) {
  const color = `#${teamColour}`;

  return (
    <div
      className={`relative rounded p-4 transition-colors ${
        highlight
          ? "bg-amber-400/[0.04] border border-amber-400/45"
          : isPrimoPilota
            ? "bg-[#E8002D]/[0.04] border border-[#E8002D]/45 shadow-[0_0_18px_rgba(232,0,45,0.1)]"
            : "bg-[#0e0e14] border border-[#1c1c26] hover:border-[#2a2a38]"
      }`}
    >
      {isPrimoPilota && (
        <div className="absolute -top-1.5 left-3 bg-[#E8002D] text-white font-[family-name:var(--font-jetbrains)] text-[8px] font-bold tracking-[1.5px] px-2 py-0.5 rounded-sm">
          PRIMO PILOTA · x2
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Team color bar */}
        <div className="w-[3px] h-11 rounded shrink-0" style={{ backgroundColor: color }} />

        {/* Driver number / photo */}
        <div
          className="w-11 h-11 rounded flex items-center justify-center text-sm font-bold shrink-0 border border-[#1c1c26]"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {headshot ? (
            <img src={headshot} alt={name} className="w-11 h-11 rounded object-cover" />
          ) : (
            <span className="font-[family-name:var(--font-jetbrains)] tabular-nums">{number}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] truncate tracking-[-0.2px]">{name}</div>
          <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/35 truncate tracking-[0.5px] uppercase mt-0.5">{team}</div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-[family-name:var(--font-jetbrains)] font-extrabold text-[18px] tabular-nums leading-none" style={{ color }}>
            {price}
          </div>
          <div className="font-[family-name:var(--font-jetbrains)] text-[8px] text-white/30 tracking-[1.5px] mt-1">SOLDINI</div>
        </div>
      </div>

      {showActions && (
        <div className="flex gap-2 mt-3">
          {onSelect && (
            <button
              onClick={onSelect}
              className="flex-1 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[2px] font-bold uppercase bg-[#E8002D] hover:bg-[#ff1a3d] text-white py-2.5 rounded transition-colors"
            >
              {actionLabel}
            </button>
          )}
          {onSetPrimoPilota && (
            <button
              onClick={onSetPrimoPilota}
              className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1.5px] font-bold uppercase border border-[#E8002D]/35 text-[#E8002D] hover:bg-[#E8002D]/10 px-3 py-2.5 rounded transition-colors"
            >
              PRIMO PILOTA
            </button>
          )}
        </div>
      )}
    </div>
  );
}

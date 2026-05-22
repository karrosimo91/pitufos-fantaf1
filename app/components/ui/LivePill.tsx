export function LivePill({ label = "LIVE" }: { label?: string }) {
  return (
    <div className="live-pill">
      <span className="live-pill-dot" />
      {label}
    </div>
  );
}

export function ConnectedPill({ connected, mode }: { connected: boolean; mode?: "init" | "mqtt" | "polling" }) {
  if (connected) {
    return (
      <div className="live-pill">
        <span className="live-pill-dot" />
        LIVE
      </div>
    );
  }
  if (mode === "polling") {
    return (
      <div className="inline-flex items-center gap-1.5 bg-amber-500/8 border border-amber-500/30 px-2 py-1 rounded font-[family-name:var(--font-jetbrains)] text-[9px] font-bold text-amber-400 tracking-[1.2px]">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-live-pulse" />
        POLLING
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.08] px-2 py-1 rounded font-[family-name:var(--font-jetbrains)] text-[9px] font-bold text-white/30 tracking-[1.2px]">
      <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
      OFFLINE
    </div>
  );
}

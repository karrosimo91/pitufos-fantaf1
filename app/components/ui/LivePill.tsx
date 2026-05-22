export function LivePill({ label = "LIVE" }: { label?: string }) {
  return (
    <div className="live-pill">
      <span className="live-pill-dot" />
      {label}
    </div>
  );
}

export function ConnectedPill({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <div className="live-pill">
        <span className="live-pill-dot" />
        CONNESSO
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

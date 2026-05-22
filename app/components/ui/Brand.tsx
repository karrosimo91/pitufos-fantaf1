export function Brand({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`brand-mark ${size === "sm" ? "brand-mark-sm" : ""}`} />
      <div className="font-extrabold text-[13px] tracking-[0.5px]">
        PITUFOS<span className="text-[#E8002D]">.</span>
      </div>
    </div>
  );
}

export function PageHead({
  breadcrumb,
  title,
  emphasis,
}: {
  breadcrumb?: string;
  title: string;
  emphasis?: string;
}) {
  return (
    <div className="px-4 pt-5 pb-2">
      {breadcrumb && (
        <div className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/30 tracking-[2px] mb-1.5 uppercase">
          {breadcrumb}
        </div>
      )}
      <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.6px]">
        {title}
        {emphasis && (
          <>
            <br />
            <em className="not-italic text-[#E8002D]">{emphasis}</em>
          </>
        )}
      </h1>
    </div>
  );
}

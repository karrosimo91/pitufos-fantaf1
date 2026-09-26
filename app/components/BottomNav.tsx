"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Flag, ShoppingCart, Trophy, MoreHorizontal } from "lucide-react";
import { useWeekendOptional } from "../lib/weekend-context";

const TABS = [
  { href: "/dashboard", label: "MURETTO", icon: LayoutDashboard },
  { href: "/gara", label: "GARA", icon: Flag },
  { href: "/mercato", label: "MERCATO", icon: ShoppingCart },
  { href: "/classifica", label: "RIVALI", icon: Trophy },
  { href: "/altro", label: "ALTRO", icon: MoreHorizontal },
];

export default function BottomNav() {
  const pathname = usePathname();
  const wk = useWeekendOptional();
  // Pallino rosso sul Muretto: manca qualcosa da confermare (prima pulsava
  // sul tab Live, l'unico dove non si poteva fare niente).
  const daConfermare = !!wk?.daConfermare;
  // Pallino verde su Gara: c'è una sessione in corso.
  const isLive = !!wk?.live.isLive;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#050507]/95 backdrop-blur-xl border-t border-[#1c1c26] safe-area-bottom">
      <div className="grid grid-cols-5 max-w-lg mx-auto pt-2 pb-3">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          const redDot = tab.href === "/dashboard" && daConfermare;
          const greenDot = tab.href === "/gara" && isLive;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={`${tab.label}${redDot ? " · da confermare" : greenDot ? " · sessione live" : ""}`}
              className={`relative flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#E8002D]" : "text-white/40 active:text-white/70"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              {redDot && (
                <span className="absolute top-0 right-1/2 translate-x-3 w-2 h-2 bg-[#E8002D] rounded-full animate-live-pulse ring-2 ring-[#050507]" />
              )}
              {greenDot && (
                <span className="absolute top-0 right-1/2 translate-x-3 w-2 h-2 bg-[#2ee59d] rounded-full animate-live-pulse ring-2 ring-[#050507]" />
              )}
              <span className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1px] font-bold">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

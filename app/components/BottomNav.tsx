"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Flag, ShoppingCart, Trophy, MoreHorizontal } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useSquadra, usePrevisioni } from "../lib/store";
import { getCurrentRound, getNextRace, isAfterDeadline } from "../lib/races";

const TABS = [
  { href: "/dashboard", label: "HOME", icon: LayoutDashboard },
  { href: "/gara", label: "LIVE", icon: Flag },
  { href: "/mercato", label: "MERCATO", icon: ShoppingCart },
  { href: "/classifica", label: "RANK", icon: Trophy },
  { href: "/altro", label: "ALTRO", icon: MoreHorizontal },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const round = getCurrentRound();
  const nextRace = getNextRace();
  const locked = isAfterDeadline(nextRace);
  const sq = useSquadra(round);
  const prev = usePrevisioni(round);

  const needsAction = user && !locked && sq.loaded && prev.loaded && (!sq.confirmed || !prev.confirmed);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#050507]/95 backdrop-blur-xl border-t border-[#1c1c26] safe-area-bottom">
      <div className="grid grid-cols-5 max-w-lg mx-auto pt-2 pb-3">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          const showDot = tab.href === "/gara" && needsAction;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#E8002D]" : "text-white/30 active:text-white/60"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              {showDot && (
                <span className="absolute top-0 right-1/2 translate-x-3 w-1.5 h-1.5 bg-[#E8002D] rounded-full animate-live-pulse" />
              )}
              <span className="font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[1.5px] font-bold">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

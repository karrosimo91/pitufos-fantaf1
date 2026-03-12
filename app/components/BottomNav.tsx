"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Flag, ShoppingCart, Trophy, MoreHorizontal } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useSquadra, usePrevisioni } from "../lib/store";
import { getCurrentRound, getNextRace, isAfterDeadline } from "../lib/races";

const TABS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gara", label: "Gara", icon: Flag },
  { href: "/mercato", label: "Mercato", icon: ShoppingCart },
  { href: "/classifica", label: "Classifica", icon: Trophy },
  { href: "/altro", label: "Altro", icon: MoreHorizontal },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const round = getCurrentRound();
  const nextRace = getNextRace();
  const locked = isAfterDeadline(nextRace);
  const sq = useSquadra(round);
  const prev = usePrevisioni(round);

  // Mostra pallino se utente loggato, prima della deadline, e manca qualcosa
  const needsAction = user && !locked && sq.loaded && prev.loaded && (!sq.confirmed || !prev.confirmed);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a12]/95 backdrop-blur-md border-t border-white/[0.06] safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-1">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          const showDot = tab.href === "/gara" && needsAction;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[60px] ${
                isActive
                  ? "text-[#E8002D]"
                  : "text-white/30 active:text-white/50"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              {showDot && (
                <span className="absolute top-1.5 right-2.5 w-2 h-2 bg-[#E8002D] rounded-full" />
              )}
              <span className={`text-[9px] tracking-[1px] uppercase ${isActive ? "font-bold" : ""}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

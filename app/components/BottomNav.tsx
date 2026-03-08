"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Flag, ShoppingCart, Trophy, MoreHorizontal } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gara", label: "Gara", icon: Flag },
  { href: "/mercato", label: "Mercato", icon: ShoppingCart },
  { href: "/classifica", label: "Classifica", icon: Trophy },
  { href: "/altro", label: "Altro", icon: MoreHorizontal },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a12]/95 backdrop-blur-md border-t border-white/[0.06] safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-1">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[60px] ${
                isActive
                  ? "text-[#E8002D]"
                  : "text-white/30 active:text-white/50"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
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

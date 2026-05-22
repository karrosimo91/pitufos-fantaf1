"use client";
import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { Brand } from "./Brand";

export function TopBar({ right }: { right?: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[#050507]/92 backdrop-blur-xl border-b border-[#1c1c26] px-4 py-2.5 flex items-center justify-between">
      <Link href={user ? "/dashboard" : "/"} className="block">
        <Brand />
      </Link>
      <div className="flex items-center gap-2">
        {right ?? (
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/30 tracking-[2px]">
            STAGIONE 2026
          </span>
        )}
      </div>
    </header>
  );
}

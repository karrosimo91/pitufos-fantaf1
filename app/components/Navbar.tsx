"use client";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import { Brand } from "./ui/Brand";

export default function Navbar() {
  const { user, profile } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-[#050507]/92 backdrop-blur-xl border-b border-[#1c1c26]">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2.5">
        <Link href={user ? "/dashboard" : "/"} className="block">
          <Brand />
        </Link>

        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/30 tracking-[2px] hidden sm:inline">
            STAGIONE 2026
          </span>
          {user && profile && (
            <Link
              href="/profilo"
              className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1.5px] text-white/45 hover:text-white/75 transition-colors uppercase truncate max-w-[140px]"
            >
              {profile.team_principal_name || user.email}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

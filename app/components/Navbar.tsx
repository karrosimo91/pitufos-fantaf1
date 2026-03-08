"use client";
import Link from "next/link";
import { useAuth } from "../lib/auth";

export default function Navbar() {
  const { user, profile } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a12]/90 backdrop-blur-md border-b border-white/5">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#E8002D] to-[#ff4466] flex items-center justify-center font-black text-xs tracking-wider">
            LP
          </div>
          <span className="font-bold text-sm tracking-[3px] uppercase">
            Los Pitufos
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="text-[10px] tracking-[2px] text-white/30 uppercase hidden sm:block">
            Stagione 2026
          </div>
          {user && profile && (
            <Link
              href="/profilo"
              className="text-[10px] tracking-wider text-white/40 hover:text-white/60 transition-all"
            >
              {profile.team_principal_name || user.email}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

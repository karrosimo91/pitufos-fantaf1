"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mercato", label: "Mercato" },
  { href: "/previsioni", label: "Previsioni" },
  { href: "/classifica", label: "Classifica" },
  { href: "/calendario", label: "Calendario" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a12]/90 backdrop-blur-md border-b border-white/5">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#E8002D] to-[#ff4466] flex items-center justify-center font-black text-xs tracking-wider">
            LP
          </div>
          <span className="font-bold text-sm tracking-[3px] uppercase hidden sm:block">
            Los Pitufos
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-[11px] tracking-[2px] uppercase px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? "bg-[#E8002D]/10 text-[#E8002D] font-bold"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/profilo"
                className="text-[10px] tracking-wider text-white/30 hover:text-white/60 hidden sm:block transition-all"
              >
                {profile?.team_principal_name || user.email}
              </Link>
              <button
                onClick={handleSignOut}
                className="text-[10px] tracking-wider text-white/30 hover:text-white/60 uppercase transition-all hidden md:block"
              >
                Esci
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-[10px] tracking-[2px] uppercase px-3 py-2 rounded-lg bg-[#E8002D]/10 text-[#E8002D] font-bold hover:bg-[#E8002D]/20 transition-all hidden md:block"
            >
              Accedi
            </Link>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
          >
            <span className={`block w-5 h-0.5 bg-white/60 transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-white/60 transition-all ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-white/60 transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#0a0a12]/95 backdrop-blur-md">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`text-[12px] tracking-[2px] uppercase px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-[#E8002D]/10 text-[#E8002D] font-bold"
                      : "text-white/40 hover:text-white/70 hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="border-t border-white/5 mt-2 pt-2">
              {user ? (
                <>
                  <Link
                    href="/profilo"
                    onClick={() => setMenuOpen(false)}
                    className="block text-[12px] tracking-[2px] uppercase px-4 py-3 text-white/40 hover:text-white/70 rounded-lg"
                  >
                    Profilo
                  </Link>
                  <button
                    onClick={() => { handleSignOut(); setMenuOpen(false); }}
                    className="w-full text-left text-[12px] tracking-[2px] uppercase px-4 py-3 text-white/40 hover:text-white/70 rounded-lg"
                  >
                    Esci
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block text-[12px] tracking-[2px] uppercase px-4 py-3 text-[#E8002D] font-bold rounded-lg"
                >
                  Accedi
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

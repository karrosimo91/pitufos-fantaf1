"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mercato", label: "Mercato" },
  { href: "/previsioni", label: "Previsioni" },
  { href: "/classifica", label: "Classifica" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

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

        <nav className="flex items-center gap-1">
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
              <span className="text-[10px] tracking-wider text-white/30 hidden sm:block">
                {profile?.team_principal_name || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-[10px] tracking-wider text-white/30 hover:text-white/60 uppercase transition-all"
              >
                Esci
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-[10px] tracking-[2px] uppercase px-3 py-2 rounded-lg bg-[#E8002D]/10 text-[#E8002D] font-bold hover:bg-[#E8002D]/20 transition-all"
            >
              Accedi
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

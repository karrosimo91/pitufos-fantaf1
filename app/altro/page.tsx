"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth";
import { Users, Info, User, LogOut, ChevronRight } from "lucide-react";

const MENU_ITEMS = [
  { href: "/campionati", label: "Leghe", desc: "Crea o unisciti a una lega", icon: Users },
  { href: "/info", label: "Info / Regolamento", desc: "Punteggi, previsioni, aggiornamenti", icon: Info },
  { href: "/profilo", label: "Profilo", desc: "Modifica nome e scuderia", icon: User },
];

export default function AltroPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        <div className="mb-6">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
            Menu
          </div>
          <h1 className="text-2xl font-black font-[family-name:var(--font-oswald)]">ALTRO</h1>
        </div>

        <div className="space-y-2 mb-8">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.06] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-white/40" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">{item.label}</div>
                  <div className="text-[11px] text-white/30">{item.desc}</div>
                </div>
                <ChevronRight size={16} className="text-white/20" />
              </Link>
            );
          })}
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-4 w-full bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 hover:bg-red-500/5 hover:border-red-500/10 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <LogOut size={18} className="text-red-400/60" />
          </div>
          <div className="text-left flex-1">
            <div className="text-sm font-bold text-red-400/80">Esci</div>
            <div className="text-[11px] text-white/20">{profile?.email || user.email}</div>
          </div>
        </button>
      </main>

      <BottomNav />
    </div>
  );
}

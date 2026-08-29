"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth";
import { Users, Info, User, LogOut, ChevronRight, Scale, FileClock, BarChart3 } from "lucide-react";
import { APP_VERSION } from "../lib/types";
import { useCdaMembership } from "../lib/use-cda";
import { CHANGELOG } from "../lib/changelog-data";

const MENU_ITEMS = [
  { href: "/statistiche", label: "Statistiche", desc: "Grafici e andamento del campionato", icon: BarChart3 },
  { href: "/campionati", label: "Leghe", desc: "Crea o unisciti a una lega", icon: Users },
  { href: "/info", label: "Info / Regolamento", desc: "Punteggi, previsioni, aggiornamenti", icon: Info },
  { href: "/profilo", label: "Profilo", desc: "Modifica nome e scuderia", icon: User },
  { href: "/changelog", label: "Changelog", desc: "Cosa c'è di nuovo nell'app", icon: FileClock },
];

export default function AltroPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { isMember: isCda } = useCdaMembership();

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#050507] text-white bg-grid">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        <div className="mb-6">
          <div className="font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[2.5px] text-[#E8002D] uppercase font-bold mb-1.5">
            MENU
          </div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.8px] leading-none">Altro</h1>
        </div>

        <div className="space-y-2 mb-8">
          {isCda && (
            <Link
              href="/cda"
              className="flex items-center gap-4 bg-white/[0.03] border border-[#E8002D]/20 rounded-xl p-4 hover:bg-white/[0.06] transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#E8002D]/10 flex items-center justify-center shrink-0">
                <Scale size={18} className="text-[#E8002D]/60" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">CDA Los Pitufos</div>
                <div className="text-[11px] text-white/30">Sezione riservata ai membri di Los Pitufos</div>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </Link>
          )}
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 hud-card p-4 hover:bg-white/[0.06] transition-all"
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
          className="flex items-center gap-4 w-full hud-card p-4 hover:bg-red-500/5 hover:border-red-500/10 transition-all mb-8"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <LogOut size={18} className="text-red-400/60" />
          </div>
          <div className="text-left flex-1">
            <div className="text-sm font-bold text-red-400/80">Esci</div>
            <div className="text-[11px] text-white/20">{profile?.email || user.email}</div>
          </div>
        </button>

        {/* Mini changelog preview + link */}
        <div className="hud-card hud-card-accent">
          <div className="hud-card-head">
            <div className="hud-label">NOVITÀ · {APP_VERSION}</div>
            <div className="hud-meta">{CHANGELOG[0]?.date.toUpperCase()}</div>
          </div>
          <div className="p-4">
            {CHANGELOG[0]?.summary && (
              <p className="text-[13px] text-white/80 font-medium mb-3 tracking-[-0.2px]">{CHANGELOG[0].summary}</p>
            )}
            <ul className="space-y-1.5 mb-4">
              {CHANGELOG[0]?.sections[0]?.items.slice(0, 3).map((item, i) => (
                <li
                  key={i}
                  className="text-[12px] text-white/65 leading-[1.45] pl-3 border-l-2 border-l-[#E8002D]/35"
                >
                  {item.length > 110 ? item.slice(0, 110) + "…" : item}
                </li>
              ))}
            </ul>
            <Link
              href="/changelog"
              className="inline-flex items-center gap-1.5 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1.5px] uppercase px-3 py-2 rounded border border-[#E8002D]/35 text-[#E8002D] hover:bg-[#E8002D]/10 transition-colors"
            >
              <FileClock size={11} /> CHANGELOG COMPLETO
            </Link>
          </div>
        </div>

        {/* Info App */}
        <div className="hud-card mt-3 p-4">
          <div className="hud-label mb-3">INFO APP</div>
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <div className="text-white/30 text-[10px] tracking-[1px] uppercase mb-0.5">Sviluppata da</div>
              <div className="font-bold text-white/85">Simone Carroccia</div>
              <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/35">@karrosimo91</div>
            </div>
            <div>
              <div className="text-white/30 text-[10px] tracking-[1px] uppercase mb-0.5">Versione</div>
              <div className="font-[family-name:var(--font-jetbrains)] font-extrabold text-[#E8002D] text-[18px] tabular-nums leading-none">{APP_VERSION}</div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

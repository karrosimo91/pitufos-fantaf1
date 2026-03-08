"use client";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { ArrowLeft } from "lucide-react";

export default function CampionatiPage() {
  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        <Link href="/altro" className="flex items-center gap-1 text-white/30 text-xs mb-4 hover:text-white/50 transition-all">
          <ArrowLeft size={14} /> Altro
        </Link>
        <div className="mb-6">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">Formula 1</div>
          <h1 className="text-2xl font-black font-[family-name:var(--font-oswald)]">CAMPIONATI</h1>
        </div>
        <div className="text-center py-20">
          <div className="text-white/20 text-sm">In arrivo</div>
          <p className="text-white/10 text-xs mt-2">Le classifiche F1 saranno disponibili con l'inizio della stagione 2026</p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

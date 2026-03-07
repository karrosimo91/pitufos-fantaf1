"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { useAuth } from "../lib/auth";

export default function ProfiloPage() {
  const router = useRouter();
  const { user, profile, loading, updateProfile } = useAuth();
  const [teamPrincipal, setTeamPrincipal] = useState("");
  const [scuderiaName, setScuderiaName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (profile) {
      setTeamPrincipal(profile.team_principal_name);
      setScuderiaName(profile.scuderia_name);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateProfile({
      team_principal_name: teamPrincipal,
      scuderia_name: scuderiaName,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
            Il tuo account
          </div>
          <h1 className="text-3xl font-black font-[family-name:var(--font-oswald)]">
            PROFILO
          </h1>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-[10px] tracking-[2px] text-white/40 uppercase block mb-2">Email</label>
            <div className="w-full bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 text-sm text-white/30">
              {user.email}
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-[2px] text-white/40 uppercase block mb-2">
              Nome Team Principal
            </label>
            <input
              type="text"
              value={teamPrincipal}
              onChange={(e) => setTeamPrincipal(e.target.value)}
              required
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#E8002D]/30 transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] tracking-[2px] text-white/40 uppercase block mb-2">
              Nome Scuderia
            </label>
            <input
              type="text"
              value={scuderiaName}
              onChange={(e) => setScuderiaName(e.target.value)}
              required
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#E8002D]/30 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#E8002D] hover:bg-[#ff1a3d] text-white font-bold text-sm tracking-[2px] uppercase py-4 rounded-xl transition-all hover:shadow-[0_0_30px_rgba(232,0,45,0.3)] disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : saved ? "Salvato!" : "Salva Modifiche"}
          </button>
        </form>
      </main>

      <footer className="text-center py-8 text-white/10 text-[10px] tracking-[3px] uppercase">
        Los Pitufos FantaF1 — Stagione 2026 — v0.8
      </footer>
    </div>
  );
}

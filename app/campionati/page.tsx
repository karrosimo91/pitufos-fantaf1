"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useLeghe, useLegaPreferita } from "../lib/store";
import { useAuth } from "../lib/auth";
import { RACES_2026 } from "../lib/races";
import { ArrowLeft, Plus, LogIn, Copy, Check, Users, Trophy, Lock, Globe, Star } from "lucide-react";
import type { Lega } from "../lib/types";

export default function LeghePage() {
  const { user } = useAuth();
  const { leghe, loaded, creaLega, uniscitiConCodice, uniscitiPubblica } = useLeghe();
  const { legaId: legaPreferita, setLegaId: setLegaPreferita } = useLegaPreferita();
  const [showCrea, setShowCrea] = useState(false);
  const [showUnisciti, setShowUnisciti] = useState(false);

  // Form crea lega
  const [nome, setNome] = useState("");
  const [roundStart, setRoundStart] = useState(1);
  const [roundEnd, setRoundEnd] = useState(24);
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdLega, setCreatedLega] = useState<Lega | null>(null);

  // Form unisciti
  const [codice, setCodice] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Codice copiato
  const [copied, setCopied] = useState<string | null>(null);

  const handleCrea = async () => {
    if (!nome.trim() || creating) return;
    setCreating(true);
    const result = await creaLega(nome.trim(), roundStart, roundEnd, isPublic);
    setCreating(false);
    if (result) {
      setCreatedLega(result);
      setNome("");
      setShowCrea(false);
    }
  };

  const handleUnisciti = async () => {
    if (!codice.trim() || joining) return;
    setJoining(true);
    const result = await uniscitiConCodice(codice.trim());
    setJoining(false);
    setJoinMsg({ ok: result.ok, text: result.ok ? "Unito alla lega!" : result.error || "Errore" });
    if (result.ok) setCodice("");
    setTimeout(() => setJoinMsg(null), 3000);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        <Link href="/altro" className="flex items-center gap-1 text-white/30 text-xs mb-4 hover:text-white/50 transition-all">
          <ArrowLeft size={14} /> Altro
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">Stagione 2026</div>
            <h1 className="text-2xl font-black font-[family-name:var(--font-oswald)]">LE MIE LEGHE</h1>
          </div>
        </div>

        {!user ? (
          <div className="text-center py-20">
            <div className="text-white/20 text-sm">Accedi per gestire le tue leghe</div>
          </div>
        ) : !loaded ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Azioni */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => { setShowCrea(!showCrea); setShowUnisciti(false); setCreatedLega(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] tracking-[2px] uppercase font-bold transition-all ${
                  showCrea
                    ? "bg-[#E8002D]/10 border border-[#E8002D]/30 text-[#E8002D]"
                    : "bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/60"
                }`}
              >
                <Plus size={14} /> Crea Lega
              </button>
              <button
                onClick={() => { setShowUnisciti(!showUnisciti); setShowCrea(false); setCreatedLega(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] tracking-[2px] uppercase font-bold transition-all ${
                  showUnisciti
                    ? "bg-[#E8002D]/10 border border-[#E8002D]/30 text-[#E8002D]"
                    : "bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/60"
                }`}
              >
                <LogIn size={14} /> Unisciti
              </button>
            </div>

            {/* Lega appena creata */}
            {createdLega && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 mb-6">
                <div className="text-green-400 font-bold text-sm mb-2">Lega creata!</div>
                <div className="text-white text-sm font-semibold">{createdLega.name}</div>
                {createdLega.invite_code && (
                  <div className="mt-3">
                    <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Codice invito</div>
                    <div className="flex items-center gap-2">
                      <span className="font-[family-name:var(--font-jetbrains)] text-lg font-bold tracking-[4px] text-[#E8002D]">
                        {createdLega.invite_code}
                      </span>
                      <button onClick={() => copyCode(createdLega.invite_code!)} className="text-white/40 hover:text-white transition-all">
                        {copied === createdLega.invite_code ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <div className="text-[11px] text-white/30 mt-1">Condividi questo codice con i tuoi amici</div>
                  </div>
                )}
              </div>
            )}

            {/* Form Crea Lega */}
            {showCrea && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6 space-y-4">
                <div>
                  <label className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold block mb-2">Nome Lega</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Es: Liga dei Campioni"
                    maxLength={40}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8002D]/40 placeholder:text-white/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold block mb-2">Da Round</label>
                    <select
                      value={roundStart}
                      onChange={(e) => setRoundStart(Number(e.target.value))}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none appearance-none"
                    >
                      {RACES_2026.map((r) => (
                        <option key={r.round} value={r.round} className="bg-[#0a0a12]">
                          R{r.round} {r.flag} {r.circuit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold block mb-2">A Round</label>
                    <select
                      value={roundEnd}
                      onChange={(e) => setRoundEnd(Number(e.target.value))}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none appearance-none"
                    >
                      {RACES_2026.filter((r) => r.round >= roundStart).map((r) => (
                        <option key={r.round} value={r.round} className="bg-[#0a0a12]">
                          R{r.round} {r.flag} {r.circuit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Toggle pubblica/privata */}
                <div>
                  <label className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold block mb-2">Tipo</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsPublic(true)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${
                        isPublic
                          ? "bg-[#E8002D]/10 border border-[#E8002D]/30 text-[#E8002D]"
                          : "bg-white/[0.03] border border-white/[0.06] text-white/40"
                      }`}
                    >
                      <Globe size={14} /> Pubblica
                    </button>
                    <button
                      onClick={() => setIsPublic(false)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${
                        !isPublic
                          ? "bg-[#E8002D]/10 border border-[#E8002D]/30 text-[#E8002D]"
                          : "bg-white/[0.03] border border-white/[0.06] text-white/40"
                      }`}
                    >
                      <Lock size={14} /> Privata
                    </button>
                  </div>
                  <div className="text-[11px] text-white/20 mt-2">
                    {isPublic ? "Chiunque puo' unirsi" : "Solo con codice invito"}
                  </div>
                </div>

                <button
                  onClick={handleCrea}
                  disabled={!nome.trim() || creating}
                  className={`w-full py-3 rounded-xl font-bold text-sm tracking-wider transition-all ${
                    !nome.trim() || creating
                      ? "bg-white/5 text-white/20 cursor-not-allowed"
                      : "bg-[#E8002D] hover:bg-[#E8002D]/80 text-white"
                  }`}
                >
                  {creating ? "Creazione..." : "Crea Lega"}
                </button>
              </div>
            )}

            {/* Form Unisciti */}
            {showUnisciti && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6 space-y-4">
                <div>
                  <label className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold block mb-2">Codice Invito</label>
                  <input
                    type="text"
                    value={codice}
                    onChange={(e) => setCodice(e.target.value.toUpperCase())}
                    placeholder="Es: ABC123"
                    maxLength={6}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8002D]/40 placeholder:text-white/20 font-[family-name:var(--font-jetbrains)] tracking-[4px] text-center text-lg"
                  />
                </div>
                {joinMsg && (
                  <div className={`text-sm text-center font-bold ${joinMsg.ok ? "text-green-400" : "text-red-400"}`}>
                    {joinMsg.text}
                  </div>
                )}
                <button
                  onClick={handleUnisciti}
                  disabled={!codice.trim() || joining}
                  className={`w-full py-3 rounded-xl font-bold text-sm tracking-wider transition-all ${
                    !codice.trim() || joining
                      ? "bg-white/5 text-white/20 cursor-not-allowed"
                      : "bg-[#E8002D] hover:bg-[#E8002D]/80 text-white"
                  }`}
                >
                  {joining ? "Ricerca..." : "Unisciti"}
                </button>
              </div>
            )}

            {/* Lista leghe */}
            <div className="space-y-3">
              {leghe.map((lega) => (
                <div
                  key={lega.id}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 transition-all hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {lega.is_generale ? (
                          <Trophy size={14} className="text-[#E8002D]" />
                        ) : lega.is_public ? (
                          <Globe size={14} className="text-white/30" />
                        ) : (
                          <Lock size={14} className="text-white/30" />
                        )}
                        <span className="font-semibold text-sm">{lega.name}</span>
                        {lega.is_generale && (
                          <span className="text-[9px] bg-[#E8002D]/20 text-[#E8002D] px-2 py-0.5 rounded-full font-bold">
                            AUTO
                          </span>
                        )}
                        {legaPreferita === lega.id && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                            PREFERITA
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-white/30">
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {lega.member_count ?? "—"}
                        </span>
                        <span>R{lega.round_start} → R{lega.round_end}</span>
                        {lega.invite_code && (
                          <button
                            onClick={() => copyCode(lega.invite_code!)}
                            className="flex items-center gap-1 text-white/40 hover:text-white/60 transition-all"
                          >
                            <span className="font-[family-name:var(--font-jetbrains)] tracking-wider">
                              {lega.invite_code}
                            </span>
                            {copied === lega.invite_code ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => setLegaPreferita(lega.id)}
                        className={`transition-all ${
                          legaPreferita === lega.id
                            ? "text-amber-400"
                            : "text-white/20 hover:text-amber-400/60"
                        }`}
                        title={legaPreferita === lega.id ? "Lega preferita" : "Imposta come preferita"}
                      >
                        <Star size={18} fill={legaPreferita === lega.id ? "currentColor" : "none"} />
                      </button>
                      <Link
                        href={`/classifica?lega=${lega.id}`}
                        className="text-[10px] tracking-[2px] text-[#E8002D] uppercase font-bold hover:text-[#E8002D]/70 transition-all"
                      >
                        Classifica
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

              {leghe.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-white/20 text-sm">Non sei in nessuna lega</div>
                  <p className="text-white/10 text-xs mt-2">Crea una lega o unisciti con un codice</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

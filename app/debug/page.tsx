"use client";
import { useState, useEffect } from "react";
import { createClient, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getDriverByNumber } from "../lib/drivers-data";

const ADMIN_KEY_STORAGE = "pitufos_admin_api_key";

export default function DebugPage() {
  const { user, loading } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [adminKey, setAdminKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);

  const log = (msg: string) => {
    console.log(msg);
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
  };

  useEffect(() => {
    log(`Supabase configured: ${isSupabaseConfigured}`);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(ADMIN_KEY_STORAGE) : null;
    if (stored) setAdminKey(stored);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) log("Utente NON loggato");
    else log(`Utente loggato: ${user.id} (${user.email})`);
  }, [user, loading]);

  const saveKey = (v: string) => {
    setAdminKey(v);
    if (typeof window !== "undefined") {
      if (v) window.localStorage.setItem(ADMIN_KEY_STORAGE, v);
      else window.localStorage.removeItem(ADMIN_KEY_STORAGE);
    }
  };

  // ─── Letture personali (RLS dell'utente, non serve admin key) ───

  const testReadDrivers = async () => {
    if (!user) return log("ERROR: non loggato");
    const supabase = createClient()!;
    const { data, error } = await supabase.from("formazioni").select("*").eq("user_id", user.id);
    if (error) log(`READ formazioni ERROR: ${JSON.stringify(error)}`);
    else log(`READ formazioni OK: ${data.length} righe — ${JSON.stringify(data)}`);
  };

  const testReadPrevisioni = async () => {
    if (!user) return log("ERROR: non loggato");
    const supabase = createClient()!;
    const { data, error } = await supabase.from("previsioni").select("*").eq("user_id", user.id);
    if (error) log(`READ previsioni ERROR: ${JSON.stringify(error)}`);
    else log(`READ previsioni OK: ${data.length} righe — ${JSON.stringify(data)}`);
  };

  const testReadFormazioni = async () => {
    if (!user) return log("ERROR: non loggato");
    const supabase = createClient()!;
    const { data, error } = await supabase.from("formazioni").select("*").eq("user_id", user.id);
    if (error) log(`READ formazioni ERROR: ${JSON.stringify(error)}`);
    else log(`READ formazioni OK: ${data.length} righe — ${JSON.stringify(data)}`);
  };

  // ─── Panoramica admin (server-side, bypassa RLS via ADMIN_API_KEY) ───

  const testPanoramica = async () => {
    if (!adminKey) return log("ERROR: inserisci l'ADMIN_API_KEY in alto");
    log("─── PANORAMICA COMPLETA (admin) ───");
    try {
      const res = await fetch("/api/admin/panoramica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_key: adminKey, round: 1 }),
      });
      if (res.status === 401) return log("ERROR 401: admin_key non valida");
      if (!res.ok) return log(`ERROR ${res.status}: ${res.statusText}`);
      const data = await res.json();

      const profiles = data.profiles as { id: string; team_principal_name: string; scuderia_name: string; email: string }[];
      log(`PROFILI: ${profiles.length} utenti`);
      for (const p of profiles) {
        log(`  👤 ${p.team_principal_name} — "${p.scuderia_name}" (${p.email})`);
      }

      log(`FORMAZIONI CONFERMATE: ${data.allFormazioniConfermate.length} righe totali`);
      const byUser = new Map<string, number[]>();
      for (const d of data.allFormazioniConfermate) {
        if (!byUser.has(d.user_id)) byUser.set(d.user_id, []);
        byUser.get(d.user_id)!.push(...((d.driver_numbers as number[]) || []));
      }
      for (const [uid, nums] of byUser) {
        const prof = profiles.find((p) => p.id === uid);
        const names = nums.map((n) => getDriverByNumber(n)?.name || `#${n}`).join(", ");
        log(`  ${prof?.team_principal_name || uid}: [${names}]`);
      }

      log(`FORMAZIONI (Round 1): ${data.formazioniRound.length} righe`);
      for (const f of data.formazioniRound) {
        const prof = profiles.find((p) => p.id === f.user_id);
        const driverNames = ((f.driver_numbers as number[]) || []).map((n) => getDriverByNumber(Number(n))?.name || `#${n}`).join(", ");
        const primo = f.primo_pilota ? (getDriverByNumber(f.primo_pilota)?.name || `#${f.primo_pilota}`) : "—";
        log(`  ${prof?.team_principal_name || f.user_id}:`);
        log(`    Piloti: [${driverNames}]`);
        log(`    Primo Pilota: ${primo}`);
        log(`    Chip: ${f.chip_piloti || "—"} | Sesto: ${f.sesto_uomo ? getDriverByNumber(f.sesto_uomo)?.name : "—"}`);
        log(`    Confermata: ${f.confirmed ? "SI" : "NO"}`);
      }

      log(`PREVISIONI (Round 1): ${data.previsioniRound.length} righe`);
      for (const p of data.previsioniRound) {
        const prof = profiles.find((pr) => pr.id === p.user_id);
        log(`  ${prof?.team_principal_name || p.user_id}:`);
        log(`    SC:${p.safety_car ?? "—"} VSC:${p.virtual_safety_car ?? "—"} RF:${p.red_flag ?? "—"} Wet:${p.gomme_wet ?? "—"} Pole:${p.pole_vince ?? "—"} DNF:${p.numero_dnf ?? "—"}`);
        log(`    Chip: ${p.chip_attivo || "—"} Target: ${p.chip_target || "—"}`);
        log(`    Confermata: ${p.confirmed ? "SI" : "NO"}`);
      }

      const weekend = data.weekendResults as { round: number }[];
      log(`WEEKEND_RESULTS: ${weekend.length} gare salvate (rounds: ${weekend.map((w) => w.round).join(", ") || "nessuna"})`);

      const classifica = data.classifica as { team_principal_name: string; total_points: number; last_weekend_points: number }[];
      log(`CLASSIFICA: ${classifica.length} righe`);
      for (const c of classifica) {
        log(`  ${c.team_principal_name}: ${c.total_points} pts (ultimo weekend: ${c.last_weekend_points})`);
      }

      const errs = data.errors as Record<string, string | undefined>;
      for (const [k, v] of Object.entries(errs)) if (v) log(`  ⚠ ${k}: ${v}`);

      log("─── FINE PANORAMICA ───");
    } catch (err) {
      log(`FETCH ERROR: ${(err as Error).message}`);
    }
  };

  const testPostGara = async () => {
    if (!adminKey) return log("ERROR: inserisci l'ADMIN_API_KEY in alto");
    log("─── TEST POST-GARA (Round 1) ───");
    log("Chiamata a /api/post-gara...");
    try {
      const res = await fetch("/api/post-gara", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round: 1, admin_key: adminKey }),
      });
      const data = await res.json();
      if (data.error) {
        log(`ERROR: ${data.error}`);
        if (data.log) for (const l of data.log) log(`  ${l}`);
      } else {
        log(`OK: ${data.giocatori} giocatori calcolati`);
        if (data.classifica) {
          for (const c of data.classifica) {
            log(`  ${c.pos}. ${c.nome} (${c.scuderia}): ${c.punti_weekend} pts | Reale: +${c.punti_reale}`);
          }
        }
        if (data.eventi) {
          log(`  Eventi: SC=${data.eventi.safety_car} VSC=${data.eventi.virtual_safety_car} RF=${data.eventi.red_flag} Wet=${data.eventi.wet_tyres} DNF=${data.eventi.total_dnf}`);
        }
        if (data.log) for (const l of data.log) log(`  ${l}`);
      }
    } catch (err) {
      log(`FETCH ERROR: ${(err as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white p-6 bg-grid">
      <h1 className="text-2xl font-extrabold mb-1 tracking-[-0.5px]">Debug DB</h1>
      <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/30 tracking-[2px] mb-5 uppercase">
        ADMIN CONSOLE · LOS PITUFOS FANTAF1
      </div>

      {/* ADMIN_API_KEY input */}
      <div className="hud-card hud-card-accent mb-5 p-4">
        <div className="hud-label mb-2">ADMIN_API_KEY</div>
        <div className="flex gap-2 items-center">
          <input
            type={keyVisible ? "text" : "password"}
            value={adminKey}
            onChange={(e) => saveKey(e.target.value)}
            placeholder="Incolla qui la chiave (salvata in localStorage)"
            className="flex-1 bg-black/40 border border-[#1c1c26] rounded px-3 py-2 font-[family-name:var(--font-jetbrains)] text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-[#E8002D]/40"
          />
          <button
            type="button"
            onClick={() => setKeyVisible((v) => !v)}
            className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1.5px] px-3 py-2 rounded bg-white/[0.04] border border-[#1c1c26] hover:bg-white/[0.08] transition-colors"
          >
            {keyVisible ? "NASCONDI" : "MOSTRA"}
          </button>
          {adminKey && (
            <button
              type="button"
              onClick={() => saveKey("")}
              className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1.5px] px-3 py-2 rounded bg-[#E8002D]/10 border border-[#E8002D]/30 text-[#E8002D] hover:bg-[#E8002D]/20 transition-colors"
            >
              CLEAR
            </button>
          )}
        </div>
        <div className="font-[family-name:var(--font-jetbrains)] text-[9px] text-white/30 mt-2 tracking-[0.5px]">
          Richiesta per "Panoramica" e "Post-Gara". Server-side bypassa RLS via service_role.
        </div>
      </div>

      <div className="hud-label mb-2">DATI MIEI</div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Btn onClick={testReadDrivers}>I miei Drivers</Btn>
        <Btn onClick={testReadFormazioni}>Le mie Formazioni</Btn>
        <Btn onClick={testReadPrevisioni}>Le mie Previsioni</Btn>
      </div>

      <div className="hud-label mb-2">PANORAMICA GLOBALE · ADMIN</div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Btn onClick={testPanoramica} accent>Panoramica Completa</Btn>
        <Btn onClick={testPostGara} accent>Test Post-Gara R1</Btn>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Btn onClick={() => setLogs([])}>Clear logs</Btn>
      </div>

      <div className="hud-card p-4 font-[family-name:var(--font-jetbrains)] text-xs space-y-1 max-h-[60vh] overflow-y-auto">
        {logs.length === 0 && <div className="text-white/20">Nessun log...</div>}
        {logs.map((l, i) => (
          <div
            key={i}
            className={
              l.includes("ERROR") ? "text-red-400"
              : l.includes("OK") ? "text-green-400"
              : l.includes("───") ? "text-[#E8002D] font-bold"
              : "text-white/60"
            }
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function Btn({ onClick, children, accent }: { onClick: () => void; children: React.ReactNode; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`font-[family-name:var(--font-jetbrains)] text-[11px] font-bold tracking-[1px] uppercase px-4 py-2 rounded transition-colors ${
        accent
          ? "bg-[#E8002D]/15 hover:bg-[#E8002D]/25 border border-[#E8002D]/40 text-[#E8002D]"
          : "bg-white/[0.04] hover:bg-white/[0.08] border border-[#1c1c26] text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

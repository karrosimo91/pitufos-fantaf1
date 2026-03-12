"use client";
import { useState, useEffect } from "react";
import { createClient, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getDriverByNumber } from "../lib/drivers-data";

export default function DebugPage() {
  const { user, loading } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => {
    console.log(msg);
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
  };

  useEffect(() => {
    log(`Supabase configured: ${isSupabaseConfigured}`);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) log("Utente NON loggato");
    else log(`Utente loggato: ${user.id} (${user.email})`);
  }, [user, loading]);

  // ─── Lettura singolo utente ───

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

  // ─── Panoramica TUTTI gli utenti ───

  const testPanoramica = async () => {
    if (!user) return log("ERROR: non loggato");
    const supabase = createClient()!;

    log("─── PANORAMICA COMPLETA ───");

    // Profili
    const { data: profiles, error: profErr } = await supabase.from("profiles").select("id, team_principal_name, scuderia_name, email");
    if (profErr) return log(`READ profiles ERROR: ${JSON.stringify(profErr)}`);
    log(`PROFILI: ${profiles?.length || 0} utenti`);
    for (const p of profiles || []) {
      log(`  👤 ${p.team_principal_name} — "${p.scuderia_name}" (${p.email})`);
    }

    // Formazioni per ogni utente (ultima confermata)
    const { data: allFormazioni, error: drvErr } = await supabase.from("formazioni").select("*").eq("confirmed", true);
    if (drvErr) log(`READ formazioni ERROR: ${JSON.stringify(drvErr)}`);
    else {
      log(`FORMAZIONI CONFERMATE: ${allFormazioni?.length || 0} righe totali`);
      const byUser = new Map<string, number[]>();
      for (const d of allFormazioni || []) {
        if (!byUser.has(d.user_id)) byUser.set(d.user_id, []);
        byUser.get(d.user_id)!.push(...(d.driver_numbers || []));
      }
      for (const [uid, nums] of byUser) {
        const prof = profiles?.find((p) => p.id === uid);
        const names = nums.map((n) => getDriverByNumber(n)?.name || `#${n}`).join(", ");
        log(`  ${prof?.team_principal_name || uid}: [${names}]`);
      }
    }

    // Formazioni round 1
    const { data: formazioni, error: formErr } = await supabase.from("formazioni").select("*").eq("round", 1);
    if (formErr) log(`READ formazioni ERROR: ${JSON.stringify(formErr)}`);
    else {
      log(`FORMAZIONI (Round 1): ${formazioni?.length || 0} righe`);
      for (const f of formazioni || []) {
        const prof = profiles?.find((p) => p.id === f.user_id);
        const driverNames = (f.driver_numbers || []).map((n: number) => getDriverByNumber(Number(n))?.name || `#${n}`).join(", ");
        const primo = f.primo_pilota ? (getDriverByNumber(f.primo_pilota)?.name || `#${f.primo_pilota}`) : "—";
        log(`  ${prof?.team_principal_name || f.user_id}:`);
        log(`    Piloti: [${driverNames}]`);
        log(`    Primo Pilota: ${primo}`);
        log(`    Chip: ${f.chip_piloti || "—"} | Sesto: ${f.sesto_uomo ? getDriverByNumber(f.sesto_uomo)?.name : "—"}`);
        log(`    Confermata: ${f.confirmed ? "SI" : "NO"}`);
      }
    }

    // Previsioni round 1
    const { data: previsioni, error: prevErr } = await supabase.from("previsioni").select("*").eq("round", 1);
    if (prevErr) log(`READ previsioni ERROR: ${JSON.stringify(prevErr)}`);
    else {
      log(`PREVISIONI (Round 1): ${previsioni?.length || 0} righe`);
      for (const p of previsioni || []) {
        const prof = profiles?.find((pr) => pr.id === p.user_id);
        log(`  ${prof?.team_principal_name || p.user_id}:`);
        log(`    SC:${p.safety_car ?? "—"} VSC:${p.virtual_safety_car ?? "—"} RF:${p.red_flag ?? "—"} Wet:${p.gomme_wet ?? "—"} Pole:${p.pole_vince ?? "—"} DNF:${p.numero_dnf ?? "—"}`);
        log(`    Chip: ${p.chip_attivo || "—"} Target: ${p.chip_target || "—"}`);
        log(`    Confermata: ${p.confirmed ? "SI" : "NO"}`);
      }
    }

    // Weekend results
    const { data: weekend } = await supabase.from("weekend_results").select("round").order("round");
    log(`WEEKEND_RESULTS: ${weekend?.length || 0} gare salvate (rounds: ${weekend?.map((w) => w.round).join(", ") || "nessuna"})`);

    // Classifica
    const { data: classifica } = await supabase.from("classifica_totale").select("*").order("total_points", { ascending: false });
    log(`CLASSIFICA: ${classifica?.length || 0} righe`);
    for (const c of classifica || []) {
      log(`  ${c.team_principal_name}: ${c.total_points} pts (ultimo weekend: ${c.last_weekend_points})`);
    }

    log("─── FINE PANORAMICA ───");
  };

  // ─── Test endpoint post-gara ───

  const testPostGara = async () => {
    log("─── TEST POST-GARA (Round 1) ───");
    log("Chiamata a /api/post-gara...");
    try {
      const res = await fetch("/api/post-gara", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round: 1, admin_key: "pitufos-f1-admin-2026-xK9mQ3" }),
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
    } catch (err: any) {
      log(`FETCH ERROR: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white p-6">
      <h1 className="text-2xl font-bold mb-4 font-[family-name:var(--font-oswald)]">Debug DB</h1>

      <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-2">Dati miei</div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Btn onClick={testReadDrivers}>I miei Drivers</Btn>
        <Btn onClick={testReadFormazioni}>Le mie Formazioni</Btn>
        <Btn onClick={testReadPrevisioni}>Le mie Previsioni</Btn>
      </div>

      <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-2">Panoramica globale</div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Btn onClick={testPanoramica} accent>Panoramica Completa</Btn>
        <Btn onClick={testPostGara} accent>Test Post-Gara R1</Btn>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Btn onClick={() => setLogs([])}>Clear</Btn>
      </div>

      <div className="bg-black/50 border border-white/10 rounded-xl p-4 font-[family-name:var(--font-jetbrains)] text-xs space-y-1 max-h-[70vh] overflow-y-auto">
        {logs.length === 0 && <div className="text-white/20">Nessun log...</div>}
        {logs.map((l, i) => (
          <div key={i} className={l.includes("ERROR") ? "text-red-400" : l.includes("OK") ? "text-green-400" : l.includes("───") ? "text-[#E8002D] font-bold" : "text-white/60"}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function Btn({ onClick, children, accent }: { onClick: () => void; children: React.ReactNode; accent?: boolean }) {
  return (
    <button onClick={onClick} className={`text-white text-xs font-bold px-4 py-2 rounded-lg transition-all ${
      accent ? "bg-[#E8002D]/20 hover:bg-[#E8002D]/30 border border-[#E8002D]/30" : "bg-white/10 hover:bg-white/20"
    }`}>
      {children}
    </button>
  );
}

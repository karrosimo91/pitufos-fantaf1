#!/usr/bin/env node
// Verifica penalità Monaco: confronto metodo ATTUALE vs NUOVO sui dati OpenF1.
// Uso:
//   node scripts/verify-monaco-penalties.mjs            # ultima gara di Monaco
//   node scripts/verify-monaco-penalties.mjs <session_key>

const OPENF1 = "https://api.openf1.org/v1";

async function j(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} su ${url}`);
  return r.json();
}

// ── METODO ATTUALE (come in post-gara/route.ts e fetch-risultati/route.ts) ──
function isPenaltyCurrent(msg) {
  return msg.includes("PENALTY") && !msg.includes("GRID") && !msg.includes("REPRIMAND");
}

// ── METODO NUOVO (keyword esplicite, non dipende solo da "PENALTY") ──
function isPenaltyNew(msg) {
  if (msg.includes("GRID") || msg.includes("REPRIMAND")) return false; // griglia=0, reprimand escluso
  if (msg.includes("UNDER INVESTIGATION") || msg.includes("NOTED") || msg.includes("NO FURTHER")) return false;
  return (
    msg.includes("PENALTY") ||
    msg.includes("DRIVE THROUGH") ||
    msg.includes("DRIVE-THROUGH") ||
    msg.includes("STOP AND GO") ||
    msg.includes("STOP/GO") ||
    msg.includes("TIME PENALTY")
  );
}

async function main() {
  const arg = process.argv[2];
  let sessionKey = arg && /^\d+$/.test(arg) ? Number(arg) : null;
  let label = "";

  if (!sessionKey) {
    const sessions = await j(`${OPENF1}/sessions?country_name=Monaco&session_name=Race`);
    if (!sessions.length) throw new Error("Nessuna gara di Monaco trovata");
    sessions.sort((a, b) => new Date(b.date_start) - new Date(a.date_start));
    const s = sessions[0];
    sessionKey = s.session_key;
    label = `Monaco ${s.year} (session_key=${sessionKey}, ${s.date_start})`;
  } else {
    label = `session_key=${sessionKey}`;
  }
  console.log(`\n=== ${label} ===\n`);

  const rc = await j(`${OPENF1}/race_control?session_key=${sessionKey}`);
  const drivers = await j(`${OPENF1}/drivers?session_key=${sessionKey}`);
  const nameOf = new Map(drivers.map((d) => [d.driver_number, d.name_acronym || d.full_name]));

  const cur = new Map(); // driver -> [messaggi]
  const neu = new Map();
  for (const r of rc) {
    const msg = (r.message || "").toUpperCase();
    if (!r.driver_number) continue;
    if (isPenaltyCurrent(msg)) (cur.get(r.driver_number) || cur.set(r.driver_number, []).get(r.driver_number)).push(r.message);
    if (isPenaltyNew(msg)) (neu.get(r.driver_number) || neu.set(r.driver_number, []).get(r.driver_number)).push(r.message);
  }

  const allDrivers = new Set([...cur.keys(), ...neu.keys()]);
  if (allDrivers.size === 0) {
    console.log("Nessuna penalità rilevata con nessuno dei due metodi.");
  }
  for (const dn of [...allDrivers].sort((a, b) => a - b)) {
    const inCur = cur.has(dn);
    const inNew = neu.has(dn);
    const flag = inCur === inNew ? "=" : "DIFFERENZA →";
    console.log(`${flag} #${dn} ${nameOf.get(dn) || "?"}  | attuale: ${inCur ? "-5" : "0"} | nuovo: ${inNew ? "-5" : "0"}`);
    const msgs = (inNew ? neu.get(dn) : cur.get(dn)) || [];
    for (const m of msgs) console.log(`      • ${m}`);
  }

  console.log(`\nRiepilogo: ATTUALE penalizza ${cur.size} piloti, NUOVO penalizza ${neu.size} piloti.`);
}

main().catch((e) => { console.error("Errore:", e.message); process.exit(1); });

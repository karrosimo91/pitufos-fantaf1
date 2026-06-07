#!/usr/bin/env node
// Verifica penalità: confronto metodo VECCHIO (campo driver_number) vs NUOVO
// (numero auto dal testo "CAR X") sui dati OpenF1.
// Uso:
//   node scripts/verify-monaco-penalties.mjs            # ultima gara di Monaco
//   node scripts/verify-monaco-penalties.mjs <session_key>

const OPENF1 = "https://api.openf1.org/v1";

async function j(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} su ${url}`);
  return r.json();
}

const EXCLUDED = ["GRID", "REPRIMAND"];
const NON_PENALTY = ["NOTED", "UNDER INVESTIGATION", "WILL BE INVESTIGATED", "NO FURTHER", "UNDER REVIEW"];
const PENALTY = ["PENALTY", "DRIVE THROUGH", "DRIVE-THROUGH", "STOP AND GO", "STOP/GO"];

function isPenalty(msg) {
  const M = msg.toUpperCase();
  if (EXCLUDED.some((k) => M.includes(k))) return false;
  if (NON_PENALTY.some((k) => M.includes(k))) return false;
  return PENALTY.some((k) => M.includes(k));
}
function carFromText(msg) {
  const m = msg.toUpperCase().match(/\bCAR\s+(\d+)/);
  return m ? parseInt(m[1], 10) : null;
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
    label = `Monaco ${s.year} (session_key=${sessionKey})`;
  } else {
    label = `session_key=${sessionKey}`;
  }
  console.log(`\n=== ${label} ===\n`);

  const rc = await j(`${OPENF1}/race_control?session_key=${sessionKey}`);
  const drivers = await j(`${OPENF1}/drivers?session_key=${sessionKey}`);
  const nameOf = new Map(drivers.map((d) => [d.driver_number, d.name_acronym || d.full_name]));

  const oldMethod = new Set(); // si affida a driver_number (bug)
  const newMethod = new Set(); // parsa "CAR X" dal testo
  for (const r of rc) {
    if (!isPenalty(r.message || "")) continue;
    if (r.driver_number) oldMethod.add(r.driver_number);
    const num = r.driver_number ?? carFromText(r.message || "");
    if (num) newMethod.add(num);
  }

  const all = new Set([...oldMethod, ...newMethod]);
  if (all.size === 0) console.log("Nessuna penalità rilevata con nessuno dei due metodi.");
  for (const dn of [...all].sort((a, b) => a - b)) {
    const o = oldMethod.has(dn), n = newMethod.has(dn);
    console.log(`${o === n ? "=" : "DIFFERENZA →"} #${dn} ${nameOf.get(dn) || "?"} | vecchio: ${o ? "-5" : "0"} | nuovo: ${n ? "-5" : "0"}`);
  }
  console.log(`\nRiepilogo: VECCHIO ${oldMethod.size} piloti, NUOVO ${newMethod.size} piloti.`);
}

main().catch((e) => { console.error("Errore:", e.message); process.exit(1); });

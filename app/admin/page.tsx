"use client";
import { useState } from "react";
import { RACES_2026 } from "../lib/races";
import { DRIVERS_2026 } from "../lib/drivers-data";

const ADMIN_USER = "admin";
const ADMIN_PASS = "97SemperF!06!";
const ADMIN_API_KEY = "pitufos-f1-admin-2026-xK9mQ3";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState("");

  const [round, setRound] = useState(1);
  const [session, setSession] = useState<string>("sprint_shootout");
  const [dotd, setDotd] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const handleLogin = () => {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      setAuthed(true);
      setLoginError("");
    } else {
      setLoginError("Credenziali errate");
    }
  };

  const handlePostGara = async () => {
    setLoading(true);
    setResult(null);
    setLogs([]);
    try {
      const body: any = { round, admin_key: ADMIN_API_KEY, session };
      if (session === "race" && dotd) body.driver_of_the_day = dotd;

      const res = await fetch("/api/post-gara", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResult(data);
      if (data.log) setLogs(data.log);
    } catch (err: any) {
      setResult({ error: err.message });
    }
    setLoading(false);
  };

  // Login screen
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-2">
              Los Pitufos FantaF1
            </div>
            <h1 className="text-2xl font-black text-white font-[family-name:var(--font-oswald)]">
              ADMIN PANEL
            </h1>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold block mb-2">Username</label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8002D]/40"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold block mb-2">Password</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8002D]/40"
              />
            </div>
            {loginError && <div className="text-red-400 text-xs text-center">{loginError}</div>}
            <button
              onClick={handleLogin}
              className="w-full bg-[#E8002D] hover:bg-[#E8002D]/80 text-white font-bold py-3 rounded-xl text-sm tracking-wider transition-all"
            >
              ACCEDI
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin panel
  const race = RACES_2026.find((r) => r.round === round);
  const driversSorted = [...DRIVERS_2026].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
              Admin Panel
            </div>
            <h1 className="text-3xl font-black font-[family-name:var(--font-oswald)]">
              POST-GARA
            </h1>
          </div>
          <button
            onClick={() => setAuthed(false)}
            className="text-white/30 hover:text-white/60 text-xs border border-white/10 px-3 py-2 rounded-lg transition-all"
          >
            Logout
          </button>
        </div>

        {/* Selezione Round */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
          <label className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold block mb-3">
            Seleziona Round
          </label>
          <select
            value={round}
            onChange={(e) => { setRound(Number(e.target.value)); setResult(null); setLogs([]); }}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8002D]/40 appearance-none"
          >
            {RACES_2026.map((r) => (
              <option key={r.round} value={r.round} className="bg-[#0a0a12]">
                R{r.round} — {r.flag} {r.name} ({new Date(r.date).toLocaleDateString("it-IT")})
              </option>
            ))}
          </select>

          {race && (
            <div className="mt-3 text-xs text-white/40">
              {race.sprint ? "Weekend Sprint" : "Weekend Normale"} — {race.circuit}
            </div>
          )}
        </div>

        {/* Selezione Sessione */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
          <label className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold block mb-3">
            Sessione da calcolare
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "sprint_shootout", label: "Sprint Qualifiche", desc: "Solo punti piloti SS", sprint: true },
              { value: "sprint", label: "Sprint Race", desc: "Solo punti piloti Sprint", sprint: true },
              { value: "qualifying", label: "Qualifica", desc: "Solo punti piloti Quali" },
              { value: "race", label: "Gara", desc: "Piloti + Previsioni + Penalita" },
            ].filter((s) => !s.sprint || race?.sprint).map((s) => (
              <button
                key={s.value}
                onClick={() => setSession(s.value)}
                className={`p-3 rounded-xl text-left transition-all border ${
                  session === s.value
                    ? "bg-[#E8002D]/20 border-[#E8002D]/40 text-white"
                    : "bg-white/[0.02] border-white/[0.06] text-white/50 hover:border-white/20"
                }`}
              >
                <div className="text-sm font-bold">{s.label}</div>
                <div className="text-[10px] text-white/30 mt-1">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Driver of the Day — solo per mode "race" */}
        {session === "race" && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
            <label className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold block mb-3">
              Driver of the Day
            </label>
            <select
              value={dotd ?? ""}
              onChange={(e) => setDotd(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8002D]/40 appearance-none"
            >
              <option value="" className="bg-[#0a0a12]">— Nessuno / Non ancora annunciato —</option>
              {driversSorted.map((d) => (
                <option key={d.number} value={d.number} className="bg-[#0a0a12]">
                  #{d.number} {d.name} ({d.team})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Bottoni */}
        <div className="flex gap-3">
          <button
            onClick={handlePostGara}
            disabled={loading || resetting}
            className={`flex-1 py-4 rounded-2xl font-bold text-sm tracking-[2px] uppercase transition-all ${
              loading || resetting
                ? "bg-white/10 text-white/30 cursor-wait"
                : "bg-[#E8002D] hover:bg-[#E8002D]/80 text-white hover:scale-[1.01] active:scale-[0.99]"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Calcolo in corso...
              </span>
            ) : (
              `Calcola ${session === "sprint_shootout" ? "Sprint Quali" : session === "sprint" ? "Sprint" : session === "qualifying" ? "Qualifica" : "Gara"} R${round}`
            )}
          </button>
          <button
            onClick={async () => {
              if (!confirm(`Sei sicuro di voler azzerare i punteggi del Round ${round}?`)) return;
              setResetting(true);
              setResult(null);
              setLogs([]);
              try {
                const res = await fetch("/api/reset-round", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ round, admin_key: ADMIN_API_KEY }),
                });
                const data = await res.json();
                setResult(data);
                if (data.log) setLogs(data.log);
              } catch (err: any) {
                setResult({ error: err.message });
              }
              setResetting(false);
            }}
            disabled={loading || resetting}
            className={`py-4 px-6 rounded-2xl font-bold text-sm tracking-[2px] uppercase transition-all ${
              loading || resetting
                ? "bg-white/10 text-white/30 cursor-wait"
                : "bg-orange-600 hover:bg-orange-600/80 text-white hover:scale-[1.01] active:scale-[0.99]"
            }`}
          >
            {resetting ? (
              <span className="flex items-center justify-center gap-3">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Reset...
              </span>
            ) : (
              "RESET"
            )}
          </button>
        </div>

        {/* Risultato */}
        {result && (
          <div className="mt-6 space-y-4">
            {result.error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
                <div className="text-red-400 font-bold text-sm mb-2">Errore</div>
                <div className="text-red-300 text-sm">{result.error}</div>
              </div>
            ) : (
              <>
                {/* Classifica weekend */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-[10px] tracking-[2px] text-[#E8002D] uppercase font-bold">
                      {result.session === "race" ? "Classifica Weekend" : `Parziale — ${result.session}`}
                    </div>
                    <div className="text-xs text-white/30">
                      {result.gara} — {result.giocatori} giocatori
                    </div>
                  </div>

                  {/* Sessioni calcolate */}
                  {result.sessioni_calcolate && (
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {Object.entries(result.sessioni_calcolate).map(([key, done]) => (
                        <span
                          key={key}
                          className={`text-[10px] px-2 py-1 rounded-lg font-bold ${
                            done ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-white/[0.03] text-white/20 border border-white/[0.05]"
                          }`}
                        >
                          {key.replace("_", " ").toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    {result.classifica?.map((c: any) => (
                      <div
                        key={c.pos}
                        className="flex items-center gap-4 bg-white/[0.02] rounded-xl px-4 py-3"
                      >
                        <span className={`font-[family-name:var(--font-jetbrains)] font-bold text-lg w-8 ${
                          c.pos === 1 ? "text-[#E8002D]" : c.pos <= 3 ? "text-white" : "text-white/40"
                        }`}>
                          {c.pos}
                        </span>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{c.nome}</div>
                          <div className="text-[11px] text-white/30">{c.scuderia}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-[family-name:var(--font-jetbrains)] font-bold text-lg">
                            {c.punti_weekend}
                          </div>
                          {c.punti_reale != null && (
                            <div className="text-[10px] text-white/30">
                              Reale: +{c.punti_reale}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Eventi */}
                {result.eventi && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                    <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-3">
                      Eventi Gara
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      {[
                        ["Safety Car", result.eventi.safety_car],
                        ["VSC", result.eventi.virtual_safety_car],
                        ["Red Flag", result.eventi.red_flag],
                        ["Gomme Wet", result.eventi.wet_tyres],
                        ["Pole ha vinto", result.eventi.pole_won],
                        [`DNF: ${result.eventi.total_dnf}`, true],
                      ].map(([label, val], i) => (
                        <div
                          key={i}
                          className={`px-3 py-2 rounded-lg text-center font-bold ${
                            typeof val === "boolean"
                              ? val ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-white/[0.03] text-white/30 border border-white/[0.05]"
                              : "bg-white/[0.03] text-white/60 border border-white/[0.05]"
                          }`}
                        >
                          {label as string}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Logs */}
            {logs.length > 0 && (
              <details className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4">
                <summary className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold cursor-pointer">
                  Log dettagliato ({logs.length} righe)
                </summary>
                <div className="mt-3 font-[family-name:var(--font-jetbrains)] text-[11px] space-y-1 max-h-60 overflow-y-auto">
                  {logs.map((l, i) => (
                    <div key={i} className={
                      l.includes("ERROR") ? "text-red-400" :
                      l.includes("---") ? "text-[#E8002D] font-bold mt-2" :
                      l.includes("OK") ? "text-green-400" :
                      "text-white/50"
                    }>{l}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

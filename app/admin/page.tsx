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
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [reviewData, setReviewData] = useState<any>(null);
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

  const handleReview = async () => {
    setReviewing(true);
    setReviewData(null);
    try {
      const res = await fetch("/api/review-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, admin_key: ADMIN_API_KEY }),
      });
      const data = await res.json();
      setReviewData(data);
    } catch (err: any) {
      setReviewData({ error: err.message });
    }
    setReviewing(false);
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
            onClick={handleReview}
            disabled={loading || resetting || reviewing}
            className={`py-4 px-6 rounded-2xl font-bold text-sm tracking-[2px] uppercase transition-all ${
              loading || resetting || reviewing
                ? "bg-white/10 text-white/30 cursor-wait"
                : "bg-blue-600 hover:bg-blue-600/80 text-white hover:scale-[1.01] active:scale-[0.99]"
            }`}
          >
            {reviewing ? (
              <span className="flex items-center justify-center gap-3">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Review...
              </span>
            ) : (
              "REVIEW"
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
        {/* Review Breakdown */}
        {reviewData && !reviewData.error && (
          <div className="mt-6 space-y-6">
            {/* Discrepanze Alert */}
            {reviewData.discrepanze?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
                <div className="text-red-400 font-bold text-sm mb-2">DISCREPANZE TROVATE</div>
                {reviewData.discrepanze.map((d: any) => (
                  <div key={d.user_id} className="text-red-300 text-xs">
                    {d.nome}: salvato {d.totale_salvato} vs calcolato {d.totale_calcolato} (diff: {d.differenza > 0 ? "+" : ""}{d.differenza})
                  </div>
                ))}
              </div>
            )}
            {reviewData.discrepanze?.length === 0 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
                <span className="text-green-400 font-bold text-sm">Nessuna discrepanza — punteggi salvati corrispondono al calcolo</span>
              </div>
            )}

            {/* Raw Results */}
            <details className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <summary className="text-[10px] tracking-[2px] text-[#E8002D] uppercase font-bold cursor-pointer">
                Risultati Grezzi (weekend_results)
              </summary>
              <div className="mt-4 space-y-4">
                {/* Events */}
                <div>
                  <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-2">Eventi</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      ["SC", reviewData.raw_results.events.safety_car],
                      ["VSC", reviewData.raw_results.events.virtual_safety_car],
                      ["Red Flag", reviewData.raw_results.events.red_flag],
                      ["Wet", reviewData.raw_results.events.wet_tyres],
                      ["Pole Won", reviewData.raw_results.events.pole_won],
                      [`DNF: ${reviewData.raw_results.events.total_dnf}`, true],
                    ].map(([label, val], i) => (
                      <div key={i} className={`px-2 py-1 rounded-lg text-center font-bold ${
                        typeof val === "boolean"
                          ? val ? "bg-green-500/10 text-green-400" : "bg-white/[0.03] text-white/30"
                          : "bg-white/[0.03] text-white/60"
                      }`}>{label as string}</div>
                    ))}
                  </div>
                </div>

                {/* Qualifying */}
                <div>
                  <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-2">Qualifica</div>
                  <div className="space-y-1">
                    {reviewData.raw_results.qualifying?.map((r: any) => (
                      <div key={r.driver_number} className="flex justify-between text-xs bg-white/[0.02] px-3 py-1 rounded-lg">
                        <span className="text-white/60">P{r.pos}</span>
                        <span className="text-white">{r.driver}</span>
                        {r.dnf && <span className="text-red-400">DNF</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Race */}
                <div>
                  <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-2">Gara</div>
                  <div className="space-y-1">
                    {reviewData.raw_results.race?.map((r: any) => (
                      <div key={r.driver_number} className="flex items-center gap-2 text-xs bg-white/[0.02] px-3 py-1 rounded-lg">
                        <span className="text-white/60 w-8">P{r.pos}</span>
                        <span className="text-white flex-1">{r.driver}</span>
                        {r.grid && <span className="text-white/30">Grid P{r.grid}</span>}
                        {r.dnf && <span className="text-red-400">DNF</span>}
                        {r.fastest_lap && <span className="text-purple-400">FL</span>}
                        {r.dotd && <span className="text-yellow-400">DOTD</span>}
                        {r.penalty && <span className="text-orange-400">PEN</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sprint Shootout */}
                {reviewData.raw_results.sprint_shootout && (
                  <div>
                    <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-2">Sprint Shootout</div>
                    <div className="space-y-1">
                      {reviewData.raw_results.sprint_shootout.map((r: any) => (
                        <div key={r.driver_number} className="flex justify-between text-xs bg-white/[0.02] px-3 py-1 rounded-lg">
                          <span className="text-white/60">P{r.pos}</span>
                          <span className="text-white">{r.driver}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sprint */}
                {reviewData.raw_results.sprint && (
                  <div>
                    <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-2">Sprint Race</div>
                    <div className="space-y-1">
                      {reviewData.raw_results.sprint.map((r: any) => (
                        <div key={r.driver_number} className="flex items-center gap-2 text-xs bg-white/[0.02] px-3 py-1 rounded-lg">
                          <span className="text-white/60 w-8">P{r.pos}</span>
                          <span className="text-white flex-1">{r.driver}</span>
                          {r.fastest_lap && <span className="text-purple-400">FL</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>

            {/* Per-Player Breakdown */}
            {reviewData.players?.map((player: any, idx: number) => (
              <details key={player.user_id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <summary className="cursor-pointer">
                  <div className="inline-flex items-center gap-4 w-full">
                    <span className={`font-[family-name:var(--font-jetbrains)] font-bold text-lg w-8 ${
                      idx === 0 ? "text-[#E8002D]" : idx < 3 ? "text-white" : "text-white/40"
                    }`}>{idx + 1}</span>
                    <div className="flex-1">
                      <span className="font-semibold text-sm text-white">{player.nome}</span>
                      <span className="text-white/30 text-xs ml-2">{player.scuderia}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-[family-name:var(--font-jetbrains)] font-bold text-lg text-white">{player.totale_calcolato}</span>
                      {player.differenza !== null && player.differenza !== 0 && (
                        <span className="text-red-400 text-xs ml-2">(salvato: {player.totale_salvato})</span>
                      )}
                    </div>
                  </div>
                </summary>

                <div className="mt-4 space-y-4">
                  {/* Formazione */}
                  <div className="bg-white/[0.02] rounded-xl p-4">
                    <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-2">Formazione</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {player.formazione.piloti.map((p: any) => (
                        <span key={p.number} className={`px-2 py-1 rounded-lg ${
                          p.number === player.formazione.primo_pilota?.number
                            ? "bg-[#E8002D]/20 text-[#E8002D] border border-[#E8002D]/30 font-bold"
                            : "bg-white/[0.05] text-white/60 border border-white/[0.08]"
                        }`}>
                          #{p.number} {p.name}
                          {p.number === player.formazione.primo_pilota?.number && " (PP)"}
                        </span>
                      ))}
                      {player.formazione.sesto_uomo && (
                        <span className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">
                          #{player.formazione.sesto_uomo.number} {player.formazione.sesto_uomo.name} (6th)
                        </span>
                      )}
                    </div>
                    {player.formazione.chip_piloti && (
                      <div className="mt-2 text-xs text-yellow-400">
                        Chip: {player.formazione.chip_piloti.toUpperCase()}
                        {player.formazione.chip_piloti_target && ` → #${player.formazione.chip_piloti_target}`}
                      </div>
                    )}
                  </div>

                  {/* Piloti Breakdown */}
                  <div className="bg-white/[0.02] rounded-xl p-4">
                    <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-3">
                      Punti Piloti: {player.punti_piloti}
                    </div>
                    {player.piloti_breakdown.map((drv: any) => (
                      <div key={drv.driver_number} className="mb-3 last:mb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-white">
                            {drv.name}
                            {drv.primo_pilota && <span className="text-[#E8002D] ml-1">(PP x2)</span>}
                            {drv.boost && <span className="text-yellow-400 ml-1">(BOOST x3)</span>}
                            {drv.sesto_uomo && <span className="text-blue-400 ml-1">(6th)</span>}
                            {drv.halo_applicato && <span className="text-green-400 ml-1">(HALO)</span>}
                          </span>
                          <span className="ml-auto font-[family-name:var(--font-jetbrains)] text-xs font-bold">
                            base: {drv.punti_base} x{drv.moltiplicatore} = <span className={drv.punti_finali >= 0 ? "text-green-400" : "text-red-400"}>{drv.punti_finali}</span>
                          </span>
                        </div>
                        <div className="pl-4 space-y-0.5">
                          {Object.entries(drv.sessions).map(([sessionName, bd]: [string, any]) => (
                            <div key={sessionName} className="text-[11px] text-white/40">
                              <span className="text-white/20 uppercase">{sessionName.replace("_", " ")}:</span>{" "}
                              {bd.items.map((item: any, i: number) => (
                                <span key={i} className={item.value >= 0 ? "text-white/50" : "text-red-400/70"}>
                                  {item.label}: {item.value > 0 ? "+" : ""}{item.value}
                                  {i < bd.items.length - 1 ? " | " : ""}
                                </span>
                              ))}
                              <span className="text-white/30 ml-1">[base: {bd.baseTotal}]</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Previsioni Breakdown */}
                  <div className="bg-white/[0.02] rounded-xl p-4">
                    <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mb-3">
                      Punti Previsioni: {player.punti_previsioni}
                    </div>
                    {player.previsioni_raw ? (
                      <div className="space-y-1">
                        {[
                          { key: "safetyCar", label: "Safety Car", val: player.previsioni_raw.safety_car, event: reviewData.raw_results.events.safety_car },
                          { key: "virtualSafetyCar", label: "VSC", val: player.previsioni_raw.virtual_safety_car, event: reviewData.raw_results.events.virtual_safety_car },
                          { key: "redFlag", label: "Red Flag", val: player.previsioni_raw.red_flag, event: reviewData.raw_results.events.red_flag },
                          { key: "gommeWet", label: "Gomme Wet", val: player.previsioni_raw.gomme_wet, event: reviewData.raw_results.events.wet_tyres },
                          { key: "poleVince", label: "Pole Vince", val: player.previsioni_raw.pole_vince, event: reviewData.raw_results.events.pole_won },
                          { key: "numeroDnf", label: "Num. DNF", val: player.previsioni_raw.numero_dnf, event: reviewData.raw_results.events.total_dnf },
                        ].map((p) => {
                          const pts = player.previsioni_breakdown[p.key] ?? 0;
                          const isDnf = p.key === "numeroDnf";
                          const corretto = isDnf ? p.val === p.event : p.val === p.event;
                          const isChipTarget = player.previsioni_raw.chip_target === p.key;
                          return (
                            <div key={p.key} className="flex items-center gap-2 text-xs">
                              <span className="w-24 text-white/40">{p.label}:</span>
                              <span className={`w-12 ${p.val === null ? "text-white/20" : "text-white/60"}`}>
                                {p.val === null ? "—" : isDnf ? p.val : p.val ? "SI" : "NO"}
                              </span>
                              <span className="w-16 text-white/20">
                                reale: {isDnf ? p.event : p.event ? "SI" : "NO"}
                              </span>
                              <span className={`w-8 font-bold ${corretto && p.val !== null ? "text-green-400" : p.val === null ? "text-white/20" : "text-red-400"}`}>
                                {corretto && p.val !== null ? "OK" : p.val === null ? "—" : "X"}
                              </span>
                              <span className={`font-[family-name:var(--font-jetbrains)] font-bold ${pts > 0 ? "text-green-400" : "text-white/30"}`}>
                                {pts > 0 ? "+" : ""}{pts}
                              </span>
                              {isChipTarget && (
                                <span className="text-yellow-400 text-[10px]">
                                  [{player.previsioni_raw.chip_attivo?.toUpperCase()}]
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {player.previsioni_raw.chip_attivo && (
                          <div className="mt-1 text-xs text-yellow-400">
                            Chip Previsioni: {player.previsioni_raw.chip_attivo.toUpperCase()} su {player.previsioni_raw.chip_target}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-white/20">Nessuna previsione confermata</div>
                    )}
                  </div>

                  {/* Penalita Cambi */}
                  {player.num_cambi > 0 && (
                    <div className="bg-white/[0.02] rounded-xl p-4">
                      <div className="text-xs text-white/40">
                        Cambi mercato: {player.num_cambi} (2 gratis)
                        {player.penalita_cambi > 0 && (
                          <span className="text-red-400 font-bold ml-2">Penalita: -{player.penalita_cambi}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Totale */}
                  <div className="bg-white/[0.02] rounded-xl p-4 flex justify-between items-center">
                    <span className="text-xs text-white/40">Totale</span>
                    <div className="text-right">
                      <span className="font-[family-name:var(--font-jetbrains)] font-bold text-white">
                        {player.punti_piloti} + {player.punti_previsioni}{player.penalita_cambi > 0 ? ` - ${player.penalita_cambi}` : ""} = {player.totale_calcolato}
                      </span>
                      {player.totale_salvato !== null && (
                        <span className={`text-xs ml-3 ${player.differenza === 0 ? "text-green-400" : "text-red-400"}`}>
                          (DB: {player.totale_salvato})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}

        {reviewData?.error && (
          <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
            <div className="text-red-400 font-bold text-sm mb-2">Errore Review</div>
            <div className="text-red-300 text-sm">{reviewData.error}</div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth";
import { useLeghe, useLegaPreferita } from "../lib/store";
import { useStatistiche, raceLabel, PREVISIONI_MAX_WEEKEND } from "../lib/use-statistiche";
import { chipLabel } from "../lib/chip-labels";
import { LineChart, type LineSeries } from "../components/charts/LineChart";
import { StackedBarChart } from "../components/charts/StackedBarChart";
import { HBarChart } from "../components/charts/HBarChart";
import { VIZ } from "../components/charts/chart-tokens";
import { SectionHead } from "../components/ui/SectionHead";
import { ChevronDown, Table2, LineChart as LineIcon } from "lucide-react";

const LEGA_GENERALE_ID = "00000000-0000-0000-0000-000000000001";

export default function StatistichePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { leghe, loaded: legheLoaded } = useLeghe();
  const { legaId: legaPreferita, loaded: legaPrefLoaded } = useLegaPreferita();

  const [legaSel, setLegaSel] = useState<string | null>(null);
  const [rivalId, setRivalId] = useState<string | null>(null);
  const [seasonMode, setSeasonMode] = useState<"punti" | "posizione">("punti");
  const [tableView, setTableView] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);



  const legaId = legaSel ?? (legaPrefLoaded ? legaPreferita : null) ?? LEGA_GENERALE_ID;
  const lega = leghe.find((l) => l.id === legaId);
  const stats = useStatistiche(legaId, lega?.round_start ?? 1, lega?.round_end ?? 24);

  const me = stats.players.find((p) => p.userId === user?.id) ?? null;
  const rival = stats.players.find((p) => p.userId === rivalId) ?? null;
  const nameOf = (id: string) => stats.players.find((p) => p.userId === id)?.tpName ?? "—";

  // ─── Serie del grafico stagionale (pattern emphasis: max 2 tinte) ───
  const seasonSeries: LineSeries[] = useMemo(() => {
    const pick = (id: string) =>
      seasonMode === "punti" ? stats.season.get(id)?.cumulative : stats.season.get(id)?.positions;
    return stats.players.map((p) => ({
      id: p.userId,
      label: p.tpName,
      values: pick(p.userId) ?? [],
      tone: p.userId === user?.id ? "me" : p.userId === rivalId ? "alt" : "muted",
    }));
  }, [stats.players, stats.season, seasonMode, user?.id, rivalId]);

  // ─── Barre weekend del giocatore mostrato (io, o l'avversario se non gioco) ───
  const focusId = me?.userId ?? rivalId ?? stats.players[0]?.userId ?? null;
  const focusRows = useMemo(() => {
    if (!focusId) return [];
    const sp = stats.season.get(focusId);
    if (!sp) return [];
    return stats.rounds.map((r, i) => {
      const row = sp.perRound[i];
      const piloti = Number(row?.piloti_points ?? 0);
      const prev = Number(row?.previsioni_points ?? 0);
      const total = Number(row?.total_points ?? 0);
      const penalita = piloti + prev - total;
      return {
        label: `R${r}`,
        values: [piloti, prev],
        note: penalita > 0 ? `Penalità cambi −${penalita}` : undefined,
      };
    });
  }, [focusId, stats.season, stats.rounds]);

  const mySummary = stats.summaries.find((x) => x.userId === focusId) ?? null;

  // Testa a testa con l'avversario selezionato, round per round
  const h2h = useMemo(() => {
    if (!me || !rival) return null;
    const a = stats.season.get(me.userId);
    const b = stats.season.get(rival.userId);
    if (!a || !b) return null;
    let meWins = 0;
    let rivalWins = 0;
    let draws = 0;
    stats.rounds.forEach((_, i) => {
      const pa = a.perRound[i];
      const pb = b.perRound[i];
      if (!pa || !pb) return;
      const va = Number(pa.total_points);
      const vb = Number(pb.total_points);
      if (va > vb) meWins += 1;
      else if (vb > va) rivalWins += 1;
      else draws += 1;
    });
    const lastA = a.cumulative.filter((v) => v !== null).pop() ?? 0;
    const lastB = b.cumulative.filter((v) => v !== null).pop() ?? 0;
    return { meWins, rivalWins, draws, gap: lastA - lastB };
  }, [me, rival, stats.season, stats.rounds]);

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
        <div className="mb-5">
          <div className="font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[2.5px] text-[#E8002D] uppercase font-bold mb-1.5">
            ANDAMENTO · STAGIONE 2026
          </div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.8px] leading-none">Statistiche</h1>
        </div>

        {/* ─── Filtri: una riga sopra tutti i grafici ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          <div>
            <div className="hud-label mb-1.5">LEGA</div>
            <div className="relative">
              <select
                value={legaId}
                onChange={(e) => { setLegaSel(e.target.value); setRivalId(null); }}
                className="w-full bg-[#0e0e14] border border-[#1c1c26] rounded px-4 py-3 text-white text-[13px] font-bold font-[family-name:var(--font-jetbrains)] tracking-[0.3px] outline-none focus:border-[#E8002D]/50 appearance-none pr-10"
              >
                {legheLoaded && leghe.length === 0 && <option value={LEGA_GENERALE_ID}>Lega Generale</option>}
                {leghe.map((l) => (
                  <option key={l.id} value={l.id} className="bg-[#050507]">
                    {l.name} (R{l.round_start}–R{l.round_end})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E8002D] pointer-events-none" />
            </div>
          </div>
          <div>
            <div className="hud-label mb-1.5">CONFRONTA CON</div>
            <div className="relative">
              <select
                value={rivalId ?? ""}
                onChange={(e) => setRivalId(e.target.value || null)}
                className="w-full bg-[#0e0e14] border border-[#1c1c26] rounded px-4 py-3 text-white text-[13px] font-bold font-[family-name:var(--font-jetbrains)] tracking-[0.3px] outline-none focus:border-[#E8002D]/50 appearance-none pr-10"
              >
                <option value="" className="bg-[#050507]">NESSUNO</option>
                {stats.players
                  .filter((p) => p.userId !== user.id)
                  .map((p) => (
                    <option key={p.userId} value={p.userId} className="bg-[#050507]">
                      {p.tpName}
                    </option>
                  ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E8002D] pointer-events-none" />
            </div>
          </div>
        </div>

        {stats.loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
          </div>
        ) : stats.rounds.length === 0 ? (
          <div className="hud-card p-10 text-center">
            <div className="text-white/30 text-sm font-semibold">Ancora nessun punteggio</div>
            <div className="text-white/15 text-[12px] mt-2">
              Le statistiche compaiono dopo il primo weekend calcolato.
            </div>
          </div>
        ) : (
          <>
            {/* ─── Tessere riepilogo ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile
                label="POSIZIONE"
                value={mySummary?.position ? `${mySummary.position}°` : "—"}
                sub={`su ${stats.players.length} · ${mySummary?.points ?? 0} pt`}
                trend={
                  mySummary?.position && mySummary?.prevPosition
                    ? mySummary.prevPosition - mySummary.position
                    : 0
                }
              />
              <StatTile
                label="WEEKEND VINTI"
                value={String(mySummary?.wins ?? 0)}
                sub={`${mySummary?.podiums ?? 0} podi su ${mySummary?.gp ?? 0} GP`}
              />
              <StatTile label="MEDIA A GP" value={mySummary?.avg !== null && mySummary?.avg !== undefined ? String(mySummary.avg) : "—"} />
              <StatTile
                label="MIGLIOR GP"
                value={mySummary?.best ? String(mySummary.best.points) : "—"}
                sub={mySummary?.best ? raceLabel(mySummary.best.round) : undefined}
              />
            </div>

            {/* ═══ Testa a testa ═══ */}
            {h2h && rival && me && (
              <>
                <SectionHead title="Testa a testa" right={`${h2h.meWins + h2h.rivalWins + h2h.draws} GP`} />
                <div className="hud-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[12px] font-bold text-[#E8002D] truncate">{me.tpName}</div>
                      <div className="font-[family-name:var(--font-jetbrains)] text-[26px] font-extrabold leading-none mt-1">{h2h.meWins}</div>
                    </div>
                    <div className="text-center shrink-0">
                      <div className="hud-label">PAREGGI</div>
                      <div className="font-[family-name:var(--font-jetbrains)] text-[16px] font-bold text-white/40 leading-none mt-1">{h2h.draws}</div>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-[12px] font-bold truncate" style={{ color: VIZ.alt }}>{rival.tpName}</div>
                      <div className="font-[family-name:var(--font-jetbrains)] text-[26px] font-extrabold leading-none mt-1">{h2h.rivalWins}</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#1c1c26] text-[12px] text-white/50">
                    In classifica sei{" "}
                    <span className={`font-[family-name:var(--font-jetbrains)] font-bold tabular-nums ${h2h.gap >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {h2h.gap > 0 ? "+" : ""}{h2h.gap}
                    </span>{" "}
                    punti rispetto a {rival.tpName}.
                  </div>
                </div>
              </>
            )}

            {/* ═══ Andamento campionato ═══ */}
            <SectionHead
              title="Andamento"
              right={
                <button
                  onClick={() => setTableView((v) => !v)}
                  className="inline-flex items-center gap-1 hover:text-white/60 transition-colors"
                >
                  {tableView ? <LineIcon size={11} /> : <Table2 size={11} />}
                  {tableView ? "GRAFICO" : "TABELLA"}
                </button>
              }
            />
            <div className="hud-card p-3">
              <div className="flex gap-1 mb-3">
                {(["punti", "posizione"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSeasonMode(m)}
                    className={`flex-1 py-2 rounded font-[family-name:var(--font-jetbrains)] text-[10px] font-bold tracking-[1.5px] uppercase transition-colors ${
                      seasonMode === m
                        ? "bg-[#E8002D]/12 border border-[#E8002D]/45 text-[#E8002D]"
                        : "bg-[#0e0e14] border border-[#1c1c26] text-white/35 hover:text-white/60"
                    }`}
                  >
                    {m === "punti" ? "Punti cumulati" : "Posizione"}
                  </button>
                ))}
              </div>

              {tableView ? (
                <SeasonTable
                  rounds={stats.rounds}
                  players={stats.players}
                  season={stats.season}
                  mode={seasonMode}
                  meId={user.id}
                />
              ) : (
                <LineChart
                  xLabels={stats.roundLabels}
                  series={seasonSeries}
                  invertY={seasonMode === "posizione"}
                  height={230}
                  xTitle="Round"
                  formatValue={(v) => (seasonMode === "posizione" ? `P${v}` : String(v))}
                />
              )}

              {/* Legenda: sempre presente, l'identità non è mai solo colore */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-[#1c1c26]">
                <LegendItem color={VIZ.me} label={me ? me.tpName : "Tu"} />
                <LegendItem color={VIZ.alt} label={rival ? rival.tpName : "Confronto (scegli sopra)"} dim={!rival} />
                <LegendItem color={VIZ.muted} label={`Altri (${Math.max(0, stats.players.length - (me ? 1 : 0) - (rival ? 1 : 0))})`} dim />
              </div>
            </div>

            {/* ═══ Weekend per weekend ═══ */}
            <SectionHead
              title="Weekend per weekend"
              right={focusId && focusId !== user.id ? nameOf(focusId) : "I TUOI PUNTI"}
            />
            <div className="hud-card p-3">
              <StackedBarChart
                rows={focusRows}
                seriesLabels={["Piloti", "Previsioni"]}
                colors={[VIZ.stack1, VIZ.stack2]}
                height={200}
                xTitle="Round"
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-[#1c1c26]">
                <LegendItem color={VIZ.stack1} label="Piloti" />
                <LegendItem color={VIZ.stack2} label="Previsioni" />
              </div>
              <p className="text-[10px] text-white/25 mt-2 leading-snug">
                Le barre mostrano i punti lordi. Le penalità cambi (già scalate dal totale) compaiono nel dettaglio al tocco.
              </p>
            </div>

            {/* ═══ Rendimento dei partecipanti ═══ */}
            <SectionHead title="Rendimento" right={`${stats.rounds.length} GP`} />
            <div className="space-y-2">
              {stats.summaries.map((p, i) => (
                <div
                  key={p.userId}
                  className={`hud-card p-3 ${p.userId === user.id ? "border-[#E8002D]/30 bg-[#E8002D]/[0.04]" : ""}`}
                >
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span
                      className={`font-[family-name:var(--font-jetbrains)] font-extrabold text-[15px] tabular-nums w-6 text-center shrink-0 ${
                        i === 0 ? "text-[#E8002D]" : i < 3 ? "text-white" : "text-white/25"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[13px] font-bold truncate leading-tight ${p.userId === user.id ? "text-[#E8002D]" : ""}`}>
                        {p.tpName}
                      </div>
                      <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/25 truncate uppercase tracking-[0.5px]">
                        {p.scuderiaName}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-[family-name:var(--font-jetbrains)] text-[18px] font-extrabold tabular-nums leading-none">
                        {p.points}
                      </div>
                      <div className="hud-label mt-1">PUNTI</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    <MiniStat label="GP" value={String(p.gp)} />
                    <MiniStat label="VITT" value={String(p.wins)} accent={p.wins > 0 ? "text-[#E8002D]" : undefined} />
                    <MiniStat label="PODI" value={String(p.podiums)} />
                    <MiniStat label="MEDIA" value={p.avg !== null ? String(p.avg) : "—"} />
                    <MiniStat label="MAX" value={p.best ? String(p.best.points) : "—"} accent="text-green-400" />
                  </div>
                </div>
              ))}
            </div>

            {/* ═══ Piazzamenti weekend ═══ */}
            <SectionHead title="Piazzamenti" right="P1 · P2 · P3" />
            <div className="hud-card p-4">
              <div className="space-y-2.5">
                {stats.summaries.map((p) => {
                  const p1 = p.placements[0] ?? 0;
                  const p2 = p.placements[1] ?? 0;
                  const p3 = p.placements[2] ?? 0;
                  const other = Math.max(0, p.gp - p1 - p2 - p3);
                  const seg = [
                    { n: p1, color: VIZ.me, label: "P1" },
                    { n: p2, color: VIZ.alt, label: "P2" },
                    { n: p3, color: VIZ.third, label: "P3" },
                    { n: other, color: "rgba(255,255,255,0.10)", label: "Altri" },
                  ];
                  return (
                    <div key={p.userId} className="flex items-center gap-2.5">
                      <div className="w-[104px] sm:w-[140px] shrink-0 min-w-0">
                        <div className={`text-[12px] truncate leading-tight ${p.userId === user.id ? "text-white font-bold" : "text-white/70"}`}>
                          {p.tpName}
                        </div>
                        <div className="text-[9px] text-white/25 truncate leading-tight">
                          {p1}·{p2}·{p3} su {p.gp}
                        </div>
                      </div>
                      {/* Barra impilata: 2px di distanziatore colore superficie tra i segmenti */}
                      <div className="flex-1 flex gap-[2px] min-w-0">
                        {seg.map((sg) =>
                          sg.n === 0 ? null : (
                            <div
                              key={sg.label}
                              title={`${sg.label}: ${sg.n}`}
                              className="h-2.5 rounded-full"
                              style={{ width: `${(sg.n / Math.max(1, p.gp)) * 100}%`, backgroundColor: sg.color }}
                            />
                          ),
                        )}
                      </div>
                      <div className="w-9 text-right font-[family-name:var(--font-jetbrains)] text-[12px] font-bold tabular-nums text-white/80 shrink-0">
                        {p.realPoints}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-[#1c1c26]">
                <LegendItem color={VIZ.me} label="1° weekend" />
                <LegendItem color={VIZ.alt} label="2°" />
                <LegendItem color={VIZ.third} label="3°" />
                <LegendItem color="rgba(255,255,255,0.10)" label="Fuori dal podio" dim />
              </div>
              <p className="text-[10px] text-white/25 mt-2 leading-snug">
                Il numero a destra è la <strong className="text-white/40 font-semibold">Classifica Reale</strong>: 25-18-15-12-10-8-6-4-2-1 punti ai primi dieci di ogni weekend.
              </p>
            </div>

            {/* ═══ Albo dei weekend ═══ */}
            <SectionHead title="Albo dei weekend" right={`${stats.roundWinners.length} GP`} />
            <div className="hud-card overflow-hidden">
              {[...stats.roundWinners].reverse().map((w, i) => (
                <div
                  key={w.round}
                  className={`flex items-center gap-3 px-4 py-2.5 ${i < stats.roundWinners.length - 1 ? "border-b border-[#1c1c26]" : ""} ${
                    w.userId === user.id ? "bg-[#E8002D]/[0.05]" : ""
                  }`}
                >
                  <span className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1px] text-white/30 uppercase w-16 shrink-0">
                    {raceLabel(w.round)}
                  </span>
                  <span className={`text-[13px] font-bold truncate flex-1 min-w-0 ${w.userId === user.id ? "text-[#E8002D]" : ""}`}>
                    {nameOf(w.userId)}
                  </span>
                  <span className="font-[family-name:var(--font-jetbrains)] text-[13px] font-bold tabular-nums text-white/70 shrink-0">
                    {w.points}
                  </span>
                </div>
              ))}
            </div>

            {/* ═══ Previsioni ═══ */}
            <SectionHead title="Previsioni" right={`${stats.racesWithResults} GARE`} />
            <div className="hud-card p-4">
              <HBarChart
                max={100}
                items={stats.previsioniAccuracy.map((a) => ({
                  id: a.key,
                  label: a.label,
                  sub: `${a.correct}/${a.total}`,
                  value: a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0,
                  display: a.total > 0 ? `${Math.round((a.correct / a.total) * 100)}%` : "—",
                }))}
              />
              <div className="hud-label mt-5 mb-2">CHI INDOVINA DI PIÙ</div>
              <HBarChart
                max={100}
                emptyLabel="Nessuna previsione calcolata"
                items={stats.playerAccuracy.map((p) => ({
                  id: p.userId,
                  label: nameOf(p.userId),
                  sub: `${p.correct}/${p.total} · DNF ${p.dnfHits}/${p.dnfTotal}`,
                  value: Math.round((p.correct / p.total) * 100),
                  display: `${Math.round((p.correct / p.total) * 100)}%`,
                  color: p.userId === user.id ? VIZ.me : VIZ.stack1,
                  highlight: p.userId === user.id,
                }))}
              />
              <p className="text-[10px] text-white/25 mt-3 leading-snug">
                Percentuale sulle 5 previsioni SI/NO. Il numero DNF esatto è contato a parte. Un weekend
                perfetto vale {PREVISIONI_MAX_WEEKEND} punti di previsioni.
              </p>
            </div>

            {/* ═══ Eventi della stagione ═══ */}
            <SectionHead title="Eventi stagione" right={`${stats.racesWithResults} GARE`} />
            <div className="hud-card p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {stats.events.map((e) => (
                  <div key={e.key} className="bg-black/30 border border-[#1c1c26] rounded p-3">
                    <div className="font-[family-name:var(--font-jetbrains)] text-[18px] font-extrabold leading-none">
                      {e.happened}
                      <span className="text-white/25 text-[12px] font-bold"> / {e.total}</span>
                    </div>
                    <div className="hud-label mt-1.5">{e.label}</div>
                  </div>
                ))}
                <div className="bg-black/30 border border-[#1c1c26] rounded p-3">
                  <div className="font-[family-name:var(--font-jetbrains)] text-[18px] font-extrabold leading-none text-amber-400">
                    {stats.totalDnf}
                  </div>
                  <div className="hud-label mt-1.5">DNF TOTALI</div>
                </div>
              </div>
            </div>

            {/* ═══ Record della lega ═══ */}
            <SectionHead title="Record della lega" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <RecordCard
                label="MIGLIOR WEEKEND"
                value={stats.bestWeekend ? `${stats.bestWeekend.points}` : "—"}
                who={stats.bestWeekend ? nameOf(stats.bestWeekend.userId) : ""}
                where={stats.bestWeekend ? raceLabel(stats.bestWeekend.round) : ""}
                accent="text-green-400"
              />
              <RecordCard
                label="PEGGIOR WEEKEND"
                value={stats.worstWeekend ? `${stats.worstWeekend.points}` : "—"}
                who={stats.worstWeekend ? nameOf(stats.worstWeekend.userId) : ""}
                where={stats.worstWeekend ? raceLabel(stats.worstWeekend.round) : ""}
                accent="text-red-400"
              />
            </div>

            {/* ═══ Aggiornamenti usati ═══ */}
            <SectionHead title="Aggiornamenti già usati" />
            <div className="hud-card overflow-hidden">
              {stats.players.map((p, i) => {
                const cu = stats.chipUsage.find((c) => c.userId === p.userId);
                const all = [...(cu?.piloti ?? []), ...(cu?.previsioni ?? [])];
                return (
                  <div
                    key={p.userId}
                    className={`flex items-start gap-3 px-4 py-3 ${i < stats.players.length - 1 ? "border-b border-[#1c1c26]" : ""} ${
                      p.userId === user.id ? "bg-[#E8002D]/[0.04]" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold truncate">{p.tpName}</div>
                      <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/25 truncate uppercase tracking-[0.5px]">
                        {p.scuderiaName}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                      {all.length === 0 ? (
                        <span className="text-[11px] text-white/20">Nessuno</span>
                      ) : (
                        all.map((c) => (
                          <span
                            key={c}
                            className="font-[family-name:var(--font-jetbrains)] text-[9px] font-bold tracking-[1px] uppercase px-2 py-1 rounded bg-amber-400/8 border border-amber-400/25 text-amber-400"
                          >
                            {chipLabel(c)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Link
              href="/classifica"
              className="flex items-center justify-center gap-2 bg-[#E8002D]/10 text-[#E8002D] font-bold text-[11px] tracking-wider uppercase py-3 rounded-xl hover:bg-[#E8002D]/20 transition-all mt-4"
            >
              Vai alla classifica
            </Link>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

// ─── Pezzi di UI ───

function StatTile({ label, value, sub, trend = 0 }: { label: string; value: string; sub?: string; trend?: number }) {
  return (
    <div className="hud-card p-3">
      <div className="flex items-baseline gap-1.5">
        <span className="font-[family-name:var(--font-jetbrains)] text-[22px] font-extrabold leading-none">{value}</span>
        {trend !== 0 && (
          <span className={`text-[11px] font-bold ${trend > 0 ? "text-green-400" : "text-red-400"}`}>
            {trend > 0 ? `▲${trend}` : `▼${Math.abs(trend)}`}
          </span>
        )}
      </div>
      <div className="hud-label mt-1.5">{label}</div>
      {sub && <div className="text-[10px] text-white/25 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-black/30 border border-[#1c1c26] rounded px-1 py-1.5 text-center">
      <div className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-bold tabular-nums leading-none ${accent ?? "text-white/80"}`}>
        {value}
      </div>
      <div className="font-[family-name:var(--font-jetbrains)] text-[8px] tracking-[1px] text-white/25 mt-1">{label}</div>
    </div>
  );
}

function LegendItem({ color, label, dim = false }: { color: string; label: string; dim?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] ${dim ? "text-white/30" : "text-white/60"}`}>
      <span className="w-2.5 h-[3px] rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function RecordCard({
  label,
  value,
  who,
  where,
  accent,
}: {
  label: string;
  value: string;
  who: string;
  where: string;
  accent: string;
}) {
  return (
    <div className="hud-card p-4">
      <div className="hud-label mb-2">{label}</div>
      <div className={`font-[family-name:var(--font-jetbrains)] text-[26px] font-extrabold leading-none ${accent}`}>
        {value}
      </div>
      <div className="text-[12px] text-white/60 mt-1.5 truncate">{who}</div>
      <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/25 uppercase tracking-[1px]">{where}</div>
    </div>
  );
}

function SeasonTable({
  rounds,
  players,
  season,
  mode,
  meId,
}: {
  rounds: number[];
  players: { userId: string; tpName: string }[];
  season: Map<string, { cumulative: (number | null)[]; positions: (number | null)[] }>;
  mode: "punti" | "posizione";
  meId: string;
}) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-[11px] font-[family-name:var(--font-jetbrains)] tabular-nums border-collapse">
        <thead>
          <tr className="text-white/30">
            <th className="text-left font-bold py-1.5 pr-2 sticky left-0 bg-[#0e0e14]">TEAM</th>
            {rounds.map((r) => (
              <th key={r} className="text-right font-bold py-1.5 px-1.5 whitespace-nowrap">R{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const vals = mode === "punti" ? season.get(p.userId)?.cumulative : season.get(p.userId)?.positions;
            return (
              <tr key={p.userId} className="border-t border-[#1c1c26]">
                <th
                  scope="row"
                  className={`text-left font-bold py-1.5 pr-2 whitespace-nowrap sticky left-0 bg-[#0e0e14] ${
                    p.userId === meId ? "text-[#E8002D]" : "text-white/60"
                  }`}
                >
                  {p.tpName}
                </th>
                {rounds.map((r, i) => (
                  <td key={r} className="text-right py-1.5 px-1.5 text-white/75">
                    {vals?.[i] ?? "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

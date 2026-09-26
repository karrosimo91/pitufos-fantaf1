"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import DriverTile from "../components/DriverTile";
import { DriverSheet } from "../components/mercato/DriverSheet";
import { SwapSheet } from "../components/mercato/SwapSheet";
import { SellSheet } from "../components/mercato/SellSheet";
import { PaidChangeSheet } from "../components/mercato/PaidChangeSheet";
import { useToast } from "../components/ui/Toast";
import { DRIVERS_2026, getDriverByNumber } from "../lib/drivers-data";
import { useLegaPreferita } from "../lib/store";
import { useWeekend } from "../lib/weekend-context";
import { useAuth } from "../lib/auth";
import { useDriverInsights, EMPTY_INSIGHT } from "../lib/use-driver-insights";
import { raceEndDate, formatWeekdayTimeLocal, getRaceByRound } from "../lib/races";
import { chipStatusText } from "../lib/chip-rules";
import { ArrowRightLeft, Lock, Search, ChevronRight, Shuffle } from "lucide-react";

type Filter = "tutti" | "rosa" | "cassa";
type Sort = "prezzo" | "forma" | "nome" | "team";

export default function MercatoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { round, race, locked, squadra } = useWeekend();
  const { legaId } = useLegaPreferita();
  const ins = useDriverInsights(round, legaId, locked);
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("tutti");
  const [sortBy, setSortBy] = useState<Sort>("prezzo");
  const [sheet, setSheet] = useState<
    | { kind: "driver"; n: number }
    | { kind: "swap"; n: number }
    | { kind: "sell"; n: number }
    | { kind: "paid"; n: number; then: "buy" | "swap" }
    | null
  >(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const priceOf = (n: number) => squadra.prices.get(n) ?? getDriverByNumber(n)?.price ?? 5;
  const ready = squadra.loaded && squadra.pricesLoaded;
  const rosterFull = squadra.driverNumbers.length >= 5;
  const cassa = squadra.budget;
  const rosaValue = squadra.driverNumbers.reduce((s, n) => s + priceOf(n), 0);
  const riapre = formatWeekdayTimeLocal(raceEndDate(race));
  const wildcardActive = squadra.chipPiloti === "wildcard";
  const wildcardUsedRound = squadra.chipPilotiUnavailable["wildcard"] ?? null;
  const wildcardAvailable = !wildcardActive && wildcardUsedRound == null;

  // Listino aggiornato: variazioni del round per i tuoi piloti
  const listino = useMemo(() => {
    const changes: { n: number; delta: number }[] = [];
    for (const n of squadra.driverNumbers) {
      const d = ins.insights.get(n)?.priceDelta ?? 0;
      if (d !== 0) changes.push({ n, delta: d });
    }
    return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [squadra.driverNumbers, ins.insights]);
  const lastRace = ins.lastRacedRound ? getRaceByRound(ins.lastRacedRound) : null;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const formScore = (n: number) => {
      const f = ins.insights.get(n)?.form ?? [];
      return f.reduce((s, x) => s + x.points, 0);
    };
    return DRIVERS_2026
      .map((d) => ({ ...d, price: priceOf(d.number), owned: squadra.driverNumbers.includes(d.number) }))
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.team.toLowerCase().includes(q))
      .filter((d) => filter === "tutti" || (filter === "rosa" ? d.owned : (!d.owned && d.price <= cassa)))
      .sort((a, b) => {
        if (sortBy === "prezzo") return b.price - a.price || a.name.localeCompare(b.name);
        if (sortBy === "forma") return formScore(b.number) - formScore(a.number) || b.price - a.price;
        if (sortBy === "nome") return a.name.localeCompare(b.name);
        return a.team.localeCompare(b.team) || b.price - a.price;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter, sortBy, squadra.driverNumbers, squadra.prices, ins.insights, cassa]);

  // ─── Azioni ───
  const doBuy = async (n: number) => {
    const d = getDriverByNumber(n);
    const res = await squadra.acquista(n);
    if (res.ok) {
      const rimasti = Math.max(0, squadra.CAMBI_GRATIS - (squadra.cambiRound + (squadra.rosaBase.length > 0 && !squadra.rosaBase.includes(n) ? 1 : 0)));
      toast.show(`${d?.name} in rosa`, {
        kind: "success",
        detail: `Cassa ${cassa - priceOf(n)} Soldini · ${squadra.driverNumbers.length + 1}/5${squadra.rosaBase.length > 0 ? ` · ${wildcardActive ? "Wildcard attiva" : `${rimasti} cambi gratis rimasti`}` : ""} · conferma nel Muretto`,
      });
    } else {
      toast.show("Acquisto non riuscito", { kind: "error", detail: res.error });
    }
  };

  const handleBuy = (n: number) => {
    if (!ready || locked) return;
    const price = priceOf(n);
    if (cassa < price) {
      toast.show(`Ti mancano ${price - cassa} Soldini`, { kind: "warning", detail: "Vendi prima un pilota, o scegline uno più economico" });
      return;
    }
    const countsAsChange = squadra.rosaBase.length > 0 && !squadra.rosaBase.includes(n);
    if (countsAsChange && squadra.penalitaProssimoCambio > 0) {
      setSheet({ kind: "paid", n, then: "buy" });
      return;
    }
    doBuy(n);
  };

  const handleSell = (n: number) => {
    if (!ready || locked) return;
    const isCaptain = squadra.primoPilota === n;
    const isTarget = squadra.chipPiloti === "boost" && squadra.chipPilotiTarget === n;
    if (isCaptain || isTarget) {
      setSheet({ kind: "sell", n });
      return;
    }
    doSell(n, null);
  };

  const doSell = async (n: number, nextCaptain: number | null) => {
    const d = getDriverByNumber(n);
    const ok = await squadra.vendi(n);
    setSheet(null);
    if (!ok) { toast.show("Vendita non riuscita", { kind: "error" }); return; }
    if (nextCaptain) squadra.setPrimoPilota(nextCaptain);
    const inBase = squadra.rosaBase.includes(n);
    toast.show(`${d?.name} venduto · +${priceOf(n)} Soldini`, {
      kind: "success",
      detail: nextCaptain ? `Primo Pilota: ${getDriverByNumber(nextCaptain)?.name}` : squadra.primoPilota === n ? "Scegli il nuovo Primo Pilota nel Muretto" : `Cassa ${cassa + priceOf(n)} Soldini`,
      action: inBase ? { label: "Annulla", onClick: () => { squadra.acquista(n); } } : undefined,
    });
  };

  const handleSwap = (n: number) => {
    if (!ready || locked) return;
    setSheet({ kind: "swap", n });
  };

  const doSwap = async (driverOut: number, driverIn: number, nextCaptain: number | null) => {
    const res = await squadra.scambia(driverOut, driverIn, nextCaptain);
    setSheet(null);
    if (res.ok) {
      toast.show(`${getDriverByNumber(driverOut)?.name.split(" ").pop()} → ${getDriverByNumber(driverIn)?.name}`, {
        kind: "success",
        detail: `Cassa ${cassa + priceOf(driverOut) - priceOf(driverIn)} Soldini · conferma nel Muretto`,
      });
    } else {
      toast.show("Scambio non riuscito", { kind: "error", detail: res.error });
    }
  };

  const activateWildcard = () => {
    squadra.setChipPiloti("wildcard");
    toast.show("Wildcard attivata", { kind: "success", detail: "Cambi illimitati senza penalità per questo round" });
  };

  const sheetDriver = sheet ? getDriverByNumber(sheet.n) : null;

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#050507] text-white bg-grid">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-3"><div className="skeleton h-20" /><div className="skeleton h-14" /><div className="skeleton h-14" /></div>
        <BottomNav />
      </div>
    );
  }

  const modified = ready && !squadra.confirmed && squadra.driverNumbers.length > 0 && !locked;

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />
      <main className={`max-w-3xl mx-auto px-4 py-5 ${modified ? "pb-stickybar" : "pb-bottomnav"}`}>
        {/* Testata + hero cassa */}
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="hud-label text-[#E8002D] mb-1">MERCATO · ROUND {round}</div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.6px] leading-none">Mercato</h1>
          </div>
          <div className="text-right">
            <div className="font-[family-name:var(--font-jetbrains)] text-[34px] font-extrabold tabular-nums leading-none">{ready ? cassa : "…"}</div>
            <div className="hud-label mt-1">SOLDINI LIBERI</div>
          </div>
        </div>
        <div className="mb-4">
          <div className="h-2 rounded bg-[#0e0e14] border border-[#1c1c26] overflow-hidden">
            <div className="h-full bg-white/70" style={{ width: `${Math.min(100, Math.max(0, (rosaValue / 100) * 100))}%` }} />
          </div>
          <div className="flex justify-between font-[family-name:var(--font-jetbrains)] text-[11px] text-white/55 mt-1">
            <span>Rosa {squadra.driverNumbers.length}/5 · vale {rosaValue}</span>
            <span>Budget 100</span>
          </div>
        </div>

        {locked && (
          <div className="hud-card hud-card-accent mb-4 p-4 flex items-center gap-3">
            <Lock size={16} className="text-[#E8002D] shrink-0" />
            <div>
              <div className="text-[14px] font-bold">Mercato chiuso</div>
              <div className="text-[12px] text-white/60">Riapre {riapre} con le nuove quotazioni</div>
            </div>
          </div>
        )}

        {/* Listino aggiornato */}
        {!locked && listino.length > 0 && lastRace && (
          <div className="hud-card mb-4 p-3.5">
            <div className="hud-label mb-1">LISTINO AGGIORNATO DOPO {lastRace.circuit.toUpperCase()}</div>
            <div className="text-[13px] text-white/80">
              {listino.map((c, i) => (
                <span key={c.n}>{i > 0 ? ", " : ""}{getDriverByNumber(c.n)?.name.split(" ").pop()} <span className={c.delta > 0 ? "text-[#2ee59d]" : "text-[#E8002D]"}>{c.delta > 0 ? "+" : ""}{c.delta}</span></span>
              ))}
              <span className="text-white/50"> · la tua rosa vale {rosaValue}</span>
            </div>
          </div>
        )}

        {/* Cambi */}
        {!locked && (
          <div className={`hud-card mb-4 p-3.5 flex items-center gap-3 ${squadra.penalitaProssimoCambio > 0 && !wildcardActive ? "border-[#ffb000]/40" : ""}`}>
            <ArrowRightLeft size={16} className={squadra.penalitaProssimoCambio > 0 && !wildcardActive ? "text-[#ffb000]" : "text-white/50"} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold">
                Cambi <span className="font-[family-name:var(--font-jetbrains)] tabular-nums">{squadra.cambiRound}/{squadra.CAMBI_GRATIS}</span> <span className="text-white/45 font-normal">gratis usati</span>
              </div>
              <div className={`font-[family-name:var(--font-jetbrains)] text-[11px] mt-0.5 ${wildcardActive ? "text-[#2ee59d]" : squadra.penalitaProssimoCambio > 0 ? "text-[#ffb000]" : "text-white/55"}`}>
                {wildcardActive ? "WILDCARD ATTIVA · CAMBI ILLIMITATI" : squadra.penalitaProssimoCambio > 0 ? `PROSSIMO CAMBIO: −${squadra.PENALITA_CAMBIO_EXTRA} PT WEEKEND` : `${squadra.cambiGratisRimasti} CAMBI GRATIS RIMASTI`}
                {squadra.penalitaTotale > 0 && ` · GIÀ −${squadra.penalitaTotale}`}
              </div>
            </div>
            {!wildcardActive && wildcardAvailable && squadra.penalitaProssimoCambio > 0 && (
              <button type="button" onClick={activateWildcard} className="btn-secondary py-2 px-3 text-[10px] shrink-0"><Shuffle size={12} /> WILDCARD</button>
            )}
          </div>
        )}

        {/* Ricerca + filtri */}
        <div className="relative mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca pilota o team"
            className="w-full bg-[#0e0e14] border border-[#1c1c26] rounded px-9 py-3 text-[14px] text-white placeholder:text-white/35 outline-none focus:border-white/30"
          />
        </div>
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto no-scrollbar">
          {([["tutti", "TUTTI"], ["rosa", `IN ROSA ${squadra.driverNumbers.length}`], ["cassa", `≤ ${cassa} S`]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={`pill shrink-0 ${filter === id ? "border-white/60 text-white bg-white/[0.08]" : ""}`}>{label}</button>
          ))}
          <span className="text-white/45 shrink-0">|</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as Sort)} className="pill bg-[#0e0e14] shrink-0 appearance-none pr-2">
            <option value="prezzo">PREZZO</option>
            <option value="forma">FORMA</option>
            <option value="nome">NOME</option>
            <option value="team">TEAM</option>
          </select>
        </div>

        {/* Lista */}
        {!ready ? (
          <div className="space-y-2"><div className="skeleton h-16" /><div className="skeleton h-16" /><div className="skeleton h-16" /><div className="skeleton h-16" /></div>
        ) : list.length === 0 ? (
          <div className="hud-card p-8 text-center text-[13px] text-white/55">Nessun pilota trovato{filter === "cassa" ? ` sotto ${cassa} Soldini: vendi qualcuno o cambia filtro` : ""}</div>
        ) : (
          <div className="space-y-2.5 pt-1">
            {list.map((d) => {
              const insight = ins.insights.get(d.number) ?? EMPTY_INSIGHT;
              const affordable = d.price <= cassa;
              const isCaptain = squadra.primoPilota === d.number;
              const isBoost = squadra.chipPiloti === "boost" && squadra.chipPilotiTarget === d.number && !isCaptain;
              const isSesto = squadra.sestoUomo === d.number;
              let action: React.ReactNode = null;
              if (!locked && ready) {
                if (d.owned) {
                  action = <button type="button" onClick={(e) => { e.stopPropagation(); handleSell(d.number); }} className="btn-secondary py-2 px-3 text-[10px]">VENDI</button>;
                } else if (rosterFull) {
                  action = <button type="button" onClick={(e) => { e.stopPropagation(); handleSwap(d.number); }} className="btn-secondary py-2 px-3 text-[10px] border-white/40">SCAMBIA</button>;
                } else {
                  action = (
                    <button type="button" disabled={!affordable} onClick={(e) => { e.stopPropagation(); handleBuy(d.number); }}
                      className={`py-2 px-3 rounded font-[family-name:var(--font-jetbrains)] text-[10px] font-bold tracking-[1.5px] uppercase tap ${affordable ? "bg-[#E8002D] text-white" : "bg-[#0e0e14] border border-[#1c1c26] text-white/35 cursor-not-allowed"}`}>
                      ACQUISTA
                    </button>
                  );
                }
              }
              const meta: string[] = [];
              if (insight.owners > 0) meta.push(`${insight.owners}/${ins.members || insight.owners} in lega`);
              if (insight.captains > 0) meta.push(`capitano di ${insight.captains}`);
              if (!d.owned && !rosterFull && !affordable && !locked) meta.push(`ti mancano ${d.price - cassa}`);
              return (
                <DriverTile
                  key={d.number}
                  driverNumber={d.number}
                  price={d.price}
                  priceDelta={insight.priceDelta}
                  form={insight.form}
                  metaLine={meta.length > 0 ? meta.join(" · ") : null}
                  warnLabel={insight.racedLast === false && lastRace ? `Non ha corso a ${lastRace.circuit}` : null}
                  role={isCaptain ? "captain" : isBoost ? "boost" : isSesto ? "sesto" : null}
                  selected={d.owned}
                  dimmed={!d.owned && !rosterFull && !affordable && !locked}
                  onTap={() => setSheet({ kind: "driver", n: d.number })}
                  right={action}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Barra fissa: stato rosa */}
      {modified && (
        <div className="sticky-bar">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/70 tracking-[0.5px] flex-1 min-w-0">
              CASSA {cassa} · {squadra.driverNumbers.length}/5 · CAMBI {squadra.cambiRound}/{squadra.CAMBI_GRATIS}{squadra.penalitaTotale > 0 ? <span className="text-[#ffb000]"> · −{squadra.penalitaTotale} PT</span> : ""}
              <div className="text-[#ffb000] text-[11px] mt-0.5">Rosa modificata, non confermata</div>
            </div>
            <Link href="/dashboard" className="btn-primary w-auto py-3 px-4 text-[11px]">CONFERMA NEL MURETTO <ChevronRight size={14} /></Link>
          </div>
        </div>
      )}

      {/* Fogli */}
      {sheet?.kind === "driver" && sheetDriver && (
        <DriverSheet
          driverNumber={sheet.n}
          price={priceOf(sheet.n)}
          insight={ins.insights.get(sheet.n) ?? EMPTY_INSIGHT}
          resultRows={ins.resultRows.map((r) => ({ round: r.round, data: r.data }))}
          locked={locked}
          members={ins.members}
          onClose={() => setSheet(null)}
          footer={!locked && ready ? (
            squadra.driverNumbers.includes(sheet.n)
              ? <button type="button" onClick={() => { const n = sheet.n; setSheet(null); handleSell(n); }} className="btn-secondary w-full">VENDI · +{priceOf(sheet.n)} SOLDINI</button>
              : rosterFull
                ? <button type="button" onClick={() => setSheet({ kind: "swap", n: sheet.n })} className="btn-primary">SCAMBIA CON UN TUO PILOTA</button>
                : <button type="button" disabled={priceOf(sheet.n) > cassa} onClick={() => { const n = sheet.n; setSheet(null); handleBuy(n); }} className="btn-primary">{priceOf(sheet.n) > cassa ? `TI MANCANO ${priceOf(sheet.n) - cassa} SOLDINI` : `ACQUISTA · ${priceOf(sheet.n)} SOLDINI`}</button>
          ) : undefined}
        />
      )}
      {sheet?.kind === "swap" && (
        <SwapSheet
          driverIn={sheet.n}
          roster={squadra.driverNumbers}
          primoPilota={squadra.primoPilota}
          boostTarget={squadra.chipPiloti === "boost" ? squadra.chipPilotiTarget : null}
          cassa={cassa}
          priceOf={priceOf}
          penaltyNext={squadra.rosaBase.length > 0 && !squadra.rosaBase.includes(sheet.n) ? squadra.penalitaProssimoCambio : 0}
          wildcard={wildcardActive}
          onConfirm={(out, next) => doSwap(out, sheet.n, next)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === "sell" && (
        <SellSheet
          driver={sheet.n}
          roster={squadra.driverNumbers}
          isCaptain={squadra.primoPilota === sheet.n}
          isBoostTarget={squadra.chipPiloti === "boost" && squadra.chipPilotiTarget === sheet.n}
          priceOut={priceOf(sheet.n)}
          cassa={cassa}
          onConfirm={(next) => doSell(sheet.n, next)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === "paid" && sheetDriver && (
        <PaidChangeSheet
          driverName={sheetDriver.name}
          penalty={squadra.PENALITA_CAMBIO_EXTRA}
          wildcardAvailable={wildcardAvailable}
          wildcardStatus={wildcardActive ? "Wildcard già attiva" : wildcardUsedRound != null ? chipStatusText(round, wildcardUsedRound) : `Wildcard disponibile · ${chipStatusText(round, null)}`}
          onConfirm={() => { const n = sheet.n; setSheet(null); doBuy(n); }}
          onWildcard={() => { const n = sheet.n; setSheet(null); activateWildcard(); doBuy(n); }}
          onClose={() => setSheet(null)}
        />
      )}
      <BottomNav />
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useWeekend } from "../../lib/weekend-context";
import { useLegaPreferita, useAggiornamenti, minDriversForRound } from "../../lib/store";
import { useCdaCompleted } from "../../lib/use-cda";
import { useDriverInsights } from "../../lib/use-driver-insights";
import { useWeekendResults } from "../../lib/use-weekend-results";
import { useToast } from "../ui/Toast";
import { calcolaPuntiWeekend } from "../../lib/scoring";
import { formatDateTimeLocal } from "../../lib/races";
import { chipLabel } from "../../lib/chip-labels";
import { MurettoHero, type HeroStep, type HeroStatus } from "./MurettoHero";
import { FormazioneSection } from "./FormazioneSection";
import { AggiornamentiSection } from "./AggiornamentiSection";
import { PrevisioniSection } from "./PrevisioniSection";
import { ConfermaBar } from "./ConfermaBar";
import { previsioneLabel } from "./previsioni-config";

/**
 * Il Muretto: una Home, cinque giorni. Prima della deadline prepara il
 * weekend (formazione, aggiornamenti, previsioni, un solo Conferma); dalla
 * deadline mostra lo stato chiuso e i punteggi; a gara calcolata rimanda al
 * recap. Stato di squadra e previsioni condiviso via WeekendProvider.
 */
export default function Muretto() {
  const { user } = useAuth();
  const { round, race, phase, locked, now, squadra: sq, previsioni: prev, live } = useWeekend();
  const { legaId } = useLegaPreferita();
  const { canPlay: cdaCanPlay } = useCdaCompleted();
  const toast = useToast();
  const ins = useDriverInsights(round, legaId, locked);
  const wr = useWeekendResults(round);
  const agg = useAggiornamenti();
  const [confirming, setConfirming] = useState(false);
  const [hadConfirmed, setHadConfirmed] = useState(false);

  // Ricorda se in questa sessione il weekend era già tutto confermato: dopo
  // una modifica lo stato passa a "modifiche non confermate".
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (sq.confirmed && prev.confirmed) setHadConfirmed(true);
  }, [sq.confirmed, prev.confirmed]);
  useEffect(() => { setHadConfirmed(false); }, [round]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const minDrivers = minDriversForRound(round);

  // Punti del weekend (per pilota) se ci sono risultati e la formazione è confermata
  const myCalc = useMemo(() => {
    if (!wr.results || !sq.confirmed || sq.driverNumbers.length === 0) return null;
    const raceDone = wr.results.race.length > 0;
    const empty = { safetyCar: null, virtualSafetyCar: null, redFlag: null, gommeWet: null, poleVince: null, numeroDnf: null };
    return calcolaPuntiWeekend(
      sq.driverNumbers, sq.primoPilota,
      raceDone ? prev.previsioni : empty,
      wr.results,
      { chipPiloti: sq.chipPiloti, chipPilotiTarget: sq.chipPilotiTarget, sestoUomo: sq.sestoUomo },
      raceDone ? { chipAttivo: prev.chipAttivo, chipTarget: prev.chipTarget } : { chipAttivo: null, chipTarget: null },
    );
  }, [wr.results, sq.confirmed, sq.driverNumbers, sq.primoPilota, sq.chipPiloti, sq.chipPilotiTarget, sq.sestoUomo, prev.previsioni, prev.chipAttivo, prev.chipTarget]);

  const pointsMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of myCalc?.pilotiDettaglio ?? []) m.set(d.driver_number, d.puntiFinali);
    return m;
  }, [myCalc]);

  // Cosa manca per confermare
  const missing: string[] = [];
  if (sq.driverNumbers.length < minDrivers) missing.push(`${minDrivers - sq.driverNumbers.length} piloti`);
  if (!sq.primoPilota) missing.push("Primo Pilota");
  if (sq.chipPiloti === "boost" && (!sq.chipPilotiTarget || sq.chipPilotiTarget === sq.primoPilota)) missing.push("pilota per il Boost");
  if (sq.chipPiloti === "sesto" && !sq.sestoUomo) missing.push("Sesto Uomo");
  if (prev.completate < 6) missing.push(`${6 - prev.completate} previsioni`);
  if (prev.chipAttivo === "doppia" && !prev.chipTarget) missing.push("previsione per la Doppia");

  const steps: HeroStep[] = [
    { label: `${Math.min(sq.driverNumbers.length, 5)}/5 piloti`, done: sq.driverNumbers.length >= minDrivers },
    { label: "Primo Pilota", done: !!sq.primoPilota },
    { label: `${prev.completate}/6 previsioni`, done: prev.completate === 6 },
    { label: "Chip (opz.)", done: !!sq.chipPiloti || !!prev.chipAttivo, optional: true },
  ];

  const bothConfirmed = sq.confirmed && prev.confirmed;
  const deadlineText = formatDateTimeLocal(race.deadline);
  let status: HeroStatus;
  if (locked) {
    status = {
      kind: "locked",
      text: bothConfirmed ? "Formazione e previsioni confermate"
        : sq.confirmed ? "Formazione confermata · previsioni non confermate"
        : prev.confirmed ? "Previsioni confermate · formazione non confermata"
        : "Nessuna formazione confermata per questo GP",
    };
  } else if (bothConfirmed) {
    status = { kind: "ok", text: `Weekend confermato · puoi modificare fino a ${deadlineText}` };
  } else if (hadConfirmed) {
    status = { kind: "modified", text: "Modifiche non confermate · tocca Conferma weekend" };
  } else if (missing.length > 0) {
    status = { kind: "todo", text: `Da completare: ${missing.join(", ")}` };
  } else {
    status = { kind: "todo", text: "Tutto pronto · tocca Conferma weekend" };
  }

  const handleConferma = async () => {
    if (cdaCanPlay === false) {
      toast.show("Completa il questionario CDA prima di confermare", { kind: "warning", action: { label: "Vai", onClick: () => { window.location.href = "/cda"; } } });
      return;
    }
    if (missing.length > 0) return;
    setConfirming(true);
    const [okForm, okPrev] = await Promise.all([sq.conferma(), prev.confermaPrevisioni()]);
    setConfirming(false);
    if (okForm && okPrev) {
      toast.show(`Weekend confermato · ${race.circuit}`, { kind: "success", detail: `Puoi ancora modificare fino a ${deadlineText}` });
    } else {
      toast.show("Conferma non riuscita", {
        kind: "error",
        detail: !okForm && !okPrev ? "Né formazione né previsioni sono state salvate: riprova" : !okForm ? "La formazione non è stata salvata (chip già usato in questa metà stagione?)" : "Le previsioni non sono state salvate: riprova",
      });
    }
  };

  const showConfermaBar = !locked && sq.loaded && prev.loaded && !bothConfirmed && (sq.driverNumbers.length > 0 || prev.completate > 0);
  const penaltyLine = sq.penalitaTotale > 0 ? `Cambi extra: −${sq.penalitaTotale} sul weekend` : null;
  const weekendScore = myCalc ? { total: myCalc.total - sq.penalitaTotale, official: true } : null;

  if (!sq.loaded || !prev.loaded) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-56" />
        <div className="skeleton h-14" />
        <div className="skeleton h-14" />
        <div className="skeleton h-14" />
      </div>
    );
  }

  return (
    <div className={showConfermaBar ? "pb-24" : ""}>
      <MurettoHero
        race={race}
        phase={phase}
        now={now}
        steps={steps}
        status={status}
        isLive={live.isLive}
        liveLabel={live.session?.sessionName}
        weekendScore={weekendScore}
      />

      {cdaCanPlay === false && !locked && (
        <Link href="/cda" className="flex items-center gap-3 bg-[#E8002D]/8 border-l-[3px] border-l-[#E8002D] border border-[#E8002D]/20 rounded-r px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-[#E8002D] shrink-0" />
          <span className="text-[13px] text-[#E8002D] font-semibold">Completa il questionario CDA per poter confermare</span>
          <ChevronRight size={14} className="ml-auto text-[#E8002D]/60 shrink-0" />
        </Link>
      )}

      {wr.raceArchived && (
        <Link href={`/risultati?round=${round}`} className="flex items-center gap-3 hud-card hud-card-accent p-4 mb-4 tap">
          <div className="flex-1">
            <div className="hud-label mb-1">GARA CALCOLATA</div>
            <div className="text-[14px] font-bold">Apri il recap del weekend: scontrino, rimpianti, condividi</div>
          </div>
          <ChevronRight size={16} className="text-white/45" />
        </Link>
      )}

      <FormazioneSection
        driverNumbers={sq.driverNumbers}
        primoPilota={sq.primoPilota}
        sestoUomo={sq.sestoUomo}
        chipPiloti={sq.chipPiloti}
        chipPilotiTarget={sq.chipPilotiTarget}
        locked={locked}
        insights={ins.insights}
        pointsMap={pointsMap}
        onSetCaptain={(n) => sq.setPrimoPilota(n)}
        onRemoveSesto={() => sq.setSestoUomo(null)}
        proposedFromRound={sq.primoPilotaProposto?.fromRound ?? null}
        lastRacedRound={ins.lastRacedRound}
        prices={sq.prices}
      />

      {locked ? (
        (sq.chipPiloti || prev.chipAttivo) && (
          <section className="mb-5">
            <h3 className="section-marker mb-2">Aggiornamenti usati</h3>
            <div className="flex flex-wrap gap-2">
              {sq.chipPiloti && <span className="pill">{chipLabel(sq.chipPiloti)}{sq.chipPiloti === "boost" && sq.chipPilotiTarget ? ` · #${sq.chipPilotiTarget}` : ""}</span>}
              {prev.chipAttivo && <span className="pill">{chipLabel(prev.chipAttivo)}{prev.chipTarget ? ` · ${previsioneLabel(prev.chipTarget)}` : ""}</span>}
            </div>
          </section>
        )
      ) : (
        <AggiornamentiSection
          round={round}
          locked={locked}
          chipPiloti={sq.chipPiloti}
          chipPilotiTarget={sq.chipPilotiTarget}
          sestoUomo={sq.sestoUomo}
          chipPilotiUnavailable={sq.chipPilotiUnavailable}
          pilotiUsage={agg.pilotiChips}
          chipPrevisioni={prev.chipAttivo}
          chipPrevisioniTarget={prev.chipTarget}
          chipPrevisioniUnavailable={prev.chipPrevisioniUnavailable}
          previsioniUsage={agg.previsioniChips}
          driverNumbers={sq.driverNumbers}
          primoPilota={sq.primoPilota}
          insights={ins.insights}
          prices={sq.prices}
          onChipPiloti={(id) => sq.setChipPiloti(id)}
          onChipPilotiTarget={(n) => sq.setChipPilotiTarget(n)}
          onSestoUomo={(n) => sq.setSestoUomo(n)}
          onChipPrevisioni={(id) => prev.setChipAttivo(id)}
          onChipPrevisioniTarget={(k) => prev.setChipTarget(k)}
        />
      )}

      <PrevisioniSection
        previsioni={prev.previsioni}
        locked={locked}
        stats={ins.eventStats}
        results={wr.results}
        doppiaTarget={prev.chipAttivo === "doppia" ? prev.chipTarget : null}
        previsioniDettaglio={myCalc && wr.raceArchived ? myCalc.previsioniDettaglio : null}
        onSet={(k, v) => prev.setPrevisione(k, v)}
        onSetDnf={(n) => prev.setNumeroDnf(n)}
      />

      {showConfermaBar && (
        <ConfermaBar
          missing={missing}
          modified={hadConfirmed}
          confirming={confirming}
          penaltyLine={penaltyLine}
          onConfirm={handleConferma}
        />
      )}
      {!!user && locked && !bothConfirmed && !wr.anyArchived && (
        <div className="text-[12px] text-white/50 text-center mb-4">Formazione chiusa: quello che vedi è ciò che gioca questo weekend.</div>
      )}
    </div>
  );
}

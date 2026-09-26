"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import CountryFlag from "../CountryFlag";
import { getRaceByRound } from "../../lib/races";
import { useRoundStandings } from "../../lib/use-my-round-score";
import { useWeekendResults } from "../../lib/use-weekend-results";

/**
 * Card compatta del weekend appena concluso: il tuo numero, la posizione
 * nella lega, i punti Reale, link al recap completo. Resta in Home finché
 * non chiude la formazione del round successivo.
 */
export function RecapMini({ round, legaId, userId }: { round: number; legaId: string | null; userId?: string }) {
  const race = getRaceByRound(round);
  const wr = useWeekendResults(round);
  const st = useRoundStandings(round, legaId, userId);
  if (!race) return null;
  if (!wr.loaded || !st.loaded) return <div className="skeleton h-24 mb-4" />;
  if (!wr.anyArchived) return null;

  const mine = st.mine;
  const leader = st.standings[0];
  return (
    <Link href={`/risultati?round=${round}`} className="block hud-card hud-card-accent mb-4 tap">
      <div className="hud-card-head">
        <div className="hud-label">IL TUO WEEKEND A {race.circuit.toUpperCase()}</div>
        <div className="hud-meta">{wr.raceArchived ? "UFFICIALE" : "PARZIALE"}</div>
      </div>
      <div className="p-4 flex items-center gap-4">
        <CountryFlag countryCode={race.countryCode} size={26} />
        <div className="flex-1 min-w-0">
          {mine ? (
            <>
              <div className="flex items-baseline gap-3">
                <span className="font-[family-name:var(--font-jetbrains)] text-[30px] font-extrabold tabular-nums leading-none">{mine.total > 0 ? "+" : ""}{mine.total}</span>
                <span className="font-[family-name:var(--font-jetbrains)] text-[13px] text-white/70">{mine.position}° su {st.players}</span>
              </div>
              <div className="text-[12px] text-white/55 mt-1 truncate">
                {mine.position === 1 ? "Hai vinto il weekend" : leader ? `Il weekend l'ha vinto chi ha fatto ${leader.total}` : ""}{wr.raceArchived ? ` · ${mine.real} pt Reale` : ""}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-white/60">Non hai giocato questo weekend</div>
          )}
        </div>
        <ChevronRight size={16} className="text-white/45 shrink-0" />
      </div>
    </Link>
  );
}

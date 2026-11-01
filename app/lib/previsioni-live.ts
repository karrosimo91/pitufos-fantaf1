// Stato "vivo" di una previsione durante la gara. Il punteggio live conta
// già ogni previsione con la situazione di adesso (SC non ancora uscita = NO
// giusto, pole non in testa = "pole vince NO" giusto), quindi la card deve
// dire la stessa cosa del totale:
//   • "ora": giusta adesso, i punti sono già nel totale ma si possono perdere
//     (NO finché l'evento non succede, pole in testa o no, ritiri pari);
//   • "pending": adesso vale 0, può ancora diventare giusta (SÌ non ancora
//     successo, ritiri sotto il numero detto);
//   • "presa" / "sbagliata": decisa, non cambia più.
// Prima i NO restavano "in attesa" fino alla bandiera a scacchi pur essendo
// già contati nel totale.

import { PREVISIONI_PUNTI, type Previsioni } from "./types";

export type PrevisioneLiveState = "pending" | "ora" | "presa" | "sbagliata" | "none";

export interface PrevisioneVivaInput {
  key: keyof Previsioni;
  prediction: boolean | number | null;
  /** Per SÌ/NO: l'evento è già successo (pole vince: chi parte primo è ora in testa). Per numeroDnf: i ritiri finora. */
  happened: boolean | number;
  ended: boolean;
  /** Punti presi se giusta (dal calcolo, chip Doppia incluso) */
  points: number;
  /** Solo "poleVince": nome di chi parte in pole e se ora è primo */
  poleName?: string | null;
  poleLeading?: boolean | null;
}

export interface PrevisioneViva {
  state: PrevisioneLiveState;
  /** Frase sotto la previsione: "+6 per ora", "presa +4", "sbagliata" */
  payoff: string;
}

/** Per il contatore "N / 6 DECISE": non cambia più fino a fine gara (o non c'è). */
export function contaComeDecisa(state: PrevisioneLiveState): boolean {
  return state === "presa" || state === "sbagliata" || state === "none";
}

const PUNTI: Record<Exclude<keyof Previsioni, "numeroDnf">, { si: number; no: number }> = {
  safetyCar: PREVISIONI_PUNTI.safetyCar,
  virtualSafetyCar: PREVISIONI_PUNTI.virtualSafetyCar,
  redFlag: PREVISIONI_PUNTI.redFlag,
  gommeWet: PREVISIONI_PUNTI.gommeWet,
  poleVince: PREVISIONI_PUNTI.poleVince,
};

const EVENTO: Record<Exclude<keyof Previsioni, "numeroDnf" | "poleVince">, string> = {
  safetyCar: "esce la SC",
  virtualSafetyCar: "esce la VSC",
  redFlag: "c'è una rossa",
  gommeWet: "si montano gomme da bagnato",
};

export function previsioneViva(i: PrevisioneVivaInput): PrevisioneViva {
  if (i.prediction === null || i.prediction === undefined) return { state: "none", payoff: "Nessuna previsione" };

  if (i.key === "numeroDnf") {
    const said = i.prediction as number;
    const now = Number(i.happened);
    if (i.ended) {
      return now === said
        ? { state: "presa", payoff: `Presa: ${now} ritiri · +${i.points}` }
        : { state: "sbagliata", payoff: `Sono stati ${now} · avevi detto ${said}` };
    }
    if (now > said) return { state: "sbagliata", payoff: `Già ${now} ritiri · avevi detto ${said}` };
    if (now === said) return { state: "ora", payoff: `${now} ritiri come hai detto · +${i.points} per ora` };
    return { state: "pending", payoff: `Finora ${now} ritiri · hai detto ${said}` };
  }

  const said = i.prediction as boolean;
  const happened = Boolean(i.happened);
  const pts = PUNTI[i.key as Exclude<keyof Previsioni, "numeroDnf">];

  if (i.key === "poleVince") {
    const who = i.poleName ? ` · ${i.poleName}` : "";
    if (i.ended) {
      return said === happened
        ? { state: "presa", payoff: `Presa · +${i.points}` }
        : { state: "sbagliata", payoff: said ? `La pole non ha vinto${who}` : `La pole ha vinto${who}` };
    }
    // `happened` live = chi parte primo è ora in testa (stesso dato del totale)
    if (said === happened) {
      return {
        state: "ora",
        payoff: said ? `+${i.points} per ora: la pole è in testa${who}` : `+${i.points} per ora: la pole non è in testa${who}`,
      };
    }
    return {
      state: "pending",
      payoff: said ? `+${pts.si} se la pole torna in testa${who}` : `+${pts.no} se la pole perde la testa${who}`,
    };
  }

  const evento = EVENTO[i.key as keyof typeof EVENTO];
  if (said) {
    if (happened) return { state: "presa", payoff: `Presa · +${i.points}` };
    if (i.ended) return { state: "sbagliata", payoff: "Non è successo" };
    return { state: "pending", payoff: `+${pts.si} se ${evento}` };
  }
  if (happened) return { state: "sbagliata", payoff: "È successo" };
  if (i.ended) return { state: "presa", payoff: `Presa · +${i.points}` };
  return { state: "ora", payoff: `+${i.points} per ora · persa se ${evento}` };
}

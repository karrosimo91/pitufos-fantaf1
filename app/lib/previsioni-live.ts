// Stato "vivo" di una previsione durante la gara: in attesa, presa,
// sbagliata. Una previsione SÌ resta in attesa finché l'evento non succede
// (o la gara finisce: allora è sbagliata); una NO resta in attesa finché la
// gara non finisce senza l'evento (se succede è sbagliata subito).
// Prima l'app segnava "✗ 0 pt" dal primo giro a chi aveva detto SÌ.

import { PREVISIONI_PUNTI, type Previsioni } from "./types";

export type PrevisioneLiveState = "pending" | "presa" | "sbagliata" | "none";

export interface PrevisioneVivaInput {
  key: keyof Previsioni;
  prediction: boolean | number | null;
  /** Per SÌ/NO: l'evento è già successo. Per numeroDnf: i ritiri finora. */
  happened: boolean | number;
  ended: boolean;
  /** Punti presi se decisa (dal calcolo, chip Doppia incluso) */
  points: number;
  /** Solo "poleVince": nome di chi parte in pole e se ora è primo */
  poleName?: string | null;
  poleLeading?: boolean | null;
}

export interface PrevisioneViva {
  state: PrevisioneLiveState;
  /** Frase sotto la previsione: "+6 se resta così", "presa +4", "sbagliata" */
  payoff: string;
}

const PUNTI: Record<Exclude<keyof Previsioni, "numeroDnf">, { si: number; no: number }> = {
  safetyCar: PREVISIONI_PUNTI.safetyCar,
  virtualSafetyCar: PREVISIONI_PUNTI.virtualSafetyCar,
  redFlag: PREVISIONI_PUNTI.redFlag,
  gommeWet: PREVISIONI_PUNTI.gommeWet,
  poleVince: PREVISIONI_PUNTI.poleVince,
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
    const lead = i.poleLeading == null ? "" : i.poleLeading ? " · ora in testa" : " · ora non in testa";
    return { state: "pending", payoff: said ? `+${pts.si} se vince chi parte primo${who}${lead}` : `+${pts.no} se non vince chi parte primo${who}${lead}` };
  }

  if (said) {
    if (happened) return { state: "presa", payoff: `Presa · +${i.points}` };
    if (i.ended) return { state: "sbagliata", payoff: "Non è successo" };
    return { state: "pending", payoff: `+${pts.si} se succede` };
  }
  if (happened) return { state: "sbagliata", payoff: "È successo" };
  if (i.ended) return { state: "presa", payoff: `Presa · +${i.points}` };
  return { state: "pending", payoff: `+${pts.no} se resta così` };
}

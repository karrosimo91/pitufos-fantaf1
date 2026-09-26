import { PREVISIONI_PUNTI } from "../../lib/types";
import type { PrevisioneKey } from "../../lib/season-insights";

export interface PrevisioneConfig {
  key: PrevisioneKey;
  label: string;
  desc: string;
  si: number;
  no: number;
}

export const PREVISIONI_CONFIG: PrevisioneConfig[] = [
  { key: "safetyCar", label: "Safety Car", desc: "Almeno una Safety Car in gara?", si: PREVISIONI_PUNTI.safetyCar.si, no: PREVISIONI_PUNTI.safetyCar.no },
  { key: "virtualSafetyCar", label: "Virtual Safety Car", desc: "Almeno una VSC in gara?", si: PREVISIONI_PUNTI.virtualSafetyCar.si, no: PREVISIONI_PUNTI.virtualSafetyCar.no },
  { key: "redFlag", label: "Bandiera rossa", desc: "Almeno una bandiera rossa in gara?", si: PREVISIONI_PUNTI.redFlag.si, no: PREVISIONI_PUNTI.redFlag.no },
  { key: "gommeWet", label: "Gomme da bagnato", desc: "Qualcuno monta intermedie o full wet in gara?", si: PREVISIONI_PUNTI.gommeWet.si, no: PREVISIONI_PUNTI.gommeWet.no },
  { key: "poleVince", label: "Pole vince la gara", desc: "Chi parte 1° in griglia vince la gara?", si: PREVISIONI_PUNTI.poleVince.si, no: PREVISIONI_PUNTI.poleVince.no },
];

/** Etichette per tutte le sei previsioni (chip Doppia, dettagli, recap). */
export const PREVISIONI_LABELS: { key: string; label: string }[] = [
  ...PREVISIONI_CONFIG.map((p) => ({ key: p.key as string, label: p.label })),
  { key: "numeroDnf", label: "Numero ritiri esatto" },
];

export function previsioneLabel(key: string): string {
  return PREVISIONI_LABELS.find((p) => p.key === key)?.label ?? key;
}

export const DNF_MAX = 10;

// ─── App Version ───
export const APP_VERSION = "v0.97";

// ─── Driver ───
export interface Driver {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  headshot_url: string | null;
  country_code: string;
}

// ─── Scuderia (team del giocatore) ───
export interface Scuderia {
  name: string;
  teamPrincipal: string;
  budget: number;
  drivers: ScuderiaDriver[];
  primoPilota: number | null; // driver_number
}

export interface ScuderiaDriver {
  driver_number: number;
  name: string;
  team: string;
  price: number;
  teamColour: string;
}

// ─── Previsioni ───
export interface Previsioni {
  safetyCar: boolean | null;
  virtualSafetyCar: boolean | null;
  redFlag: boolean | null;
  gommeWet: boolean | null;
  poleVince: boolean | null;
  numeroDnf: number | null;
}

// ─── Race ───
export interface Race {
  round: number;
  name: string;
  circuit: string;
  flag: string;
  date: string;
  sprint: boolean;
}

// ─── Classifica ───
export interface ClassificaEntry {
  position: number;
  teamPrincipal: string;
  scuderiaName: string;
  totalPoints: number;
  weekendPoints: number;
}

// ─── Leghe ───
export interface Lega {
  id: string;
  name: string;
  creator_id: string | null;
  round_start: number;
  round_end: number;
  is_public: boolean;
  invite_code: string | null;
  is_generale: boolean;
  created_at: string;
  member_count?: number;
}

// ─── Punteggi ───
export const PUNTI_QUALIFICA = {
  1: 8, 2: 6, 3: 5, 4: 4, 5: 4,
  6: 3, 7: 3, 8: 3, 9: 3, 10: 3,
  11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1,
  17: -1, 18: -1, 19: -1, 20: -1, 21: -1, 22: -1,
} as Record<number, number>;

export const PUNTI_SPRINT_SHOOTOUT = {
  1: 4, 2: 3, 3: 2,
  4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
  11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0,
  17: -1, 18: -1, 19: -1, 20: -1, 21: -1, 22: -1,
} as Record<number, number>;

export const PUNTI_SPRINT = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
} as Record<number, number>;

export const PUNTI_GARA = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
} as Record<number, number>;

export const PREVISIONI_PUNTI = {
  safetyCar: { si: 4, no: 6 },
  virtualSafetyCar: { si: 5, no: 5 },
  redFlag: { si: 7, no: 3 },
  gommeWet: { si: 8, no: 2 },
  poleVince: { si: 3, no: 7 },
  numeroDnf: { esatto: 8 },
};

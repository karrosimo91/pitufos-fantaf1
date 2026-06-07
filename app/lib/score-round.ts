// Calcolo punteggi giocatori per un round — fonte unica condivisa tra
// /api/post-gara e /api/recalc-penalties (evita la logica duplicata).

import {
  calcolaPuntiWeekend,
  type RaceWeekendResults,
  type ChipPilotiConfig,
  type ChipPrevisioniConfig,
} from "./scoring";
import type { Previsioni } from "./types";

export interface PlayerScore {
  user_id: string;
  name: string;
  scuderia: string;
  weekend_points: number;
  piloti_points: number;
  previsioni_points: number;
  penalita_cambi: number;
}

const EMPTY_PREVISIONI: Previsioni = {
  safetyCar: null,
  virtualSafetyCar: null,
  redFlag: null,
  gommeWet: null,
  poleVince: null,
  numeroDnf: null,
};

/**
 * Calcola il punteggio weekend di tutti i giocatori con formazione confermata.
 * Le previsioni e la penalità cambi vengono considerate solo se `isPostRace`.
 * Restituisce la lista ordinata per punteggio weekend (desc).
 */
export async function computePlayerScores(
  supabase: any,
  round: number,
  weekendResults: RaceWeekendResults,
  isPostRace: boolean,
): Promise<PlayerScore[]> {
  const { data: formazioni } = await supabase
    .from("formazioni")
    .select("*")
    .eq("round", round)
    .eq("confirmed", true);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, team_principal_name, scuderia_name");

  let previsioniData: any[] | null = null;
  if (isPostRace) {
    const { data } = await supabase
      .from("previsioni")
      .select("*")
      .eq("round", round)
      .eq("confirmed", true);
    previsioniData = data;
  }

  const playerScores: PlayerScore[] = [];

  for (const formazione of formazioni || []) {
    const driverNumbers: number[] = (formazione.driver_numbers || []).map(Number);
    if (driverNumbers.length === 0) continue;

    const chipPiloti: ChipPilotiConfig = {
      chipPiloti: formazione.chip_piloti,
      chipPilotiTarget: formazione.chip_piloti_target,
      sestoUomo: formazione.sesto_uomo,
    };

    let previsioni: Previsioni = { ...EMPTY_PREVISIONI };
    let chipPrevisioni: ChipPrevisioniConfig = { chipAttivo: null, chipTarget: null };

    if (isPostRace) {
      const prev = previsioniData?.find((p: any) => p.user_id === formazione.user_id);
      if (prev) {
        previsioni = {
          safetyCar: prev.safety_car,
          virtualSafetyCar: prev.virtual_safety_car,
          redFlag: prev.red_flag,
          gommeWet: prev.gomme_wet,
          poleVince: prev.pole_vince,
          numeroDnf: prev.numero_dnf,
        };
        chipPrevisioni = {
          chipAttivo: prev.chip_attivo || null,
          chipTarget: prev.chip_target || null,
        };
      }
    }

    const calc = calcolaPuntiWeekend(
      driverNumbers,
      formazione.primo_pilota,
      previsioni,
      weekendResults,
      chipPiloti,
      chipPrevisioni,
    );
    const profile = profiles?.find((p: any) => p.id === formazione.user_id);

    // Penalità cambi: solo post-race, e mai con chip wildcard
    let penalitaCambi = 0;
    if (isPostRace && formazione.chip_piloti !== "wildcard") {
      const { data: cambiData } = await supabase
        .from("mercato_cambi")
        .select("id")
        .eq("user_id", formazione.user_id)
        .eq("round", round);
      const numCambi = (cambiData || []).length;
      penalitaCambi = Math.max(0, numCambi - 2) * 10;
    }

    playerScores.push({
      user_id: formazione.user_id,
      name: profile?.team_principal_name || "—",
      scuderia: profile?.scuderia_name || "—",
      weekend_points: calc.total - penalitaCambi,
      piloti_points: calc.pilotiPoints,
      previsioni_points: calc.previsioniPoints,
      penalita_cambi: penalitaCambi,
    });
  }

  playerScores.sort((a, b) => b.weekend_points - a.weekend_points);
  return playerScores;
}

// ─── CDA: Questionario v2 — Proposte modifica punteggi ───

import type { CdaQuestion, CdaSection } from "./cda-questions";

export const CDA_QUESTIONNAIRE_V2_ID = "v2_modifica_punteggi";
export const CDA_QUESTIONNAIRE_V2_LABEL = "Modifica Punteggi — Proposta v2";

export const CDA_SECTIONS_V2: CdaSection[] = [
  {
    id: "v2_qualifiche",
    title: "Qualifiche GP — Modifiche proposte",
    questions: [
      {
        id: "v2_quali_p3_da5_a4",
        label: "P3: passare da +5 a +4 punti",
        detail: "Attualmente P3 vale +5, si propone di ridurlo a +4",
      },
      {
        id: "v2_quali_p4p5_da4_a3",
        label: "P4-P5: passare da +4 a +3 punti",
        detail: "Attualmente P4-P5 vale +4, si propone di ridurlo a +3",
      },
      {
        id: "v2_quali_p6p10_da3_a2",
        label: "P6-P10 (resto Q3): passare da +3 a +2 punti",
        detail: "Attualmente P6-P10 vale +3, si propone di ridurlo a +2",
      },
      {
        id: "v2_quali_q1_da-1_a-2",
        label: "Q1 (P17-P22): passare da -1 a -2 punti",
        detail: "Attualmente Q1 vale -1, si propone di portarlo a -2",
      },
    ],
  },
  {
    id: "v2_sprint",
    title: "Sprint Race — Modifiche proposte",
    questions: [
      {
        id: "v2_sprint_p2_da7_a5",
        label: "P2: passare da +7 a +5 punti",
        detail: "Attualmente P2 sprint vale +7, si propone di ridurlo a +5",
      },
      {
        id: "v2_sprint_p3_da6_a4",
        label: "P3: passare da +6 a +4 punti",
        detail: "Attualmente P3 sprint vale +6, si propone di ridurlo a +4",
      },
      {
        id: "v2_sprint_p4_da5_a3",
        label: "P4: passare da +5 a +3 punti",
        detail: "Attualmente P4 sprint vale +5, si propone di ridurlo a +3",
      },
      {
        id: "v2_sprint_p5_da4_a2",
        label: "P5: passare da +4 a +2 punti",
        detail: "Attualmente P5 sprint vale +4, si propone di ridurlo a +2",
      },
      {
        id: "v2_sprint_p6p8_0",
        label: "P6-P8: dare 0 punti",
        detail: "Attualmente P6: +3, P7: +2, P8: +1 — si propone 0 per tutti",
      },
    ],
  },
  {
    id: "v2_gara",
    title: "Gara — Modifiche proposte",
    questions: [
      {
        id: "v2_gara_pos_guad_da1_a2",
        label: "Posizioni guadagnate vs griglia: da +1 a +2 per posizione",
        detail: "Attualmente +1 per posizione guadagnata, si propone +2",
      },
      {
        id: "v2_gara_pos_perse_da-0.5_a-1",
        label: "Posizioni perse vs griglia: da -0.5 a -1 per posizione",
        detail: "Attualmente -0.5 per posizione persa, si propone -1",
      },
    ],
  },
  {
    id: "v2_previsioni",
    title: "Previsioni — Modifiche proposte",
    questions: [
      {
        id: "v2_prev_pole_si_da3_a4",
        label: "Pole vince la gara SI: da +3 a +4 punti",
        detail: "Attualmente SI vale +3, si propone +4",
      },
      {
        id: "v2_prev_pole_no_da7_a6",
        label: "Pole vince la gara NO: da +7 a +6 punti",
        detail: "Attualmente NO vale +7, si propone +6",
      },
      {
        id: "v2_prev_dnf_da8_a5",
        label: "Numero DNF esatto: da +8 a +5 punti",
        detail: "Attualmente indovinare il numero DNF vale +8, si propone +5",
      },
    ],
  },
];

export const ALL_QUESTIONS_V2 = CDA_SECTIONS_V2.flatMap((s) => s.questions);
export const TOTAL_QUESTIONS_V2 = ALL_QUESTIONS_V2.length;

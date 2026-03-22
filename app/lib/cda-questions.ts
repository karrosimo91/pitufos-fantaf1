// ─── CDA: Domande per votazione regolamento ───

export const CDA_LEAGUE_NAME = "🏎️🏆 Los Pitufos F1 Championship 🏆🏎️";
export const CDA_LEAGUE_ID = "566abb62-600d-4189-9eab-267fa98d140c";

export interface CdaQuestion {
  id: string;
  label: string;
  detail?: string;
}

export interface CdaSection {
  id: string;
  title: string;
  questions: CdaQuestion[];
}

export const CDA_SECTIONS: CdaSection[] = [
  {
    id: "struttura",
    title: "Struttura del gioco",
    questions: [
      { id: "struttura_budget_100", label: "Budget: 100 Soldini" },
      { id: "struttura_5_piloti", label: "5 piloti per scuderia" },
      { id: "struttura_quotazioni_variabili", label: "Quotazioni variano dopo ogni GP" },
      { id: "struttura_cambi_gratis_2", label: "2 cambi gratuiti per weekend" },
      { id: "struttura_cambio_extra_-10", label: "Dal 3° cambio: -10 punti weekend ciascuno" },
      { id: "struttura_24gp_6sprint", label: "Stagione: 24 GP, 6 weekend sprint, 22 piloti, 11 scuderie" },
    ],
  },
  {
    id: "capitano",
    title: "Primo Pilota (Capitano)",
    questions: [
      { id: "capitano_scelta_obbligatoria", label: "Scelta obbligatoria ogni weekend" },
      { id: "capitano_x2", label: "Punteggio x2 (bonus e malus)" },
      { id: "capitano_dnf_-30", label: "Se Primo Pilota fa DNF (-15), malus raddoppiato = -30" },
    ],
  },
  {
    id: "qualifica",
    title: "Punteggi Qualifica GP",
    questions: [
      { id: "quali_pole_+8", label: "Pole (P1): +8" },
      { id: "quali_p2_+6", label: "P2: +6" },
      { id: "quali_p3_+5", label: "P3: +5" },
      { id: "quali_p4p5_+4", label: "P4-P5: +4" },
      { id: "quali_q3_+3", label: "P6-P10 (resto Q3): +3" },
      { id: "quali_q2_+1", label: "P11-P16 (Q2): +1" },
      { id: "quali_q1_-1", label: "P17-P22 (Q1): -1" },
      { id: "quali_nc_-5", label: "NC/DSQ/No tempo: -5" },
      { id: "quali_penalita_griglia_0", label: "Penalità in griglia: 0 punti" },
    ],
  },
  {
    id: "sprint_shootout",
    title: "Punteggi Sprint Shootout",
    questions: [
      { id: "ss_pole_+4", label: "Pole sprint: +4" },
      { id: "ss_p2_+3", label: "P2: +3" },
      { id: "ss_p3_+2", label: "P3: +2" },
      { id: "ss_sq3_+1", label: "P4-P10 (SQ3): +1" },
      { id: "ss_sq2_0", label: "P11-P16 (SQ2): 0" },
      { id: "ss_sq1_-1", label: "P17-P22 (SQ1): -1" },
      { id: "ss_nc_-3", label: "NC: -3" },
    ],
  },
  {
    id: "sprint_race",
    title: "Punteggi Sprint Race",
    questions: [
      { id: "sprint_p1_+8", label: "P1: +8" },
      { id: "sprint_p2_+7", label: "P2: +7" },
      { id: "sprint_p3_+6", label: "P3: +6" },
      { id: "sprint_p4_+5", label: "P4: +5" },
      { id: "sprint_p5_+4", label: "P5: +4" },
      { id: "sprint_p6_+3", label: "P6: +3" },
      { id: "sprint_p7_+2", label: "P7: +2" },
      { id: "sprint_p8_+1", label: "P8: +1" },
      { id: "sprint_p9p22_0", label: "P9-P22: 0" },
      { id: "sprint_giro_veloce_+2", label: "Giro veloce sprint: +2" },
      { id: "sprint_dnf_-10", label: "DNF sprint: -10" },
      { id: "sprint_no_pos", label: "NO posizioni guadagnate/perse in sprint" },
    ],
  },
  {
    id: "gara",
    title: "Punteggi Gara (Gran Premio)",
    questions: [
      { id: "gara_p1_+25", label: "P1: +25" },
      { id: "gara_p2_+18", label: "P2: +18" },
      { id: "gara_p3_+15", label: "P3: +15" },
      { id: "gara_p4_+12", label: "P4: +12" },
      { id: "gara_p5_+10", label: "P5: +10" },
      { id: "gara_p6_+8", label: "P6: +8" },
      { id: "gara_p7_+6", label: "P7: +6" },
      { id: "gara_p8_+4", label: "P8: +4" },
      { id: "gara_p9_+2", label: "P9: +2" },
      { id: "gara_p10_+1", label: "P10: +1" },
      { id: "gara_p11p22_0", label: "P11-P22: 0" },
      { id: "gara_pos_guad_+1", label: "Posizione guadagnata vs griglia: +1 per posizione" },
      { id: "gara_pos_perse_-0.5", label: "Posizione persa vs griglia: -0.5 per posizione" },
      { id: "gara_giro_veloce_+3", label: "Giro veloce: +3" },
      { id: "gara_dotd_+5", label: "Driver of the Day: +5" },
      { id: "gara_dnf_-15", label: "DNF/Ritiro: -15" },
      { id: "gara_penalita_-5", label: "Penalità in gara/post gara: -5" },
    ],
  },
  {
    id: "previsioni",
    title: "Previsioni",
    questions: [
      { id: "prev_6_per_weekend", label: "6 previsioni per weekend" },
      { id: "prev_sc_si4_no6", label: "Safety Car: SI +4 / NO +6" },
      { id: "prev_vsc_si5_no5", label: "Virtual Safety Car: SI +5 / NO +5" },
      { id: "prev_red_flag_si7_no3", label: "Red Flag: SI +7 / NO +3" },
      { id: "prev_wet_si8_no2", label: "Gomme wet: SI +8 / NO +2" },
      { id: "prev_pole_vince_si3_no7", label: "Pole vince la gara: SI +3 / NO +7" },
      { id: "prev_dnf_esatto_+8", label: "Numero DNF esatto: +8" },
      { id: "prev_sbagliata_0", label: "Previsione sbagliata: 0 punti" },
    ],
  },
  {
    id: "chip",
    title: "Aggiornamenti (Chip)",
    questions: [
      { id: "chip_2_usi", label: "Ogni chip: 2 utilizzi (1 pre-pausa estiva, 1 post-pausa)" },
      { id: "chip_max_1_pil_1_prev", label: "Max 1 chip piloti + 1 chip previsioni per weekend" },
      { id: "chip_boost_x3", label: "Boost Mode: un pilota diverso dal Capitano fa x3 per tutto il weekend" },
      { id: "chip_halo", label: "Halo: se un tuo pilota va in negativo, il minimo è 0 punti" },
      { id: "chip_sesto_uomo", label: "Sesto Uomo: aggiungi un 6° pilota temporaneo per un weekend" },
      { id: "chip_wildcard", label: "Wildcard: cambi illimitati senza penalità per quel round" },
      { id: "chip_prev_sicura", label: "Previsione Sicura: 1 previsione dà punti comunque" },
      { id: "chip_prev_doppia", label: "Previsione Doppia: punti x2 su 1 previsione" },
    ],
  },
  {
    id: "proposte_aperte",
    title: "Proposte aperte (da approvare)",
    questions: [
      { id: "proposta_scudo_capitano", label: "Scudo Capitano: nuovo chip piloti — Primo Pilota x2 solo sui bonus, malus restano x1", detail: "Sarebbe un Aggiornamento Piloti aggiuntivo, stesse regole degli altri chip (2 usi stagionali)" },
      { id: "proposta_quotazioni_fasce", label: "Variazione quotazioni post-GP a fasce: ≥40pt → +3, 25-39 → +2, 10-24 → +1, 0-9 → 0, -1/-10 → -1, ≤-11 → -2", detail: "Quotazione minima 5, massima 45. Si applica dopo ogni GP." },
    ],
  },
  {
    id: "live",
    title: "Live",
    questions: [
      { id: "live_abbonamento_10", label: "Investiamo 10€ al mese per avere risultati live", detail: "Abbonamento OpenF1 per dati in tempo reale durante le gare (WebSocket)" },
    ],
  },
  {
    id: "deadline",
    title: "Deadline",
    questions: [
      { id: "deadline_normali_sabato", label: "Weekend normali: prima delle qualifiche (sabato)" },
      { id: "deadline_sprint_venerdi", label: "Weekend sprint: prima della Sprint Shootout (venerdì)" },
      { id: "deadline_blocco_tutto", label: "Si blocca tutto insieme: formazione, Primo Pilota, chip, previsioni" },
    ],
  },
];

export const ALL_QUESTIONS = CDA_SECTIONS.flatMap((s) => s.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;

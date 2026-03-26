-- ═══════════════════════════════════════
-- Migration v13: CDA questionari multipli
-- Aggiunge questionnaire_id a cda_voti per supportare questionari versioned
-- Il vecchio questionario (v1) usa questionnaire_id = 'v1_regolamento'
-- Il nuovo questionario (v2) usa questionnaire_id = 'v2_modifica_punteggi'
-- ═══════════════════════════════════════

-- Aggiungi colonna questionnaire_id (default 'v1_regolamento' per i voti esistenti)
ALTER TABLE cda_voti
  ADD COLUMN IF NOT EXISTS questionnaire_id text NOT NULL DEFAULT 'v1_regolamento';

-- Aggiorna il constraint UNIQUE per includere questionnaire_id
-- Prima rimuovi il vecchio (se esiste)
ALTER TABLE cda_voti
  DROP CONSTRAINT IF EXISTS cda_voti_user_id_question_id_key;

-- Crea il nuovo constraint unico
ALTER TABLE cda_voti
  ADD CONSTRAINT cda_voti_user_question_questionnaire_key
  UNIQUE (user_id, question_id, questionnaire_id);

-- Indice per query veloci per questionario
CREATE INDEX IF NOT EXISTS idx_cda_voti_questionnaire
  ON cda_voti (questionnaire_id);

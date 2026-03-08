-- ═══════════════════════════════════════════
-- Migration v10: Tabelle per calcolo punteggi
-- ═══════════════════════════════════════════

-- Risultati weekend (inseriti dall'admin dopo ogni gara)
CREATE TABLE IF NOT EXISTS weekend_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  round int NOT NULL UNIQUE,
  data jsonb NOT NULL,  -- RaceWeekendResults JSON
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Punteggi calcolati per giocatore/round (storico dettagliato)
CREATE TABLE IF NOT EXISTS weekend_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  round int NOT NULL,
  total_points numeric NOT NULL DEFAULT 0,
  piloti_points numeric NOT NULL DEFAULT 0,
  previsioni_points numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, round)
);

-- Classifica totale (aggiornata dopo ogni calcolo)
CREATE TABLE IF NOT EXISTS classifica_totale (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  team_principal_name text NOT NULL DEFAULT '—',
  scuderia_name text NOT NULL DEFAULT '—',
  total_points numeric NOT NULL DEFAULT 0,
  last_weekend_points numeric NOT NULL DEFAULT 0,
  real_points numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- RLS: weekend_results leggibile da tutti, scrivibile solo da service_role
ALTER TABLE weekend_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "weekend_results_read" ON weekend_results FOR SELECT USING (true);

-- RLS: weekend_scores leggibile da tutti
ALTER TABLE weekend_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "weekend_scores_read" ON weekend_scores FOR SELECT USING (true);

-- RLS: classifica_totale leggibile da tutti
ALTER TABLE classifica_totale ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "classifica_totale_read" ON classifica_totale FOR SELECT USING (true);

-- ═══════════════════════════════════════════
-- Migrazione v0.9 — Nuova struttura formazioni
-- Esegui su Supabase SQL Editor
-- ═══════════════════════════════════════════

-- 1. Semplifica scuderia_drivers (solo roster attuale)
-- Prima salva i dati esistenti, poi ricrea la tabella

-- Crea tabella temporanea con i dati attuali
CREATE TEMP TABLE _sd_backup AS
SELECT DISTINCT user_id, driver_number FROM scuderia_drivers;

-- Ricrea scuderia_drivers semplificata
DROP TABLE IF EXISTS scuderia_drivers CASCADE;

CREATE TABLE scuderia_drivers (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  driver_number int NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, driver_number)
);

-- Ripristina dati
INSERT INTO scuderia_drivers (user_id, driver_number)
SELECT user_id, driver_number FROM _sd_backup
ON CONFLICT DO NOTHING;

DROP TABLE _sd_backup;

-- RLS
ALTER TABLE scuderia_drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own drivers" ON scuderia_drivers;
DROP POLICY IF EXISTS "Users can insert own drivers" ON scuderia_drivers;
DROP POLICY IF EXISTS "Users can update own drivers" ON scuderia_drivers;
DROP POLICY IF EXISTS "Users can delete own drivers" ON scuderia_drivers;

CREATE POLICY "Users can view own drivers" ON scuderia_drivers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own drivers" ON scuderia_drivers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own drivers" ON scuderia_drivers FOR DELETE USING (auth.uid() = user_id);

-- 2. Nuova tabella formazioni (per round)
CREATE TABLE IF NOT EXISTS formazioni (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  round int NOT NULL,
  driver_numbers int[] NOT NULL DEFAULT '{}',
  primo_pilota int,
  sesto_uomo int,
  chip_piloti text,
  chip_piloti_target int,
  confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, round)
);

ALTER TABLE formazioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own formazioni" ON formazioni FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own formazioni" ON formazioni FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own formazioni" ON formazioni FOR UPDATE USING (auth.uid() = user_id);

-- 3. Aggiungi chip_target a previsioni
ALTER TABLE previsioni ADD COLUMN IF NOT EXISTS chip_target text;

-- 4. scuderia_confirmed su profiles non serve più (ma lo lasciamo per retrocompatibilità)

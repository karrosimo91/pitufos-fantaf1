-- ═══════════════════════════════════════
-- Migration v12: Mercato cambi (trasferimenti)
-- 2 cambi gratis per round, dal 3° in poi -10 punti
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS mercato_cambi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  round int NOT NULL,
  driver_in int NOT NULL,
  driver_out int NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mercato_cambi ENABLE ROW LEVEL SECURITY;

-- Utenti vedono i propri cambi
CREATE POLICY "mercato_cambi_read" ON mercato_cambi FOR SELECT USING (auth.uid() = user_id);

-- Utenti inseriscono i propri cambi
CREATE POLICY "mercato_cambi_insert" ON mercato_cambi FOR INSERT WITH CHECK (auth.uid() = user_id);

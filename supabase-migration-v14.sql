-- ═══════════════════════════════════════
-- Migration v14: Punteggi provvisori weekend
-- Salva i punteggi live/provvisori su Supabase
-- Cancellati automaticamente quando admin calcola risultati ufficiali
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS provisional_weekend (
  round int PRIMARY KEY,
  session_name text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE provisional_weekend ENABLE ROW LEVEL SECURITY;

-- Tutti possono leggere
CREATE POLICY "provisional_read" ON provisional_weekend FOR SELECT USING (true);

-- Utenti autenticati possono inserire/aggiornare
CREATE POLICY "provisional_upsert" ON provisional_weekend FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "provisional_update" ON provisional_weekend FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Utenti autenticati possono cancellare (admin post-gara)
CREATE POLICY "provisional_delete" ON provisional_weekend FOR DELETE USING (auth.uid() IS NOT NULL);

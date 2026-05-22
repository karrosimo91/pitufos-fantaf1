-- ═══════════════════════════════════════════════════════════════════════
-- Migration v16 — Tabella driver_prices per algoritmo quotazioni a fasce
-- ═══════════════════════════════════════════════════════════════════════
--
-- Implementa la persistenza delle quotazioni piloti round-by-round, base
-- per l'algoritmo a fasce approvato dal CDA (vedi scoring.ts:aggiornaQuotazione).
--
-- Schema:
--   driver_prices(driver_number, round, price)
--   round = 0 → quotazione iniziale (seed da DRIVERS_2026)
--   round = N → quotazione applicata DURANTE il round N (cioè dopo che
--               il round N-1 è stato calcolato)
--
-- Lettura tipica nel mercato/scoring:
--   SELECT price FROM driver_prices
--   WHERE driver_number = $1 AND round <= $2
--   ORDER BY round DESC LIMIT 1
--
-- Eseguire una volta su Supabase SQL Editor.
-- Sicura da rieseguire (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- 1. TABELLA driver_prices
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_prices (
  driver_number int NOT NULL,
  round int NOT NULL,
  price int NOT NULL CHECK (price >= 5 AND price <= 45),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (driver_number, round)
);

CREATE INDEX IF NOT EXISTS idx_driver_prices_round
  ON driver_prices (round DESC, driver_number);


-- ─────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────
-- I prezzi piloti sono dati pubblici (servono al mercato per tutti).
-- Read-all autenticato. Scritture solo via service_role (post-gara).

ALTER TABLE driver_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_prices_read" ON driver_prices;
CREATE POLICY "driver_prices_read"
  ON driver_prices FOR SELECT
  TO authenticated, anon
  USING (true);

-- Niente policy INSERT/UPDATE/DELETE → solo service_role può scrivere.


-- ─────────────────────────────────────────────────────────────────────
-- 3. SEED quotazioni iniziali round=0
-- ─────────────────────────────────────────────────────────────────────
-- Dati allineati a app/lib/drivers-data.ts (DRIVERS_2026).
-- ON CONFLICT DO NOTHING → idempotente.

INSERT INTO driver_prices (driver_number, round, price) VALUES
  (1, 0, 36),   -- Norris (McLaren)
  (3, 0, 36),   -- Verstappen (Red Bull)
  (81, 0, 33),  -- Piastri (McLaren)
  (63, 0, 34),  -- Russell (Mercedes)
  (16, 0, 30),  -- Leclerc (Ferrari)
  (44, 0, 28),  -- Hamilton (Ferrari)
  (12, 0, 27),  -- Antonelli (Mercedes)
  (6, 0, 17),   -- Hadjar (Red Bull)
  (10, 0, 14),  -- Gasly (Alpine)
  (55, 0, 14),  -- Sainz (Williams)
  (23, 0, 13),  -- Albon (Williams)
  (30, 0, 9),   -- Lawson (Racing Bulls)
  (14, 0, 12),  -- Alonso (Aston Martin)
  (87, 0, 12),  -- Bearman (Haas)
  (31, 0, 11),  -- Ocon (Haas)
  (27, 0, 9),   -- Hulkenberg (Audi)
  (18, 0, 10),  -- Stroll (Aston Martin)
  (41, 0, 10),  -- Lindblad (Racing Bulls)
  (5, 0, 9),    -- Bortoleto (Audi)
  (43, 0, 8),   -- Colapinto (Alpine)
  (11, 0, 8),   -- Perez (Cadillac)
  (77, 0, 7)    -- Bottas (Cadillac)
ON CONFLICT (driver_number, round) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- FINE v16
-- ═══════════════════════════════════════════════════════════════════════

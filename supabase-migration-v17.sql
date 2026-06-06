-- ═══════════════════════════════════════════════════════════════════════
-- Migration v17 — Cassa scuderia (saldo soldini) + prezzi nei cambi
-- ═══════════════════════════════════════════════════════════════════════
--
-- PROBLEMA RISOLTO
-- Prima il budget era ricalcolato a ogni render come:
--     budget = 100 − Σ(quotazioni ATTUALI dei piloti in rosa)
-- Con le quotazioni variabili, tenere la stessa rosa che si rivaluta
-- mangiava il budget fino a renderlo negativo (es. −6), e impediva di
-- ricomprare i propri stessi piloti dopo averli venduti.
--
-- NUOVO MODELLO ("prezzo d'acquisto bloccato" / cassa)
--   - La scuderia ha un saldo `cassa` memorizzato (i "soldini liberi").
--   - Comprare  → cassa −= quotazione ATTUALE del pilota
--   - Vendere   → cassa += quotazione ATTUALE del pilota
--   - Tenere la rosa → la cassa NON cambia quando le quotazioni si muovono.
--   La rivalutazione si "incassa" solo quando vendi.
--
-- INIZIALIZZAZIONE (rose già esistenti)
--   cassa = 100 − Σ(quotazioni INIZIALI dei piloti in rosa).
--   Finora i prezzi non erano ancora variati, quindi la quotazione iniziale
--   è esattamente quanto i giocatori hanno pagato. L'init avviene lato client
--   al primo caricamento di un round con cassa = NULL (vedi store.ts).
--
-- AUDIT
--   prezzo_in / prezzo_out su mercato_cambi registrano la quotazione al
--   momento del trade: rete di sicurezza per ricostruire/verificare la cassa.
--
-- Eseguire una volta su Supabase SQL Editor. Sicura da rieseguire.
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- 1. Saldo cassa sulla formazione (per round)
-- ─────────────────────────────────────────────────────────────────────
-- NULL = non ancora inizializzata → store.ts la calcola e la persiste.

ALTER TABLE formazioni
  ADD COLUMN IF NOT EXISTS cassa int;


-- ─────────────────────────────────────────────────────────────────────
-- 2. Prezzi al momento del cambio (audit / ricostruzione cassa)
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE mercato_cambi
  ADD COLUMN IF NOT EXISTS prezzo_in int;

ALTER TABLE mercato_cambi
  ADD COLUMN IF NOT EXISTS prezzo_out int;


-- ═══════════════════════════════════════════════════════════════════════
-- FINE v17
-- ═══════════════════════════════════════════════════════════════════════

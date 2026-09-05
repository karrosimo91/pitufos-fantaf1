-- ═══════════════════════════════════════════════════════════════════════
-- Patch manuale — round 15 (Monza 2026), Team Principal karrosimo91
-- Applicata in produzione il 2026-09-05. Registrata qui per audit.
-- ═══════════════════════════════════════════════════════════════════════
--
-- CONTESTO
-- Al passaggio round 14 → 15 la formazione di karrosimo91 è rimasta con
-- 4 piloti: Lawson (#30) è sparito dalla rosa e la cassa è passata da 24
-- a 36 (+12 = quotazione di Lawson al round 14). Nessuna riga in
-- `mercato_cambi` giustifica la cessione: è una rimozione di sistema, non
-- un cambio volontario. Nessun altro giocatore risulta colpito.
--
-- INTERVENTO
-- Reintegro del 5° pilota con Lewis Hamilton (#44) e azzeramento della
-- cassa, come richiesto dal proprietario della lega.
--
-- ⚠️ DEROGA AL REGOLAMENTO — la quotazione di Hamilton al round 15 è 38
-- Soldini, la cassa disponibile era 36: l'acquisto è fuori budget di 2
-- Soldini. La cassa è stata portata a 0 invece che a -2. È una deroga
-- decisa manualmente, non una regola: non va replicata senza passare dal
-- CDA.
--
-- NON è stata scritta una riga in `mercato_cambi`: da regolamento la
-- sostituzione di un pilota rimosso per cause non dipendenti dal giocatore
-- non consuma cambi (cfr. CLAUDE.md, "Casi particolari"). Di conseguenza
-- il round 15 resta a 0 cambi usati e senza penalità.
--
-- Stato prima:  driver_numbers = {12,16,27,5},    cassa = 36
-- Stato dopo:   driver_numbers = {12,16,27,5,44}, cassa = 0
-- primo_pilota resta NULL e confirmed resta false: la formazione va
-- confermata dall'utente in app entro la deadline.

UPDATE formazioni
SET driver_numbers = ARRAY[12, 16, 27, 5, 44],
    cassa          = 0,
    updated_at     = now()
WHERE user_id = '54fffda1-b651-4734-b892-d0b2254ab742'
  AND round   = 15;

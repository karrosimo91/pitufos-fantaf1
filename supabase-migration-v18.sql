-- ═══════════════════════════════════════════════════════════════════════
-- Migration v18 — Punti Classifica Reale per round (idempotenza ricalcoli)
-- ═══════════════════════════════════════════════════════════════════════
--
-- PROBLEMA RISOLTO
-- classifica_totale.real_points veniva SOMMATO a ogni calcolo della gara
-- (post-gara, ricalcola-round) e mai sottratto dal reset: ogni rilancio di
-- un round raddoppiava i 25-18-15. In produzione (13/09/2026) si era arrivati
-- a 637 punti con un massimo teorico di 325 su 13 round.
--
-- NUOVO MODELLO
--   - weekend_scores.real_points registra quanto ogni round ha dato a ogni
--     giocatore (25-18-15-12-10-8-6-4-2-1, 0 oltre il decimo).
--   - classifica_totale.real_points = somma di quei valori, aggiornata per
--     differenza da lib/score-round.ts (applicaPunteggiRound).
--   - Pari merito: piloti_points, poi previsioni_points, poi user_id
--     (stessa regola in lib/classifica-reale.ts; da confermare in CDA).
--
-- Eseguire una volta su Supabase SQL Editor. Sicura da rieseguire.
-- ═══════════════════════════════════════════════════════════════════════

alter table weekend_scores add column if not exists real_points numeric;

-- Backfill: ricostruisce i punti reale di ogni round con la regola attuale
with ranked as (
  select id,
         row_number() over (
           partition by round
           order by total_points desc, piloti_points desc, previsioni_points desc, user_id
         ) as pos
  from weekend_scores
)
update weekend_scores ws
set real_points = case r.pos
  when 1 then 25 when 2 then 18 when 3 then 15 when 4 then 12 when 5 then 10
  when 6 then 8  when 7 then 6  when 8 then 4  when 9 then 2  when 10 then 1
  else 0 end
from ranked r
where r.id = ws.id;

-- Riallinea la classifica generale alla somma per round
update classifica_totale ct
set real_points = coalesce((select sum(ws.real_points) from weekend_scores ws where ws.user_id = ct.user_id), 0),
    updated_at = now();

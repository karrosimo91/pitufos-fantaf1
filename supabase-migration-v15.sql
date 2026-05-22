-- ═══════════════════════════════════════════════════════════════════════
-- Migration v15 — Performance live scoring + RLS leak classifica_totale
-- ═══════════════════════════════════════════════════════════════════════
--
-- Questa migrazione chiude 3 buchi identificati nella code review:
--
--   1) Indici mancanti su previsioni / formazioni / weekend_results che
--      rallentano le query del live scoring (LiveTab + useLiveScoring).
--   2) RLS leak su classifica_totale: oggi la policy "classifica_totale_read"
--      è USING (true) → chiunque (anche non autenticato) vede team + punti
--      di TUTTI gli utenti, senza filtro per lega.
--   3) (Solo verifica, niente SQL) auth sui POST admin — vedere note in fondo.
--
-- Eseguire una volta su Supabase SQL Editor.
-- Sicura da rieseguire: usa CREATE INDEX IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- 1. INDICI per accelerare il live scoring
-- ─────────────────────────────────────────────────────────────────────
--
-- Durante un weekend live il client esegue per ogni utente / tick:
--   - select * from previsioni where round = ? and confirmed = true
--   - select * from previsioni where user_id = ? and round = ? and confirmed = true
--   - select * from formazioni where round = ? and confirmed = true
--   - select * from formazioni where user_id = ? and round = ? and confirmed = true
--   - select * from weekend_results where round = ?
--
-- Tutte queste query sono attualmente full-scan (a parte la UNIQUE su
-- (user_id, round) che però non filtra per `confirmed`).
-- Aggiungiamo indici parziali e composti appropriati.

-- Previsioni: scan per round (classifica live) e per singolo utente.
-- L'indice parziale su confirmed=true evita di indicizzare le bozze.
CREATE INDEX IF NOT EXISTS idx_previsioni_round_confirmed
  ON previsioni (round)
  WHERE confirmed = true;

CREATE INDEX IF NOT EXISTS idx_previsioni_user_round_confirmed
  ON previsioni (user_id, round)
  WHERE confirmed = true;

-- Formazioni: stesso pattern (lettura live per tutti gli utenti della lega).
CREATE INDEX IF NOT EXISTS idx_formazioni_round_confirmed
  ON formazioni (round)
  WHERE confirmed = true;

CREATE INDEX IF NOT EXISTS idx_formazioni_user_round_confirmed
  ON formazioni (user_id, round)
  WHERE confirmed = true;

-- weekend_results: c'è già una UNIQUE su round che crea un indice implicito,
-- ma lo dichiariamo esplicitamente per chiarezza e per coprire eventuali
-- ricreazioni future della tabella. IF NOT EXISTS = no-op se già presente.
CREATE INDEX IF NOT EXISTS idx_weekend_results_round
  ON weekend_results (round);

-- Bonus: lookups molto frequenti anche su weekend_scores e mercato_cambi
-- durante il calcolo live (penalità cambi). Costo zero, beneficio sicuro.
CREATE INDEX IF NOT EXISTS idx_weekend_scores_round
  ON weekend_scores (round);

CREATE INDEX IF NOT EXISTS idx_mercato_cambi_user_round
  ON mercato_cambi (user_id, round);


-- ─────────────────────────────────────────────────────────────────────
-- 2. FIX RLS LEAK su classifica_totale
-- ─────────────────────────────────────────────────────────────────────
--
-- STATO ATTUALE (v10):
--   ALTER TABLE classifica_totale ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "classifica_totale_read" FOR SELECT USING (true);
-- → chiunque (anche anon) può leggere TUTTE le righe: team_principal_name,
--   scuderia_name, total_points, last_weekend_points, real_points di ogni
--   utente della piattaforma. È un leak di privacy/dati: non c'è filtro per
--   lega e il rendering classifiche dovrebbe avvenire via `classifica_lega`
--   (RPC SECURITY DEFINER definita in v11).
--
-- SCELTA: NON converto la tabella in vista/funzione (è scritta in 4 route
-- admin e letta in /debug). Applico invece il principio del minimo
-- privilegio sulle RLS:
--   - L'utente autenticato può leggere SOLO la propria riga
--     (serve per useDashboardStats che mostra "i miei punti totali").
--   - I membri della stessa lega di un altro utente possono comunque
--     leggere le sue stats aggregate via la RPC `classifica_lega`
--     (che è SECURITY DEFINER e bypassa RLS in modo controllato).
--   - I client che vogliono la classifica globale DEVONO passare per
--     `classifica_lega(<Lega Generale>)`, già usata dal frontend.
--   - L'anon non legge più nulla.
--   - service_role (route admin) bypassa RLS by design → continua a scrivere.
--
-- Perché questa scelta e non una "RLS policy sulla vista":
--   - classifica_totale NON è una vista: è una tabella materializzata
--     aggiornata dalle route admin via service_role. Mettere RLS sulla
--     tabella è semplice, retrocompatibile e non richiede di toccare
--     il codice TS (le scritture passano da service_role, le letture
--     "globali" passano già da `classifica_lega`).
--   - Una funzione SECURITY DEFINER che filtra per lega esiste GIÀ:
--     `classifica_lega(p_lega_id, p_round)` introdotta in v11. È
--     l'approccio pulito per le classifiche cross-utente. Qui si
--     completa il lavoro chiudendo l'accesso diretto alla tabella.

-- Rimuovi la policy permissiva attuale.
DROP POLICY IF EXISTS "classifica_totale_read" ON classifica_totale;

-- Nuova policy: l'utente vede solo la propria riga.
CREATE POLICY "classifica_totale_read_self"
  ON classifica_totale
  FOR SELECT
  USING (auth.uid() = user_id);

-- Nota: non aggiungiamo policy INSERT/UPDATE/DELETE.
-- Le scritture avvengono solo dalle route admin (server-side) tramite la
-- service_role key che bypassa RLS by design. Lasciando senza policy di
-- scrittura, nessun client autenticato/anon può alterare la classifica.

-- (Facoltativo) Hardening della RPC classifica_lega: forzare il chiamante
-- a essere membro della lega che richiede. Lo lascio come TODO esplicito:
-- la firma attuale è SECURITY DEFINER e accetta qualsiasi p_lega_id, il che
-- è OK per leghe pubbliche ma diventa un mini-leak per eventuali leghe
-- private future. Quando arriverà il concetto di "lega privata" aggiungere
-- in cima alla funzione un check:
--   IF NOT EXISTS (SELECT 1 FROM lega_members
--                  WHERE lega_id = p_lega_id AND user_id = auth.uid())
--      AND NOT (SELECT is_public FROM leghe WHERE id = p_lega_id)
--   THEN RAISE EXCEPTION 'forbidden'; END IF;


-- ─────────────────────────────────────────────────────────────────────
-- 3. AUTH POST admin — NOTE DI VERIFICA (no SQL applicato)
-- ─────────────────────────────────────────────────────────────────────
--
-- Verifica eseguita su:
--   - app/api/fetch-risultati/route.ts
--   - app/api/review-round/route.ts
--   - app/api/calcola-risultati/route.ts
--   - app/api/ricalcola-round/route.ts
--   - app/api/post-gara/route.ts
--
-- TUTTE e 5 le route applicano lo stesso pattern in testa al POST:
--
--   const expectedKey = process.env.ADMIN_API_KEY;
--   if (!expectedKey || admin_key !== expectedKey) {
--     return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
--   }
--
-- → Il controllo richiesto dalla review ("env var ADMIN_SECRET o whitelist")
--   è già presente, con nome `ADMIN_API_KEY`. Niente da fare lato DB.
--
-- Rischi residui (fuori scope di questa migrazione, ma da tenere d'occhio):
--   * La chiave viene passata nel body JSON. Va bene se la chiamata è in
--     HTTPS (lo è su Vercel), ma occhio a non loggarla in chiaro.
--   * Non c'è rate-limit: un attaccante può brute-forzare la chiave. Se
--     ADMIN_API_KEY è abbastanza lunga (>=32 char random) è accettabile.
--   * Non c'è log di "chi" ha invocato la route → manca audit trail.
--     Quando ci saranno più admin valutare il passaggio a whitelist di
--     auth.uid() (vedi sotto come implementarla lato DB):
--
--       CREATE TABLE IF NOT EXISTS admin_users (
--         user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
--         created_at timestamptz DEFAULT now()
--       );
--       ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
--       -- nessuna policy → solo service_role legge/scrive
--
--   Lascio la tabella commentata: introducila solo quando deciderai di
--   sostituire / affiancare ADMIN_API_KEY con auth.uid() whitelist.

-- ═══════════════════════════════════════════════════════════════════════
-- FINE v15
-- ═══════════════════════════════════════════════════════════════════════

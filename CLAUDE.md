# Los Pitufos FantaF1

## Progetto
Fantasy F1 ibrido: fantasy manager (scuderia piloti con budget) + pronostici (previsioni su eventi di gara). Aperto a tutti, gratuito.

## Stack
- **Frontend:** Next.js + Tailwind CSS
- **Hosting:** Vercel (deploy automatico da GitHub)
- **API dati F1:** solo OpenF1 (api.openf1.org), per dati live e storici. Jolpica/Ergast NON si usa: numera i round saltando le gare cancellate (nel 2026 Bahrain e Jeddah), quindi col nostro numero di round risponde con un'altra gara
- **Dati live:** OpenF1 abbonamento €9.90/mese, connessione WebSocket per real-time durante le gare
- **Repo:** github.com/karrosimo91/pitufos-fantaf1
- **Sito in produzione:** https://pitufos-fantaf1.vercel.app/

## Regolamento v1.0 — Approvato dal CDA

> ⚠️ **Drift versione doc/codice:** questo documento è fermo alla v1.0.0
> (ultima approvazione CDA), mentre il codice applicativo è già a v1.8.1
> (vedi `CHANGELOG.md`). Le sezioni sotto vanno riletta contro l'implementazione
> reale prima di assumerle come fonte di verità su dettagli di edge case.

### Struttura
- Ogni giocatore si chiama "Team Principal"
- Ogni squadra si chiama "Scuderia"
- Budget: 100 "Soldini" (crediti di gioco)
- 5 piloti per scuderia
- Quotazioni iniziali basate sul Fantasy F1 ufficiale ($1M = 1 Soldino)
- Quotazioni variano dopo ogni GP
- Mercato: compravendita con quotazioni variabili, 2 cambi gratis per round, dal 3° in poi -10 punti weekend ciascuno
- Aperto a tutti
- Stagione 2026: 24 GP, 6 weekend sprint, 22 piloti, 11 scuderie

### Primo Pilota (Capitano)
- Ogni weekend scegli obbligatoriamente 1 pilota come Primo Pilota
- Punteggio x2 (bonus E malus)
- Se il Primo Pilota fa DNF (-10), il malus raddoppiato diventa -20

### Punteggi Qualifica GP
- Pole: +8
- P2: +6
- P3: +4
- P4-P5: +3
- P6-P10 (resto Q3): +2
- P11-P16 (Q2): +1
- P17-P22 (Q1): -1
- Non fa la Q / escluso / NC / senza tempo: -5 e basta, nessun altro punto (decisione 13/09/2026; vale anche per chi OpenF1 non elenca nella classifica)
- Penalità in griglia (a monte o per colpa in Q): 0 punti in qualifica, si paga in gara con la griglia reale

### Punteggi Sprint Shootout (Qualifica Sprint)
- Pole sprint: +4
- P2: +3
- P3: +2
- P4-P10 (resto SQ3): +1
- SQ2 (P11-P16): 0
- SQ1 (P17-P22): -1
- NC: -3

### Punteggi Sprint Race
- P1: +8, P2: +5, P3: +4, P4: +3, P5: +2, P6-P8: 0, P9-P22: 0
- Giro veloce sprint: +2
- DNF sprint: -5
- NO posizioni guadagnate/perse in sprint

### Punteggi Gara (Gran Premio)
- P1: +25, P2: +18, P3: +15, P4: +12, P5: +10, P6: +8, P7: +6, P8: +4, P9: +2, P10: +1, P11-P22: 0
- Posizione guadagnata vs griglia di partenza (non vs qualifica): +1 per posizione
- Posizione persa vs griglia di partenza: -1 per posizione
- Giro veloce: +3
- Driver of the Day: +5
- DNF/Ritiro: -10
- Penalità in gara/post gara: -5

### Previsioni (6 per weekend)
Punti differenziati SI vs NO (evento raro premia di più):
- Safety Car: SI +4 / NO +6 / Sbagliata 0
- Virtual Safety Car: SI +5 / NO +5 / Sbagliata 0
- Red Flag: SI +7 / NO +3 / Sbagliata 0
- Gomme wet usate: SI +8 / NO +2 / Sbagliata 0
- Pole vince la gara: SI +4 / NO +7 / Sbagliata 0 (pole = chi PARTE primo in griglia, decisione 13/09/2026)
- Numero DNF esatto: +5 se indovini / 0 se sbagli

### Aggiornamenti (Chip) — dalla fabbrica
Ogni chip ha 2 utilizzi: 1 prima della pausa estiva, 1 dopo. Se non lo usi, scade.
Regola: max 1 Aggiornamento Piloti + max 1 Aggiornamento Previsioni per weekend.

**Aggiornamenti Piloti:**
- **Boost Mode (x3):** un pilota DIVERSO dal Primo Pilota fa x3 per tutto il weekend
- **Halo:** se un tuo pilota va in negativo, il minimo è 0 punti
- **Scudo Capitano:** Primo Pilota x2 solo sui bonus, malus restano x1
- **Sesto Uomo:** aggiungi un 6° pilota temporaneo per un weekend (qualsiasi pilota)
- **Wildcard:** cambi illimitati senza penalità per quel round

**Aggiornamenti Previsioni:**
- **Previsione Doppia:** punti x2 su 1 previsione

### Deadline
- Weekend normali: prima delle qualifiche (sabato) — hai visto FP1, FP2, FP3
- Weekend sprint: prima della Sprint Shootout (venerdì) — hai visto solo FP1
- Si blocca tutto insieme: formazione, Primo Pilota, chip, previsioni

### Doppia Classifica
1. **Classifica Somma Punti (PRINCIPALE):** somma totale di tutti i punti weekend dopo weekend. Include tutto.
2. **Classifica Reale:** ogni weekend i giocatori vengono classificati per punteggio. Top 10 prendono punti F1 (25-18-15-12-10-8-6-4-2-1), gli altri 0.

### Casi particolari (edge case)
- **Pilota rimosso dal weekend per cause di forza maggiore** (infortunio, sostituzione sedile) → rimozione automatica dalla formazione senza consumo cambi, rimborso pari alla quotazione corrente in `driver_prices`, punteggio 0 (non DNF). Se il pilota era Primo Pilota/Sesto Uomo/target di un chip, quei campi vengono azzerati; il chip stesso viene invalidato se puntava proprio su quel pilota (es. Boost Mode). Se il pilota rimosso lasciava la scuderia sotto i 5 titolari, il vincolo "esattamente 5 piloti" per confermare formazione/previsioni viene abbassato temporaneamente a "minimo 4" per il round interessato, finché non si ricompra un sostituto.
  - Precedente applicato: round 14 (Zandvoort 2026), Hadjar (#6) infortunato e sostituito da Lawson in Red Bull; Tsunoda torna in Racing Bulls. Implementato in `scoring.ts` (flag `dns` distinto da `dnf`: nessun malus/bonus/giro veloce/pos. guadagnate-perse), `drivers-data.ts` (lista piloti) e `store.ts` (vincolo minimo piloti round 14).

## Punti aperti (da definire col team)
1. ~~Costruttori~~ — CHIUSO: no costruttori
2. ~~Gestione mercato~~ — CHIUSO: 2 cambi gratis, extra -10 punti (già implementato)
3. ~~Wildcard~~ — CHIUSO: già implementata come Aggiornamento Piloti
4. ~~Budget~~ — CHIUSO: 100 Soldini confermati
5. ~~All-in Previsioni~~ — CHIUSO: rimosso
6. ~~Weekend Perfetto~~ — CHIUSO: rimosso
7. ~~Scudo Capitano~~ — CHIUSO: approvato CDA, implementato come chip piloti (x2 solo bonus, malus x1)
8. ~~Algoritmo variazione quotazioni~~ — CHIUSO: approvato CDA, da implementare (fasce: ≥40: +3, 25-39: +2, 10-24: +1, 0-9: 0, -1/-10: -1, ≤-11: -2, min 5, max 45)

## Quotazioni Piloti 2026 (confermate)
Budget: 100 Soldini, 5 piloti per scuderia.

| Pilota | Team | Soldini |
|--------|------|---------|
| Norris | McLaren | 36 |
| Verstappen | Red Bull | 36 |
| Russell | Mercedes | 34 |
| Piastri | McLaren | 33 |
| Leclerc | Ferrari | 30 |
| Hamilton | Ferrari | 28 |
| Antonelli | Mercedes | 27 |
| Hadjar | Red Bull | 17 |
| Gasly | Alpine | 14 |
| Sainz | Williams | 14 |
| Albon | Williams | 13 |
| Alonso | Aston Martin | 12 |
| Bearman | Haas | 12 |
| Ocon | Haas | 11 |
| Stroll | Aston Martin | 10 |
| Lindblad | Racing Bulls | 10 |
| Hulkenberg | Audi | 9 |
| Lawson | Racing Bulls | 9 |
| Bortoleto | Audi | 9 |
| Colapinto | Alpine | 8 |
| Perez | Cadillac | 8 |
| Bottas | Cadillac | 7 |

### Team 2026 (11 scuderie)
- Red Bull: Verstappen, Hadjar
- McLaren: Norris, Piastri
- Mercedes: Russell, Antonelli
- Ferrari: Leclerc, Hamilton
- Alpine: Gasly, Colapinto
- Williams: Sainz, Albon
- Aston Martin: Alonso, Stroll
- Haas: Ocon, Bearman
- Audi: Hulkenberg, Bortoleto
- Racing Bulls: Lawson, Lindblad
- Cadillac: Perez, Bottas

## API OpenF1 — Endpoint che usiamo
- `sessions` → calendario, tipo sessione
- `session_result` → classifiche finali (qualifica, gara, sprint)
- `starting_grid` → griglia partenza. ATTENZIONE: verificato a Monza 2026, risponde **200 con array vuoto** anche con token valido: non ci si può contare. La griglia si risolve a cascata in `lib/starting-grid.ts` → `starting_grid` → prime posizioni del feed `position` della gara (lo schieramento, unica fonte live) → posizioni di qualifica (ultimo fallback, ignora le penalità in griglia)
- `drivers` → info piloti (nome, team, numero, foto, colore)
- `race_control` → Safety Car, VSC, Red Flag, penalità di gara e in griglia. NON copre tutti i ritiri: OpenF1 non emette un messaggio per ogni macchina che si ferma, quindi i DNF live si leggono anche da `session_result` via `/api/live-retired` (flag `dnf`/`dsq`, aggiornati durante la sessione) e le due fonti si sommano
- `stints` → compound gomme (per previsione wet)
- `laps` → tempi al giro (per giro veloce)
- `meetings` → info weekend
- `championship_drivers` → classifica mondiale piloti
- `championship_teams` → classifica mondiale costruttori

**Dati manuali:** Driver of the Day, quotazioni iniziali, variazione quotazioni

## Calcolo punteggi — regole di robustezza (v1.10.0)
Unico percorso di scrittura: `/api/post-gara` (risultati + punteggi), `/api/recalc-penalties`
(ricalcolo penalità), `/api/reset-round` (azzeramento). `fetch-risultati`, `ricalcola-round`
e `calcola-risultati` rispondono 410: erano doppioni con logica divergente.

1. **Round → sessione OpenF1 per data**, mai per posizione in lista (`lib/openf1-sessions.ts`,
   `findRaceSessionForRound`): si cerca la sessione "Race" entro 36h dall'orario di gara di
   `races.ts`. Se non c'è o è ambigua → errore, niente salvato. Motivo: OpenF1 tiene in lista
   le gare cancellate (Bahrain, Jeddah 2026) e ne aggiunge altre (Kuala Lumpur 4/10/2026,
   fra Baku e Singapore): `meetings[round - 1]` dal round 18 avrebbe preso la gara sbagliata.
2. **Niente risultati ufficiali, niente calcolo** (`lib/official-results.ts`,
   `checkResultsReady`): sessione conclusa, `session_result` con righe, tutti i piloti di
   `/drivers`. Fallisce → 409. Nessun fallback sul feed `position` (non ha i flag dnf/dsq/dns:
   Madrid 2026 è finita in archivio con 22 classificati e zero ritiri proprio per quello).
   Riconoscere il caso in archivio: nessuna riga gara con `position` null.
3. **Coerenza prima di salvare** (`validateWeekendResults`): `total_dnf` = righe dnf + dns,
   posizioni univoche, un P1. Fallisce → 422.
4. **Punteggi applicati per differenza** (`lib/score-round.ts`, `applicaPunteggiRound`):
   `weekend_scores.real_points` (migrazione v18) registra i punti Classifica Reale dati da
   ogni round; `classifica_totale` si aggiorna sottraendo il vecchio e sommando il nuovo,
   anche per `real_points`. Rilanciare è sempre sicuro. `isPostRace` dipende dalla presenza
   della gara in archivio, non dalla sessione rilanciata.
5. **Classifica Reale** (`lib/classifica-reale.ts`): stessa regola su server e Statistiche.
   Pari merito: piloti_points, poi previsioni_points, poi user_id — proposta, da confermare
   in CDA.
6. Driver of the Day è manuale: un rilancio senza DOTD mantiene quello salvato.
7. **Qualifica e "pole vince"** (decisioni 13/09/2026): la pole è chi PARTE primo in griglia
   (`poleWon` in `official-results.ts`, anche live). Se non fai la Q prendi -5 e basta (-3 in
   shootout), nessun altro punto tolto: vale per "senza tempo" (`duration` tutta nulla), per
   chi è escluso/non classificato (position null) e per chi OpenF1 non elenca proprio nella
   classifica (`addAbsentAsNoTime`, iscritti = drivers del meeting ∩ rosa; Madrid 2026: Bearman).
   Per questo la guardia sui dati completi per qualifica e shootout accetta liste corte
   (`allowMissingDrivers`, soglia minima 15). Nessuna esenzione per penalità in griglia: quelle
   valgono 0 in qualifica e si pagano con la griglia in gara. DNS (forza maggiore, pilota
   rimosso dal weekend) resta 0.
10. **Override manuali** (`lib/manual-overrides.ts`): decisioni FIA post-gara che OpenF1 non
   recepisce (Monaco 2026: Corte d'Appello 3/9, Gasly 7°, Hadjar 3°; OpenF1 è rimasto alla
   classifica intermedia con Gasly 3°). Applicati a ogni calcolo e nell'audit, con fonte.
   Prima di ricalcolare un round vecchio: controllare che OpenF1 non abbia "dimenticato"
   una decisione successiva. DNS tecnici (Cina, Miami sprint, Montréal 2026) sono `dns: true`
   in OpenF1 e valgono 0: regola da confermare in CDA (prima erano -10/-5 come DNF).
9. **Quotazioni solo sul round più recente**: rilanciare una gara passata ricalcola i punti,
   non i prezzi (il cleanup delle quotazioni future cancellerebbe quelle dei round dopo).
8. **Audit prima di ricalcolare**: `/api/audit-regole?from=&to=` (sola lettura, cookie admin o `admin_key`)
   mostra i delta per regola/round/giocatore. I round 2-14 hanno in archivio griglia =
   qualifica: il ricalcolo retroattivo con la griglia reale è da fare dopo il via del CDA.

Incoerenza nota ancora aperta: `total_dnf` conta anche i DNS, mentre per i punti del singolo
pilota il DNS vale 0 e non -10 (caso Hadjar round 14). Non è mai scattata su nessun round
(nessun `dns: true` in archivio), ma la regola va decisa: proposta, escludere il DNS.

## Admin — autenticazione
- Credenziali SOLO lato server: `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_API_KEY` (variabili Vercel). Mai
  costanti nel client: il bundle è pubblico.
- `/api/admin-login` (POST) rilascia il cookie httpOnly `pitufos_admin`, firmato HMAC con
  `ADMIN_API_KEY`, 12 ore. GET verifica la sessione, DELETE fa logout.
- Ogni route admin usa `isAdminRequest(request, admin_key)` (`lib/admin-auth.ts`): cookie valido
  oppure `admin_key` uguale a `ADMIN_API_KEY` (per curl/script). Nuove route admin: stessa funzione.
- `/admin` ha il pannello "Audit regole" (`/api/audit-regole`), "Ricalcola round" e "Ricalcola
  stagione" (`/api/admin/rounds` elenca i round in archivio; si rilanciano solo quelli, mai il
  round 1 o i cancellati).

## CDA Los Pitufos
- Pagina `/cda`: votazione regolamento, riservata ai membri della lega LP (id: `566abb62-600d-4189-9eab-267fa98d140c`)
- Sistema versionato: `questionnaire_id` su tabella `cda_voti` (v1_regolamento, v2_modifica_punteggi)
- Questionario attivo (bloccante) configurabile in `use-cda.ts` → `ACTIVE_QUESTIONNAIRE_ID`
- Membri CDA devono completare il questionario attivo per poter confermare formazione/previsioni
- Nota: `lega_members` ha PK composita (lega_id, user_id), NO colonna `id`

## RLS Supabase — stato reale vs migrazioni nel repo
Le migrazioni in repo non riflettono tutte le policy applicate a mano in produzione.
Stato verificato (agosto 2026):
- `formazioni`, `previsioni`, `profiles` → hanno **anche** una policy `*_read_all` con `USING (true)`
  (oltre alle vecchie "own row"). Per questo il live scoring e il dettaglio squadra
  degli altri giocatori funzionano.
- `weekend_scores`, `weekend_results`, `driver_prices` → read-all.
- `mercato_cambi` → **leggibile solo dal proprietario**. Nessun calcolo lato client
  può ricavare la penalità cambi di un altro giocatore: va letta da `weekend_scores`
  (già al netto) come fa `/classifica`.
- `classifica_totale` → `classifica_totale_read_self`, solo la propria riga; le classifiche
  passano dalla RPC `classifica_lega`.
Se si aggiungono feature che leggono dati di altri giocatori, verificare prima la policy
sulla tabella: una query bloccata da RLS torna 0 righe senza errore.

## Live Scoring (attivo)
- WebSocket MQTT via `wss://mqtt.openf1.org:8084/mqtt` (OpenF1 Sponsor, €9.90/mese)
- Token OAuth2 generato da `/api/openf1-token` (env vars: `OPENF1_USERNAME`, `OPENF1_PASSWORD`)
- `use-live-session.ts`: rileva sessione attiva (polling REST ogni 60 sec)
- `use-live-ws.ts`: connessione WebSocket MQTT, subscribe a v1/position, v1/race_control, v1/laps, v1/stints
- `use-live-scoring.ts`: calcolo punti provvisori in tempo reale usando `scoring.ts`
- `LiveTab.tsx`: componente UI con posizioni piloti, previsioni live, feed race control
- Integrato in `/gara` con badge LIVE e tab auto-switch
- Dati push istantanei via WebSocket, più due polling REST di supporto durante gara/sprint: `/api/live-grid` (griglia, finché non arriva quella vera) e `/api/live-retired` (ritiri ufficiali da `session_result`, ogni 45 sec)
- Debug mode: `/gara?debug_live=true` per testare con dati mock

## PWA
- manifest.json, service worker (sw.js), icone PNG (192/512)
- Installabile da Safari → Aggiungi alla schermata Home
- RegisterSW.tsx nel layout

## Email Reminder (pronto, non attivo)
- API `/api/send-reminders` implementata con Resend
- NON attiva: serve dominio verificato per mandare email a tutti
- Vercel Cron non utilizzabile su piano Hobby (solo 1/giorno)

## Design
- Tema scuro, colore primario #E8002D (rosso F1)
- Font: Oswald per titoli, JetBrains Mono per numeri, Inter per testo
- Mobile-first
- Stile ispirato al prototipo "PITWALL" già creato
- Mockup redesign v2 disponibile in `/public/mockup-v2.html` (Space Grotesk, stile moderno)

## TODO — Da fare nelle prossime sessioni

### Refactor / Snellimento
- **LiveTab.tsx troppo grande** — spezzare in componenti: ClassificaWeekend, PlayerModal, BreakdownAccordion, PrevisioniLive
- **Logica duplicata** — il calcolo punti per altri giocatori (useMemo classifica) ripete la logica di scoring.ts. Centralizzare
- **Troppi fetch nel LiveTab** — creare hook `useLiveWeekendData(round, legaId)` che centralizza fetch formazioni, previsioni, grid, risultati precedenti
- **Tab provvisorio** — riusare gli stessi componenti del live invece di copia-incolla semplificato
- **Breakdown nel tab provvisorio** — aggiungere dettaglio pilota cliccabile anche nel tab provvisorio (attualmente mostra solo classifica)

### Feature da implementare
- **Algoritmo quotazioni a fasce** — approvato CDA, non implementato (fasce: ≥40: +3, 25-39: +2, 10-24: +1, 0-9: 0, -1/-10: -1, ≤-11: -2, min 5, max 45)
- **Fallback polling REST** — se WebSocket non si connette, polling `/api/live-data` ogni 15 sec come backup
- **Redesign grafica** — mockup v2 pronto, da implementare (Space Grotesk, layout moderno)

### Bug noti / Miglioramenti
- Alcuni utenti vedono live a 0 (WebSocket non si connette) — serve fallback polling
- Mercato bloccato durante sessioni — verificare che funzioni correttamente
- Aggiornamento punteggi richiede cambio tab — potrebbe essere latenza WebSocket

# Los Pitufos FantaF1

## Progetto
Fantasy F1 ibrido: fantasy manager (scuderia piloti con budget) + pronostici (previsioni su eventi di gara). Aperto a tutti, gratuito.

## Stack
- **Frontend:** Next.js + Tailwind CSS
- **Hosting:** Vercel (deploy automatico da GitHub)
- **API dati F1:** OpenF1 (api.openf1.org) per dati live e storici + Jolpica (api.jolpi.ca/ergast/f1) per classifiche e calendario
- **Dati live:** OpenF1 abbonamento €9.90/mese, connessione WebSocket per real-time durante le gare
- **Repo:** github.com/karrosimo91/pitufos-fantaf1

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
- NC/DSQ/No tempo: -5
- Penalità in griglia: 0 punti

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
- Posizione guadagnata vs griglia: +1 per posizione
- Posizione persa vs griglia: -1 per posizione
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
- Pole vince la gara: SI +4 / NO +7 / Sbagliata 0
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
- `starting_grid` → griglia partenza (per pos guadagnate/perse)
- `drivers` → info piloti (nome, team, numero, foto, colore)
- `race_control` → Safety Car, VSC, Red Flag, penalità
- `stints` → compound gomme (per previsione wet)
- `laps` → tempi al giro (per giro veloce)
- `meetings` → info weekend
- `championship_drivers` → classifica mondiale piloti
- `championship_teams` → classifica mondiale costruttori

**Dati manuali:** Driver of the Day, quotazioni iniziali, variazione quotazioni

## API Jolpica — Endpoint che usiamo
- `/current.json` → calendario completo con orari FP, quali, sprint, gara
- `/current/driverstandings.json` → classifica piloti
- `/current/constructorstandings.json` → classifica costruttori

## CDA Los Pitufos
- Pagina `/cda`: votazione regolamento, riservata ai membri della lega LP (id: `566abb62-600d-4189-9eab-267fa98d140c`)
- Sistema versionato: `questionnaire_id` su tabella `cda_voti` (v1_regolamento, v2_modifica_punteggi)
- Questionario attivo (bloccante) configurabile in `use-cda.ts` → `ACTIVE_QUESTIONNAIRE_ID`
- Membri CDA devono completare il questionario attivo per poter confermare formazione/previsioni
- Nota: `lega_members` ha PK composita (lega_id, user_id), NO colonna `id`

## Live Scoring (attivo)
- WebSocket MQTT via `wss://mqtt.openf1.org:8084/mqtt` (OpenF1 Sponsor, €9.90/mese)
- Token OAuth2 generato da `/api/openf1-token` (env vars: `OPENF1_USERNAME`, `OPENF1_PASSWORD`)
- `use-live-session.ts`: rileva sessione attiva (polling REST ogni 60 sec)
- `use-live-ws.ts`: connessione WebSocket MQTT, subscribe a v1/position, v1/race_control, v1/laps, v1/stints
- `use-live-scoring.ts`: calcolo punti provvisori in tempo reale usando `scoring.ts`
- `LiveTab.tsx`: componente UI con posizioni piloti, previsioni live, feed race control
- Integrato in `/gara` con badge LIVE e tab auto-switch
- Dati push istantanei, nessun polling durante la sessione
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

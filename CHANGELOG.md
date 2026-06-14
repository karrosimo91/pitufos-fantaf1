# Changelog

## v1.7.0 — 14 Giugno 2026

### Tab Live ridisegnato
- **Fascia punteggio sempre in cima** al tab Live, con tre sotto-tab: **Dashboard** (i tuoi piloti live + andamento previsioni + race control), **Classifica Gara** (classifica live del weekend) e **Classifica Generale** (classifica di stagione + punti del weekend live).

### /gara ridisegnata
- **Fascia recap** in alto: posizione in classifica, punti totali, media.
- **Formazione e Previsioni** raggruppate nel nuovo tab **Muretto** (con sotto-toggle), invece di due tab separati. Tab principali: Muretto · Live · Dettaglio.

### Fix
- **DNF live**: i ritiri ora vengono rilevati leggendo il numero auto dal testo del messaggio (CAR X), come per le penalità. Prima non venivano quasi mai conteggiati.
- **Pole vince (live)**: calcolata in tempo reale deducendo il pole sitter dalla griglia di partenza.
- **Breakdown Halo/Scudo**: i chip si applicano sul totale del weekend; il dettaglio per-pilota ora torna sempre col punteggio mostrato.
- **Classifica Generale (`/classifica`)**: non mostra più il punteggio in tempo reale (che era impreciso), ma il provvisorio di fine sessione. Il live in tempo reale è nel tab Live.
- **Etichette chip** leggibili ovunque.

### Sotto il cofano
- Salvataggio dei punteggi provvisori con throttle (max 1 scrittura/30s): meno carico sul database e niente sovrascritture tra più client.
- Logica di punteggio live centralizzata su una sola connessione e un solo motore di calcolo.

---

## v1.6.0 — 14 Giugno 2026

### Fix
- **Punteggio live che non si aggiornava senza cambiare tab** — il tab Live apriva due connessioni WebSocket separate alla stessa sessione: i due client si disconnettevano a vicenda bloccando gli aggiornamenti in tempo reale. Ora c'è una sola connessione condivisa e il punteggio si aggiorna da solo, senza dover cambiare scheda.
- **Punteggio in alto diverso da quello in classifica** — i due valori venivano calcolati da connessioni diverse e potevano divergere. Ora usano lo stesso identico snapshot live e coincidono sempre.
- **Live bloccato a zero** — se la connessione live si apriva ma restava silenziosa, il polling REST di riserva veniva spento e non si riattivava più. Ora un "safety-net" controlla la freschezza dei dati e, se sono fermi da oltre 15s, recupera i dati via REST automaticamente, rispegnendosi quando il live riprende.

### Regolamento
- **Chip riutilizzabili una sola volta per metà stagione** — un Aggiornamento già usato nella stessa metà di stagione non è più riselezionabile (1 uso prima della pausa estiva, 1 dopo).
- **Rimosso il chip "Previsione Sicura"** — tolto dalla selezione previsioni e dal regolamento. Gli usi storici già salvati restano comunque visibili.

---

## v1.5.0 — 7 Giugno 2026

### Fix
- **Penalità di gara conteggiate** — il malus -5 per scorrettezze in pista (penalità in tempo, drive through, stop and go, penalità post-gara) ora viene assegnato correttamente, una sola volta per pilota. Prima non scattava mai: OpenF1 lascia `driver_number` vuoto nei messaggi dei commissari e il sistema cercava il pilota nel campo sbagliato. Ora il numero auto viene letto dal testo del messaggio (`CAR X`). Verificato sui dati reali del GP di Monaco.
- Vale sia per il **punteggio live** durante la gara, sia per il **calcolo ufficiale post-gara**.

### Novità
- **Manutenzione penalità (admin)** — nuovo pannello in `/admin` per ricalcolare penalità e punteggi di un singolo GP o di tutti i GP già disputati. Idempotente: rilanciarlo non altera nulla se non ci sono variazioni.

### Sotto il cofano
- Rilevamento penalità centralizzato in `lib/penalties.ts`, coperto da test automatici con i dati reali di Monaco
- Calcolo punteggi del weekend centralizzato in `lib/score-round.ts`, condiviso tra `/api/post-gara` e `/api/recalc-penalties` (eliminata logica duplicata)

---

## v1.4.0 — 22 Maggio 2026

### Design
- **Nuova identità Pitwall** — logo PITUFOS. con brand-mark triangolare, palette HUD F1 (nero #000 + accent #E8002D), griglia tecnica di sfondo, tipografia mono JetBrains su numeri e label
- **Nuova icona** dell'app (PWA): parallelogramma rosso obliquo + logotipo PITUFOS.
- **Componenti UI unificati**: HudCard, SectionHead, LivePill, Brand — coerenti su tutte le pagine
- **Restyling completo** di home, /gara, /classifica, /mercato, /dashboard e tutte le pagine secondarie

### Novità
- **Quotazioni dinamiche dei piloti** — l'algoritmo a fasce approvato dal CDA è ora attivo: dopo ogni gara i prezzi cambiano (≥40 pts: +3, 25-39: +2, 10-24: +1, 0-9: 0, -1/-10: -1, ≤-11: -2; range 5-45). Il mercato mostra le quotazioni vigenti.
- **Fallback polling REST** per il live scoring — se il WebSocket MQTT non si connette, l'app passa automaticamente al polling REST ogni 15s. Pillola di stato: LIVE (verde) / POLLING (gialla) / OFFLINE (grigia). Risolve il bug "live a 0" che colpiva alcuni utenti.
- **Podio classifica** con label SILVER/GOLD/BRONZE e shadow sul leader
- **/debug ammodernata** con input ADMIN_API_KEY persistente

### Fix
- Bug "live a 0": logging strutturato + fallback automatico al polling
- Logica scoring centralizzata: eliminate duplicazioni che potevano causare punteggi divergenti tra le viste
- Race condition su cambio sessione live (fetch ora abortiti correttamente)

### Sotto il cofano
- **Refactor LiveTab** da 935 a 206 righe (-78%), zero duplicazioni della logica scoring
- **91 test automatici** su scoring e logica live: ogni modifica al regolamento è ora coperta da test di regressione
- **Database**: indici parziali per accelerare il live, RLS hardening su classifica_totale, nuova tabella driver_prices

---

## v1.3.0 — 29 Marzo 2026

### Novità
- **Breakdown punteggio pilota** — clicca su un pilota per vedere il dettaglio di come è composto il punteggio (posizione, giro veloce, pos. guadagnate/perse, moltiplicatore)

---

## v1.2.1 — 29 Marzo 2026

### Fix
- Previsioni live colorate correttamente (verde se corretta, rosso se sbagliata)
- Classifica weekend live include punti previsioni per tutti i giocatori
- Previsioni visibili nel modal dettaglio giocatore
- Modal dettaglio giocatore scrollabile su mobile

---

## v1.2.0 — 28 Marzo 2026

### Novità
- **Dettaglio giocatore live** — clicca su un giocatore nella classifica weekend per vedere i punti live dei suoi piloti
- **Punteggi provvisori persistenti** — dopo la sessione, i punteggi restano visibili con badge "PROVVISORIO" finché l'admin non calcola i risultati ufficiali
- **Classifica stagione live** — la pagina Classifica si aggiorna con i punti provvisori del weekend (live o post-sessione)
- **Mercato bloccato** durante sessioni live

### Fix
- Fix autenticazione OpenF1 e CORS (proxy server-side)
- Classifica weekend filtrata per lega preferita

---

## v1.1.1 — 28 Marzo 2026

### Fix
- **Live scoring**: fix autenticazione OpenF1 e CORS (proxy server-side)
- **Mercato bloccato** durante sessioni live

---

## v1.1.0 — 27 Marzo 2026

### Novità
- **Classifica weekend live** — ranking provvisorio di tutti i giocatori aggiornato in tempo reale durante le sessioni

---

## v1.0.0 — 27 Marzo 2026
Prima release stabile.

### Novità
- **Aggiornamento regolamento e punteggi** secondo voti CDA v1 e v2
- **Scudo Capitano** — nuovo Aggiornamento Piloti (Capitano x2 solo bonus, malus x1)
- **Live scoring** — dati in tempo reale via WebSocket OpenF1 durante tutte le sessioni

# Changelog

## v1.10.0 — 13 Settembre 2026

### Regolamento (decisioni 13/09/2026, in attesa di ricalcolo retroattivo)
- **"Pole vince la gara" si valuta sulla griglia di partenza** — la pole è chi parte primo, non chi ha fatto il miglior tempo in qualifica: se il poleman ha una penalità in griglia, la pole di fatto passa a chi parte davanti. Vale nel post-gara e nel live; senza griglia si ricade sulla qualifica.
- **"Senza tempo" in qualifica vale -5** (-3 in sprint shootout) — rilevato dai risultati ufficiali (`duration` di `session_result` senza alcun tempo in Q1/Q2/Q3). Prima non scattava mai.
- **Se non fai la Q prendi -5 e basta** — vale anche per chi OpenF1 non elenca proprio nella classifica di qualifica (Madrid 2026: 20 righe su 22, Bearman assente): gli iscritti al weekend assenti dalla classifica vengono aggiunti come "senza tempo". Nessun altro punto tolto, nessuna esenzione per penalità in griglia (quelle valgono 0 in qualifica e si pagano con la griglia in gara). La guardia sui dati completi accetta per qualifica e shootout liste corte, con soglia minima contro le pubblicazioni a metà.
- **Quotazioni solo sul round più recente** — rilanciare una gara passata ricalcola i punti e non tocca i prezzi: prima il cleanup delle "quotazioni future" avrebbe cancellato quelle dei round successivi.
- **Posizioni guadagnate/perse dalla griglia reale** — già nel codice dal 6/9, ma i round 2-14 in archivio hanno come griglia la posizione di qualifica (tutti e 22 i piloti, in ogni round): il ricalcolo retroattivo va fatto.
- Nuovo `/api/audit-regole` (sola lettura, admin): per ogni round ricalcola tutti i giocatori applicando le regole una alla volta e riporta i delta per round, per giocatore e per regola, con i piloti che le fanno scattare. Sostituisce `/api/audit-griglia`.

### Fix
- **Zero ritiri a Madrid (round 16)** — il calcolo post-gara era partito pochi minuti dopo la bandiera a scacchi, quando OpenF1 non aveva ancora pubblicato `session_result`; il codice ripiegava sul feed `position`, che non porta i flag di ritiro, e salvava 22 piloti "classificati" e `total_dnf` 0 senza nessun errore. Ora `/api/post-gara` **non salva e non calcola niente** finché i risultati ufficiali non ci sono e non sono completi: la sessione deve essere conclusa, `session_result` deve rispondere e devono esserci tutti i piloti attesi (confronto con `/drivers`). Se manca qualcosa risponde 409 spiegando perché, e l'archivio resta com'era. Il fallback sul feed `position` è stato eliminato.
- **Round abbinato per data, non per posizione** — la gara di un round veniva presa con `meetings[round - 1]`, fidandosi che la lista OpenF1 avesse lo stesso ordine e numero del nostro calendario. Con Bahrain e Jeddah cancellate ma in lista reggeva ancora; con una gara in più (Kuala Lumpur, 4 ottobre, fra Baku e Singapore) dal round 18 l'indice avrebbe puntato alla gara sbagliata. Ora la sessione gara si trova confrontando `date_start` con l'orario di gara del nostro calendario (finestra di 36 ore); se non c'è o è ambigua, errore esplicito. Vale per `post-gara`, `recalc-penalties`, `audit-griglia` e `live-grid`.
- **Classifica Reale gonfiata nei ricalcoli** — i punti 25-18-15 venivano sommati a `classifica_totale.real_points` a ogni calcolo della gara e mai sottratti dal reset: ogni rilancio raddoppiava. Il valore in produzione era arrivato a 637 con un massimo teorico di 325 (la pagina Statistiche non lo leggeva, quindi nessuno l'ha visto). Ora ogni round registra in `weekend_scores.real_points` quanto ha dato e la classifica generale si aggiorna per differenza: rilanciare cento volte dà lo stesso risultato di lanciare una volta. Migrazione v18 con riallineamento dei dati.
- **Pari merito nella Classifica Reale** — a punteggio weekend uguale l'ordine era quello casuale delle righe del DB, diverso a ogni calcolo. Regola unica per server e pagina Statistiche: prima i punti piloti, poi le previsioni, poi l'id (proposta da confermare in CDA, un solo punto nel codice da cambiare).
- **Rilancio della qualifica dopo la gara** — ricalcolare la qualifica di un round già chiuso azzerava previsioni, penalità cambi e Classifica Reale perché "non era la sessione gara". Ora contano appena la gara è in archivio, qualunque sessione si rilanci.
- **Driver of the Day perso nei rilanci** — è un dato manuale: se non arriva col rilancio si tiene quello già salvato invece di azzerarlo.
- **Coerenza interna prima del salvataggio** — eventi e righe piloti devono raccontare la stessa storia (numero ritiri, posizioni univoche, un vincitore): se no il salvataggio si ferma con 422. Trovato e corretto in archivio il round 2 (Cina): 7 ritiri nelle righe piloti ma `total_dnf` 0 (senza impatto sui punti, nessuno aveva previsto 7).
- **Qualifica dai risultati ufficiali** — la classifica di qualifica e sprint shootout arrivava dal feed `position`, che non conosce NC e squalifiche: il −5 (−3 in shootout) non scattava mai. Ora arriva da `session_result`.

### Fix (13/09, sera)
- **OpenF1 risponde 429 sotto carico e il codice lo leggeva come "nessun dato"** — nel primo audit sei round su tredici risultavano senza griglia e senza qualifica solo per questo. Ora ogni chiamata OpenF1 riprova su 429/5xx con attesa crescente (1s, 2s, 4s) e l'audit riporta esito HTTP e righe di ogni chiamata (`chiamate_openf1`), così "non disponibile" dice il perché.
- **Non classificato in qualifica** — un pilota senza posizione in `session_result` (tempi cancellati, esclusione) non è più trattato come un P17-22 da -1: è l'NC del regolamento, -5. Trovato a Miami 2026 (Hadjar, in archivio P9 con +2). L'audit elenca a parte anche i DNS di qualifica (0 punti).
- Audit più leggero (race_control solo di qualifica, shootout e gara) e limitato a 60 s: su Vercel Hobby va lanciato a blocchi di round.

### Sicurezza
- **Credenziali admin fuori dal client** — utente, password e `ADMIN_API_KEY` erano scritti nel codice della pagina `/admin`, quindi nel JavaScript scaricato da ogni giocatore. Ora il login passa da `/api/admin-login`, confronta con `ADMIN_USER` / `ADMIN_PASS` (variabili Vercel) e rilascia un cookie httpOnly firmato, valido 12 ore; tutte le route admin accettano il cookie (o `admin_key` nel body per gli script). Da fare su Vercel: impostare `ADMIN_USER` e `ADMIN_PASS`, ruotare `ADMIN_API_KEY`.
- Bottone **Ricalcola round** in `/admin`: rilancia in sequenza tutte le sessioni del round (Shootout, Sprint, Qualifica, Gara) con log, sfruttando i ricalcoli idempotenti.
- Pannello **Audit regole** in `/admin`: lancia l'audit a blocchi di round e mostra la tabella dei totali, le note e il JSON completo, senza chiavi negli URL.

### Sotto il cofano
- **Solo OpenF1** — rimossa Jolpica/Ergast da griglia, post-gara, audit e helper: numera i round saltando le gare cancellate (il nostro 16 per loro è il 14), quindi col nostro numero risponde con un'altra gara.
- **Ritirate le route doppione** `/api/fetch-risultati`, `/api/ricalcola-round`, `/api/calcola-risultati` (410): copie con logica divergente e senza controlli, non chiamate da nessuna parte. Il calcolo passa solo da `/api/post-gara`, il ricalcolo penalità da `/api/recalc-penalties`, l'azzeramento da `/api/reset-round`.
- Nuove librerie pure e testate: `lib/official-results.ts` (prontezza e coerenza dei risultati), `lib/openf1-sessions.ts` (round → sessione per data), `lib/classifica-reale.ts` (ordinamento e punti reale); `lib/score-round.ts` ha l'unico punto di scrittura dei punteggi (`applicaPunteggiRound`). 175 test.

---

## v1.9.2 — 6 Settembre 2026

### Fix
- **DNF non contati nel live** — i ritiri venivano dedotti solo dai messaggi `race_control` ("RETIRED", "OUT OF THE RACE"...), ma OpenF1 non emette un messaggio per ogni macchina che si ferma: i ritiri silenziosi non facevano mai scattare il malus −10 in tempo reale. Ora il live interroga anche `session_result` (flag ufficiali `dnf`/`dsq`) ogni 45 secondi durante gara e sprint, tramite il nuovo `/api/live-retired`, e unisce le due fonti. Un ritiro rilevato non viene più tolto, così un errore momentaneo dell'API non fa "resuscitare" nessuno. `dns` (non partito) resta escluso: vale 0, non −10.
- **Posizioni guadagnate/perse calcolate dalla qualifica invece che dalla griglia** — il delta +1/−1 per posizione usava la posizione di **qualifica** come riferimento, ignorando le penalità in griglia (cambio motore/cambio, impeding). Un pilota che qualificava P7, partiva P20 per penalità e chiudeva P8 risultava **−1 posizione persa** invece di **+12 guadagnate**: 13 punti in meno, 26 se Primo Pilota. Ora la griglia arriva dall'endpoint OpenF1 `starting_grid` (griglia reale, penalità incluse) in tutti e tre i percorsi: `/api/post-gara`, `/api/fetch-risultati` e `/api/live-grid` (live scoring). Se `starting_grid` non è ancora pubblicato si ricade sulle posizioni di qualifica come prima, e il log del post-gara lo segnala.
- Invariato per scelta il trattamento della penalità in griglia sui punti qualifica: restano i punti del piazzamento in qualifica, la penalità griglia non genera il −5 di gara.
- **`starting_grid` di OpenF1 è vuoto** (verificato a Monza 2026: HTTP 200 con array vuoto, token valido), quindi la griglia viene risolta a cascata su più fonti: `starting_grid` → risultati ufficiali Jolpica (campo `grid`, solo a gara conclusa) → prime posizioni registrate nel feed `position` della gara (lo schieramento, unica fonte utile a gara in corso) → posizioni di qualifica come ultimo fallback. `/api/live-grid` espone la fonte usata in `source`, il post-gara la scrive nel log.

---

## v1.9.1 — 29 Agosto 2026

### Fix
- **DNF live non conteggiato quando il pilota spariva dalle posizioni** — il feed `v1/position` di OpenF1 smette di emettere per una macchina ritirata. Chi apriva il live *dopo* il ritiro (o restava senza lo snapshot REST iniziale, es. token non disponibile) non vedeva più quel pilota fra le posizioni: `calcolaPuntiPilotaBase` non trovava nessuna riga e il malus spariva in silenzio — **0 punti invece di −10** — per tutti i partecipanti che avevano quel pilota. Nel frattempo `total_dnf` lo contava lo stesso, quindi la previsione "N° DNF" e i punti piloti erano incoerenti fra loro. Ora i ritirati assenti dalle posizioni ottengono comunque la loro riga nei risultati live (gara e sprint), quindi il malus arriva a tutti.

### Sotto il cofano
- **Punteggi provvisori più leggeri** — il salvataggio scriveva per ogni giocatore un dettaglio per pilota con `puntiFinali: 0` e `isDnf: false` fissi (dato mai letto da nessuno, e sbagliato). Rimosso: si salva solo il totale, che era ed è corretto. Il salvataggio non si ri-programma più a ogni cambio di posizione in pista, ma solo quando cambia davvero la classifica.

---

## v1.9.0 — 29 Agosto 2026

### Statistiche e grafici
- Nuova pagina **Statistiche** (`/statistiche`, da Altro → Statistiche), tutta centrata sui partecipanti al Fanta.
- **Andamento campionato** round per round, in **punti cumulati** o in **posizione**, con confronto diretto contro un avversario a scelta (vista tabella inclusa).
- **Testa a testa**: quanti weekend hai vinto contro l'avversario selezionato, i pareggi e il distacco in classifica.
- **Rendimento** di ogni Team Principal: GP disputati, weekend vinti, podi, media a GP, miglior punteggio e punti totali.
- **Piazzamenti weekend** (quante volte 1°, 2°, 3°, fuori dal podio) con i punti della **Classifica Reale** (25-18-15-12-10-8-6-4-2-1).
- **Albo dei weekend**: chi ha vinto ogni round e con quanti punti.
- **Weekend per weekend**: barre con lo split punti piloti / punti previsioni; al tocco il dettaglio con totale e penalità cambi.
- **Previsioni**: percentuale indovinata per evento e classifica dei giocatori più precisi (DNF esatti contati a parte).
- **Eventi della stagione**, **record della lega** (miglior/peggior weekend) e **aggiornamenti già usati** da ogni giocatore.
- Palette dei grafici validata per daltonismo sulla superficie scura; legenda sempre presente, valori leggibili al tocco.

### Dettaglio altri giocatori
- Il modale di dettaglio di un altro Team Principal ora **scorre** correttamente su mobile: header fisso fuori dall'area scrollabile, corpo `flex-1 min-h-0` con `overscroll-contain`, e scroll della pagina sotto bloccato mentre il modale è aperto (stesso trattamento anche per il dettaglio del tab Live).
- A gara calcolata si vede **tutto quello che ha inserito** l'avversario, non solo i punti: rosa completa con badge Primo Pilota / Boost x3 / Sesto Uomo e punti per singolo pilota, previsioni con la risposta data e l'esito (✓/✗) più i punti raccolti, aggiornamenti usati (inclusa la previsione su cui è stata applicata la Doppia).
- In vista "Stagione completa" un suggerimento spiega che per aprire le squadre degli altri serve scegliere un round.

### Fix
- **Penalità cambi degli altri giocatori mai conteggiata** nel dettaglio da `/classifica`: `mercato_cambi` è leggibile solo dal proprietario (RLS), quindi il conteggio dei cambi tornava sempre 0 e il totale mostrato poteva essere più alto di quello ufficiale in classifica. Ora il totale viene letto da `weekend_scores` (già al netto della penalità) e la penalità è ricavata come differenza dai punti lordi.

---

## v1.8.1 — 14 Giugno 2026

### Fix
- **Rank provvisorio gonfiato (doppio conteggio)** — durante i weekend con più sessioni, il punteggio provvisorio sommava le sessioni anche se il dato live era già il totale cumulativo del weekend, contando due volte qualifica/sprint. Ora si salva il delta di ogni sessione: la classifica provvisoria (e quindi il rank) torna corretta. Coperto da test.

---

## v1.8.0 — 14 Giugno 2026

### Muretto nella Home
- La gestione **Formazione** e **Previsioni** (con i relativi chip) e il **Dettaglio** post-gara ora vivono nella **Home** (il "Muretto"), insieme al recap lega (posizione, punti, gare, media) e alla prossima gara. A weekend iniziato i tab diventano un riassunto in sola lettura.

### LIVE solo live
- La pagina **LIVE** (`/gara`) ora contiene **solo** l'esperienza live: durante la sessione il tab Live (Dashboard / Classifica Gara / Classifica Generale), a sessione finita il provvisorio di fine sessione. Fuori dal weekend mostra un segnaposto.

---

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

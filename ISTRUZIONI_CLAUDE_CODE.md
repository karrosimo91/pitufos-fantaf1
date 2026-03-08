# ISTRUZIONI PER CLAUDE CODE — Los Pitufos FantaF1

Leggi il file CLAUDE.md per il contesto completo del progetto (regolamento, punteggi, API, quotazioni).

## PANORAMICA

Costruisci il sito Los Pitufos FantaF1 con 5 pagine principali + sezione "Altro". 
Design: tema scuro #0a0a12, colore primario #E8002D, font Oswald per titoli, JetBrains Mono per numeri, Inter per testo. Mobile-first. Stile ispirato al prototipo PITWALL.
Navigazione: barra in basso stile app mobile con 5 tab (Dashboard, Gara, Mercato, Classifica, Altro).
Tutto in italiano.

## REGOLE IMPORTANTI

### Salvataggio dati
- Le previsioni di gara NON vengono salvate a database automaticamente. Il giocatore compila le previsioni e quando clicca "Conferma" vengono salvate.
- Stessa cosa per la scuderia: il giocatore sceglie i piloti, il Capitano e gli Aggiornamenti, poi clicca "Conferma" per salvare.
- DOPO aver confermato, il giocatore PUÒ ancora modificare sia le previsioni che la scuderia, fino alla deadline. Ogni modifica richiede un nuovo "Conferma" per essere salvata.
- Dopo la deadline tutto si blocca e non è più modificabile.

### Deadline
- Weekend normali: prima delle qualifiche (sabato)
- Weekend sprint: prima della Sprint Shootout (venerdì)
- Mostra sempre un countdown alla deadline
- Dopo la deadline i campi diventano read-only

---

## PAGINA 1: DASHBOARD (home, route: /)

La prima cosa che il giocatore vede. Risponde a: "a che punto sono e cosa devo fare?"

### Parte alta — Riepilogo personale
- Nome Scuderia + nome Team Principal
- Card con: Punti totali, Posizione in classifica, Gare giocate, Media punti per weekend

### Parte centrale — Prossima gara / Gara in corso
- Card con bandiera paese, nome GP, circuito, date del weekend
- Se NON c'è gara in corso: countdown al prossimo weekend
- Se c'è gara in corso: badge LIVE rosso pulsante + bottone "Vai alla gara" che porta a /gara
- Se il giocatore non ha ancora confermato formazione e previsioni per il prossimo GP: avviso giallo "Non hai ancora confermato la formazione!" con bottone che porta a /gara

### Parte bassa — La tua scuderia attuale
- I tuoi 5 piloti con nome, team, colore team, prezzo
- Capitano evidenziato con icona corona e bordo rosso
- Budget rimasto su 100 Soldini
- Aggiornamenti disponibili: mostra quanti utilizzi rimangono per ogni Aggiornamento (es. "Boost Mode: 2/2", "Halo: 1/2")

---

## PAGINA 2: GARA (route: /gara)

Questa è la pagina centrale del gioco. Ha 3 stati diversi.

### Header fisso (sempre visibile)
- Round number (es. R1)
- Bandiera paese
- Nome Gran Premio (es. "Australian Grand Prix")
- Nome circuito
- Date del weekend
- Badge LIVE quando c'è sessione in corso
- Layout/silhouette del circuito (opzionale, se troppo complesso saltalo)

### STATO 1: Pre-deadline (prima della deadline)
Tabs: Formazione | Previsioni | Orari

**Tab Formazione:**
- I tuoi 5 piloti attuali con possibilità di cambiare (link al Mercato)
- Selezione Capitano: radio button su uno dei 5 piloti, evidenziato con corona
- Selezione Aggiornamento Piloti: dropdown con gli Aggiornamenti disponibili (Boost Mode, Halo, Sostituzione in Griglia, Sesto Uomo, Wildcard) oppure "Nessuno". Se seleziona Boost Mode, deve scegliere su quale pilota (diverso dal Capitano). Se seleziona Sesto Uomo, deve scegliere un pilota qualsiasi dalla lista completa.
- Countdown alla deadline ben visibile
- Bottone "CONFERMA FORMAZIONE" in basso, grande e rosso
- Dopo la conferma: mostra "Formazione confermata ✓" ma permette ancora di modificare fino alla deadline

**Tab Previsioni:**
- Le 6 previsioni con toggle SI/NO:
  - Safety Car in gara
  - Virtual Safety Car in gara
  - Red Flag in gara
  - Gomme wet/full wet usate in gara
  - Pilota in pole vince la gara
  - Numero ritiri (DNF): input numerico (0-22)
- Per ogni previsione mostra i punti possibili (es. "SI: +4 | NO: +6")
- Selezione Aggiornamento Previsioni: dropdown (Previsione Sicura, Previsione Doppia, Previsione Tardiva) oppure "Nessuno". Se seleziona Previsione Sicura o Doppia, deve scegliere a quale previsione applicarlo.
- Countdown alla deadline
- Bottone "CONFERMA PREVISIONI" in basso, grande e rosso
- Dopo la conferma: mostra "Previsioni confermate ✓" ma permette ancora di modificare fino alla deadline

**Tab Orari:**
- Lista sessioni del weekend divise per giorno (Venerdì, Sabato, Domenica)
- Per ogni sessione: nome (FP1, FP2, FP3, Qualifying, Sprint Shootout, Sprint, Race), orario, stato (completata / in corso / da fare)
- Noi NON assegniamo punti per le prove libere, ma mostriamo gli orari

### STATO 2: Live (durante una sessione)
Tabs: Live | Previsioni | Classifica Weekend

**Tab Live:**
- Posizioni dei tuoi 5 piloti evidenziati nella classifica generale
- Colore del team a fianco di ogni pilota
- Il Capitano evidenziato con corona + "(x2)" accanto ai punti
- Punteggio provvisorio della tua scuderia che si aggiorna
- Se hai attivato Boost Mode: il pilota boostato mostra "(x3)"
- Sezione previsioni live: le 6 previsioni con stato che si aggiorna. Quando esce la Safety Car → la riga Safety Car si illumina di verde per chi ha detto SI, rosso per chi ha detto NO. Stessa logica per VSC, Red Flag, ecc.
- Feed messaggi race control in basso (Safety Car, bandiere, penalità)

**Tab Previsioni:**
- Le tue previsioni confermate (read-only dopo la deadline)
- Stato attuale di ognuna: accaduto / non accaduto / in attesa

**Tab Classifica Weekend:**
- Ranking provvisorio di tutti i giocatori per questo weekend
- La tua posizione evidenziata
- Punti provvisori di ognuno

### STATO 3: Post-gara (dopo la bandiera a scacchi)
Tabs: Risultati | Classifica Weekend | Punteggi dettaglio

**Tab Risultati:**
- Riepilogo del tuo weekend: punteggio totale, posizione nel weekend
- I tuoi 5 piloti con dettaglio punti (punti qualifica + punti gara + bonus/malus)
- Il Capitano con punti raddoppiati evidenziati
- Le tue 6 previsioni: giusta ✓ / sbagliata ✗ con punti ottenuti
- Aggiornamento usato e il suo effetto

**Tab Classifica Weekend:**
- Ranking definitivo dei giocatori per questo weekend
- Top 10 evidenziati (quelli che prendono punti Classifica Reale: 25-18-15-12-10-8-6-4-2-1)

**Tab Punteggi dettaglio:**
- Breakdown completo: punti qualifica + punti sprint (se c'era) + punti gara + bonus/malus + previsioni + aggiornamenti = totale weekend

---

## PAGINA 3: MERCATO (route: /mercato)

### Header
- Budget disponibile: "XX / 100 Soldini"
- Slot piloti: "X / 5 piloti"
- Cambi rimasti: "X / 2 cambi gratuiti" (se ha fatto più di 2 cambi: "Cambio extra: -10 punti!")

### Lista piloti
- Tutti i 22 piloti in una lista
- Per ogni pilota: foto/avatar, nome, team (con colore team), prezzo in Soldini
- Filtri: per team, per fascia di prezzo, ordina per prezzo/nome
- Se il pilota è già nella tua scuderia: bottone "Vendi" (rosso)
- Se il pilota non è nella tua scuderia: bottone "Compra" (verde), disabilitato se non hai budget o slot

### Quotazioni piloti (da CLAUDE.md)
Verstappen 36, Norris 37, Russell 32, Piastri 33, Leclerc 30, Hamilton 28, Antonelli 23, Hadjar 15, Gasly 14, Sainz 14, Albon 13, Alonso 12, Stroll 10, Bearman 11, Ocon 11, Hulkenberg 10, Lawson 13, Bortoleto 9, Lindblad 9, Colapinto 8, Perez 8, Bottas 8.

### Team dei piloti
Red Bull: Verstappen, Hadjar
McLaren: Norris, Piastri
Mercedes: Russell, Antonelli
Ferrari: Leclerc, Hamilton
Alpine: Gasly, Colapinto
Williams: Sainz, Albon
Aston Martin: Alonso, Stroll
Haas: Ocon, Bearman
Kick Sauber: Hulkenberg, Bortoleto
Racing Bulls: Lawson, Lindblad
Cadillac: Perez, Bottas

---

## PAGINA 4: CLASSIFICA (route: /classifica)

### Toggle in alto: "Somma Punti" | "Classifica Reale"

### Tab Somma Punti (default, classifica principale)
- La tua posizione evidenziata in alto con bordo colorato, separata dalla lista
- Mostra: media punti, miglior posizione weekend, gare disputate
- Lista tutti i giocatori ordinati per punti totali
- Per ogni giocatore: posizione, nome Scuderia, @nome Team Principal, punti totali, punti ultimo weekend

### Tab Classifica Reale
- Stessa struttura ma ordinata per punti della Classifica Reale
- Ricorda: ogni weekend il top 10 dei giocatori prende punti F1 (25-18-15-12-10-8-6-4-2-1)

---

## PAGINA 5: ALTRO (route: /altro)

Menu con link a:

### Campionati (/campionati)
- **Crea un campionato:** form con nome campionato + toggle pubblico/privato + selezione range gare (da round X a round Y) → genera codice invito da condividere
- **Unisciti con codice:** input per inserire codice e unirsi
- Lista dei tuoi campionati attivi

### Info / Regolamento (/info)
- Sezione Punteggi: divisa per sessione (Qualifica GP, Sprint Shootout, Sprint Race, Gara, Bonus/Malus) con tutti i punti del regolamento
- Sezione Previsioni: tabella con punti SI/NO per ognuna delle 6 previsioni
- Sezione Aggiornamenti: lista di tutti i 7 Aggiornamenti con spiegazione, categoria (Piloti/Previsioni), numero utilizzi, scadenza
- Sezione Regole base: budget 100 Soldini, 5 piloti, Primo Pilota x2, mercato (2 cambi gratis, -10 per extra), deadline, doppia classifica
- Sezione Bonus Automatici: All-in Previsioni + Weekend Perfetto

### Profilo (/profilo)
- Modifica nome Team Principal e nome Scuderia
- Email
- Logout

---

## DATI E API

### OpenF1 (api.openf1.org/v1)
Usa per: calendario sessioni, risultati, posizioni live, race control, stints, laps, drivers, classifiche mondiali.
Dati storici: gratis, no auth.
Dati live: richiedono abbonamento (per ora usa i dati storici, il live lo aggiungiamo dopo).

### Jolpica (api.jolpi.ca/ergast/f1)
Usa per: calendario completo con orari sessioni, classifiche piloti/costruttori.

### Supabase
Usa per: autenticazione utenti, profili, scuderia piloti, previsioni, classifiche giocatori, campionati.

---

## REGOLA VISIBILITÀ AVVERSARI

- Le scuderie (piloti, Capitano) e le previsioni degli altri giocatori NON sono visibili prima della deadline.
- Ogni giocatore vede solo le proprie scelte fino alla deadline.
- DOPO la deadline tutto diventa visibile: puoi vedere le scuderie e le previsioni di tutti gli avversari.
- Nella classifica weekend (durante il live e post-gara) si vedono i punti ma i dettagli delle scelte sono visibili solo dopo la deadline.

---

## NOTE TECNICHE

- Next.js App Router con Tailwind CSS
- Supabase per auth e database (le chiavi sono già in .env.local)
- Tutte le pagine richiedono autenticazione tranne la landing page (/) e /info
- Mobile-first: tutto deve funzionare bene su telefono
- Usa i Google Fonts: Oswald (titoli), JetBrains Mono (numeri/dati), Inter (testo)
- Colori team F1 da usare ovunque ci sia riferimento a un team
- Icone: usa lucide-react o emoji
- Animazioni: sottili, non esagerate. Pulsazione per LIVE badge, transizioni morbide tra tab

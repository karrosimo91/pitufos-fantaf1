# Los Pitufos FantaF1

## Progetto
Fantasy F1 ibrido: fantasy manager (scuderia piloti con budget) + pronostici (previsioni su eventi di gara). Aperto a tutti, gratuito.

## Stack
- **Frontend:** Next.js + Tailwind CSS
- **Hosting:** Vercel (deploy automatico da GitHub)
- **API dati F1:** OpenF1 (api.openf1.org) per dati live e storici + Jolpica (api.jolpi.ca/ergast/f1) per classifiche e calendario
- **Dati live:** OpenF1 abbonamento €9.90/mese, connessione WebSocket per real-time durante le gare
- **Repo:** github.com/karrosimo91/pitufos-fantaf1

## Regolamento v0.1 — Elementi confermati

### Struttura
- Ogni giocatore si chiama "Team Principal"
- Ogni squadra si chiama "Scuderia"
- Budget: 100 "Soldini" (crediti di gioco)
- 5 piloti per scuderia
- Quotazioni iniziali basate sul Fantasy F1 ufficiale ($1M = 1 Soldino)
- Quotazioni variano dopo ogni GP
- Mercato ibrido: compravendita con quotazioni variabili + limite di cambi per weekend
- Aperto a tutti
- Stagione 2026: 24 GP, 6 weekend sprint, 22 piloti, 11 scuderie

### Primo Pilota (Capitano)
- Ogni weekend scegli obbligatoriamente 1 pilota come Primo Pilota
- Punteggio x2 (bonus E malus)
- Se il Primo Pilota fa DNF (-15), il malus raddoppiato diventa -30

### Punteggi Qualifica GP
- Pole: +8
- P2: +6
- P3: +5
- P4-P5: +4
- P6-P10 (resto Q3): +3
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
- P1: +8, P2: +7, P3: +6, P4: +5, P5: +4, P6: +3, P7: +2, P8: +1, P9-P22: 0
- Giro veloce sprint: +2
- DNF sprint: -10
- NO posizioni guadagnate/perse in sprint

### Punteggi Gara (Gran Premio)
- P1: +25, P2: +18, P3: +15, P4: +12, P5: +10, P6: +8, P7: +6, P8: +4, P9: +2, P10: +1, P11-P22: 0
- Posizione guadagnata vs griglia: +1 per posizione
- Posizione persa vs griglia: -0.5 per posizione
- Giro veloce: +3
- Driver of the Day: +5
- DNF/Ritiro: -15
- Penalità in gara/post gara: -5

### Previsioni (6 per weekend)
Punti differenziati SI vs NO (evento raro premia di più):
- Safety Car: SI +4 / NO +6 / Sbagliata 0
- Virtual Safety Car: SI +5 / NO +5 / Sbagliata 0
- Red Flag: SI +7 / NO +3 / Sbagliata 0
- Gomme wet usate: SI +8 / NO +2 / Sbagliata 0
- Pole vince la gara: SI +3 / NO +7 / Sbagliata 0
- Numero DNF esatto: +8 se indovini / 0 se sbagli

### Aggiornamenti (Chip) — dalla fabbrica
Ogni chip ha 2 utilizzi: 1 prima della pausa estiva, 1 dopo. Se non lo usi, scade.
Regola: max 1 Aggiornamento Piloti + max 1 Aggiornamento Previsioni per weekend.

**Aggiornamenti Piloti:**
- **Boost Mode (x3):** un pilota DIVERSO dal Primo Pilota fa x3 per tutto il weekend
- **Halo:** se un tuo pilota va in negativo, il minimo è 0 punti
- **Sostituzione in Griglia:** 1 cambio squadra post-qualifica senza penalità
- **Sesto Uomo:** aggiungi un 6° pilota temporaneo per un weekend (qualsiasi pilota)

**Aggiornamenti Previsioni:**
- **Previsione Sicura:** 1 previsione dà punti comunque (indovini o no)
- **Previsione Doppia:** punti x2 su 1 previsione
- **Previsione Tardiva:** cambi 1 previsione dopo le qualifiche

### Bonus Automatici
- **All-in Previsioni:** tutte e 6 le previsioni giuste = bonus automatico (punteggio DA DEFINIRE)
- **Weekend Perfetto:** Primo Pilota vince + tutte previsioni giuste = super bonus (punteggio DA DEFINIRE)

### Deadline
- Weekend normali: prima delle qualifiche (sabato) — hai visto FP1, FP2, FP3
- Weekend sprint: prima della Sprint Shootout (venerdì) — hai visto solo FP1
- Si blocca tutto insieme: formazione, Primo Pilota, chip, previsioni

### Doppia Classifica
1. **Classifica Somma Punti (PRINCIPALE):** somma totale di tutti i punti weekend dopo weekend. Include tutto.
2. **Classifica Reale:** ogni weekend i giocatori vengono classificati per punteggio. Top 10 prendono punti F1 (25-18-15-12-10-8-6-4-2-1), gli altri 0.

## Punti aperti (da definire col team)
1. Costruttori: aggiungere 1 costruttore? Se sì, ricalibrazione budget
2. Gestione mercato: numero cambi gratuiti (1, 2 o 3), accumulo, penalità extra
3. Wildcard: se cambi limitati, entra come Aggiornamento?
4. Budget definitivo: 100 Soldini base, ricalcolo se costruttori
5. All-in Previsioni: punteggio bonus
6. Weekend Perfetto: punteggio super bonus
7. Scudo Capitano: Primo Pilota x2 solo sui bonus? Aggiornamento extra?
8. Algoritmo variazione quotazioni piloti post-GP

## Quotazioni Piloti 2026 (confermate)
Budget: 100 Soldini, 5 piloti per scuderia.

| Pilota | Team | Soldini |
|--------|------|---------|
| Norris | McLaren | 37 |
| Verstappen | Red Bull | 36 |
| Piastri | McLaren | 33 |
| Russell | Mercedes | 32 |
| Leclerc | Ferrari | 30 |
| Hamilton | Ferrari | 28 |
| Antonelli | Mercedes | 23 |
| Hadjar | Red Bull | 15 |
| Gasly | Alpine | 14 |
| Sainz | Williams | 14 |
| Lawson | Racing Bulls | 13 |
| Albon | Williams | 13 |
| Alonso | Aston Martin | 12 |
| Bearman | Haas | 11 |
| Ocon | Haas | 11 |
| Hulkenberg | Audi | 10 |
| Stroll | Aston Martin | 10 |
| Bortoleto | Audi | 9 |
| Lindblad | Racing Bulls | 9 |
| Colapinto | Alpine | 8 |
| Perez | Cadillac | 8 |
| Bottas | Cadillac | 8 |

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

## Design
- Tema scuro, colore primario #E8002D (rosso F1)
- Font: Oswald per titoli, JetBrains Mono per numeri, Inter per testo
- Mobile-first
- Stile ispirato al prototipo "PITWALL" già creato

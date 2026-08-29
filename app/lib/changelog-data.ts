// Changelog strutturato — fonte di verità per la pagina /changelog
// Mantenere allineato con CHANGELOG.md

export interface ChangelogSection {
  title: string;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string;
  summary?: string;
  sections: ChangelogSection[];
}

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: "v1.9.0",
    date: "29 Agosto 2026",
    summary: "Nuova pagina Statistiche con grafici, e il dettaglio degli altri Team Principal finalmente completo e scorrevole.",
    sections: [
      {
        title: "Statistiche e grafici",
        items: [
          "Nuova pagina Statistiche (Altro → Statistiche): andamento del campionato round per round, in punti cumulati o in posizione, con confronto diretto contro un avversario a scelta.",
          "Testa a testa: quanti weekend hai vinto contro l'avversario selezionato e il distacco in classifica.",
          "Rendimento di ogni Team Principal: GP disputati, weekend vinti, podi, media a GP, miglior punteggio e punti totali.",
          "Piazzamenti weekend (quante volte 1°, 2°, 3°) con i punti della Classifica Reale (25-18-15-12-10-8-6-4-2-1).",
          "Albo dei weekend: chi ha vinto ogni round e con quanti punti.",
          "Weekend per weekend: barre con lo split punti piloti / punti previsioni e il dettaglio (penalità cambi inclusa) al tocco.",
          "Previsioni: percentuale indovinata per evento e classifica dei giocatori più precisi, più gli eventi della stagione, i record della lega e gli aggiornamenti già usati da ognuno.",
          "Ogni grafico ha legenda, valori leggibili al tocco e vista tabella per l'andamento stagionale.",
        ],
      },
      {
        title: "Dettaglio altri giocatori",
        items: [
          "Il dettaglio di un altro Team Principal ora scorre correttamente su mobile: header fisso, corpo scrollabile e blocco dello scroll della pagina sotto.",
          "A gara calcolata si vede tutto quello che ha inserito: rosa completa con Primo Pilota / Boost / Sesto Uomo e punti per pilota, previsioni con la risposta data e l'esito, aggiornamenti usati (con la previsione su cui è stata applicata la Doppia).",
          "Fix: la penalità cambi degli altri giocatori non era mai conteggiata nel dettaglio (mercato_cambi non è leggibile dagli altri), quindi il totale mostrato poteva essere più alto di quello ufficiale. Ora il totale arriva dal punteggio ufficiale del round.",
          "In vista Stagione completa un suggerimento spiega che serve scegliere un round per aprire le squadre degli altri.",
        ],
      },
    ],
  },
  {
    version: "v1.8.1",
    date: "14 Giugno 2026",
    summary: "Fix al punteggio provvisorio nel rank (doppio conteggio delle sessioni).",
    sections: [
      {
        title: "Fix",
        items: [
          "Rank provvisorio gonfiato: nei weekend con più sessioni il provvisorio contava due volte qualifica/sprint. Ora salva il delta di ogni sessione e la classifica torna corretta.",
        ],
      },
    ],
  },
  {
    version: "v1.8.0",
    date: "14 Giugno 2026",
    summary: "Il Muretto (gestione squadra) si sposta nella Home; la pagina LIVE resta solo per il live.",
    sections: [
      {
        title: "Muretto nella Home",
        items: [
          "Gestione Formazione e Previsioni (con i chip) e Dettaglio post-gara ora nella Home, insieme al recap lega e alla prossima gara.",
          "A weekend iniziato i tab diventano un riassunto in sola lettura.",
        ],
      },
      {
        title: "LIVE solo live",
        items: [
          "La pagina LIVE contiene solo l'esperienza live (Dashboard / Classifica Gara / Classifica Generale) e il provvisorio di fine sessione. Fuori dal weekend mostra un segnaposto.",
        ],
      },
    ],
  },
  {
    version: "v1.7.0",
    date: "14 Giugno 2026",
    summary: "Tab Live ridisegnato, /gara con fascia recap e tab Muretto, più fix ai punteggi live.",
    sections: [
      {
        title: "Tab Live ridisegnato",
        items: [
          "Fascia punteggio sempre in cima e tre sotto-tab: Dashboard (tuoi piloti + previsioni live), Classifica Gara (weekend) e Classifica Generale (stagione + punti live).",
        ],
      },
      {
        title: "/gara ridisegnata",
        items: [
          "Fascia recap in alto: posizione, punti totali, media.",
          "Formazione e Previsioni raggruppate nel nuovo tab Muretto (sotto-toggle). Tab principali: Muretto · Live · Dettaglio.",
        ],
      },
      {
        title: "Fix",
        items: [
          "DNF live: i ritiri ora vengono rilevati leggendo il numero auto dal testo del messaggio (prima quasi mai conteggiati).",
          "Pole vince calcolata live deducendo il pole sitter dalla griglia di partenza.",
          "Breakdown Halo/Scudo: i chip valgono sul totale del weekend, il dettaglio pilota ora torna sempre.",
          "Classifica generale: niente più punteggio in tempo reale impreciso, ma il provvisorio di fine sessione (il live vive nel tab Live).",
          "Etichette chip leggibili ovunque.",
        ],
      },
      {
        title: "Sotto il cofano",
        items: [
          "Salvataggio provvisori con throttle (max 1 scrittura/30s): meno carico DB e niente sovrascritture tra client.",
          "Punteggio live su una sola connessione e un solo motore di calcolo.",
        ],
      },
    ],
  },
  {
    version: "v1.6.0",
    date: "14 Giugno 2026",
    summary: "Punteggio live più stabile e affidabile, più aggiustamenti al regolamento chip.",
    sections: [
      {
        title: "Fix",
        items: [
          "Punteggio live che non si aggiornava senza cambiare tab: il Live apriva due connessioni separate alla stessa sessione e i due client si disconnettevano a vicenda. Ora una sola connessione condivisa, il punteggio si aggiorna da solo.",
          "Punteggio in alto diverso da quello in classifica: ora entrambi usano lo stesso identico snapshot live e coincidono sempre.",
          "Live bloccato a zero: se la connessione si apriva ma restava silenziosa, il polling di riserva non si riattivava più. Ora un controllo automatico sulla freschezza dei dati recupera tutto via REST e si rispegne quando il live riprende.",
        ],
      },
      {
        title: "Regolamento",
        items: [
          "Ogni Aggiornamento (chip) è riutilizzabile una sola volta per metà stagione: 1 uso prima della pausa estiva, 1 dopo.",
          "Rimosso il chip \"Previsione Sicura\". Gli usi storici già salvati restano visibili.",
        ],
      },
    ],
  },
  {
    version: "v1.5.0",
    date: "7 Giugno 2026",
    summary: "Penalità di gara finalmente conteggiate (live e post-gara).",
    sections: [
      {
        title: "Fix",
        items: [
          "Penalità di gara ora conteggiate correttamente (-5, una sola volta per pilota). Prima non venivano mai assegnate: OpenF1 lascia vuoto il numero pilota nei messaggi dei commissari e il sistema lo cercava nel campo sbagliato. Ora viene letto dal testo del messaggio. Verificato sui dati reali di Monaco.",
          "Vale sia per il punteggio live durante la gara, sia per il calcolo ufficiale post-gara.",
        ],
      },
      {
        title: "Novità",
        items: [
          "Pannello admin \"Manutenzione penalità\": ricalcola le penalità (e i punteggi) di un singolo GP o di tutti i GP già disputati. Operazione sicura e ripetibile.",
        ],
      },
      {
        title: "Sotto il cofano",
        items: [
          "Rilevamento penalità centralizzato in un unico modulo, coperto da test automatici con i dati reali di Monaco.",
          "Calcolo punteggi del weekend centralizzato e condiviso tra post-gara e ricalcolo (meno duplicazioni).",
        ],
      },
    ],
  },
  {
    version: "v1.4.0",
    date: "22 Maggio 2026",
    summary: "Identità Pitwall, quotazioni dinamiche, fallback live.",
    sections: [
      {
        title: "Design",
        items: [
          "Nuova identità Pitwall: logo PITUFOS. con brand-mark triangolare, palette HUD F1 (nero + accent rosso), griglia tecnica di sfondo, tipografia mono JetBrains su numeri e label.",
          "Nuova icona dell'app (PWA): parallelogramma rosso obliquo + logotipo.",
          "Componenti UI unificati (HudCard, SectionHead, LivePill, Brand) coerenti su tutte le pagine.",
          "Restyling completo di home, /gara, /classifica, /mercato, /dashboard e pagine secondarie.",
        ],
      },
      {
        title: "Novità",
        items: [
          "Quotazioni dinamiche dei piloti: l'algoritmo a fasce CDA è ora attivo. Dopo ogni gara i prezzi cambiano (≥40 pts: +3, 25-39: +2, 10-24: +1, 0-9: 0, -1/-10: -1, ≤-11: -2; range 5-45). Il mercato mostra le quotazioni vigenti.",
          "Fallback polling REST per il live: se WebSocket MQTT non si connette, l'app passa al polling REST ogni 15s. Pillola di stato LIVE / POLLING / OFFLINE.",
          "Podio classifica con label SILVER/GOLD/BRONZE e shadow sul leader.",
          "Pagina /debug ammodernata con input ADMIN_API_KEY persistente.",
        ],
      },
      {
        title: "Fix",
        items: [
          "Bug \"live a 0\": logging strutturato + fallback automatico al polling.",
          "Logica scoring centralizzata: eliminate duplicazioni che potevano causare punteggi divergenti tra le viste.",
          "Race condition su cambio sessione live (fetch ora abortiti correttamente).",
        ],
      },
      {
        title: "Sotto il cofano",
        items: [
          "Refactor LiveTab da 935 a 206 righe (-78%), zero duplicazioni scoring.",
          "91 test automatici su scoring e logica live: ogni modifica al regolamento è coperta da test di regressione.",
          "Database: indici parziali per accelerare il live, RLS hardening su classifica_totale, nuova tabella driver_prices.",
        ],
      },
    ],
  },
  {
    version: "v1.3.0",
    date: "29 Marzo 2026",
    sections: [
      {
        title: "Novità",
        items: [
          "Breakdown punteggio pilota: clicca su un pilota per vedere il dettaglio (posizione, giro veloce, pos. guadagnate/perse, moltiplicatore).",
        ],
      },
    ],
  },
  {
    version: "v1.2.1",
    date: "29 Marzo 2026",
    sections: [
      {
        title: "Fix",
        items: [
          "Previsioni live colorate correttamente (verde se corretta, rosso se sbagliata).",
          "Classifica weekend live include punti previsioni per tutti i giocatori.",
          "Previsioni visibili nel modal dettaglio giocatore.",
          "Modal dettaglio giocatore scrollabile su mobile.",
        ],
      },
    ],
  },
  {
    version: "v1.2.0",
    date: "28 Marzo 2026",
    sections: [
      {
        title: "Novità",
        items: [
          "Dettaglio giocatore live: clicca su un giocatore nella classifica weekend per vedere i punti live dei suoi piloti.",
          "Punteggi provvisori persistenti: dopo la sessione i punteggi restano visibili con badge PROVVISORIO finché l'admin non calcola i risultati ufficiali.",
          "Classifica stagione live: la pagina Classifica si aggiorna con i punti provvisori del weekend.",
          "Mercato bloccato durante sessioni live.",
        ],
      },
      {
        title: "Fix",
        items: [
          "Fix autenticazione OpenF1 e CORS (proxy server-side).",
          "Classifica weekend filtrata per lega preferita.",
        ],
      },
    ],
  },
  {
    version: "v1.1.1",
    date: "28 Marzo 2026",
    sections: [
      {
        title: "Fix",
        items: [
          "Live scoring: fix autenticazione OpenF1 e CORS (proxy server-side).",
          "Mercato bloccato durante sessioni live.",
        ],
      },
    ],
  },
  {
    version: "v1.1.0",
    date: "27 Marzo 2026",
    sections: [
      {
        title: "Novità",
        items: [
          "Classifica weekend live: ranking provvisorio di tutti i giocatori aggiornato in tempo reale durante le sessioni.",
        ],
      },
    ],
  },
  {
    version: "v1.0.0",
    date: "27 Marzo 2026",
    summary: "Prima release stabile.",
    sections: [
      {
        title: "Novità",
        items: [
          "Aggiornamento regolamento e punteggi secondo voti CDA v1 e v2.",
          "Scudo Capitano: nuovo Aggiornamento Piloti (Capitano x2 solo bonus, malus x1).",
          "Live scoring: dati in tempo reale via WebSocket OpenF1 durante tutte le sessioni.",
        ],
      },
    ],
  },
];

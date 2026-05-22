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

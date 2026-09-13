import { NextResponse } from "next/server";

/**
 * POST /api/fetch-risultati — RITIRATA.
 *
 * Era un secondo percorso per scaricare i risultati e salvarli in
 * weekend_results, duplicato di `/api/post-gara` ma con logica più debole:
 *   - qualifica presa dal feed `position` invece che da `session_result`;
 *   - ritiri dedotti solo dai messaggi `race_control` con `driver_number`
 *     valorizzato, che OpenF1 spesso lascia null: risultato, gare salvate con
 *     zero DNF;
 *   - griglia anche da Jolpica, che numera i round saltando le gare
 *     cancellate e quindi restituisce un'altra gara;
 *   - nessun controllo sulla prontezza dei dati.
 *
 * Non era chiamata da nessuna parte dell'app. Tenerla viva significava avere
 * una seconda porta da cui far entrare punteggi sbagliati, quindi è chiusa:
 * il calcolo passa solo da `/api/post-gara`, che verifica i risultati
 * ufficiali prima di scrivere (vedi lib/official-results.ts).
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Endpoint ritirato. Usa /api/post-gara (stesso body, più il campo session: 'qualifying' | 'sprint_shootout' | 'sprint' | 'race'), che controlla i risultati ufficiali OpenF1 prima di salvare.",
    },
    { status: 410 },
  );
}

import { NextResponse } from "next/server";

/**
 * POST /api/calcola-risultati — RITIRATA.
 *
 * Calcolava i punteggi da weekend_results con una copia propria della logica
 * (senza penalità cambi) e sommava i punti Classifica Reale a ogni chiamata.
 * Non era chiamata da nessuna parte dell'app. Il calcolo passa solo da
 * `/api/post-gara`.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Endpoint ritirato. Usa /api/post-gara." },
    { status: 410 },
  );
}

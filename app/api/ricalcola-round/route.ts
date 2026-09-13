import { NextResponse } from "next/server";

/**
 * POST /api/ricalcola-round — RITIRATA.
 *
 * Ricalcolava i punteggi di un round con una copia propria della logica di
 * calcolo, diversa da quella vera: ignorava la penalità cambi e sommava i
 * punti Classifica Reale senza sottrarre quelli già dati. Non era chiamata da
 * nessuna parte dell'app. Per ricalcolare un round si rilancia la sessione da
 * `/api/post-gara` (idempotente) oppure `/api/recalc-penalties`.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Endpoint ritirato. Rilancia la sessione da /api/post-gara: il ricalcolo è idempotente." },
    { status: 410 },
  );
}

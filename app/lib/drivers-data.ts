// Quotazioni iniziali 2026 basate su Fantasy F1 ufficiale ($1M = 1 Soldino)
// Prezzi stimati - da aggiornare quando escono quelli ufficiali 2026
export const DRIVER_PRICES: Record<number, number> = {
  1: 30,   // Verstappen
  44: 28,  // Hamilton
  16: 26,  // Leclerc
  4: 25,   // Norris
  63: 22,  // Russell
  81: 20,  // Piastri
  14: 18,  // Alonso
  55: 17,  // Sainz
  11: 15,  // Perez
  10: 14,  // Gasly
  22: 13,  // Tsunoda
  23: 12,  // Albon
  18: 11,  // Stroll
  27: 10,  // Hulkenberg
  77: 9,   // Bottas
  31: 8,   // Ocon
  87: 7,   // Bearman
  43: 6,   // Colapinto
  7: 6,    // Hadjar
  61: 5,   // Doohan
  30: 5,   // Lawson
  12: 5,   // Antonelli
};

export function getDriverPrice(driverNumber: number): number {
  return DRIVER_PRICES[driverNumber] ?? 5;
}

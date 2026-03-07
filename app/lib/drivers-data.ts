export interface DriverData {
  number: number;
  name: string;
  team: string;
  teamColour: string;
  country: string;
  price: number;
}

// Piloti stagione 2026 — quotazioni confermate
export const DRIVERS_2026: DriverData[] = [
  { number: 4, name: "Lando Norris", team: "McLaren", teamColour: "FF8000", country: "GB", price: 37 },
  { number: 1, name: "Max Verstappen", team: "Red Bull", teamColour: "3671C6", country: "NL", price: 36 },
  { number: 81, name: "Oscar Piastri", team: "McLaren", teamColour: "FF8000", country: "AU", price: 33 },
  { number: 63, name: "George Russell", team: "Mercedes", teamColour: "27F4D2", country: "GB", price: 32 },
  { number: 16, name: "Charles Leclerc", team: "Ferrari", teamColour: "E80020", country: "MC", price: 30 },
  { number: 44, name: "Lewis Hamilton", team: "Ferrari", teamColour: "E80020", country: "GB", price: 28 },
  { number: 12, name: "Andrea Kimi Antonelli", team: "Mercedes", teamColour: "27F4D2", country: "IT", price: 23 },
  { number: 6, name: "Isack Hadjar", team: "Red Bull", teamColour: "3671C6", country: "FR", price: 15 },
  { number: 10, name: "Pierre Gasly", team: "Alpine", teamColour: "0093CC", country: "FR", price: 14 },
  { number: 55, name: "Carlos Sainz", team: "Williams", teamColour: "1868DB", country: "ES", price: 14 },
  { number: 30, name: "Liam Lawson", team: "Racing Bulls", teamColour: "6692FF", country: "NZ", price: 13 },
  { number: 23, name: "Alex Albon", team: "Williams", teamColour: "1868DB", country: "TH", price: 13 },
  { number: 14, name: "Fernando Alonso", team: "Aston Martin", teamColour: "229971", country: "ES", price: 12 },
  { number: 87, name: "Oliver Bearman", team: "Haas", teamColour: "B6BABD", country: "GB", price: 11 },
  { number: 31, name: "Esteban Ocon", team: "Haas", teamColour: "B6BABD", country: "FR", price: 11 },
  { number: 27, name: "Nico Hulkenberg", team: "Kick Sauber", teamColour: "52E252", country: "DE", price: 10 },
  { number: 18, name: "Lance Stroll", team: "Aston Martin", teamColour: "229971", country: "CA", price: 10 },
  { number: 5, name: "Gabriel Bortoleto", team: "Kick Sauber", teamColour: "52E252", country: "BR", price: 9 },
  { number: 2, name: "Arvid Lindblad", team: "Racing Bulls", teamColour: "6692FF", country: "GB", price: 9 },
  { number: 43, name: "Franco Colapinto", team: "Alpine", teamColour: "0093CC", country: "AR", price: 8 },
  { number: 11, name: "Sergio Perez", team: "Cadillac", teamColour: "FFD700", country: "MX", price: 8 },
  { number: 77, name: "Valtteri Bottas", team: "Cadillac", teamColour: "FFD700", country: "FI", price: 8 },
];

export function getDriverByNumber(num: number): DriverData | undefined {
  return DRIVERS_2026.find((d) => d.number === num);
}

export function getDriverPrice(driverNumber: number): number {
  return DRIVERS_2026.find((d) => d.number === driverNumber)?.price ?? 5;
}

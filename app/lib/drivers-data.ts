export interface DriverData {
  number: number;
  name: string;
  team: string;
  teamColour: string;
  country: string;
  price: number;
}

// Piloti stagione 2026 con quotazioni ($1M Fantasy F1 = 1 Soldino)
export const DRIVERS_2026: DriverData[] = [
  { number: 1, name: "Max Verstappen", team: "Red Bull Racing", teamColour: "3671C6", country: "NL", price: 30 },
  { number: 44, name: "Lewis Hamilton", team: "Ferrari", teamColour: "E80020", country: "GB", price: 28 },
  { number: 16, name: "Charles Leclerc", team: "Ferrari", teamColour: "E80020", country: "MC", price: 26 },
  { number: 4, name: "Lando Norris", team: "McLaren", teamColour: "FF8000", country: "GB", price: 25 },
  { number: 63, name: "George Russell", team: "Mercedes", teamColour: "27F4D2", country: "GB", price: 22 },
  { number: 81, name: "Oscar Piastri", team: "McLaren", teamColour: "FF8000", country: "AU", price: 20 },
  { number: 14, name: "Fernando Alonso", team: "Aston Martin", teamColour: "229971", country: "ES", price: 18 },
  { number: 55, name: "Carlos Sainz", team: "Williams", teamColour: "1868DB", country: "ES", price: 17 },
  { number: 11, name: "Sergio Perez", team: "Red Bull Racing", teamColour: "3671C6", country: "MX", price: 15 },
  { number: 10, name: "Pierre Gasly", team: "Alpine", teamColour: "0093CC", country: "FR", price: 14 },
  { number: 22, name: "Yuki Tsunoda", team: "RB", teamColour: "6692FF", country: "JP", price: 13 },
  { number: 23, name: "Alex Albon", team: "Williams", teamColour: "1868DB", country: "TH", price: 12 },
  { number: 18, name: "Lance Stroll", team: "Aston Martin", teamColour: "229971", country: "CA", price: 11 },
  { number: 27, name: "Nico Hulkenberg", team: "Sauber", teamColour: "52E252", country: "DE", price: 10 },
  { number: 77, name: "Valtteri Bottas", team: "Sauber", teamColour: "52E252", country: "FI", price: 9 },
  { number: 31, name: "Esteban Ocon", team: "Haas", teamColour: "B6BABD", country: "FR", price: 8 },
  { number: 87, name: "Oliver Bearman", team: "Haas", teamColour: "B6BABD", country: "GB", price: 7 },
  { number: 12, name: "Andrea Kimi Antonelli", team: "Mercedes", teamColour: "27F4D2", country: "IT", price: 7 },
  { number: 43, name: "Franco Colapinto", team: "Alpine", teamColour: "0093CC", country: "AR", price: 6 },
  { number: 7, name: "Jack Doohan", team: "Alpine", teamColour: "0093CC", country: "AU", price: 5 },
  { number: 30, name: "Liam Lawson", team: "RB", teamColour: "6692FF", country: "NZ", price: 5 },
  { number: 6, name: "Isack Hadjar", team: "RB", teamColour: "6692FF", country: "FR", price: 5 },
];

export function getDriverByNumber(num: number): DriverData | undefined {
  return DRIVERS_2026.find((d) => d.number === num);
}

export function getDriverPrice(driverNumber: number): number {
  return DRIVERS_2026.find((d) => d.number === driverNumber)?.price ?? 5;
}

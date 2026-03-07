// Tipi per le tabelle Supabase

export interface DbScuderia {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface DbScuderiaDriver {
  id: string;
  scuderia_id: string;
  driver_number: number;
  name: string;
  team: string;
  team_colour: string;
  price: number;
  is_primo_pilota: boolean;
  created_at: string;
}

export interface DbPrevisione {
  id: string;
  user_id: string;
  round: number;
  safety_car: boolean | null;
  virtual_safety_car: boolean | null;
  red_flag: boolean | null;
  gomme_wet: boolean | null;
  pole_vince: boolean | null;
  numero_dnf: number | null;
  chip_attivo: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbProfile {
  id: string;
  email: string;
  team_principal_name: string;
  scuderia_name: string;
  created_at: string;
}

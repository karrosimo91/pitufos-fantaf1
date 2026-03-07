-- ═══════════════════════════════════════════
-- Migrazione v0.7 — Esegui su Supabase SQL Editor
-- ═══════════════════════════════════════════

-- Fix trigger registrazione: legge nomi dai metadata
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, team_principal_name, scuderia_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'team_principal_name', 'Team Principal'),
    coalesce(new.raw_user_meta_data->>'scuderia_name', 'La Mia Scuderia')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Campo conferma squadra (se non esiste gia)
alter table profiles add column if not exists scuderia_confirmed boolean default false;

-- Campo conferma previsioni (se non esiste gia)
alter table previsioni add column if not exists confirmed boolean default false;

-- Tabella risultati weekend (inserita dall'admin dopo ogni GP)
create table if not exists weekend_results (
  id uuid default gen_random_uuid() primary key,
  round int not null unique,
  data jsonb not null,
  created_at timestamptz default now()
);

alter table weekend_results enable row level security;
create policy "Anyone can view weekend_results" on weekend_results for select using (true);
create policy "Authenticated can insert weekend_results" on weekend_results for insert with check (auth.uid() is not null);
create policy "Authenticated can update weekend_results" on weekend_results for update using (auth.uid() is not null);

-- Policy per leggere i profili nella classifica (tutti vedono tutti)
drop policy if exists "Users can view own profile" on profiles;
create policy "Anyone can view profiles" on profiles for select using (true);

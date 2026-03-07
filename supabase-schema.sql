-- ═══════════════════════════════════════════
-- Los Pitufos FantaF1 — Schema Database
-- Esegui questo SQL nella Supabase SQL Editor
-- ═══════════════════════════════════════════

-- Profili utente
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  team_principal_name text not null default 'Team Principal',
  scuderia_name text not null default 'La Mia Scuderia',
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Trigger: crea profilo automaticamente alla registrazione
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Piloti della scuderia
create table scuderia_drivers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  driver_number int not null,
  name text not null,
  team text not null,
  team_colour text not null default '666666',
  price numeric not null,
  is_primo_pilota boolean default false,
  created_at timestamptz default now(),
  unique(user_id, driver_number)
);

alter table scuderia_drivers enable row level security;
create policy "Users can view own drivers" on scuderia_drivers for select using (auth.uid() = user_id);
create policy "Users can insert own drivers" on scuderia_drivers for insert with check (auth.uid() = user_id);
create policy "Users can update own drivers" on scuderia_drivers for update using (auth.uid() = user_id);
create policy "Users can delete own drivers" on scuderia_drivers for delete using (auth.uid() = user_id);

-- Previsioni per round
create table previsioni (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  round int not null,
  safety_car boolean,
  virtual_safety_car boolean,
  red_flag boolean,
  gomme_wet boolean,
  pole_vince boolean,
  numero_dnf int,
  chip_attivo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, round)
);

alter table previsioni enable row level security;
create policy "Users can view own previsioni" on previsioni for select using (auth.uid() = user_id);
create policy "Users can insert own previsioni" on previsioni for insert with check (auth.uid() = user_id);
create policy "Users can update own previsioni" on previsioni for update using (auth.uid() = user_id);

-- Classifica (calcolata, aggiornata dopo ogni GP)
create table classifica (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  round int not null,
  weekend_points numeric default 0,
  total_points numeric default 0,
  real_points numeric default 0,
  created_at timestamptz default now(),
  unique(user_id, round)
);

alter table classifica enable row level security;
create policy "Anyone can view classifica" on classifica for select using (true);
create policy "Only system can insert classifica" on classifica for insert with check (auth.uid() = user_id);
create policy "Only system can update classifica" on classifica for update using (auth.uid() = user_id);

-- Vista classifica aggregata (per la pagina classifica)
create or replace view classifica_totale as
select
  p.id as user_id,
  p.team_principal_name,
  p.scuderia_name,
  coalesce(sum(c.weekend_points), 0) as total_points,
  coalesce(max(case when c.round = (select max(round) from classifica) then c.weekend_points end), 0) as last_weekend_points,
  coalesce(sum(c.real_points), 0) as real_points
from profiles p
left join classifica c on c.user_id = p.id
group by p.id, p.team_principal_name, p.scuderia_name
order by total_points desc;

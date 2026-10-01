-- JalSuraksha Nepal — real data sources
--
-- 1. Live hydro-met data: DHM river gauges and rain stations (hydrology.gov.np,
--    fetched through the BIPAD portal API). The server syncs them into
--    hydromet_stations; risk zones point at the gauge and rain station that
--    represent them. Writes happen only with the service key (sync job).
-- 2. A global data mode: 'live' (real readings drive risk) or 'simulation'
--    (the demo scenario, for presentations and drills — always labelled).
-- 3. Real reference data: hospitals/health posts, helipads, fire stations
--    (BIPAD), ward boundaries (OpenStreetMap) and candidate shelters, each
--    with its source. Imported candidate shelters stay closed and unverified
--    until staff confirm them and enter a capacity.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
alter table public.app_settings enable row level security;

create policy "app_settings: public read" on public.app_settings
  for select to anon, authenticated using (true);
create policy "app_settings: staff set data mode" on public.app_settings
  for update to authenticated
  using (public.is_staff() and key = 'data_mode')
  with check (public.is_staff() and key = 'data_mode' and value in ('"live"'::jsonb, '"simulation"'::jsonb));

insert into public.app_settings (key, value) values ('data_mode', '"live"');

-- ---------------------------------------------------------------------------
-- Hydro-met stations (latest reading per station) + short history
-- ---------------------------------------------------------------------------
create type public.hydromet_kind as enum ('river', 'rain');

create table public.hydromet_stations (
  id text primary key,                 -- e.g. 'bipad:river:25'
  kind public.hydromet_kind not null,
  name text not null,
  basin text,
  latitude double precision not null,
  longitude double precision not null,
  district_code integer,
  municipality_code integer,
  warning_level_m numeric(8, 3),
  danger_level_m numeric(8, 3),
  water_level_m numeric(8, 3),
  trend text,                          -- RISING / FALLING / STEADY (DHM)
  official_status text,                -- e.g. 'BELOW WARNING LEVEL' (DHM)
  rain_1h_mm numeric(7, 2),
  rain_3h_mm numeric(7, 2),
  rain_6h_mm numeric(7, 2),
  rain_12h_mm numeric(7, 2),
  rain_24h_mm numeric(7, 2),
  observed_at timestamptz,             -- when the station measured it
  fetched_at timestamptz not null default now(),
  data_source text not null default 'DHM (hydrology.gov.np) via BIPAD portal',
  source_url text,
  updated_at timestamptz not null default now()
);
create index hydromet_stations_kind_idx on public.hydromet_stations (kind);
create trigger hydromet_stations_updated_at before update on public.hydromet_stations
  for each row execute function public.set_updated_at();
alter table public.hydromet_stations enable row level security;
create policy "hydromet_stations: public read" on public.hydromet_stations
  for select to anon, authenticated using (true);

create table public.hydromet_readings (
  station_id text not null references public.hydromet_stations (id) on delete cascade,
  observed_at timestamptz not null,
  water_level_m numeric(8, 3),
  rain_1h_mm numeric(7, 2),
  rain_24h_mm numeric(7, 2),
  primary key (station_id, observed_at)
);
alter table public.hydromet_readings enable row level security;
create policy "hydromet_readings: public read" on public.hydromet_readings
  for select to anon, authenticated using (true);

-- Which live stations represent each risk zone.
alter table public.risk_zones
  add column river_station_id text references public.hydromet_stations (id) on delete set null,
  add column rain_station_id text references public.hydromet_stations (id) on delete set null;

-- Automatic alerts raised from official gauge thresholds are tied to their
-- station so they are not duplicated and can be withdrawn when levels drop.
alter table public.alerts add column station_id text references public.hydromet_stations (id) on delete set null;
create unique index alerts_one_active_per_station on public.alerts (station_id) where station_id is not null and is_active;

-- ---------------------------------------------------------------------------
-- Reference data: facilities and ward boundaries
-- ---------------------------------------------------------------------------
create type public.facility_kind as enum ('hospital', 'health_facility', 'helipad', 'fire_station', 'police', 'government');

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  kind public.facility_kind not null,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  phone text,
  ward integer,
  municipality text,
  district text,
  data_source text not null,
  source_ref text not null unique,     -- e.g. 'bipad:resource:11870'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index facilities_kind_idx on public.facilities (kind);
create trigger facilities_updated_at before update on public.facilities
  for each row execute function public.set_updated_at();
alter table public.facilities enable row level security;
create policy "facilities: public read" on public.facilities
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "facilities: admin write" on public.facilities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.wards (
  id text primary key,                 -- e.g. 'bharatpur-10'
  municipality text not null,
  district text not null,
  ward_no integer not null,
  name text not null,
  polygon jsonb not null,              -- [[lat, lng], ...] outer ring
  center_latitude double precision not null,
  center_longitude double precision not null,
  data_source text not null,
  source_ref text,
  updated_at timestamptz not null default now(),
  unique (municipality, ward_no)
);
alter table public.wards enable row level security;
create policy "wards: public read" on public.wards
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Shelters: provenance and verification
-- ---------------------------------------------------------------------------
create type public.verification_status as enum ('verified', 'unverified', 'demo');

alter table public.shelters
  add column verification public.verification_status not null default 'verified',
  add column kind text not null default 'evacuation_centre',
  add column data_source text,
  add column source_ref text unique;

-- An imported candidate has no known capacity yet: allowed only while closed.
alter table public.shelters drop constraint shelters_capacity_check;
alter table public.shelters add constraint shelters_capacity_check
  check (capacity > 0 or (capacity = 0 and not is_active));

update public.shelters set verification = 'demo', data_source = 'Demo dataset' where is_demo;

-- Teams: provenance (demo roster vs real teams entered by admins).
alter table public.rescue_teams add column data_source text;
update public.rescue_teams set data_source = 'Demo dataset' where is_demo;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.hydromet_stations, public.app_settings;

-- JalSuraksha Nepal — core schema
-- Tables, enums, indexes and integrity triggers. RLS policies live in the next
-- migration; workflow functions in the one after.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('citizen', 'operator', 'rescue', 'admin');
create type public.alert_severity as enum ('info', 'watch', 'high', 'danger');
create type public.data_source_type as enum ('official', 'community', 'simulated');
create type public.sos_situation as enum (
  'safe_temporarily', 'water_entering', 'water_rising', 'trapped', 'medical', 'other'
);
create type public.priority_level as enum ('low', 'moderate', 'high', 'critical');
create type public.sos_status as enum (
  'received', 'acknowledged', 'assigned', 'accepted', 'en_route', 'arrived',
  'in_progress', 'resolved', 'cancelled'
);
create type public.assignment_status as enum (
  'assigned', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'
);
create type public.team_status as enum ('available', 'assigned', 'busy', 'offline');
create type public.hazard_type as enum (
  'flooded_road', 'landslide', 'blocked_bridge', 'waterlogging',
  'damaged_infrastructure', 'stranded_people', 'other'
);
create type public.hazard_severity as enum ('low', 'medium', 'high', 'critical');
create type public.hazard_status as enum ('open', 'verified', 'resolved', 'rejected');
create type public.safety_status as enum ('unknown', 'safe', 'evacuated', 'need_help');
create type public.supply_status as enum ('available', 'limited', 'unavailable');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rescue teams (referenced by profiles)
-- ---------------------------------------------------------------------------
create table public.rescue_teams (
  id uuid primary key default gen_random_uuid(),
  call_sign text not null unique,
  name text not null,
  status public.team_status not null default 'available',
  personnel_count integer not null default 4 check (personnel_count between 1 and 50),
  equipment text[] not null default '{}',
  base_location text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  contact_phone text,
  district text not null default 'Chitwan',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rescue_teams_status_idx on public.rescue_teams (status);
create trigger rescue_teams_updated_at before update on public.rescue_teams
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  full_name text,
  role public.app_role not null default 'citizen',
  district text,
  municipality text,
  ward integer check (ward is null or ward between 1 and 40),
  emergency_contact text,
  safety_status public.safety_status not null default 'unknown',
  safety_updated_at timestamptz,
  rescue_team_id uuid references public.rescue_teams (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_rescue_team_idx on public.profiles (rescue_team_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a citizen profile for every new auth user. Role is ALWAYS citizen
-- here; elevated roles are granted by an admin (never from signup metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, full_name)
  values (
    new.id,
    nullif(new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) <= 2000),
  severity public.alert_severity not null,
  district text,
  municipality text,
  river_basin text,
  source text not null,
  source_type public.data_source_type not null default 'simulated',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
create index alerts_active_idx on public.alerts (is_active, created_at desc);
create trigger alerts_updated_at before update on public.alerts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Risk zones (inputs to the transparent rule-based risk engine)
-- ---------------------------------------------------------------------------
create table public.risk_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null,
  municipality text,
  river_basin text not null,
  river_name text,
  -- Polygon as an array of [lat, lng] pairs (kept as jsonb to avoid PostGIS).
  polygon jsonb not null,
  center_latitude double precision not null,
  center_longitude double precision not null,
  radius_m integer not null default 1500 check (radius_m > 0),
  river_level_m numeric(6, 2) not null,
  warning_level_m numeric(6, 2) not null,
  danger_level_m numeric(6, 2) not null,
  rainfall_mm_24h numeric(6, 1) not null default 0,
  distance_to_river_m integer not null default 1000,
  elevation_vulnerability numeric(3, 2) not null default 0.5
    check (elevation_vulnerability between 0 and 1),
  road_access_reduction numeric(3, 2) not null default 0
    check (road_access_reduction between 0 and 1),
  source_type public.data_source_type not null default 'simulated',
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (danger_level_m > warning_level_m)
);
create index risk_zones_basin_idx on public.risk_zones (river_basin);
create trigger risk_zones_updated_at before update on public.risk_zones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Shelters
-- ---------------------------------------------------------------------------
create table public.shelters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  district text not null,
  municipality text not null,
  ward integer,
  capacity integer not null check (capacity > 0),
  current_occupancy integer not null default 0 check (current_occupancy >= 0),
  remaining_capacity integer generated always as (greatest(capacity - current_occupancy, 0)) stored,
  food_status public.supply_status not null default 'available',
  water_status public.supply_status not null default 'available',
  medical_assistance boolean not null default false,
  contact_phone text,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_occupancy <= capacity * 2)
);
create index shelters_active_idx on public.shelters (is_active);
create trigger shelters_updated_at before update on public.shelters
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Community hazard reports
-- ---------------------------------------------------------------------------
create table public.hazard_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  type public.hazard_type not null,
  severity public.hazard_severity not null default 'medium',
  status public.hazard_status not null default 'open',
  description text check (description is null or char_length(description) <= 1000),
  location_name text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  photo_url text,
  confirmation_count integer not null default 0,
  -- Duplicate grouping: reports of the same type within a small radius point at
  -- the first (primary) report.
  duplicate_of uuid references public.hazard_reports (id) on delete set null,
  source_type public.data_source_type not null default 'community',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hazard_reports_status_idx on public.hazard_reports (status, created_at desc);
create index hazard_reports_type_idx on public.hazard_reports (type);
create index hazard_reports_duplicate_idx on public.hazard_reports (duplicate_of);
create index hazard_reports_reporter_idx on public.hazard_reports (reporter_id);
create trigger hazard_reports_updated_at before update on public.hazard_reports
  for each row execute function public.set_updated_at();

create table public.hazard_confirmations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.hazard_reports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);
create index hazard_confirmations_user_idx on public.hazard_confirmations (user_id);

create or replace function public.bump_hazard_confirmation_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.hazard_reports
      set confirmation_count = confirmation_count + 1
      where id = new.report_id;
  elsif tg_op = 'DELETE' then
    update public.hazard_reports
      set confirmation_count = greatest(confirmation_count - 1, 0)
      where id = old.report_id;
  end if;
  return null;
end;
$$;

create trigger hazard_confirmations_count
  after insert or delete on public.hazard_confirmations
  for each row execute function public.bump_hazard_confirmation_count();

-- ---------------------------------------------------------------------------
-- SOS requests
-- ---------------------------------------------------------------------------
create sequence public.sos_reference_seq start with 1001;

create table public.sos_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique
    default ('SOS-NEP-' || lpad(nextval('public.sos_reference_seq')::text, 4, '0')),
  -- Secret used by guests without a session to look up their own SOS status.
  tracking_token uuid not null default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  phone text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location_accuracy_m integer,
  location_name text,
  people_count integer not null default 1 check (people_count between 1 and 200),
  children_count integer not null default 0 check (children_count >= 0),
  elderly_count integer not null default 0 check (elderly_count >= 0),
  injured boolean not null default false,
  situation public.sos_situation not null,
  description text check (description is null or char_length(description) <= 1000),
  photo_path text,
  priority_score integer not null default 0 check (priority_score between 0 and 100),
  priority_level public.priority_level not null default 'low',
  priority_factors jsonb not null default '[]'::jsonb,
  operator_priority_override public.priority_level,
  priority_override_note text,
  effective_priority public.priority_level
    generated always as (coalesce(operator_priority_override, priority_level)) stored,
  status public.sos_status not null default 'received',
  assigned_team_id uuid references public.rescue_teams (id) on delete set null,
  source text not null default 'app' check (source in ('app', 'sms', 'operator')),
  is_demo boolean not null default false,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (children_count + elderly_count <= people_count)
);
create index sos_requests_status_idx on public.sos_requests (status, created_at desc);
create index sos_requests_priority_idx on public.sos_requests (effective_priority, created_at desc);
create index sos_requests_user_idx on public.sos_requests (user_id);
create index sos_requests_phone_idx on public.sos_requests (phone, created_at desc);
create index sos_requests_team_idx on public.sos_requests (assigned_team_id);
create trigger sos_requests_updated_at before update on public.sos_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rescue assignments
-- ---------------------------------------------------------------------------
create table public.rescue_assignments (
  id uuid primary key default gen_random_uuid(),
  sos_id uuid not null references public.sos_requests (id) on delete cascade,
  rescue_team_id uuid not null references public.rescue_teams (id) on delete restrict,
  assigned_by uuid references public.profiles (id) on delete set null,
  status public.assignment_status not null default 'assigned',
  notes text,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  en_route_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rescue_assignments_team_idx on public.rescue_assignments (rescue_team_id, status);
create index rescue_assignments_sos_idx on public.rescue_assignments (sos_id);
-- At most one live assignment per SOS.
create unique index rescue_assignments_one_active_per_sos
  on public.rescue_assignments (sos_id)
  where status not in ('completed', 'cancelled');
create trigger rescue_assignments_updated_at before update on public.rescue_assignments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Incident status history (audit trail + citizen timeline)
-- ---------------------------------------------------------------------------
create table public.incident_status_history (
  id uuid primary key default gen_random_uuid(),
  sos_id uuid not null references public.sos_requests (id) on delete cascade,
  from_status public.sos_status,
  to_status public.sos_status not null,
  changed_by uuid references auth.users (id) on delete set null,
  actor_role text not null default 'system',
  note text,
  created_at timestamptz not null default now()
);
create index incident_status_history_sos_idx on public.incident_status_history (sos_id, created_at);

-- Record the initial "received" entry for every new SOS.
create or replace function public.log_sos_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.incident_status_history (sos_id, from_status, to_status, changed_by, actor_role, note)
  values (new.id, null, new.status, new.user_id, 'citizen', 'Request received');
  return new;
end;
$$;

create trigger sos_requests_log_created
  after insert on public.sos_requests
  for each row execute function public.log_sos_created();

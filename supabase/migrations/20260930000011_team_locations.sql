-- JalSuraksha Nepal — live rescue team positions
--
-- While on a mission the rescue console shares the team's GPS position. Who
-- may see it (RLS):
--  - staff (all teams);
--  - members of that team;
--  - the citizen whose OPEN SOS that team is actively assigned to — nobody
--    else, and only during the mission. Guests without a session get it via
--    /api/sos/track, which checks the SOS tracking token server-side.
-- One row per team (latest position); writes only by members of the team.

create table public.team_locations (
  team_id uuid primary key references public.rescue_teams (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m integer check (accuracy_m >= 0),
  heading_deg integer check (heading_deg between 0 and 359),
  speed_mps numeric(6, 2) check (speed_mps >= 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger team_locations_updated_at before update on public.team_locations
  for each row execute function public.set_updated_at();
alter table public.team_locations enable row level security;

create policy "team_locations: staff read" on public.team_locations
  for select to authenticated using (public.is_staff());

create policy "team_locations: team read" on public.team_locations
  for select to authenticated using (team_id = public.current_rescue_team_id());

create policy "team_locations: sos owner read during mission" on public.team_locations
  for select to authenticated
  using (
    exists (
      select 1
      from public.rescue_assignments a
      join public.sos_requests s on s.id = a.sos_id
      where a.rescue_team_id = team_locations.team_id
        and a.status in ('assigned', 'accepted', 'en_route', 'arrived', 'in_progress')
        and s.status not in ('resolved', 'cancelled')
        and s.user_id = (select auth.uid())
    )
  );

create policy "team_locations: team insert own" on public.team_locations
  for insert to authenticated
  with check (team_id = public.current_rescue_team_id() and updated_by = (select auth.uid()));

create policy "team_locations: team update own" on public.team_locations
  for update to authenticated
  using (team_id = public.current_rescue_team_id())
  with check (team_id = public.current_rescue_team_id() and updated_by = (select auth.uid()));

alter publication supabase_realtime add table public.team_locations;

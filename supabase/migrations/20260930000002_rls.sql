-- JalSuraksha Nepal — Row Level Security
-- Default deny on every table. Roles are read from public.profiles, never from
-- client-supplied values or user-editable JWT metadata.

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies can read profiles without
-- recursing into the profiles policies).
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('operator', 'admin') from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function public.current_rescue_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.rescue_team_id
  from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('rescue', 'admin');
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.current_rescue_team_id() from public;
grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_rescue_team_id() to anon, authenticated;

-- Block privilege escalation: only admins (or server-side service/SQL access,
-- where auth.uid() is null) can change role or team membership.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.rescue_team_id is distinct from old.rescue_team_id)
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'FORBIDDEN: only administrators can change roles' using errcode = '42501';
  end if;
  if new.id is distinct from old.id then
    raise exception 'FORBIDDEN: profile id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.alerts enable row level security;
alter table public.risk_zones enable row level security;
alter table public.shelters enable row level security;
alter table public.hazard_reports enable row level security;
alter table public.hazard_confirmations enable row level security;
alter table public.rescue_teams enable row level security;
alter table public.sos_requests enable row level security;
alter table public.rescue_assignments enable row level security;
alter table public.incident_status_history enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: staff read all" on public.profiles
  for select to authenticated
  using (public.is_staff());

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles: admin update all" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- alerts — public information when active
-- ---------------------------------------------------------------------------
create policy "alerts: public read active" on public.alerts
  for select to anon, authenticated
  using (is_active and (expires_at is null or expires_at > now()));

create policy "alerts: staff read all" on public.alerts
  for select to authenticated
  using (public.is_staff());

create policy "alerts: staff insert" on public.alerts
  for insert to authenticated
  with check (public.is_staff());

create policy "alerts: staff update" on public.alerts
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "alerts: admin delete" on public.alerts
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- risk_zones — public
-- ---------------------------------------------------------------------------
create policy "risk_zones: public read" on public.risk_zones
  for select to anon, authenticated
  using (true);

create policy "risk_zones: staff write" on public.risk_zones
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- shelters — public when active; staff maintain occupancy; admin manages
-- ---------------------------------------------------------------------------
create policy "shelters: public read active" on public.shelters
  for select to anon, authenticated
  using (is_active or public.is_staff());

create policy "shelters: staff update" on public.shelters
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "shelters: admin insert" on public.shelters
  for insert to authenticated
  with check (public.is_admin());

create policy "shelters: admin delete" on public.shelters
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- hazard_reports — public read (except rejected); signed-in users report
-- ---------------------------------------------------------------------------
create policy "hazard_reports: public read" on public.hazard_reports
  for select to anon, authenticated
  using (status <> 'rejected' or public.is_staff() or reporter_id = (select auth.uid()));

create policy "hazard_reports: users create own" on public.hazard_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'
    and source_type = 'community'
    and confirmation_count = 0
    and reviewed_by is null
  );

create policy "hazard_reports: staff update" on public.hazard_reports
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "hazard_reports: admin delete" on public.hazard_reports
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- hazard_confirmations — one per user per report
-- ---------------------------------------------------------------------------
create policy "hazard_confirmations: read own or staff" on public.hazard_confirmations
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

create policy "hazard_confirmations: create own" on public.hazard_confirmations
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "hazard_confirmations: delete own" on public.hazard_confirmations
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- rescue_teams — any signed-in user may read call signs/status (citizens see
-- which team is coming); staff update; admin manage.
-- ---------------------------------------------------------------------------
create policy "rescue_teams: authenticated read" on public.rescue_teams
  for select to authenticated
  using (true);

create policy "rescue_teams: staff update" on public.rescue_teams
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "rescue_teams: admin insert" on public.rescue_teams
  for insert to authenticated
  with check (public.is_admin());

create policy "rescue_teams: admin delete" on public.rescue_teams
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- sos_requests — owner, staff, or the assigned rescue team. No client
-- INSERT/UPDATE/DELETE: intake goes through the validated /api/sos route and
-- workflow changes through SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------
create policy "sos_requests: owner read" on public.sos_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "sos_requests: staff read" on public.sos_requests
  for select to authenticated
  using (public.is_staff());

create policy "sos_requests: assigned team read" on public.sos_requests
  for select to authenticated
  using (assigned_team_id is not null and assigned_team_id = public.current_rescue_team_id());

-- ---------------------------------------------------------------------------
-- rescue_assignments
-- ---------------------------------------------------------------------------
create policy "rescue_assignments: staff read" on public.rescue_assignments
  for select to authenticated
  using (public.is_staff());

create policy "rescue_assignments: team read" on public.rescue_assignments
  for select to authenticated
  using (rescue_team_id = public.current_rescue_team_id());

create policy "rescue_assignments: sos owner read" on public.rescue_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.sos_requests s
      where s.id = sos_id and s.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- incident_status_history — visible to whoever can see the SOS
-- ---------------------------------------------------------------------------
create policy "incident_status_history: read with sos" on public.incident_status_history
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.sos_requests s
      where s.id = sos_id
        and (
          s.user_id = (select auth.uid())
          or (s.assigned_team_id is not null and s.assigned_team_id = public.current_rescue_team_id())
        )
    )
  );

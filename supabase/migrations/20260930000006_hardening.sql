-- JalSuraksha Nepal — production-readiness hardening
--
-- 1. Anonymous sessions (created silently for guest SOS) are the
--    `authenticated` Postgres role. They must not be able to post hazard
--    reports or confirmations directly through the API — otherwise anyone can
--    mint sessions and fake a "blocked bridge" that re-routes every citizen.
-- 2. Consistent lock ordering: every workflow function now locks the SOS row
--    before its assignment row, so concurrent operator/rescue actions cannot
--    deadlock.

create or replace function public.is_permanent_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false;
$$;

grant execute on function public.is_permanent_user() to anon, authenticated;

drop policy "hazard_reports: users create own" on public.hazard_reports;
create policy "hazard_reports: users create own" on public.hazard_reports
  for insert to authenticated
  with check (
    public.is_permanent_user()
    and reporter_id = (select auth.uid())
    and status = 'open'
    and source_type = 'community'
    and confirmation_count = 0
    and reviewed_by is null
    and duplicate_of is distinct from id
  );

drop policy "hazard_confirmations: create own" on public.hazard_confirmations;
create policy "hazard_confirmations: create own" on public.hazard_confirmations
  for insert to authenticated
  with check (public.is_permanent_user() and user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- update_assignment_status: lock SOS → assignment → team (same order as
-- assign_rescue_team / resolve_sos / cancel functions).
-- ---------------------------------------------------------------------------
create or replace function public.update_assignment_status(
  p_assignment_id uuid,
  p_status public.assignment_status,
  p_note text default null
)
returns public.rescue_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sos_id uuid;
  v_assignment public.rescue_assignments;
  v_sos public.sos_requests;
  v_team public.rescue_teams;
  v_role public.app_role := public.current_app_role();
  v_sos_status public.sos_status;
  v_label text;
begin
  select sos_id into v_sos_id from public.rescue_assignments where id = p_assignment_id;
  if not found then
    raise exception 'NOT_FOUND: assignment not found';
  end if;

  -- Lock order: SOS first, then the assignment.
  select * into v_sos from public.sos_requests where id = v_sos_id for update;
  select * into v_assignment from public.rescue_assignments where id = p_assignment_id for update;

  if not (
    public.is_staff()
    or (v_role = 'rescue' and v_assignment.rescue_team_id = public.current_rescue_team_id())
  ) then
    raise exception 'FORBIDDEN: not a member of the assigned team';
  end if;

  if not public.assignment_transition_allowed(v_assignment.status, p_status) then
    raise exception 'INVALID_TRANSITION: assignment cannot move from % to %', v_assignment.status, p_status;
  end if;

  update public.rescue_assignments
  set status = p_status,
      notes = coalesce(p_note, notes),
      accepted_at = case when p_status = 'accepted' then now() else accepted_at end,
      en_route_at = case when p_status = 'en_route' then now() else en_route_at end,
      arrived_at = case when p_status = 'arrived' then now() else arrived_at end,
      completed_at = case when p_status in ('completed', 'cancelled') then now() else completed_at end
  where id = p_assignment_id
  returning * into v_assignment;

  select * into v_team from public.rescue_teams where id = v_assignment.rescue_team_id for update;
  update public.rescue_teams
  set status = case
    when p_status in ('completed', 'cancelled') then 'available'::public.team_status
    when p_status in ('en_route', 'arrived', 'in_progress') then 'busy'::public.team_status
    else 'assigned'::public.team_status
  end
  where id = v_assignment.rescue_team_id;

  v_sos_status := case p_status
    when 'accepted' then 'accepted'::public.sos_status
    when 'en_route' then 'en_route'::public.sos_status
    when 'arrived' then 'arrived'::public.sos_status
    when 'in_progress' then 'in_progress'::public.sos_status
    when 'completed' then 'resolved'::public.sos_status
    when 'cancelled' then 'acknowledged'::public.sos_status
  end;

  v_label := case p_status
    when 'accepted' then format('Team %s accepted the mission', v_team.call_sign)
    when 'en_route' then format('Team %s dispatched', v_team.call_sign)
    when 'arrived' then format('Team %s arrived on scene', v_team.call_sign)
    when 'in_progress' then format('Team %s rescue in progress', v_team.call_sign)
    when 'completed' then format('Rescue completed by team %s', v_team.call_sign)
    when 'cancelled' then format('Team %s assignment cancelled — returned to queue', v_team.call_sign)
  end;

  if v_sos.status not in ('resolved', 'cancelled') then
    if p_status = 'cancelled' then
      update public.sos_requests set assigned_team_id = null where id = v_sos.id;
    end if;
    perform public._set_sos_status(v_sos, v_sos_status, v_role::text, coalesce(p_note, v_label));
  end if;

  return v_assignment;
end;
$$;

revoke all on function public.update_assignment_status(uuid, public.assignment_status, text) from public, anon;
grant execute on function public.update_assignment_status(uuid, public.assignment_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Optimistic concurrency for dispatch. The operator's screen sends the
--    team it believes is currently assigned (null = none). If another
--    operator changed it meanwhile, refuse instead of silently cancelling
--    their dispatch.
-- ---------------------------------------------------------------------------
drop function public.assign_rescue_team(uuid, uuid, text);

create or replace function public.assign_rescue_team(
  p_sos_id uuid,
  p_team_id uuid,
  p_note text default null,
  p_expected_team_id uuid default null
)
returns public.rescue_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sos public.sos_requests;
  v_team public.rescue_teams;
  v_assignment public.rescue_assignments;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: operator role required';
  end if;

  select * into v_sos from public.sos_requests where id = p_sos_id for update;
  if not found then
    raise exception 'NOT_FOUND: SOS request not found';
  end if;
  if v_sos.status in ('resolved', 'cancelled') then
    raise exception 'ALREADY_CLOSED: SOS % is already closed', v_sos.reference_code;
  end if;
  if v_sos.status in ('en_route', 'arrived', 'in_progress') then
    raise exception 'INVALID_TRANSITION: a team is already dispatched to %', v_sos.reference_code;
  end if;
  if v_sos.assigned_team_id is distinct from p_expected_team_id then
    raise exception 'CONFLICT: % was updated by another operator', v_sos.reference_code;
  end if;

  select * into v_team from public.rescue_teams where id = p_team_id for update;
  if not found then
    raise exception 'NOT_FOUND: rescue team not found';
  end if;
  if v_team.status <> 'available' then
    raise exception 'TEAM_UNAVAILABLE: team % is %', v_team.call_sign, v_team.status;
  end if;

  perform public._close_active_assignment(p_sos_id, 'cancelled');

  insert into public.rescue_assignments (sos_id, rescue_team_id, assigned_by, status, notes)
  values (p_sos_id, p_team_id, (select auth.uid()), 'assigned', p_note)
  returning * into v_assignment;

  update public.rescue_teams set status = 'assigned' where id = p_team_id;
  update public.sos_requests set assigned_team_id = p_team_id where id = p_sos_id;

  select * into v_sos from public.sos_requests where id = p_sos_id;
  perform public._set_sos_status(v_sos, 'assigned', public.current_app_role()::text,
    format('Rescue team %s assigned', v_team.call_sign));

  return v_assignment;
end;
$$;

revoke all on function public.assign_rescue_team(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.assign_rescue_team(uuid, uuid, text, uuid) to authenticated;

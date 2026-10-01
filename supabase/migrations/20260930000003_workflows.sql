-- JalSuraksha Nepal — incident workflow functions
-- All state changes run here so authorization, transition validation, related
-- updates (team status, SOS status) and the audit trail happen atomically.
-- Keep the transition tables in sync with lib/utilities/status.ts.
--
-- Errors are raised with a stable code prefix the app maps to friendly text:
--   FORBIDDEN, NOT_FOUND, INVALID_TRANSITION, TEAM_UNAVAILABLE, ALREADY_CLOSED

create or replace function public.sos_transition_allowed(
  p_from public.sos_status,
  p_to public.sos_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'received'     then p_to in ('acknowledged', 'assigned', 'resolved', 'cancelled')
    when 'acknowledged' then p_to in ('assigned', 'resolved', 'cancelled')
    when 'assigned'     then p_to in ('accepted', 'assigned', 'acknowledged', 'resolved', 'cancelled')
    when 'accepted'     then p_to in ('en_route', 'assigned', 'acknowledged', 'resolved', 'cancelled')
    when 'en_route'     then p_to in ('arrived', 'acknowledged', 'resolved', 'cancelled')
    when 'arrived'      then p_to in ('in_progress', 'acknowledged', 'resolved', 'cancelled')
    when 'in_progress'  then p_to in ('acknowledged', 'resolved', 'cancelled')
    else false
  end;
$$;

create or replace function public.assignment_transition_allowed(
  p_from public.assignment_status,
  p_to public.assignment_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'assigned'    then p_to in ('accepted', 'cancelled')
    when 'accepted'    then p_to in ('en_route', 'cancelled')
    when 'en_route'    then p_to in ('arrived', 'cancelled')
    when 'arrived'     then p_to in ('in_progress', 'completed', 'cancelled')
    when 'in_progress' then p_to in ('completed', 'cancelled')
    else false
  end;
$$;

-- Internal: move an SOS to a new status and log it. Caller must hold the row lock.
create or replace function public._set_sos_status(
  p_sos public.sos_requests,
  p_to public.sos_status,
  p_actor_role text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_sos.status = p_to and p_to <> 'assigned' then
    return;
  end if;
  if not public.sos_transition_allowed(p_sos.status, p_to) then
    raise exception 'INVALID_TRANSITION: SOS cannot move from % to %', p_sos.status, p_to;
  end if;

  update public.sos_requests
  set status = p_to,
      acknowledged_at = case
        when p_to <> 'received' then coalesce(acknowledged_at, now())
        else acknowledged_at end,
      resolved_at = case when p_to in ('resolved', 'cancelled') then now() else resolved_at end
  where id = p_sos.id;

  insert into public.incident_status_history (sos_id, from_status, to_status, changed_by, actor_role, note)
  values (p_sos.id, p_sos.status, p_to, (select auth.uid()), p_actor_role, p_note);
end;
$$;

-- Internal: finish the live assignment for an SOS (if any) and free its team.
create or replace function public._close_active_assignment(
  p_sos_id uuid,
  p_final public.assignment_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.rescue_assignments;
begin
  select * into v_assignment
  from public.rescue_assignments
  where sos_id = p_sos_id and status not in ('completed', 'cancelled')
  for update;

  if found then
    update public.rescue_assignments
    set status = p_final,
        completed_at = now()
    where id = v_assignment.id;

    update public.rescue_teams
    set status = 'available'
    where id = v_assignment.rescue_team_id and status in ('assigned', 'busy');
  end if;
end;
$$;

revoke all on function public._set_sos_status(public.sos_requests, public.sos_status, text, text) from public, anon, authenticated;
revoke all on function public._close_active_assignment(uuid, public.assignment_status) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operator: acknowledge an incoming SOS ("Control centre notified")
-- ---------------------------------------------------------------------------
create or replace function public.acknowledge_sos(p_sos_id uuid)
returns public.sos_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sos public.sos_requests;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: operator role required';
  end if;

  select * into v_sos from public.sos_requests where id = p_sos_id for update;
  if not found then
    raise exception 'NOT_FOUND: SOS request not found';
  end if;

  if v_sos.status = 'received' then
    perform public._set_sos_status(v_sos, 'acknowledged', public.current_app_role()::text,
      'Control centre notified');
  end if;

  select * into v_sos from public.sos_requests where id = p_sos_id;
  return v_sos;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operator: assign (or re-assign) a rescue team
-- ---------------------------------------------------------------------------
create or replace function public.assign_rescue_team(
  p_sos_id uuid,
  p_team_id uuid,
  p_note text default null
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

  select * into v_team from public.rescue_teams where id = p_team_id for update;
  if not found then
    raise exception 'NOT_FOUND: rescue team not found';
  end if;
  if v_team.status <> 'available' then
    raise exception 'TEAM_UNAVAILABLE: team % is %', v_team.call_sign, v_team.status;
  end if;

  -- Re-assignment: release the previous team.
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

-- ---------------------------------------------------------------------------
-- Rescue team (or operator): advance an assignment
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
  v_assignment public.rescue_assignments;
  v_sos public.sos_requests;
  v_team public.rescue_teams;
  v_role public.app_role := public.current_app_role();
  v_sos_status public.sos_status;
  v_label text;
begin
  select * into v_assignment from public.rescue_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'NOT_FOUND: assignment not found';
  end if;

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

  select * into v_sos from public.sos_requests where id = v_assignment.sos_id for update;
  if v_sos.status not in ('resolved', 'cancelled') then
    if p_status = 'cancelled' then
      update public.sos_requests set assigned_team_id = null where id = v_sos.id;
    end if;
    perform public._set_sos_status(v_sos, v_sos_status, v_role::text, coalesce(p_note, v_label));
  end if;

  return v_assignment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operator: override the automated priority recommendation
-- ---------------------------------------------------------------------------
create or replace function public.set_sos_priority_override(
  p_sos_id uuid,
  p_level public.priority_level,
  p_note text default null
)
returns public.sos_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sos public.sos_requests;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: operator role required';
  end if;

  update public.sos_requests
  set operator_priority_override = p_level,
      priority_override_note = p_note
  where id = p_sos_id
  returning * into v_sos;

  if not found then
    raise exception 'NOT_FOUND: SOS request not found';
  end if;

  insert into public.incident_status_history (sos_id, from_status, to_status, changed_by, actor_role, note)
  values (
    v_sos.id, v_sos.status, v_sos.status, (select auth.uid()), public.current_app_role()::text,
    case when p_level is null
      then 'Priority override cleared — using automated recommendation'
      else format('Priority overridden to %s%s', upper(p_level::text),
        case when p_note is not null and p_note <> '' then ': ' || p_note else '' end)
    end
  );

  return v_sos;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operator: close an incident
-- ---------------------------------------------------------------------------
create or replace function public.resolve_sos(p_sos_id uuid, p_note text default null)
returns public.sos_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sos public.sos_requests;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN: operator role required';
  end if;

  select * into v_sos from public.sos_requests where id = p_sos_id for update;
  if not found then
    raise exception 'NOT_FOUND: SOS request not found';
  end if;
  if v_sos.status in ('resolved', 'cancelled') then
    return v_sos;
  end if;

  perform public._close_active_assignment(p_sos_id, 'completed');
  perform public._set_sos_status(v_sos, 'resolved', public.current_app_role()::text,
    coalesce(nullif(p_note, ''), 'Marked resolved by control centre'));

  select * into v_sos from public.sos_requests where id = p_sos_id;
  return v_sos;
end;
$$;

-- ---------------------------------------------------------------------------
-- Citizen: "I am safe now" — closes their own SOS and releases any team.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_own_sos(p_sos_id uuid)
returns public.sos_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sos public.sos_requests;
begin
  select * into v_sos from public.sos_requests where id = p_sos_id for update;
  if not found or v_sos.user_id is distinct from (select auth.uid()) or (select auth.uid()) is null then
    raise exception 'NOT_FOUND: SOS request not found';
  end if;
  if v_sos.status in ('resolved', 'cancelled') then
    return v_sos;
  end if;

  perform public._close_active_assignment(p_sos_id, 'cancelled');
  perform public._set_sos_status(v_sos, 'cancelled', 'citizen', 'Citizen reported safe');

  select * into v_sos from public.sos_requests where id = p_sos_id;
  return v_sos;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rescue team: toggle own availability (available <-> offline) when idle
-- ---------------------------------------------------------------------------
create or replace function public.set_own_team_availability(p_available boolean)
returns public.rescue_teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid := public.current_rescue_team_id();
  v_team public.rescue_teams;
begin
  if v_team_id is null then
    raise exception 'FORBIDDEN: not linked to a rescue team';
  end if;

  select * into v_team from public.rescue_teams where id = v_team_id for update;
  if v_team.status in ('assigned', 'busy') then
    raise exception 'INVALID_TRANSITION: finish the current mission first';
  end if;

  update public.rescue_teams
  set status = case when p_available then 'available'::public.team_status else 'offline'::public.team_status end
  where id = v_team_id
  returning * into v_team;

  return v_team;
end;
$$;

-- Workflow RPCs are for signed-in users only; each checks the role itself.
revoke all on function public.acknowledge_sos(uuid) from public, anon;
revoke all on function public.assign_rescue_team(uuid, uuid, text) from public, anon;
revoke all on function public.update_assignment_status(uuid, public.assignment_status, text) from public, anon;
revoke all on function public.set_sos_priority_override(uuid, public.priority_level, text) from public, anon;
revoke all on function public.resolve_sos(uuid, text) from public, anon;
revoke all on function public.cancel_own_sos(uuid) from public, anon;
revoke all on function public.set_own_team_availability(boolean) from public, anon;

grant execute on function public.acknowledge_sos(uuid) to authenticated;
grant execute on function public.assign_rescue_team(uuid, uuid, text) to authenticated;
grant execute on function public.update_assignment_status(uuid, public.assignment_status, text) to authenticated;
grant execute on function public.set_sos_priority_override(uuid, public.priority_level, text) to authenticated;
grant execute on function public.resolve_sos(uuid, text) to authenticated;
grant execute on function public.cancel_own_sos(uuid) to authenticated;
grant execute on function public.set_own_team_availability(boolean) to authenticated;

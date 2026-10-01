-- Live caller location: while an SOS is open, the caller's phone keeps
-- sending its GPS position so the control centre and the assigned team see
-- where the person is now, not only where they pressed SOS.

-- Null until the first live update: the position is the one sent with the SOS.
alter table public.sos_requests
  add column location_updated_at timestamptz;

-- Proven by the tracking token (guests have no session). Closed SOS keep
-- their last position. Called only by the server (service role).
create or replace function public.update_sos_location_with_token(
  p_reference text,
  p_token uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m integer
)
returns public.sos_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sos public.sos_requests;
begin
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'INVALID: invalid position';
  end if;

  select * into v_sos
  from public.sos_requests
  where reference_code = p_reference and tracking_token = p_token
  for update;

  if not found then
    raise exception 'NOT_FOUND: SOS request not found';
  end if;
  if v_sos.status in ('resolved', 'cancelled') then
    return v_sos;
  end if;

  update public.sos_requests
  set latitude = p_latitude,
      longitude = p_longitude,
      location_accuracy_m = case when p_accuracy_m is null then null else least(greatest(p_accuracy_m, 0), 100000) end,
      location_updated_at = now()
  where id = v_sos.id
  returning * into v_sos;
  return v_sos;
end;
$$;

revoke all on function public.update_sos_location_with_token(text, uuid, double precision, double precision, integer) from public, anon, authenticated;
grant execute on function public.update_sos_location_with_token(text, uuid, double precision, double precision, integer) to service_role;

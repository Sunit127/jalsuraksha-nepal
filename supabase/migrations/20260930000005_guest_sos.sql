-- JalSuraksha Nepal — guest SOS support
-- Guests without a session track and close their SOS with the secret
-- tracking token returned at submission. Only the server (service role) may
-- call this; the API validates input before calling it.

create or replace function public.cancel_sos_with_token(p_reference text, p_token uuid)
returns public.sos_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sos public.sos_requests;
begin
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

  perform public._close_active_assignment(v_sos.id, 'cancelled');
  perform public._set_sos_status(v_sos, 'cancelled', 'citizen', 'Citizen reported safe');

  select * into v_sos from public.sos_requests where id = v_sos.id;
  return v_sos;
end;
$$;

revoke all on function public.cancel_sos_with_token(text, uuid) from public, anon, authenticated;
grant execute on function public.cancel_sos_with_token(text, uuid) to service_role;

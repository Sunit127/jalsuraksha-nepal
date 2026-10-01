-- JalSuraksha Nepal — citizen updates reach staff and rescue teams live
--
-- 1. Family safety status (SAFE / EVACUATED / NEED HELP) lives on profiles,
--    which were not in the realtime publication, so the operations centre never
--    saw a change. RLS still applies to every event: only staff (profiles:
--    staff read all) and the person themselves receive a profile change.
-- 2. When a citizen marks themselves safe, their SOS is cancelled and the
--    active mission is closed as 'cancelled' — the same final state as a
--    reassignment. Record why on the assignment so the rescue team is told
--    "citizen reported safe" rather than a generic "mission closed".

alter publication supabase_realtime add table public.profiles;

create or replace function public.note_citizen_safe_on_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only citizens cancel an SOS (operators resolve), and the cancel functions
  -- close the active assignment in the same transaction, so completed_at = now().
  if new.status = 'cancelled' and old.status not in ('resolved', 'cancelled') then
    update public.rescue_assignments
    set notes = 'Citizen reported safe — SOS closed'
    where sos_id = new.id and status = 'cancelled' and completed_at = now();
  end if;
  return new;
end;
$$;

revoke execute on function public.note_citizen_safe_on_assignment() from public, anon, authenticated;

create trigger sos_requests_note_citizen_safe
  after update of status on public.sos_requests
  for each row execute function public.note_citizen_safe_on_assignment();

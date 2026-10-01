-- JalSuraksha Nepal — tell citizens when a public row disappears
--
-- Realtime postgres_changes only delivers an UPDATE to subscribers who can
-- still read the *new* row under RLS. When an operator withdraws an alert,
-- closes a shelter or rejects a hazard report, the row stops being public, so
-- citizens never receive the change and keep showing it until they reload.
--
-- These triggers send a public broadcast on the `public:visibility` topic
-- carrying only the table name and row id (no content), so open citizen
-- screens can drop the row immediately. Rows that become visible again are
-- delivered by postgres_changes as usual.

create or replace function public.broadcast_hidden_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_public boolean;
  is_public boolean;
begin
  if tg_table_name = 'alerts' then
    was_public := old.is_active;
    is_public := new.is_active;
  elsif tg_table_name = 'shelters' then
    was_public := old.is_active;
    is_public := new.is_active;
  elsif tg_table_name = 'hazard_reports' then
    was_public := old.status <> 'rejected';
    is_public := new.status <> 'rejected';
  else
    return new;
  end if;

  if was_public and not is_public then
    begin
      perform realtime.send(
        jsonb_build_object('table', tg_table_name, 'id', new.id),
        'hidden',
        'public:visibility',
        false
      );
    exception when others then
      -- Never block the operator's change because realtime is unavailable.
      raise warning 'broadcast_hidden_row: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

revoke execute on function public.broadcast_hidden_row() from public, anon, authenticated;

create trigger alerts_broadcast_hidden
  after update of is_active on public.alerts
  for each row execute function public.broadcast_hidden_row();

create trigger shelters_broadcast_hidden
  after update of is_active on public.shelters
  for each row execute function public.broadcast_hidden_row();

create trigger hazard_reports_broadcast_hidden
  after update of status on public.hazard_reports
  for each row execute function public.broadcast_hidden_row();

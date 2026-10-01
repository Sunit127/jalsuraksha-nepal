-- JalSuraksha Nepal — a reporter cannot confirm their own hazard report
--
-- Confirmations signal independent corroboration to operators. The app
-- already refused self-confirmation from the map, but re-reporting the same
-- hazard (grouped as a duplicate) or calling the API directly still let a
-- reporter inflate their own report's count.

drop policy "hazard_confirmations: create own" on public.hazard_confirmations;
create policy "hazard_confirmations: create own" on public.hazard_confirmations
  for insert to authenticated
  with check (
    public.is_permanent_user()
    and user_id = (select auth.uid())
    and not exists (
      select 1 from public.hazard_reports r
      where r.id = report_id and r.reporter_id = (select auth.uid())
    )
  );

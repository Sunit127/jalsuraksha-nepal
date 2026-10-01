-- JalSuraksha Nepal — Realtime publication and Storage buckets

-- Realtime: postgres_changes events are filtered per subscriber by RLS.
alter publication supabase_realtime add table
  public.sos_requests,
  public.rescue_assignments,
  public.rescue_teams,
  public.hazard_reports,
  public.shelters,
  public.alerts,
  public.incident_status_history;

-- Storage buckets. Uploads happen server-side (/api/uploads) after type/size
-- validation, so no client write policies are defined (default deny).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('sos-photos', 'sos-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('hazard-photos', 'hazard-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

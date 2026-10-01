-- JalSuraksha Nepal — database security & workflow tests (pgTAP)
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

-- ---------------------------------------------------------------------------
-- Fixtures: one user per role (profiles are created by the auth trigger)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, instance_id)
values
  ('11111111-1111-4111-8111-111111111111', 'cit-a@test.np', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('22222222-2222-4222-8222-222222222222', 'cit-b@test.np', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('33333333-3333-4333-8333-333333333333', 'op@test.np', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('44444444-4444-4444-8444-444444444444', 'rescue@test.np', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('55555555-5555-4555-8555-555555555555', 'op2@test.np', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into auth.users (id, aud, role, is_anonymous, instance_id)
values ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');

insert into public.rescue_teams (id, call_sign, name, latitude, longitude)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'T-01', 'Test team 1', 27.68, 84.43),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'T-02', 'Test team 2', 27.69, 84.44);

update public.profiles set role = 'operator' where id in ('33333333-3333-4333-8333-333333333333', '55555555-5555-4555-8555-555555555555');
update public.profiles set role = 'rescue', rescue_team_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  where id = '44444444-4444-4444-8444-444444444444';

insert into public.sos_requests (id, reference_code, user_id, phone, latitude, longitude, situation, people_count)
values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'SOS-NEP-9001', '11111111-1111-4111-8111-111111111111', '+9779800000001', 27.69, 84.41, 'trapped', 3),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'SOS-NEP-9002', '22222222-2222-4222-8222-222222222222', '+9779800000002', 27.70, 84.42, 'medical', 1);

select ok((select count(*) = 2 from public.profiles where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222') and role = 'citizen'),
  'new auth users get a citizen profile');

-- helper to act as a user
create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------
set local role anon;
select is((select count(*) from public.sos_requests)::int, 0, 'anon cannot read SOS requests');
select is((select count(*) from public.profiles)::int, 0, 'anon cannot read profiles');
select is((select count(*) from public.rescue_assignments)::int, 0, 'anon cannot read assignments');
select throws_ok($$ insert into public.sos_requests (phone, latitude, longitude, situation) values ('+9779800000009', 27.7, 84.4, 'other') $$,
  '42501', null, 'anon cannot insert SOS directly (intake goes through the API)');
reset role;

-- ---------------------------------------------------------------------------
-- Citizens
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is((select count(*) from public.sos_requests)::int, 1, 'citizen sees only their own SOS');
select is((select reference_code from public.sos_requests), 'SOS-NEP-9001', 'the visible SOS is their own');
select is((select count(*) from public.profiles)::int, 1, 'citizen sees only their own profile');
select throws_like($$ update public.profiles set role = 'admin' where id = '11111111-1111-4111-8111-111111111111' $$,
  '%FORBIDDEN%', 'citizen cannot escalate their role');
select lives_ok($$ update public.profiles set full_name = 'Sita', safety_status = 'safe' where id = '11111111-1111-4111-8111-111111111111' $$,
  'citizen can update their own details');
select throws_like($$ select public.assign_rescue_team('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '%FORBIDDEN%', 'citizen cannot dispatch teams');
select throws_like($$ select public.cancel_own_sos('bbbbbbbb-0000-4000-8000-000000000002') $$,
  '%NOT_FOUND%', 'citizen cannot close someone else''s SOS');
select lives_ok($$ insert into public.hazard_reports (reporter_id, type, severity, latitude, longitude)
  values ('11111111-1111-4111-8111-111111111111', 'flooded_road', 'high', 27.69, 84.42) $$,
  'citizen can report a hazard as themselves');
select throws_ok($$ insert into public.hazard_reports (reporter_id, type, severity, latitude, longitude, status)
  values ('11111111-1111-4111-8111-111111111111', 'flooded_road', 'high', 27.69, 84.42, 'verified') $$,
  '42501', null, 'citizen cannot self-verify a hazard report');
select throws_ok($$ insert into public.hazard_confirmations (report_id, user_id)
  select id, '11111111-1111-4111-8111-111111111111' from public.hazard_reports
  where reporter_id = '11111111-1111-4111-8111-111111111111' limit 1 $$,
  '42501', null, 'citizen cannot confirm their own hazard report');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select lives_ok($$ insert into public.hazard_confirmations (report_id, user_id)
  select id, '22222222-2222-4222-8222-222222222222' from public.hazard_reports
  where reporter_id = '11111111-1111-4111-8111-111111111111' limit 1 $$,
  'another citizen can confirm the report');
reset role;

-- ---------------------------------------------------------------------------
-- Anonymous (guest SOS) sessions cannot post or confirm hazards
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","is_anonymous":true}', true);
select throws_ok($$ insert into public.hazard_reports (reporter_id, type, severity, latitude, longitude)
  values ('66666666-6666-4666-8666-666666666666', 'blocked_bridge', 'critical', 27.689, 84.4222) $$,
  '42501', null, 'anonymous session cannot post a hazard report');
select throws_ok($$ insert into public.hazard_confirmations (report_id, user_id)
  select id, '66666666-6666-4666-8666-666666666666' from public.hazard_reports limit 1 $$,
  '42501', null, 'anonymous session cannot confirm hazards');
select is((select count(*) from public.sos_requests)::int, 0, 'anonymous session sees no SOS it does not own');
reset role;

-- ---------------------------------------------------------------------------
-- Operators and rescue workflow
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is((select count(*) from public.sos_requests where reference_code like 'SOS-NEP-900%')::int, 2, 'operator sees all SOS');
select is((select status::text from public.acknowledge_sos('bbbbbbbb-0000-4000-8000-000000000001')), 'acknowledged', 'operator acknowledges');
select is((select status::text from public.assign_rescue_team('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001')),
  'assigned', 'operator assigns an available team');
select throws_like($$ select public.assign_rescue_team('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '%TEAM_UNAVAILABLE%', 'a busy team cannot be double-booked');

select pg_temp.act_as('55555555-5555-4555-8555-555555555555');
select throws_like($$ select public.assign_rescue_team('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002', null, null) $$,
  '%CONFLICT%', 'a second operator with a stale screen cannot overwrite the dispatch');
select is((select status::text from public.assign_rescue_team('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002', null, 'aaaaaaaa-0000-4000-8000-000000000001')),
  'assigned', 'an up-to-date operator can deliberately reassign');
select is((select status::text from public.assign_rescue_team('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', null, 'aaaaaaaa-0000-4000-8000-000000000002')),
  'assigned', 'and reassign back to the original team');

select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select is((select count(*) from public.sos_requests)::int, 1, 'rescue team sees only its assigned SOS');
select throws_like($$ select public.update_assignment_status(
    (select id from public.rescue_assignments where sos_id = 'bbbbbbbb-0000-4000-8000-000000000001' and status not in ('completed', 'cancelled')), 'arrived') $$,
  '%INVALID_TRANSITION%', 'rescue cannot skip from assigned to arrived');
select lives_ok($$ select public.update_assignment_status(
    (select id from public.rescue_assignments where sos_id = 'bbbbbbbb-0000-4000-8000-000000000001' and status not in ('completed', 'cancelled')), 'accepted') $$,
  'rescue accepts the mission');
select lives_ok($$ select public.update_assignment_status(
    (select id from public.rescue_assignments where sos_id = 'bbbbbbbb-0000-4000-8000-000000000001' and status not in ('completed', 'cancelled')), 'en_route') $$,
  'rescue goes en route');

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is((select status::text from public.sos_requests where id = 'bbbbbbbb-0000-4000-8000-000000000001'), 'en_route',
  'citizen sees their SOS as en route');
select ok((select count(*) >= 4 from public.incident_status_history where sos_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'citizen can read their own incident timeline');
reset role;

-- Rows that stop being public are announced (citizens can't receive the RLS-filtered UPDATE)
select has_trigger('public', 'alerts', 'alerts_broadcast_hidden', 'withdrawn alerts are broadcast');
select has_trigger('public', 'shelters', 'shelters_broadcast_hidden', 'closed shelters are broadcast');
select has_trigger('public', 'hazard_reports', 'hazard_reports_broadcast_hidden', 'rejected hazards are broadcast');
select lives_ok($$ update public.alerts set is_active = not is_active where id = (select id from public.alerts limit 1) $$,
  'toggling an alert with the broadcast trigger succeeds');

-- Citizen updates reach staff and rescue teams
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'),
  'family safety status changes are published to realtime (RLS-filtered)');
select has_trigger('public', 'sos_requests', 'sos_requests_note_citizen_safe', 'missions closed by a citizen marking safe are labelled');

-- Real data: settings, live readings, reference data
set local role authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is((select count(*) from public.app_settings where key = 'data_mode')::int, 1, 'anyone can read the data mode');
update public.app_settings set value = '"simulation"' where key = 'data_mode';
select is((select value #>> '{}' from public.app_settings where key = 'data_mode'), 'live', 'a citizen cannot switch the data mode');
select throws_ok($$ insert into public.hydromet_stations (id, kind, name, latitude, longitude) values ('fake:1', 'river', 'Fake gauge', 27.7, 84.4) $$,
  '42501', null, 'nobody but the sync job writes river readings');
select throws_ok($$ insert into public.facilities (kind, name, latitude, longitude, data_source, source_ref) values ('hospital', 'Fake', 27.7, 84.4, 'x', 'x:1') $$,
  '42501', null, 'a citizen cannot add facilities');
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select lives_ok($$ update public.app_settings set value = '"simulation"' where key = 'data_mode' $$, 'staff can switch to simulation');
select throws_ok($$ update public.app_settings set value = '"chaos"' where key = 'data_mode' $$,
  '42501', null, 'the data mode only accepts live or simulation');
reset role;
select throws_ok($$ insert into public.shelters (name, address, latitude, longitude, district, municipality, capacity, is_active) values ('X', 'Y', 27.7, 84.4, 'Chitwan', 'Bharatpur', 0, true) $$,
  '23514', null, 'a shelter with unknown capacity cannot be open');

-- Live team positions: written by the team, visible only to the citizen it is rescuing
set local role authenticated;
select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select lives_ok($$ insert into public.team_locations (team_id, latitude, longitude, updated_by)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 27.685, 84.425, '44444444-4444-4444-8444-444444444444') $$,
  'a rescue crew shares its own team position');
select throws_ok($$ insert into public.team_locations (team_id, latitude, longitude, updated_by)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 27.69, 84.44, '44444444-4444-4444-8444-444444444444') $$,
  '42501', null, 'a crew cannot set another team''s position');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is((select count(*) from public.team_locations)::int, 1, 'the citizen being rescued sees their assigned team''s position');
select throws_ok($$ insert into public.team_locations (team_id, latitude, longitude, updated_by)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 27.69, 84.44, '11111111-1111-4111-8111-111111111111') $$,
  '42501', null, 'a citizen cannot write team positions');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is((select count(*) from public.team_locations)::int, 0, 'other citizens cannot see where teams are');
reset role;

-- Live caller location: token-proven, server-only, open SOS only
insert into public.sos_requests (id, reference_code, tracking_token, phone, latitude, longitude, situation, people_count)
values ('bbbbbbbb-0000-4000-8000-000000000009', 'SOS-NEP-9009', 'cccccccc-0000-4000-8000-000000000009', '+9779800000009', 27.60, 84.40, 'water_rising', 1);
set local role anon;
select throws_ok($$ select public.update_sos_location_with_token('SOS-NEP-9009', 'cccccccc-0000-4000-8000-000000000009', 27.61, 84.41, 20) $$,
  '42501', null, 'browsers cannot call the live-location function directly');
reset role;
select throws_ok($$ select public.update_sos_location_with_token('SOS-NEP-9009', 'cccccccc-0000-4000-8000-00000000000f', 27.61, 84.41, 20) $$,
  'P0001', 'NOT_FOUND: SOS request not found', 'a wrong tracking token cannot move an SOS');
select lives_ok($$ select public.update_sos_location_with_token('SOS-NEP-9009', 'cccccccc-0000-4000-8000-000000000009', 27.61, 84.41, 20) $$,
  'the caller''s phone updates its SOS position');
select ok((select latitude = 27.61 and longitude = 84.41 and location_accuracy_m = 20 and location_updated_at is not null
  from public.sos_requests where id = 'bbbbbbbb-0000-4000-8000-000000000009'), 'the new position and its time are stored');
update public.sos_requests set status = 'cancelled' where id = 'bbbbbbbb-0000-4000-8000-000000000009';
select public.update_sos_location_with_token('SOS-NEP-9009', 'cccccccc-0000-4000-8000-000000000009', 27.7, 84.5, 5);
select ok((select latitude = 27.61 from public.sos_requests where id = 'bbbbbbbb-0000-4000-8000-000000000009'),
  'a closed SOS keeps its last position');

select * from finish();
rollback;

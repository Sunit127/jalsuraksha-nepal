-- Web Push: devices that asked to receive flood alerts on the lock screen.
-- Written and read only by the server (service role); browsers never see
-- other people's subscriptions.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sent_at timestamptz
);

create trigger push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
-- No policies: anon/authenticated cannot read or write; the service role bypasses RLS.
revoke all on public.push_subscriptions from anon, authenticated;

-- "Connect with LEDGR": apps such as the Obsidian plugin sign in without the user pasting an API key
-- (an OAuth-style device flow). The app gets a code, the user approves it at ledgrjournal.app/connect,
-- and the app then receives its own API key, which shows in Settings → API and can be revoked there.
-- Safe to run more than once.

create table if not exists public.device_codes (
  id uuid primary key default gen_random_uuid(),
  device_hash text not null unique check (device_hash ~ '^[0-9a-f]{64}$'), -- SHA-256 of the app's secret device code
  user_code text not null unique check (user_code ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}$'), -- what the user sees and approves
  client text not null default 'App' check (char_length(client) between 1 and 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'used')),
  user_id uuid references auth.users (id) on delete cascade,
  plan_source text check (plan_source in ('owner', 'matrixx')),
  pro_until timestamptz,
  key_id uuid references public.api_keys (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  decided_at timestamptz
);
create index if not exists device_codes_expires on public.device_codes (expires_at);

alter table public.device_codes enable row level security;
alter table public.device_codes force row level security;
-- No policies and no grants: only LEDGR's server (service role) reads or changes device codes.
revoke all on public.device_codes from anon, authenticated;

-- LEDGR API (LEDGR Pro): personal API keys, and an inbox for trades sent in through the API.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- API keys. Only a SHA-256 hash of each key is stored; the key itself is shown once.
-- Keys are created, refreshed and revoked by LEDGR's server (service role) after it
-- checks the person's plan.
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'API key' check (char_length(name) between 1 and 40),
  prefix text not null check (char_length(prefix) <= 24),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  plan_source text not null check (plan_source in ('owner', 'matrixx')),
  pro_until timestamptz, -- when LEDGR Pro ends (null: owner, never ends)
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_keys_user on public.api_keys (user_id);

alter table public.api_keys enable row level security;
alter table public.api_keys force row level security;
-- No policies and no grants: only LEDGR's server (service role) reads or changes keys.
-- The app lists your keys through /api/keys, which never returns the hash.
revoke all on public.api_keys from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trade inbox: POST /api/v1/trades puts trades here; the LEDGR app adds them to the
-- journal the next time it opens (or regains focus) and then deletes them.
-- ---------------------------------------------------------------------------
create table if not exists public.api_trade_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key_id uuid references public.api_keys (id) on delete set null,
  trade jsonb not null check (pg_column_size(trade) < 32768),
  created_at timestamptz not null default now()
);
create index if not exists api_trade_inbox_user on public.api_trade_inbox (user_id, created_at);

alter table public.api_trade_inbox enable row level security;
alter table public.api_trade_inbox force row level security;
drop policy if exists api_trade_inbox_select_own on public.api_trade_inbox;
create policy api_trade_inbox_select_own on public.api_trade_inbox for select to authenticated using (user_id = auth.uid());
drop policy if exists api_trade_inbox_delete_own on public.api_trade_inbox;
create policy api_trade_inbox_delete_own on public.api_trade_inbox for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.api_trade_inbox from anon, authenticated;

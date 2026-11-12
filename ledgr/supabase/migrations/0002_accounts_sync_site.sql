-- Ledgr: cloud sync snapshots, public reviews (moderated), and website sign-ups.

-- ---------------------------------------------------------------------------
-- One journal snapshot per user (what the app syncs today)
-- ---------------------------------------------------------------------------
create table public.user_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  check (pg_column_size(state) < 50 * 1024 * 1024)
);

create or replace function public.snapshot_touch() returns trigger language plpgsql as $$
begin new.updated_at = clock_timestamp(); return new; end $$;
create trigger user_snapshots_touch before insert or update on public.user_snapshots for each row execute function public.snapshot_touch();

alter table public.user_snapshots enable row level security;
alter table public.user_snapshots force row level security;
create policy user_snapshots_select_own on public.user_snapshots for select to authenticated using (user_id = auth.uid());
create policy user_snapshots_insert_own on public.user_snapshots for insert to authenticated with check (user_id = auth.uid());
create policy user_snapshots_update_own on public.user_snapshots for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_snapshots_delete_own on public.user_snapshots for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reviews: written by signed-in users, shown publicly only after approval
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade, -- one review per account
  display_name text not null check (char_length(display_name) between 1 and 40),
  rating smallint not null check (rating between 1 and 5),
  title text not null default '' check (char_length(title) <= 80),
  body text not null check (char_length(body) between 10 and 1200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
alter table public.reviews force row level security;
-- Anyone may read approved reviews; authors may read their own.
create policy reviews_read on public.reviews for select to anon, authenticated using (status = 'approved' or user_id = auth.uid());
-- Authors may submit one review, which always starts as pending.
create policy reviews_insert_own on public.reviews for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
-- Authors may delete their own review. Approval happens in the Supabase dashboard (service role).
create policy reviews_delete_own on public.reviews for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Website sign-ups: affiliate applications and community list (write-only from the site)
-- ---------------------------------------------------------------------------
create table public.site_signups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('affiliate', 'community')),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) < 8192),
  created_at timestamptz not null default now(),
  unique (kind, email)
);

alter table public.site_signups enable row level security;
alter table public.site_signups force row level security;
-- The public can submit, but nobody can read submissions through the API (owner reads them in the dashboard).
create policy site_signups_insert on public.site_signups for insert to anon, authenticated with check (true);

grant select, insert, delete on public.reviews to anon, authenticated;
grant insert on public.site_signups to anon, authenticated;
grant select, insert, update, delete on public.user_snapshots to authenticated;

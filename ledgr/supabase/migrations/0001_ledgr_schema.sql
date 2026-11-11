-- Ledgr relational schema for hosted (Supabase / PostgreSQL) deployments.
-- Mirrors the local-first model in src/lib/types.ts.
-- Every user-owned table carries user_id and is protected by row-level security:
-- a signed-in user can only read and write their own rows.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users & profiles (auth.users is managed by Supabase Auth)
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  base_currency char(3) not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  breakeven_threshold numeric(14,4) not null default 0 check (breakeven_threshold >= 0),
  translation text not null default 'KJV' check (translation in ('KJV')),
  checklist jsonb not null default '[]'::jsonb,
  mistake_categories text[] not null default '{}',
  setups text[] not null default '{}',
  confluence_library text[] not null default '{}',
  insights jsonb not null default '{"minSample": 10, "enabled": {}}'::jsonb,
  appearance jsonb not null default '{}'::jsonb,
  sidebar_collapsed boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Accounts (simulated only — never linked to a brokerage)
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('Personal simulation', 'Hypothetical evaluation', 'Demo', 'Backtest')),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  starting_balance numeric(18,2) not null check (starting_balance >= 0),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  color text not null default '#C5A66D',
  goals text not null default '',
  rule_profit_target numeric(18,2) check (rule_profit_target > 0),
  rule_max_drawdown numeric(18,2) check (rule_max_drawdown > 0),
  rule_daily_loss_limit numeric(18,2) check (rule_daily_loss_limit > 0),
  rule_min_trading_days int check (rule_min_trading_days > 0),
  created_at timestamptz not null default now()
);
create index on public.accounts (user_id);

create table public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  date date not null,
  amount numeric(18,2) not null check (amount <> 0),
  note text not null default '' check (char_length(note) <= 80)
);
create index on public.balance_adjustments (user_id, account_id, date);

-- ---------------------------------------------------------------------------
-- Strategies, confluences, tags
-- ---------------------------------------------------------------------------

create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '',
  market text not null default '',
  timeframe text not null default '',
  entry_criteria text not null default '',
  exit_criteria text not null default '',
  invalidation text not null default '',
  notes text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.strategies (user_id);

create table public.confluences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  unique (user_id, name)
);

create table public.strategy_confluences (
  strategy_id uuid not null references public.strategies (id) on delete cascade,
  confluence_id uuid not null references public.confluences (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (strategy_id, confluence_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------
-- Trades, executions, attachments
-- ---------------------------------------------------------------------------

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  number int not null,
  account_id uuid references public.accounts (id) on delete set null,
  strategy_id uuid references public.strategies (id) on delete set null,
  symbol text not null default '' check (char_length(symbol) <= 24),
  market text check (market in ('Forex','Futures','Stocks','Crypto','Indices','Options','Commodities','Other')),
  direction text check (direction in ('long','short')),
  date date not null,
  session text,
  point_value numeric(18,6) not null default 1 check (point_value > 0),
  stop_price numeric(20,8),
  target_price numeric(20,8),
  planned_risk numeric(18,2) check (planned_risk > 0),
  manual_net numeric(18,2),
  fees numeric(18,2) not null default 0 check (fees >= 0),
  setup text not null default '',
  grade text check (grade in ('A+','A','B','C','D','F')),
  entry_notes text not null default '',
  exit_notes text not null default '',
  emotions text[] not null default '{}',
  emotion_note text not null default '',
  mistakes text[] not null default '{}',
  reflection_went_well text not null default '',
  reflection_improve text not null default '',
  reflection_followed_plan text check (reflection_followed_plan in ('yes','partial','no')),
  reflection_learned text not null default '',
  showcase_pinned boolean not null default false,
  showcase_description text not null default '',
  showcase_background text not null default 'ledger',
  is_draft boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);
create index on public.trades (user_id, date);
create index on public.trades (user_id, account_id);

create table public.trade_tags (
  trade_id uuid not null references public.trades (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (trade_id, tag_id)
);

create table public.trade_confluences (
  trade_id uuid not null references public.trades (id) on delete cascade,
  confluence_id uuid not null references public.confluences (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (trade_id, confluence_id)
);

create table public.executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null references public.trades (id) on delete cascade,
  kind text not null check (kind in ('entry','exit')),
  price numeric(20,8) not null check (price >= 0),
  quantity numeric(20,8) not null check (quantity > 0),
  executed_at timestamptz not null,
  fees numeric(18,2) not null default 0 check (fees >= 0),
  note text not null default ''
);
create index on public.executions (trade_id);

-- Exited quantity may never exceed entered quantity.
create or replace function public.check_execution_quantities() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  entered numeric; exited numeric;
begin
  select coalesce(sum(quantity) filter (where kind = 'entry'), 0), coalesce(sum(quantity) filter (where kind = 'exit'), 0)
    into entered, exited from public.executions where trade_id = coalesce(new.trade_id, old.trade_id);
  if exited > entered then raise exception 'Exited quantity cannot exceed entered quantity'; end if;
  return null;
end $$;
create constraint trigger executions_exit_qty_guard after insert or update or delete on public.executions
  deferrable initially deferred for each row execute function public.check_execution_quantities();

create table public.trade_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null references public.trades (id) on delete cascade,
  role text not null check (role in ('before','after','additional')),
  storage_path text not null, -- {user_id}/{trade_id}/{file}
  name text not null default '',
  annotation text not null default '',
  created_at timestamptz not null default now(),
  check (storage_path like (user_id::text || '/%'))
);

create table public.trade_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null references public.trades (id) on delete cascade,
  at timestamptz not null default now(),
  message text not null
);

-- ---------------------------------------------------------------------------
-- Journals
-- ---------------------------------------------------------------------------

create table public.daily_journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  pre_intentions text not null default '', pre_learning text not null default '', pre_habits text not null default '',
  pre_avoid text not null default '', pre_reflection_plan text not null default '',
  post_happened text not null default '', post_learned text not null default '',
  post_followed_process text check (post_followed_process in ('yes','partial','no')),
  post_difficult text not null default '', post_improve text not null default '',
  mood text,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.weekly_journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  reflection text not null default '', progress text not null default '', recurring_mistakes text not null default '',
  lessons text not null default '', next_objectives text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  target numeric not null check (target > 0),
  progress numeric not null default 0 check (progress >= 0),
  unit text not null default '',
  due date,
  created_at timestamptz not null default now()
);

create table public.checklist_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  item_id text not null,
  primary key (user_id, date, item_id)
);

-- ---------------------------------------------------------------------------
-- Study
-- ---------------------------------------------------------------------------

create table public.study_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid not null references public.study_folders (id) on delete restrict,
  title text not null default 'Untitled note' check (char_length(title) <= 120),
  blocks jsonb not null default '[]'::jsonb, -- ordered NoteBlock[]
  video_url text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  cards jsonb not null default '[]'::jsonb, -- BoardCard[] with positions
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Verses (library is public reference data; favourites are private)
-- ---------------------------------------------------------------------------

create table public.verse_library (
  id text primary key, -- e.g. 'PRO.16.3'
  reference text not null,
  translation text not null default 'KJV',
  text text not null,
  topics text[] not null default '{}',
  reflection text not null default ''
);

create table public.favourite_verses (
  user_id uuid not null references auth.users (id) on delete cascade,
  verse_id text not null references public.verse_library (id),
  reflection text not null default '' check (char_length(reflection) <= 2000),
  saved_at timestamptz not null default now(),
  primary key (user_id, verse_id)
);

create table public.verse_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  verse_id text not null references public.verse_library (id),
  page text not null,
  at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reports & AI
-- ---------------------------------------------------------------------------

create table public.performance_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('trade','daily','weekly','monthly','strategy','overview')),
  theme text not null default 'ledger',
  ref_id text,
  stats text[] not null default '{}',
  reflection text not null default '',
  font text not null default 'sans' check (font in ('sans','serif')),
  show_logo boolean not null default true,
  show_chart boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 32000),
  citations text[] not null default '{}',
  mode text check (mode in ('model','offline')),
  created_at timestamptz not null default now()
);
create index on public.ai_messages (conversation_id, created_at);

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  filter jsonb not null
);

-- ---------------------------------------------------------------------------
-- Row-level security: owner-only access on every user table
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_settings','accounts','balance_adjustments','strategies','confluences','strategy_confluences','tags',
    'trades','trade_tags','trade_confluences','executions','trade_attachments','trade_activity','daily_journals',
    'weekly_journals','goals','checklist_log','study_folders','study_notes','study_boards','favourite_verses',
    'verse_history','performance_reports','ai_conversations','ai_messages','saved_filters'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for select using (user_id = auth.uid())', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert with check (user_id = auth.uid())', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete using (user_id = auth.uid())', t || '_delete_own', t);
  end loop;
end $$;

-- Child rows must reference a parent the same user owns.
create policy executions_parent_owned on public.executions as restrictive for all
  using (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()));
create policy attachments_parent_owned on public.trade_attachments as restrictive for all
  using (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.trades t where t.id = trade_id and t.user_id = auth.uid()));
create policy trades_account_owned on public.trades as restrictive for all
  using (true)
  with check (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()));
create policy ai_messages_parent_owned on public.ai_messages as restrictive for all
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- Verse library: readable by any signed-in user, writable by no one through the API.
alter table public.verse_library enable row level security;
create policy verse_library_read on public.verse_library for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Private storage for attachments: objects live under {user_id}/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ledgr-attachments', 'ledgr-attachments', false, 8388608, array['image/png','image/jpeg','image/webp','image/gif','application/pdf'])
on conflict (id) do nothing;

create policy "attachments: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'ledgr-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachments: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'ledgr-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachments: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'ledgr-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachments: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'ledgr-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trades_touch before update on public.trades for each row execute function public.touch_updated_at();
create trigger strategies_touch before update on public.strategies for each row execute function public.touch_updated_at();
create trigger notes_touch before update on public.study_notes for each row execute function public.touch_updated_at();
create trigger daily_touch before update on public.daily_journals for each row execute function public.touch_updated_at();
create trigger weekly_touch before update on public.weekly_journals for each row execute function public.touch_updated_at();

-- Create profile and settings rows when a user signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

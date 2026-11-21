-- LEDGR community: public trader profiles, posts (with pictures/video), replies, likes,
-- 24-hour stories, crews, follows, direct messages, blocks and reports.
-- Every table uses row-level security. Run this once in Supabase → SQL Editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Public profiles
-- ---------------------------------------------------------------------------
create table if not exists public.community_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  bio text not null default '' check (char_length(bio) <= 280),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 300),
  -- Stats the trader chose to show, calculated by the app from their own journal.
  public_stats jsonb not null default '{}'::jsonb check (pg_column_size(public_stats) < 8192),
  -- Who may send this person a direct message: 'mutual' (people who follow each other), 'nobody'.
  dm_policy text not null default 'mutual' check (dm_policy in ('mutual', 'nobody')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.community_profiles enable row level security;
alter table public.community_profiles force row level security;
drop policy if exists cp_read on public.community_profiles;
create policy cp_read on public.community_profiles for select to anon, authenticated using (true);
drop policy if exists cp_insert on public.community_profiles;
create policy cp_insert on public.community_profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists cp_update on public.community_profiles;
create policy cp_update on public.community_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists cp_delete on public.community_profiles;
create policy cp_delete on public.community_profiles for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Follows and blocks
-- ---------------------------------------------------------------------------
create table if not exists public.community_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.community_follows enable row level security;
alter table public.community_follows force row level security;
drop policy if exists cf_read on public.community_follows;
create policy cf_read on public.community_follows for select to anon, authenticated using (true);
drop policy if exists cf_insert on public.community_follows;
create policy cf_insert on public.community_follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists cf_delete on public.community_follows;
create policy cf_delete on public.community_follows for delete to authenticated using (follower_id = auth.uid());

create table if not exists public.community_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.community_blocks enable row level security;
alter table public.community_blocks force row level security;
drop policy if exists cb_read on public.community_blocks;
create policy cb_read on public.community_blocks for select to authenticated using (blocker_id = auth.uid() or blocked_id = auth.uid());
drop policy if exists cb_insert on public.community_blocks;
create policy cb_insert on public.community_blocks for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists cb_delete on public.community_blocks;
create policy cb_delete on public.community_blocks for delete to authenticated using (blocker_id = auth.uid());

-- Either person blocked the other.
create or replace function public.community_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

-- ---------------------------------------------------------------------------
-- Crews (groups)
-- ---------------------------------------------------------------------------
create table if not exists public.community_crews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  description text not null default '' check (char_length(description) <= 280),
  is_private boolean not null default false,
  -- Private crews are joined with this code (only members can read it).
  invite_code text not null default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);
create table if not exists public.community_crew_members (
  crew_id uuid not null references public.community_crews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create or replace function public.community_is_member(c uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_crew_members where crew_id = c and user_id = u)
$$;

alter table public.community_crews enable row level security;
alter table public.community_crews force row level security;
-- Public crews are visible to everyone; private crews only to their members.
drop policy if exists cc_read on public.community_crews;
create policy cc_read on public.community_crews for select to anon, authenticated using (not is_private or public.community_is_member(id, auth.uid()));
drop policy if exists cc_insert on public.community_crews;
create policy cc_insert on public.community_crews for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists cc_update on public.community_crews;
create policy cc_update on public.community_crews for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists cc_delete on public.community_crews;
create policy cc_delete on public.community_crews for delete to authenticated using (owner_id = auth.uid());

-- Hide the invite code from non-members by reading crews through this view in the app.
create or replace view public.community_crews_public with (security_invoker = true) as
  select id, owner_id, name, description, is_private, created_at,
         (select count(*) from public.community_crew_members m where m.crew_id = c.id) as member_count
  from public.community_crews c;

alter table public.community_crew_members enable row level security;
alter table public.community_crew_members force row level security;
drop policy if exists ccm_read on public.community_crew_members;
create policy ccm_read on public.community_crew_members for select to anon, authenticated using (
  exists (select 1 from public.community_crews c where c.id = crew_id and (not c.is_private or public.community_is_member(c.id, auth.uid())))
);
-- Anyone signed in may join a public crew; private crews go through community_join_crew(code).
drop policy if exists ccm_join_public on public.community_crew_members;
create policy ccm_join_public on public.community_crew_members for insert to authenticated with check (
  user_id = auth.uid() and role = 'member' and exists (select 1 from public.community_crews c where c.id = crew_id and not c.is_private)
);
drop policy if exists ccm_leave on public.community_crew_members;
create policy ccm_leave on public.community_crew_members for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.community_crews c where c.id = crew_id and c.owner_id = auth.uid())
);

-- The owner becomes a member when the crew is created.
create or replace function public.community_crew_owner_join() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.community_crew_members (crew_id, user_id, role) values (new.id, new.owner_id, 'owner') on conflict do nothing; return new; end $$;
drop trigger if exists community_crew_owner_join on public.community_crews;
create trigger community_crew_owner_join after insert on public.community_crews for each row execute function public.community_crew_owner_join();

-- Join a private crew with its invite code.
create or replace function public.community_join_crew(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into c from public.community_crews where invite_code = code;
  if c is null then raise exception 'That invite code doesn''t match a crew'; end if;
  insert into public.community_crew_members (crew_id, user_id) values (c, auth.uid()) on conflict do nothing;
  return c;
end $$;
revoke all on function public.community_join_crew(text) from public, anon;
grant execute on function public.community_join_crew(text) to authenticated;

-- Members (only) can read a private crew's invite code to share it.
create or replace function public.community_crew_invite(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select invite_code from public.community_crews where id = c and public.community_is_member(c, auth.uid())
$$;
revoke all on function public.community_crew_invite(uuid) from public, anon;
grant execute on function public.community_crew_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Posts, replies, likes
-- ---------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  crew_id uuid references public.community_crews (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  -- Up to 10 pictures or videos: [{ "path": "<uid>/...", "kind": "image" | "video" }]
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 10),
  -- An optional trade the author chose to share (symbol, direction, R, result…), as they chose to show it.
  trade jsonb check (trade is null or pg_column_size(trade) < 4096),
  created_at timestamptz not null default now(),
  check (char_length(body) > 0 or jsonb_array_length(media) > 0 or trade is not null)
);
create index if not exists community_posts_created on public.community_posts (created_at desc);
create index if not exists community_posts_user on public.community_posts (user_id, created_at desc);
create index if not exists community_posts_crew on public.community_posts (crew_id, created_at desc);
alter table public.community_posts enable row level security;
alter table public.community_posts force row level security;
drop policy if exists cpo_read on public.community_posts;
create policy cpo_read on public.community_posts for select to anon, authenticated using (
  (crew_id is null or public.community_is_member(crew_id, auth.uid()))
  and (auth.uid() is null or not public.community_blocked(auth.uid(), user_id))
);
drop policy if exists cpo_insert on public.community_posts;
create policy cpo_insert on public.community_posts for insert to authenticated with check (
  user_id = auth.uid() and (crew_id is null or public.community_is_member(crew_id, auth.uid()))
);
drop policy if exists cpo_delete on public.community_posts;
create policy cpo_delete on public.community_posts for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.community_crews c where c.id = crew_id and c.owner_id = auth.uid())
);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists community_replies_post on public.community_replies (post_id, created_at);
alter table public.community_replies enable row level security;
alter table public.community_replies force row level security;
-- Replies follow their post's visibility (the post policy applies inside the subquery).
drop policy if exists cr_read on public.community_replies;
create policy cr_read on public.community_replies for select to anon, authenticated using (
  exists (select 1 from public.community_posts p where p.id = post_id)
  and (auth.uid() is null or not public.community_blocked(auth.uid(), user_id))
);
drop policy if exists cr_insert on public.community_replies;
create policy cr_insert on public.community_replies for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.community_posts p where p.id = post_id and not public.community_blocked(auth.uid(), p.user_id))
);
drop policy if exists cr_delete on public.community_replies;
create policy cr_delete on public.community_replies for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.community_posts p where p.id = post_id and p.user_id = auth.uid())
);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.community_likes enable row level security;
alter table public.community_likes force row level security;
drop policy if exists cl_read on public.community_likes;
create policy cl_read on public.community_likes for select to anon, authenticated using (exists (select 1 from public.community_posts p where p.id = post_id));
drop policy if exists cl_insert on public.community_likes;
create policy cl_insert on public.community_likes for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.community_posts p where p.id = post_id));
drop policy if exists cl_delete on public.community_likes;
create policy cl_delete on public.community_likes for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Stories (a trading day, gone after 24 hours)
-- ---------------------------------------------------------------------------
create table if not exists public.community_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_path text not null check (char_length(media_path) <= 300),
  kind text not null check (kind in ('image', 'video')),
  caption text not null default '' check (char_length(caption) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists community_stories_live on public.community_stories (expires_at desc);
alter table public.community_stories enable row level security;
alter table public.community_stories force row level security;
drop policy if exists cs_read on public.community_stories;
create policy cs_read on public.community_stories for select to anon, authenticated using (
  expires_at > now() and (auth.uid() is null or not public.community_blocked(auth.uid(), user_id))
);
drop policy if exists cs_insert on public.community_stories;
create policy cs_insert on public.community_stories for insert to authenticated with check (user_id = auth.uid() and expires_at <= now() + interval '24 hours 5 minutes');
drop policy if exists cs_delete on public.community_stories;
create policy cs_delete on public.community_stories for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Direct messages
-- ---------------------------------------------------------------------------
create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists community_messages_pair on public.community_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);
create index if not exists community_messages_recipient on public.community_messages (recipient_id, created_at desc);

-- May a send b a message? Not blocked, and b's setting allows it (mutual follows, or nobody).
create or replace function public.community_can_message(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not public.community_blocked(a, b)
    and coalesce((select dm_policy from public.community_profiles where user_id = b), 'mutual') = 'mutual'
    and exists (select 1 from public.community_follows where follower_id = a and followee_id = b)
    and exists (select 1 from public.community_follows where follower_id = b and followee_id = a)
$$;

alter table public.community_messages enable row level security;
alter table public.community_messages force row level security;
drop policy if exists cm_read on public.community_messages;
create policy cm_read on public.community_messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists cm_send on public.community_messages;
create policy cm_send on public.community_messages for insert to authenticated with check (
  sender_id = auth.uid() and read_at is null and public.community_can_message(auth.uid(), recipient_id)
);
-- The recipient may mark messages read (only read_at changes; see trigger).
drop policy if exists cm_mark_read on public.community_messages;
create policy cm_mark_read on public.community_messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists cm_delete on public.community_messages;
create policy cm_delete on public.community_messages for delete to authenticated using (sender_id = auth.uid());

create or replace function public.community_messages_only_read() returns trigger language plpgsql as $$
begin
  if new.sender_id <> old.sender_id or new.recipient_id <> old.recipient_id or new.body <> old.body or new.created_at <> old.created_at then
    raise exception 'Only read_at can change';
  end if;
  return new;
end $$;
drop trigger if exists community_messages_only_read on public.community_messages;
create trigger community_messages_only_read before update on public.community_messages for each row execute function public.community_messages_only_read();

-- ---------------------------------------------------------------------------
-- Reports (reviewed by the owner in the Supabase dashboard or the owner page)
-- ---------------------------------------------------------------------------
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'reply', 'story', 'message', 'profile', 'crew')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);
alter table public.community_reports enable row level security;
alter table public.community_reports force row level security;
drop policy if exists crp_insert on public.community_reports;
create policy crp_insert on public.community_reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
drop policy if exists crp_read_own on public.community_reports;
create policy crp_read_own on public.community_reports for select to authenticated using (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Media: public bucket, each person writes only inside their own folder (<user id>/...)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ledgr-community', 'ledgr-community', true, 41943040,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_media_read on storage.objects;
create policy community_media_read on storage.objects for select to anon, authenticated using (bucket_id = 'ledgr-community');
drop policy if exists community_media_insert on storage.objects;
create policy community_media_insert on storage.objects for insert to authenticated with check (bucket_id = 'ledgr-community' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists community_media_delete on storage.objects;
create policy community_media_delete on storage.objects for delete to authenticated using (bucket_id = 'ledgr-community' and (storage.foldername(name))[1] = auth.uid()::text);

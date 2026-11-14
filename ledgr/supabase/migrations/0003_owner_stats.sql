-- Ledgr: totals for the owner dashboard (/admin). Run once in Supabase: SQL Editor > New query > paste > Run.
-- Only the server's secret key (service role) can call it; signed-in users and the public cannot.
create or replace function public.ledgr_owner_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'journals', count(*),
    'trades', coalesce(sum(case when jsonb_typeof(state->'trades') = 'array' then jsonb_array_length(state->'trades') else 0 end), 0),
    'journals_with_trades', count(*) filter (where jsonb_typeof(state->'trades') = 'array' and jsonb_array_length(state->'trades') > 0),
    'synced_7d', count(*) filter (where updated_at > now() - interval '7 days'),
    'synced_30d', count(*) filter (where updated_at > now() - interval '30 days')
  )
  from public.user_snapshots;
$$;
revoke all on function public.ledgr_owner_stats() from public, anon, authenticated;
grant execute on function public.ledgr_owner_stats() to service_role;

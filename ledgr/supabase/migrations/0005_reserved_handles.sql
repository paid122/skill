-- Reserve official-looking community handles for LEDGR's own account (ledgr.support@gmail.com),
-- so nobody else can pose as LEDGR. Safe to run more than once.
create or replace function public.community_reserved_handle() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if new.handle ~ '^(ledgr|ledgrjournal|ledgr_?support|ledgr_?official|ledgr_?team|owner|admin|administrator|support|official|staff|team|mod|moderator|matrixx)$'
     and coalesce((select lower(email) from auth.users where id = new.user_id), '') <> 'ledgr.support@gmail.com' then
    raise exception 'That handle is reserved for LEDGR. Pick another one.' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists community_reserved_handle on public.community_profiles;
create trigger community_reserved_handle before insert or update of handle on public.community_profiles
  for each row execute function public.community_reserved_handle();

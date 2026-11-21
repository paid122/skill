-- Allow up to 20 pictures/videos in a community post (LEDGR+). Safe to run more than once.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.community_posts'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%jsonb_array_length(media) <= 10%'
  loop execute format('alter table public.community_posts drop constraint %I', c); end loop;
end $$;
alter table public.community_posts drop constraint if exists community_posts_media_limit;
alter table public.community_posts add constraint community_posts_media_limit check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 20);

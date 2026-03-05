create table if not exists public.follows (
  follower_user_id uuid not null references public.profiles (user_id) on delete cascade,
  following_user_id uuid not null references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, following_user_id),
  constraint follows_distinct_users check (follower_user_id <> following_user_id)
);

create index if not exists idx_follows_following on public.follows (following_user_id, created_at desc);

alter table public.follows enable row level security;

drop policy if exists follows_select on public.follows;
create policy follows_select
on public.follows
for select
to authenticated
using (true);

drop policy if exists follows_insert on public.follows;
create policy follows_insert
on public.follows
for insert
to authenticated
with check (follower_user_id = auth.uid());

drop policy if exists follows_delete on public.follows;
create policy follows_delete
on public.follows
for delete
to authenticated
using (follower_user_id = auth.uid() or public.is_admin());

create or replace function public.follow_user(p_target uuid, p_user uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_target is null then
    raise exception 'Missing user id';
  end if;
  if p_user = p_target then
    return 'self';
  end if;

  insert into public.follows (follower_user_id, following_user_id)
  values (p_user, p_target)
  on conflict do nothing;

  return 'followed';
end;
$$;

create or replace function public.unfollow_user(p_target uuid, p_user uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_target is null then
    raise exception 'Missing user id';
  end if;

  delete from public.follows
  where follower_user_id = p_user
    and following_user_id = p_target;

  return 'unfollowed';
end;
$$;

create or replace function public.profile_follow_counts(p_target uuid)
returns table(followers bigint, following bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*)::bigint from public.follows f where f.following_user_id = p_target) as followers,
    (select count(*)::bigint from public.follows f where f.follower_user_id = p_target) as following;
$$;

grant execute on function public.follow_user(uuid, uuid) to authenticated;
grant execute on function public.unfollow_user(uuid, uuid) to authenticated;
grant execute on function public.profile_follow_counts(uuid) to authenticated;

create or replace function public.profile_follow_counts(p_target uuid)
returns table(followers bigint, following bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*) filter (
      where m.status = 'mutual'
        and m.created_by is not null
        and m.created_by <> p_target
        and (m.user_a = p_target or m.user_b = p_target)
    )::bigint as followers,
    count(*) filter (
      where m.status = 'mutual'
        and m.created_by = p_target
        and (m.user_a = p_target or m.user_b = p_target)
    )::bigint as following
  from public.matches m;
$$;

grant execute on function public.profile_follow_counts(uuid) to authenticated;

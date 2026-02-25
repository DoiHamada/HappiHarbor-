create or replace function public.can_create_conversation(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_a <> p_user_b
    and not public.are_users_blocked(p_user_a, p_user_b)
    and exists (
      select 1
      from public.profiles a
      where a.user_id = p_user_a
        and a.is_published = true
        and a.is_suspended = false
    )
    and exists (
      select 1
      from public.profiles b
      where b.user_id = p_user_b
        and b.is_published = true
        and b.is_suspended = false
    )
    and public.is_user_verified(p_user_a)
    and public.is_user_verified(p_user_b);
$$;

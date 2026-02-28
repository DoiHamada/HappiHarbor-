create or replace function public.request_friend(p_target uuid, p_user uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_a uuid;
  v_b uuid;
  v_existing public.matches%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if p_target is null or p_target = v_user then
    raise exception 'Invalid target user';
  end if;

  if public.are_users_blocked(v_user, p_target) then
    raise exception 'This user is unavailable';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = v_user
      and p.is_suspended = false
  ) then
    raise exception 'Your account is unavailable';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_target
      and p.is_published = true
      and p.is_suspended = false
  ) then
    raise exception 'This user is unavailable';
  end if;

  if v_user < p_target then
    v_a := v_user;
    v_b := p_target;
  else
    v_a := p_target;
    v_b := v_user;
  end if;

  select *
  into v_existing
  from public.matches m
  where m.user_a = v_a and m.user_b = v_b;

  if v_existing.id is null then
    insert into public.matches (user_a, user_b, status, created_by, score, explanation)
    values (v_a, v_b, 'pending', v_user, 0, '[]'::jsonb);
    return 'requested';
  end if;

  if v_existing.status = 'mutual' then
    return 'already_friends';
  end if;

  if v_existing.status = 'pending' then
    if v_existing.created_by = v_user then
      return 'already_requested';
    end if;

    update public.matches
    set status = 'mutual',
        matched_at = coalesce(matched_at, now()),
        updated_at = now(),
        closed_reason = null
    where id = v_existing.id;
    return 'accepted';
  end if;

  update public.matches
  set status = 'pending',
      created_by = v_user,
      matched_at = null,
      closed_reason = null,
      updated_at = now()
  where id = v_existing.id;

  return 'requested';
end;
$$;

create or replace function public.accept_friend_request(p_match uuid, p_user uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_match public.matches%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_match
  from public.matches m
  where m.id = p_match;

  if v_match.id is null then
    raise exception 'Request not found';
  end if;

  if not (v_match.user_a = v_user or v_match.user_b = v_user) then
    raise exception 'Not authorized';
  end if;

  if v_match.status = 'mutual' then
    return 'already_friends';
  end if;

  if v_match.status <> 'pending' then
    return 'not_pending';
  end if;

  if v_match.created_by = v_user then
    raise exception 'Only recipient can accept';
  end if;

  update public.matches
  set status = 'mutual',
      matched_at = coalesce(matched_at, now()),
      updated_at = now(),
      closed_reason = null
  where id = v_match.id;

  return 'accepted';
end;
$$;

grant execute on function public.request_friend(uuid, uuid) to authenticated;
grant execute on function public.accept_friend_request(uuid, uuid) to authenticated;

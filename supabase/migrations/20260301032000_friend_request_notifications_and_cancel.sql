DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'social_notification_type'
      AND e.enumlabel = 'friend_request'
  ) THEN
    ALTER TYPE public.social_notification_type ADD VALUE 'friend_request';
  END IF;
END
$$;

create or replace function public.cancel_friend_request(p_target uuid, p_user uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_a uuid;
  v_b uuid;
  v_match public.matches%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if p_target is null or p_target = v_user then
    raise exception 'Invalid target user';
  end if;

  if v_user < p_target then
    v_a := v_user;
    v_b := p_target;
  else
    v_a := p_target;
    v_b := v_user;
  end if;

  select *
  into v_match
  from public.matches m
  where m.user_a = v_a and m.user_b = v_b;

  if v_match.id is null then
    return 'not_found';
  end if;

  if v_match.status <> 'pending' then
    return 'not_pending';
  end if;

  if v_match.created_by <> v_user then
    raise exception 'Only requester can cancel';
  end if;

  update public.matches
  set status = 'closed',
      closed_reason = 'request_canceled',
      updated_at = now()
  where id = v_match.id;

  return 'canceled';
end;
$$;

grant execute on function public.cancel_friend_request(uuid, uuid) to authenticated;

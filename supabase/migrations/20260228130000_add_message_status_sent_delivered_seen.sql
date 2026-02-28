alter table public.conversation_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists seen_at timestamptz;

create index if not exists idx_conversation_messages_conversation_delivered
on public.conversation_messages (conversation_id, delivered_at);

create index if not exists idx_conversation_messages_conversation_seen
on public.conversation_messages (conversation_id, seen_at);

create or replace function public.mark_conversation_delivered(p_user uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  update public.conversation_messages m
  set
    delivered_at = coalesce(m.delivered_at, v_now),
    updated_at = now()
  from public.conversations c
  where c.id = m.conversation_id
    and (c.user_a = p_user or c.user_b = p_user)
    and m.sender_id <> p_user
    and m.delivered_at is null;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation uuid, p_user uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation
      and (c.user_a = p_user or c.user_b = p_user)
  ) then
    return;
  end if;

  update public.conversation_messages m
  set
    delivered_at = coalesce(m.delivered_at, v_now),
    seen_at = coalesce(m.seen_at, v_now),
    updated_at = now()
  where m.conversation_id = p_conversation
    and m.sender_id <> p_user
    and (m.delivered_at is null or m.seen_at is null);

  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conversation, p_user, v_now)
  on conflict (conversation_id, user_id)
  do update set
    last_read_at = excluded.last_read_at,
    updated_at = now();
end;
$$;

grant execute on function public.mark_conversation_delivered(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;

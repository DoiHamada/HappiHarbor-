-- Messaging v2: request-based conversations + direct chat for mutual matches

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_request_status_enum') THEN
    CREATE TYPE public.message_request_status_enum AS ENUM ('pending', 'approved', 'rejected', 'canceled');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_source_enum') THEN
    CREATE TYPE public.conversation_source_enum AS ENUM ('match', 'request');
  END IF;
END
$$;

create table if not exists public.message_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.profiles (user_id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (user_id) on delete cascade,
  status public.message_request_status_enum not null default 'pending',
  message text check (message is null or char_length(message) between 1 and 300),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_requests_distinct_users check (requester_user_id <> recipient_user_id)
);

create unique index if not exists idx_message_requests_pending_pair
on public.message_requests ((least(requester_user_id, recipient_user_id)), (greatest(requester_user_id, recipient_user_id)))
where status = 'pending';

create index if not exists idx_message_requests_recipient_created
on public.message_requests (recipient_user_id, created_at desc);

create index if not exists idx_message_requests_requester_created
on public.message_requests (requester_user_id, created_at desc);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (user_id) on delete cascade,
  user_b uuid not null references public.profiles (user_id) on delete cascade,
  source public.conversation_source_enum not null,
  request_id uuid references public.message_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_distinct_users check (user_a <> user_b),
  constraint conversations_unique_pair unique (user_a, user_b)
);

create index if not exists idx_conversations_user_a_created
on public.conversations (user_a, created_at desc);

create index if not exists idx_conversations_user_b_created
on public.conversations (user_b, created_at desc);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (user_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversation_messages_created
on public.conversation_messages (conversation_id, created_at asc);

create index if not exists idx_conversation_messages_sender_created
on public.conversation_messages (sender_id, created_at desc);

create or replace function public.can_create_message_request(p_requester uuid, p_recipient uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requester_profile public.profiles%rowtype;
  recipient_profile public.profiles%rowtype;
begin
  if p_requester = p_recipient then
    return false;
  end if;

  select * into requester_profile from public.profiles where user_id = p_requester;
  select * into recipient_profile from public.profiles where user_id = p_recipient;

  if requester_profile.user_id is null or recipient_profile.user_id is null then
    return false;
  end if;

  if requester_profile.is_suspended or recipient_profile.is_suspended then
    return false;
  end if;

  if not public.is_user_verified(p_requester) or not public.is_user_verified(p_recipient) then
    return false;
  end if;

  if public.are_users_blocked(p_requester, p_recipient) then
    return false;
  end if;

  return true;
end;
$$;

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
    and (
      exists (
        select 1
        from public.matches m
        where m.status = 'mutual'
          and (
            (m.user_a = p_user_a and m.user_b = p_user_b)
            or
            (m.user_a = p_user_b and m.user_b = p_user_a)
          )
      )
      or
      exists (
        select 1
        from public.message_requests r
        where r.status = 'approved'
          and (
            (r.requester_user_id = p_user_a and r.recipient_user_id = p_user_b)
            or
            (r.requester_user_id = p_user_b and r.recipient_user_id = p_user_a)
          )
      )
    );
$$;

create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (
        c.user_a = auth.uid()
        or
        c.user_b = auth.uid()
        or
        public.is_admin()
      )
  );
$$;

create or replace function public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (c.user_a = p_user_id or c.user_b = p_user_id)
  );
$$;

create or replace function public.normalize_conversation_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tmp uuid;
begin
  if new.user_a = new.user_b then
    raise exception 'Cannot create conversation with the same user';
  end if;

  if new.user_a > new.user_b then
    tmp := new.user_a;
    new.user_a := new.user_b;
    new.user_b := tmp;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_message_requests_updated_at on public.message_requests;
create trigger trg_message_requests_updated_at
before update on public.message_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists trg_conversations_normalize_pair on public.conversations;
create trigger trg_conversations_normalize_pair
before insert or update on public.conversations
for each row execute function public.normalize_conversation_pair();

drop trigger if exists trg_conversation_messages_updated_at on public.conversation_messages;
create trigger trg_conversation_messages_updated_at
before update on public.conversation_messages
for each row execute function public.set_updated_at();

alter table public.message_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

DROP POLICY IF EXISTS message_requests_select ON public.message_requests;
create policy message_requests_select
on public.message_requests
for select
to authenticated
using (
  public.is_admin()
  or requester_user_id = auth.uid()
  or recipient_user_id = auth.uid()
);

DROP POLICY IF EXISTS message_requests_insert ON public.message_requests;
create policy message_requests_insert
on public.message_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and status = 'pending'
  and public.can_create_message_request(requester_user_id, recipient_user_id)
);

DROP POLICY IF EXISTS message_requests_update ON public.message_requests;
create policy message_requests_update
on public.message_requests
for update
to authenticated
using (
  public.is_admin()
  or (recipient_user_id = auth.uid() and status = 'pending')
  or (requester_user_id = auth.uid() and status = 'pending')
)
with check (
  public.is_admin()
  or (recipient_user_id = auth.uid() and status in ('approved', 'rejected'))
  or (requester_user_id = auth.uid() and status = 'canceled')
);

DROP POLICY IF EXISTS conversations_select ON public.conversations;
create policy conversations_select
on public.conversations
for select
to authenticated
using (
  public.is_admin()
  or user_a = auth.uid()
  or user_b = auth.uid()
);

DROP POLICY IF EXISTS conversations_insert ON public.conversations;
create policy conversations_insert
on public.conversations
for insert
to authenticated
with check (
  (user_a = auth.uid() or user_b = auth.uid())
  and public.can_create_conversation(user_a, user_b)
);

DROP POLICY IF EXISTS conversation_messages_select ON public.conversation_messages;
create policy conversation_messages_select
on public.conversation_messages
for select
to authenticated
using (
  public.is_admin()
  or public.can_access_conversation(conversation_id)
);

DROP POLICY IF EXISTS conversation_messages_insert ON public.conversation_messages;
create policy conversation_messages_insert
on public.conversation_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.can_access_conversation(conversation_id)
  and public.is_conversation_participant(conversation_id, sender_id)
);

DROP POLICY IF EXISTS conversation_messages_update ON public.conversation_messages;
create policy conversation_messages_update
on public.conversation_messages
for update
to authenticated
using (public.is_admin() or sender_id = auth.uid())
with check (public.is_admin() or sender_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversation_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
  END IF;
END
$$;

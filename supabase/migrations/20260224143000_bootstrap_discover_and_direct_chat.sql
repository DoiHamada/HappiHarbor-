-- Bootstrap migration for environments missing discover/chat tables.
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_source_enum') THEN
    CREATE TYPE public.conversation_source_enum AS ENUM ('match', 'request');
  END IF;
END
$$;

create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  thought text check (thought is null or char_length(thought) between 1 and 1000),
  photo_path text check (photo_path is null or char_length(photo_path) between 3 and 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feed_post_content_required check (coalesce(nullif(btrim(thought), ''), photo_path) is not null)
);

create index if not exists idx_feed_posts_created_at on public.feed_posts (created_at desc);
create index if not exists idx_feed_posts_user_created_at on public.feed_posts (user_id, created_at desc);

alter table public.feed_posts enable row level security;

DROP POLICY IF EXISTS feed_posts_select ON public.feed_posts;
create policy feed_posts_select
on public.feed_posts
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = feed_posts.user_id
      and p.is_published = true
      and p.is_suspended = false
  )
);

DROP POLICY IF EXISTS feed_posts_insert ON public.feed_posts;
create policy feed_posts_insert
on public.feed_posts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_suspended = false
  )
);

DROP POLICY IF EXISTS feed_posts_update ON public.feed_posts;
create policy feed_posts_update
on public.feed_posts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

DROP POLICY IF EXISTS feed_posts_delete ON public.feed_posts;
create policy feed_posts_delete
on public.feed_posts
for delete
to authenticated
using (user_id = auth.uid());

drop trigger if exists trg_feed_posts_updated_at on public.feed_posts;
create trigger trg_feed_posts_updated_at
before update on public.feed_posts
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feed-photos',
  'feed-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

DROP POLICY IF EXISTS feed_photos_select ON storage.objects;
create policy feed_photos_select
on storage.objects
for select
to authenticated
using (bucket_id = 'feed-photos');

DROP POLICY IF EXISTS feed_photos_insert ON storage.objects;
create policy feed_photos_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'feed-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS feed_photos_update ON storage.objects;
create policy feed_photos_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'feed-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'feed-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS feed_photos_delete ON storage.objects;
create policy feed_photos_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'feed-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (user_id) on delete cascade,
  user_b uuid not null references public.profiles (user_id) on delete cascade,
  source public.conversation_source_enum not null default 'request',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_distinct_users check (user_a <> user_b),
  constraint conversations_unique_pair unique (user_a, user_b)
);

create index if not exists idx_conversations_user_a_created on public.conversations (user_a, created_at desc);
create index if not exists idx_conversations_user_b_created on public.conversations (user_b, created_at desc);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (user_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversation_messages_created on public.conversation_messages (conversation_id, created_at asc);
create index if not exists idx_conversation_messages_sender_created on public.conversation_messages (sender_id, created_at desc);

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
      and (c.user_a = auth.uid() or c.user_b = auth.uid() or public.is_admin())
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

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

DROP POLICY IF EXISTS conversations_select ON public.conversations;
create policy conversations_select
on public.conversations
for select
to authenticated
using (public.is_admin() or user_a = auth.uid() or user_b = auth.uid());

DROP POLICY IF EXISTS conversations_insert ON public.conversations;
create policy conversations_insert
on public.conversations
for insert
to authenticated
with check ((user_a = auth.uid() or user_b = auth.uid()) and public.can_create_conversation(user_a, user_b));

DROP POLICY IF EXISTS conversation_messages_select ON public.conversation_messages;
create policy conversation_messages_select
on public.conversation_messages
for select
to authenticated
using (public.is_admin() or public.can_access_conversation(conversation_id));

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

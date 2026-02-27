alter table public.profiles
  add column if not exists cover_photo_url text,
  add column if not exists cover_photo_storage_path text;

alter table public.preferences
  add column if not exists preferred_languages text[];

create index if not exists idx_preferences_preferred_languages on public.preferences using gin (preferred_languages);

alter table public.feed_posts
  add column if not exists is_public boolean not null default true;

create index if not exists idx_feed_posts_public_created_at
on public.feed_posts (created_at desc)
where is_public = true;

create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists idx_conversation_reads_user_last_read
on public.conversation_reads (user_id, last_read_at desc);

drop trigger if exists trg_conversation_reads_updated_at on public.conversation_reads;
create trigger trg_conversation_reads_updated_at
before update on public.conversation_reads
for each row execute function public.set_updated_at();

insert into public.conversation_reads (conversation_id, user_id, last_read_at)
select c.id, c.user_a, now()
from public.conversations c
on conflict (conversation_id, user_id) do nothing;

insert into public.conversation_reads (conversation_id, user_id, last_read_at)
select c.id, c.user_b, now()
from public.conversations c
on conflict (conversation_id, user_id) do nothing;

create or replace function public.unread_conversation_message_count(p_user uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::int
  from public.conversation_messages m
  inner join public.conversations c on c.id = m.conversation_id
  left join public.conversation_reads r
    on r.conversation_id = m.conversation_id
    and r.user_id = p_user
  where (c.user_a = p_user or c.user_b = p_user)
    and m.sender_id <> p_user
    and m.created_at > coalesce(r.last_read_at, '1970-01-01'::timestamptz);
$$;

create or replace function public.mark_conversation_read(p_conversation uuid, p_user uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation
      and (c.user_a = p_user or c.user_b = p_user)
  ) then
    return;
  end if;

  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conversation, p_user, now())
  on conflict (conversation_id, user_id)
  do update set
    last_read_at = excluded.last_read_at,
    updated_at = now();
end;
$$;

grant execute on function public.unread_conversation_message_count(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;

alter table public.conversation_reads enable row level security;

DROP POLICY IF EXISTS conversation_reads_select ON public.conversation_reads;
create policy conversation_reads_select
on public.conversation_reads
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_reads.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

DROP POLICY IF EXISTS conversation_reads_insert ON public.conversation_reads;
create policy conversation_reads_insert
on public.conversation_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_reads.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

DROP POLICY IF EXISTS conversation_reads_update ON public.conversation_reads;
create policy conversation_reads_update
on public.conversation_reads
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_reads.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_reads.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

DROP POLICY IF EXISTS feed_posts_select ON public.feed_posts;
create policy feed_posts_select
on public.feed_posts
for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (
    is_public = true
    and exists (
      select 1
      from public.profiles p
      where p.user_id = feed_posts.user_id
        and p.is_published = true
        and p.is_suspended = false
    )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-covers',
  'profile-covers',
  true,
  7340032,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

DROP POLICY IF EXISTS profile_avatars_select ON storage.objects;
create policy profile_avatars_select
on storage.objects
for select
to authenticated
using (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS profile_avatars_insert ON storage.objects;
create policy profile_avatars_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS profile_avatars_update ON storage.objects;
create policy profile_avatars_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS profile_avatars_delete ON storage.objects;
create policy profile_avatars_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS profile_covers_select ON storage.objects;
create policy profile_covers_select
on storage.objects
for select
to authenticated
using (bucket_id = 'profile-covers');

DROP POLICY IF EXISTS profile_covers_insert ON storage.objects;
create policy profile_covers_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS profile_covers_update ON storage.objects;
create policy profile_covers_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS profile_covers_delete ON storage.objects;
create policy profile_covers_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

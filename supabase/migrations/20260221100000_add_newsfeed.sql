-- Newsfeed: user thoughts + optional photo uploads

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
  public.is_admin()
  or user_id = auth.uid()
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
  and public.is_user_verified(auth.uid())
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
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

DROP POLICY IF EXISTS feed_posts_delete ON public.feed_posts;
create policy feed_posts_delete
on public.feed_posts
for delete
to authenticated
using (public.is_admin() or user_id = auth.uid());

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

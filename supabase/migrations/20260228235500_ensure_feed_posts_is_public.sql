alter table public.feed_posts
  add column if not exists is_public boolean;

update public.feed_posts
set is_public = true
where is_public is null;

alter table public.feed_posts
  alter column is_public set default true;

alter table public.feed_posts
  alter column is_public set not null;

create index if not exists idx_feed_posts_public_created_at
on public.feed_posts (created_at desc)
where is_public = true;

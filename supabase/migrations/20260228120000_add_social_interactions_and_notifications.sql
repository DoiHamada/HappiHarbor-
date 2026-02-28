create or replace function public.are_users_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where m.status = 'mutual'
      and (
        (m.user_a = p_user_a and m.user_b = p_user_b)
        or (m.user_a = p_user_b and m.user_b = p_user_a)
      )
  );
$$;

create or replace function public.can_view_feed_post(p_post_id uuid, p_viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.feed_posts fp
    join public.profiles owner on owner.user_id = fp.user_id
    where fp.id = p_post_id
      and (
        p_viewer = fp.user_id
        or (
          fp.is_public = true
          and owner.is_published = true
          and owner.is_suspended = false
        )
        or (
          fp.is_public = false
          and public.are_users_friends(fp.user_id, p_viewer)
        )
      )
  );
$$;

DROP POLICY IF EXISTS feed_posts_select ON public.feed_posts;
create policy feed_posts_select
on public.feed_posts
for select
to authenticated
using (
  public.is_admin()
  or public.can_view_feed_post(id, auth.uid())
);

create table if not exists public.feed_post_reactions (
  post_id uuid not null references public.feed_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  reaction text not null check (char_length(reaction) between 1 and 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists idx_feed_post_reactions_post_created
on public.feed_post_reactions (post_id, created_at desc);

create index if not exists idx_feed_post_reactions_user_created
on public.feed_post_reactions (user_id, created_at desc);

create table if not exists public.feed_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feed_post_comments_post_created
on public.feed_post_comments (post_id, created_at asc);

create index if not exists idx_feed_post_comments_user_created
on public.feed_post_comments (user_id, created_at desc);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_notification_type') THEN
    CREATE TYPE public.social_notification_type AS ENUM ('reaction', 'comment', 'profile_view');
  END IF;
END
$$;

create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles (user_id) on delete cascade,
  actor_user_id uuid not null references public.profiles (user_id) on delete cascade,
  type public.social_notification_type not null,
  post_id uuid references public.feed_posts (id) on delete cascade,
  comment_id uuid references public.feed_post_comments (id) on delete cascade,
  reaction text,
  details text,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  constraint social_notifications_not_self check (recipient_user_id <> actor_user_id)
);

create index if not exists idx_social_notifications_recipient_created
on public.social_notifications (recipient_user_id, created_at desc);

create index if not exists idx_social_notifications_actor_created
on public.social_notifications (actor_user_id, created_at desc);

drop trigger if exists trg_feed_post_reactions_updated_at on public.feed_post_reactions;
create trigger trg_feed_post_reactions_updated_at
before update on public.feed_post_reactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_feed_post_comments_updated_at on public.feed_post_comments;
create trigger trg_feed_post_comments_updated_at
before update on public.feed_post_comments
for each row execute function public.set_updated_at();

alter table public.feed_post_reactions enable row level security;
alter table public.feed_post_comments enable row level security;
alter table public.social_notifications enable row level security;

DROP POLICY IF EXISTS feed_post_reactions_select ON public.feed_post_reactions;
create policy feed_post_reactions_select
on public.feed_post_reactions
for select
to authenticated
using (public.can_view_feed_post(post_id, auth.uid()));

DROP POLICY IF EXISTS feed_post_reactions_insert ON public.feed_post_reactions;
create policy feed_post_reactions_insert
on public.feed_post_reactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_view_feed_post(post_id, auth.uid())
);

DROP POLICY IF EXISTS feed_post_reactions_update ON public.feed_post_reactions;
create policy feed_post_reactions_update
on public.feed_post_reactions
for update
to authenticated
using (user_id = auth.uid() and public.can_view_feed_post(post_id, auth.uid()))
with check (user_id = auth.uid() and public.can_view_feed_post(post_id, auth.uid()));

DROP POLICY IF EXISTS feed_post_reactions_delete ON public.feed_post_reactions;
create policy feed_post_reactions_delete
on public.feed_post_reactions
for delete
to authenticated
using (user_id = auth.uid());

DROP POLICY IF EXISTS feed_post_comments_select ON public.feed_post_comments;
create policy feed_post_comments_select
on public.feed_post_comments
for select
to authenticated
using (public.can_view_feed_post(post_id, auth.uid()));

DROP POLICY IF EXISTS feed_post_comments_insert ON public.feed_post_comments;
create policy feed_post_comments_insert
on public.feed_post_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_view_feed_post(post_id, auth.uid())
);

DROP POLICY IF EXISTS feed_post_comments_update ON public.feed_post_comments;
create policy feed_post_comments_update
on public.feed_post_comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

DROP POLICY IF EXISTS feed_post_comments_delete ON public.feed_post_comments;
create policy feed_post_comments_delete
on public.feed_post_comments
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS social_notifications_select ON public.social_notifications;
create policy social_notifications_select
on public.social_notifications
for select
to authenticated
using (recipient_user_id = auth.uid() or public.is_admin());

DROP POLICY IF EXISTS social_notifications_insert ON public.social_notifications;
create policy social_notifications_insert
on public.social_notifications
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and recipient_user_id <> auth.uid()
);

DROP POLICY IF EXISTS social_notifications_update ON public.social_notifications;
create policy social_notifications_update
on public.social_notifications
for update
to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS social_notifications_delete ON public.social_notifications;
create policy social_notifications_delete
on public.social_notifications
for delete
to authenticated
using (recipient_user_id = auth.uid() or public.is_admin());

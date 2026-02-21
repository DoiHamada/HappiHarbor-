-- HappiHarbor initial schema + RLS
-- Target: Supabase Postgres

create extension if not exists pgcrypto;

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
    CREATE TYPE public.gender_enum AS ENUM (
      'female',
      'male',
      'non_binary',
      'trans_female',
      'trans_male',
      'other',
      'prefer_not_to_say'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sexual_preference_enum') THEN
    CREATE TYPE public.sexual_preference_enum AS ENUM (
      'heterosexual',
      'homosexual',
      'bisexual',
      'pansexual',
      'asexual',
      'questioning',
      'other',
      'prefer_not_to_say'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skin_tone_enum') THEN
    CREATE TYPE public.skin_tone_enum AS ENUM (
      'light',
      'medium',
      'tan',
      'deep',
      'prefer_not_to_say'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status_enum') THEN
    CREATE TYPE public.match_status_enum AS ENUM ('pending', 'mutual', 'closed');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status_enum') THEN
    CREATE TYPE public.message_status_enum AS ENUM ('sent', 'edited', 'deleted');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason_enum') THEN
    CREATE TYPE public.report_reason_enum AS ENUM (
      'harassment',
      'hate_speech',
      'sexual_content',
      'minor_safety',
      'spam_or_scam',
      'impersonation',
      'violence_or_threat',
      'other'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_status_enum') THEN
    CREATE TYPE public.moderation_status_enum AS ENUM ('open', 'in_review', 'resolved', 'dismissed');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flag_source_enum') THEN
    CREATE TYPE public.flag_source_enum AS ENUM ('auto_text_toxicity', 'auto_behavior', 'user_report');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_action_enum') THEN
    CREATE TYPE public.moderation_action_enum AS ENUM ('warn', 'restrict', 'suspend', 'ban');
  END IF;
END
$$;

-- Common updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auth helpers
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.is_user_verified(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and u.email_confirmed_at is not null
  );
$$;

-- Core tables
create table if not exists public.avatar_presets (
  key text primary key check (char_length(key) between 3 and 80),
  label text not null check (char_length(label) between 2 and 60),
  asset_path text not null check (char_length(asset_path) between 3 and 255),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

insert into public.avatar_presets (key, label, asset_path, sort_order)
values
  ('harbor-bear-01', 'Harbor Bear', '/avatars/harbor-bear-01.png', 10),
  ('harbor-cat-01', 'Harbor Cat', '/avatars/harbor-cat-01.png', 20),
  ('harbor-fox-01', 'Harbor Fox', '/avatars/harbor-fox-01.png', 30),
  ('harbor-otter-01', 'Harbor Otter', '/avatars/harbor-otter-01.png', 40),
  ('harbor-rabbit-01', 'Harbor Rabbit', '/avatars/harbor-rabbit-01.png', 50),
  ('harbor-panda-01', 'Harbor Panda', '/avatars/harbor-panda-01.png', 60),
  ('harbor-koala-01', 'Harbor Koala', '/avatars/harbor-koala-01.png', 70),
  ('harbor-deer-01', 'Harbor Deer', '/avatars/harbor-deer-01.png', 80),
  ('harbor-lion-01', 'Harbor Lion', '/avatars/harbor-lion-01.png', 90),
  ('harbor-tiger-01', 'Harbor Tiger', '/avatars/harbor-tiger-01.png', 100)
on conflict (key) do nothing;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 50),
  age_years smallint not null check (age_years between 13 and 100),
  gender public.gender_enum not null,
  nationality text not null check (char_length(nationality) between 2 and 56),
  sexual_preference public.sexual_preference_enum not null,
  height_cm smallint not null check (height_cm between 100 and 250),
  weight_kg numeric(5,2) not null check (weight_kg between 30 and 300),
  skin_tone public.skin_tone_enum not null,
  avatar_key text not null references public.avatar_presets (key),
  bio text,
  is_published boolean not null default false,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preferences (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  min_age smallint not null default 18 check (min_age between 13 and 100),
  max_age smallint not null default 35 check (max_age between 13 and 100 and max_age >= min_age),
  preferred_genders public.gender_enum[],
  preferred_nationalities text[],
  use_appearance_filters boolean not null default false,
  appearance_filters jsonb not null default '{}'::jsonb check (jsonb_typeof(appearance_filters) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (user_id) on delete cascade,
  user_b uuid not null references public.profiles (user_id) on delete cascade,
  status public.match_status_enum not null default 'pending',
  created_by uuid default auth.uid() references public.profiles (user_id),
  score numeric(5,2) not null default 0 check (score between 0 and 100),
  explanation jsonb not null default '[]'::jsonb check (jsonb_typeof(explanation) = 'array'),
  matched_at timestamptz,
  closed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_distinct_users check (user_a <> user_b),
  constraint matches_unique_pair unique (user_a, user_b)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (user_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  status public.message_status_enum not null default 'sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  target_user_id uuid references public.profiles (user_id) on delete set null,
  target_match_id uuid references public.matches (id) on delete set null,
  target_message_id uuid references public.messages (id) on delete set null,
  reason public.report_reason_enum not null,
  details text,
  status public.moderation_status_enum not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id),
  constraint report_target_required check (num_nonnulls(target_user_id, target_match_id, target_message_id) >= 1)
);

create table if not exists public.moderation_flags (
  id uuid primary key default gen_random_uuid(),
  source public.flag_source_enum not null,
  label text not null,
  score numeric(5,2) check (score between 0 and 100),
  target_user_id uuid references public.profiles (user_id) on delete set null,
  target_match_id uuid references public.matches (id) on delete set null,
  target_message_id uuid references public.messages (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  status public.moderation_status_enum not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id)
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles (user_id) on delete cascade,
  action public.moderation_action_enum not null,
  reason text not null,
  duration_hours integer,
  performed_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  constraint duration_for_restrict check (
    (action <> 'restrict')
    or
    (duration_hours is not null and duration_hours > 0)
  )
);

create table if not exists public.blocks (
  blocker_user_id uuid not null references public.profiles (user_id) on delete cascade,
  blocked_user_id uuid not null references public.profiles (user_id) on delete cascade,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  constraint no_self_block check (blocker_user_id <> blocked_user_id)
);

-- Matching eligibility helpers
create or replace function public.are_users_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocks b
    where b.active = true
      and (
        (b.blocker_user_id = p_user_a and b.blocked_user_id = p_user_b)
        or
        (b.blocker_user_id = p_user_b and b.blocked_user_id = p_user_a)
      )
  );
$$;

create or replace function public.is_pair_eligible(p_user_a uuid, p_user_b uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a_profile public.profiles%rowtype;
  b_profile public.profiles%rowtype;
  a_pref public.preferences%rowtype;
  b_pref public.preferences%rowtype;
begin
  if p_user_a = p_user_b then
    return false;
  end if;

  select * into a_profile from public.profiles where user_id = p_user_a;
  select * into b_profile from public.profiles where user_id = p_user_b;

  if a_profile.user_id is null or b_profile.user_id is null then
    return false;
  end if;

  if not a_profile.is_published or not b_profile.is_published then
    return false;
  end if;

  if a_profile.is_suspended or b_profile.is_suspended then
    return false;
  end if;

  -- Strict age bracket separation for MVP
  if (a_profile.age_years < 18 and b_profile.age_years >= 18)
     or
     (a_profile.age_years >= 18 and b_profile.age_years < 18)
  then
    return false;
  end if;

  if not public.is_user_verified(a_profile.user_id) or not public.is_user_verified(b_profile.user_id) then
    return false;
  end if;

  if public.are_users_blocked(a_profile.user_id, b_profile.user_id) then
    return false;
  end if;

  select * into a_pref from public.preferences where user_id = a_profile.user_id;
  select * into b_pref from public.preferences where user_id = b_profile.user_id;

  if a_pref.user_id is null or b_pref.user_id is null then
    return false;
  end if;

  if b_profile.age_years < a_pref.min_age or b_profile.age_years > a_pref.max_age then
    return false;
  end if;

  if a_profile.age_years < b_pref.min_age or a_profile.age_years > b_pref.max_age then
    return false;
  end if;

  if a_pref.preferred_genders is not null and not (b_profile.gender = any(a_pref.preferred_genders)) then
    return false;
  end if;

  if b_pref.preferred_genders is not null and not (a_profile.gender = any(b_pref.preferred_genders)) then
    return false;
  end if;

  if a_pref.preferred_nationalities is not null and not (b_profile.nationality = any(a_pref.preferred_nationalities)) then
    return false;
  end if;

  if b_pref.preferred_nationalities is not null and not (a_profile.nationality = any(b_pref.preferred_nationalities)) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.can_access_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and (
        m.user_a = auth.uid()
        or
        m.user_b = auth.uid()
        or
        public.is_admin()
      )
  );
$$;

create or replace function public.can_send_message(p_match_id uuid, p_sender_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and m.status = 'mutual'
      and p_sender_id = auth.uid()
      and (m.user_a = p_sender_id or m.user_b = p_sender_id)
      and not public.are_users_blocked(m.user_a, m.user_b)
  );
$$;

-- Triggers
create or replace function public.normalize_match_pair_and_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tmp uuid;
begin
  if new.user_a = new.user_b then
    raise exception 'Cannot match a user with themselves';
  end if;

  if tg_op = 'UPDATE'
     and new.user_a = old.user_a
     and new.user_b = old.user_b
  then
    return new;
  end if;

  if new.user_a > new.user_b then
    tmp := new.user_a;
    new.user_a := new.user_b;
    new.user_b := tmp;
  end if;

  if not public.is_pair_eligible(new.user_a, new.user_b) then
    raise exception 'Pair is not eligible based on safety, verification, age bracket, or preferences';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_non_admin_profile_moderation_fields_update()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and new.is_suspended <> old.is_suspended then
    raise exception 'Only admin can modify suspension state';
  end if;

  return new;
end;
$$;

create or replace function public.reports_to_flags_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.moderation_flags (
    source,
    label,
    score,
    target_user_id,
    target_match_id,
    target_message_id,
    report_id,
    status
  ) values (
    'user_report',
    concat('report:', new.reason::text),
    null,
    new.target_user_id,
    new.target_match_id,
    new.target_message_id,
    new.id,
    'open'
  );

  return new;
end;
$$;

create or replace function public.apply_moderation_action_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.action in ('suspend', 'ban') then
    update public.profiles
    set is_suspended = true,
        updated_at = now()
    where user_id = new.target_user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_guard_admin_fields on public.profiles;
create trigger trg_profiles_guard_admin_fields
before update on public.profiles
for each row execute function public.prevent_non_admin_profile_moderation_fields_update();

drop trigger if exists trg_preferences_updated_at on public.preferences;
create trigger trg_preferences_updated_at
before update on public.preferences
for each row execute function public.set_updated_at();

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists trg_matches_normalize_validate on public.matches;
create trigger trg_matches_normalize_validate
before insert or update on public.matches
for each row execute function public.normalize_match_pair_and_validate();

drop trigger if exists trg_messages_updated_at on public.messages;
create trigger trg_messages_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

drop trigger if exists trg_reports_updated_at on public.reports;
create trigger trg_reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

drop trigger if exists trg_reports_to_flags on public.reports;
create trigger trg_reports_to_flags
after insert on public.reports
for each row execute function public.reports_to_flags_trigger();

drop trigger if exists trg_flags_updated_at on public.moderation_flags;
create trigger trg_flags_updated_at
before update on public.moderation_flags
for each row execute function public.set_updated_at();

drop trigger if exists trg_blocks_updated_at on public.blocks;
create trigger trg_blocks_updated_at
before update on public.blocks
for each row execute function public.set_updated_at();

drop trigger if exists trg_apply_moderation_action on public.moderation_actions;
create trigger trg_apply_moderation_action
after insert on public.moderation_actions
for each row execute function public.apply_moderation_action_to_profile();

-- Indexes
create index if not exists idx_profiles_published on public.profiles (is_published) where is_published = true;
create index if not exists idx_profiles_age on public.profiles (age_years);
create index if not exists idx_profiles_nationality on public.profiles (nationality);

create index if not exists idx_preferences_min_max_age on public.preferences (min_age, max_age);
create index if not exists idx_preferences_preferred_genders on public.preferences using gin (preferred_genders);
create index if not exists idx_preferences_preferred_nationalities on public.preferences using gin (preferred_nationalities);

create index if not exists idx_matches_user_a on public.matches (user_a, status);
create index if not exists idx_matches_user_b on public.matches (user_b, status);
create index if not exists idx_matches_created_at on public.matches (created_at desc);

create index if not exists idx_messages_match_created_at on public.messages (match_id, created_at asc);
create index if not exists idx_messages_sender_created_at on public.messages (sender_id, created_at desc);

create index if not exists idx_reports_status_created_at on public.reports (status, created_at desc);
create index if not exists idx_flags_status_created_at on public.moderation_flags (status, created_at desc);
create index if not exists idx_moderation_actions_target_created_at on public.moderation_actions (target_user_id, created_at desc);
create index if not exists idx_blocks_blocker_active on public.blocks (blocker_user_id, active);
create index if not exists idx_blocks_blocked_active on public.blocks (blocked_user_id, active);

-- RLS
alter table public.profiles enable row level security;
alter table public.avatar_presets enable row level security;
alter table public.preferences enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_flags enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.blocks enable row level security;

-- Profiles policies
DROP POLICY IF EXISTS avatar_presets_select ON public.avatar_presets;
create policy avatar_presets_select
on public.avatar_presets
for select
to authenticated
using (is_active = true or public.is_admin());

DROP POLICY IF EXISTS profiles_select ON public.profiles;
create policy profiles_select
on public.profiles
for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (is_published = true and is_suspended = false)
);

DROP POLICY IF EXISTS profiles_insert ON public.profiles;
create policy profiles_insert
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_update ON public.profiles;
create policy profiles_update
on public.profiles
for update
to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

-- Preferences policies
DROP POLICY IF EXISTS preferences_select ON public.preferences;
create policy preferences_select
on public.preferences
for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

DROP POLICY IF EXISTS preferences_insert ON public.preferences;
create policy preferences_insert
on public.preferences
for insert
to authenticated
with check (user_id = auth.uid());

DROP POLICY IF EXISTS preferences_update ON public.preferences;
create policy preferences_update
on public.preferences
for update
to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

-- Matches policies
DROP POLICY IF EXISTS matches_select ON public.matches;
create policy matches_select
on public.matches
for select
to authenticated
using (public.is_admin() or user_a = auth.uid() or user_b = auth.uid());

DROP POLICY IF EXISTS matches_insert ON public.matches;
create policy matches_insert
on public.matches
for insert
to authenticated
with check (
  (public.is_admin() or auth.uid() = user_a or auth.uid() = user_b)
  and public.is_pair_eligible(user_a, user_b)
);

DROP POLICY IF EXISTS matches_update_admin_only ON public.matches;
create policy matches_update_admin_only
on public.matches
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Messages policies
DROP POLICY IF EXISTS messages_select ON public.messages;
create policy messages_select
on public.messages
for select
to authenticated
using (public.is_admin() or public.can_access_match(match_id));

DROP POLICY IF EXISTS messages_insert ON public.messages;
create policy messages_insert
on public.messages
for insert
to authenticated
with check (
  public.can_send_message(match_id, sender_id)
);

DROP POLICY IF EXISTS messages_update ON public.messages;
create policy messages_update
on public.messages
for update
to authenticated
using (public.is_admin() or sender_id = auth.uid())
with check (public.is_admin() or sender_id = auth.uid());

-- Reports policies
DROP POLICY IF EXISTS reports_select ON public.reports;
create policy reports_select
on public.reports
for select
to authenticated
using (public.is_admin() or reporter_user_id = auth.uid());

DROP POLICY IF EXISTS reports_insert ON public.reports;
create policy reports_insert
on public.reports
for insert
to authenticated
with check (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS reports_update_admin_only ON public.reports;
create policy reports_update_admin_only
on public.reports
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Blocks policies
DROP POLICY IF EXISTS blocks_select ON public.blocks;
create policy blocks_select
on public.blocks
for select
to authenticated
using (public.is_admin() or blocker_user_id = auth.uid());

DROP POLICY IF EXISTS blocks_insert ON public.blocks;
create policy blocks_insert
on public.blocks
for insert
to authenticated
with check (blocker_user_id = auth.uid() and blocker_user_id <> blocked_user_id);

DROP POLICY IF EXISTS blocks_update ON public.blocks;
create policy blocks_update
on public.blocks
for update
to authenticated
using (public.is_admin() or blocker_user_id = auth.uid())
with check (public.is_admin() or blocker_user_id = auth.uid());

DROP POLICY IF EXISTS blocks_delete ON public.blocks;
create policy blocks_delete
on public.blocks
for delete
to authenticated
using (public.is_admin() or blocker_user_id = auth.uid());

-- Moderation tables policies (admin only)
DROP POLICY IF EXISTS moderation_flags_select_admin ON public.moderation_flags;
create policy moderation_flags_select_admin
on public.moderation_flags
for select
to authenticated
using (public.is_admin());

DROP POLICY IF EXISTS moderation_flags_update_admin ON public.moderation_flags;
create policy moderation_flags_update_admin
on public.moderation_flags
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

DROP POLICY IF EXISTS moderation_flags_insert_admin ON public.moderation_flags;
create policy moderation_flags_insert_admin
on public.moderation_flags
for insert
to authenticated
with check (public.is_admin());

DROP POLICY IF EXISTS moderation_actions_select_admin ON public.moderation_actions;
create policy moderation_actions_select_admin
on public.moderation_actions
for select
to authenticated
using (public.is_admin());

DROP POLICY IF EXISTS moderation_actions_insert_admin ON public.moderation_actions;
create policy moderation_actions_insert_admin
on public.moderation_actions
for insert
to authenticated
with check (public.is_admin() and performed_by = auth.uid());

-- Realtime publication for chat + match state updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;

alter table public.profiles
  add column if not exists public_id text,
  add column if not exists last_active_at timestamptz;

update public.profiles
set public_id = 'HH-' || upper(substr(replace(user_id::text, '-', ''), 1, 12))
where public_id is null;

update public.profiles
set last_active_at = coalesce(last_active_at, updated_at, created_at, now())
where last_active_at is null;

alter table public.profiles
  alter column public_id set default ('HH-' || upper(substr(replace(user_id::text, '-', ''), 1, 12))),
  alter column public_id set not null,
  alter column last_active_at set default now(),
  alter column last_active_at set not null;

alter table public.profiles
  drop constraint if exists profiles_public_id_format;

alter table public.profiles
  add constraint profiles_public_id_format check (public_id ~ '^HH-[A-F0-9]{12}$');

create unique index if not exists idx_profiles_public_id_unique on public.profiles (public_id);
create index if not exists idx_profiles_last_active_at on public.profiles (last_active_at desc);

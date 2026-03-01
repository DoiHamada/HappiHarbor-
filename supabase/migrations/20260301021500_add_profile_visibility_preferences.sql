alter table public.preferences
  add column if not exists profile_visibility jsonb not null default '{"show_age": true, "show_nationality": true, "show_sexual_preference": true}'::jsonb
  check (jsonb_typeof(profile_visibility) = 'object');

update public.preferences
set profile_visibility = coalesce(
  profile_visibility,
  '{"show_age": true, "show_nationality": true, "show_sexual_preference": true}'::jsonb
);

alter table public.profiles
  alter column is_published set default true;

update public.profiles
set is_published = true
where is_published = false;

alter table public.preferences
  add column if not exists profile_tags jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_tags) = 'object');

update public.preferences
set
  preferred_genders = null,
  preferred_nationalities = null,
  use_appearance_filters = false,
  appearance_filters = '{}'::jsonb
where true;

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

  return true;
end;
$$;

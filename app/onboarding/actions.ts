"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GENDER_OPTIONS, LANGUAGE_OPTIONS, ONBOARDING_TAG_OPTIONS, SEXUAL_PREFERENCE_OPTIONS } from "@/types/profile";

function parseNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCheckboxValues(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function onboardingError(message: string): never {
  redirect(`/onboarding?error=${encodeURIComponent(message)}`);
}

export async function saveOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const displayName = String(formData.get("display_name") ?? "").trim();
  const nationality = String(formData.get("nationality") ?? "").trim();
  const bioRaw = String(formData.get("bio") ?? "").trim();
  const ageYears = parseNumber(formData.get("age_years"), 18);

  const gender = String(formData.get("gender") ?? "prefer_not_to_say");
  const sexualPreference = String(formData.get("sexual_preference") ?? "prefer_not_to_say");
  const avatarFile = formData.get("avatar_file");

  const preferredLanguages = unique(parseCheckboxValues(formData, "preferred_languages").map(normalizeToken));
  const profileTags = Object.fromEntries(
    Object.keys(ONBOARDING_TAG_OPTIONS).map((key) => {
      const values = unique(parseCheckboxValues(formData, `tag_${key}`).map(normalizeToken));
      return [key, values];
    })
  );

  const missingFields: string[] = [];
  if (!displayName) missingFields.push("display name");
  if (!nationality) missingFields.push("nationality");
  if (preferredLanguages.length === 0) missingFields.push("at least one language you speak");

  if (missingFields.length > 0) {
    onboardingError(`Please complete: ${missingFields.join(", ")}.`);
  }

  if (!GENDER_OPTIONS.includes(gender as (typeof GENDER_OPTIONS)[number])) {
    onboardingError("Please choose a valid gender.");
  }

  if (
    !SEXUAL_PREFERENCE_OPTIONS.includes(
      sexualPreference as (typeof SEXUAL_PREFERENCE_OPTIONS)[number]
    )
  ) {
    onboardingError("Please choose a valid sexual preference.");
  }

  if (
    preferredLanguages.some(
      (value) => !LANGUAGE_OPTIONS.includes(value as (typeof LANGUAGE_OPTIONS)[number]) && !/^[a-z0-9_]{2,40}$/.test(value)
    )
  ) {
    onboardingError("Please choose valid language values.");
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("avatar_storage_path,avatar_url,avatar_key,height_cm,weight_kg,skin_tone")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: firstAvatar } = await supabase
    .from("avatar_presets")
    .select("key")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const avatarKey = existingProfile?.avatar_key ?? firstAvatar?.key ?? "harbor-bear-01";

  let avatarUrl: string | null = existingProfile?.avatar_url ?? "/logo-mark.svg";
  let avatarStoragePath: string | null = existingProfile?.avatar_storage_path ?? null;
  const heightCm = existingProfile?.height_cm ?? 165;
  const weightKg = existingProfile?.weight_kg ?? 60;
  const skinTone = existingProfile?.skin_tone ?? "prefer_not_to_say";

  if (avatarFile instanceof File && avatarFile.size > 0) {
    const allowedTypes = new Set(["image/jpeg", "image/png"]);
    if (!allowedTypes.has(avatarFile.type)) {
      onboardingError("Avatar must be JPG or PNG.");
    }

    const maxBytes = 5 * 1024 * 1024;
    if (avatarFile.size > maxBytes) {
      onboardingError("Avatar is too large. Maximum size is 5MB.");
    }

    const extFromName = avatarFile.name.split(".").pop()?.toLowerCase();
    const ext = extFromName && /^[a-z0-9]+$/.test(extFromName) ? extFromName : "jpg";
    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(filePath, avatarFile, {
      contentType: avatarFile.type,
      upsert: false
    });

    if (uploadError) {
      onboardingError(`Avatar upload failed: ${uploadError.message}`);
    }

    if (existingProfile?.avatar_storage_path) {
      await supabase.storage.from("profile-avatars").remove([existingProfile.avatar_storage_path]);
    }

    const {
      data: { publicUrl }
    } = supabase.storage.from("profile-avatars").getPublicUrl(filePath);

    avatarUrl = publicUrl;
    avatarStoragePath = filePath;
  }

  let minAge = parseNumber(formData.get("min_age"), ageYears >= 18 ? 18 : 13);
  let maxAge = parseNumber(formData.get("max_age"), ageYears >= 18 ? 35 : 17);

  if (ageYears < 18) {
    minAge = Math.max(13, Math.min(minAge, 17));
    maxAge = Math.max(minAge, Math.min(maxAge, 17));
  } else {
    minAge = Math.max(18, minAge);
    maxAge = Math.max(minAge, maxAge);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName,
      age_years: ageYears,
      gender,
      nationality,
      sexual_preference: sexualPreference,
      height_cm: heightCm,
      weight_kg: weightKg,
      skin_tone: skinTone,
      avatar_key: avatarKey,
      avatar_url: avatarUrl,
      avatar_storage_path: avatarStoragePath,
      bio: bioRaw || null,
      is_published: true
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    onboardingError(profileError.message);
  }

  const preferencePayload = {
    user_id: user.id,
    min_age: minAge,
    max_age: maxAge,
    preferred_languages: preferredLanguages,
    preferred_genders: null,
    preferred_nationalities: null,
    use_appearance_filters: false,
    appearance_filters: {},
    profile_tags: profileTags,
    profile_visibility: {
      show_age: true,
      show_nationality: true,
      show_sexual_preference: true
    }
  };

  const { error: preferenceError } = await supabase
    .from("preferences")
    .upsert(preferencePayload, { onConflict: "user_id" });

  if (preferenceError) {
    const normalized = preferenceError.message.toLowerCase();
    const missingProfileTagsColumn = normalized.includes("profile_tags") && normalized.includes("schema cache");
    const missingProfileVisibilityColumn = normalized.includes("profile_visibility") && normalized.includes("schema cache");

    if (!missingProfileTagsColumn && !missingProfileVisibilityColumn) {
      onboardingError(preferenceError.message);
    }

    const { error: fallbackPreferenceError } = await supabase
      .from("preferences")
      .upsert(
        {
          user_id: user.id,
          min_age: minAge,
          max_age: maxAge,
          preferred_languages: preferredLanguages,
          preferred_genders: null,
          preferred_nationalities: null,
          use_appearance_filters: false,
          appearance_filters: {}
        },
        { onConflict: "user_id" }
      );

    if (fallbackPreferenceError) {
      onboardingError(fallbackPreferenceError.message);
    }
  }

  redirect("/matches");
}

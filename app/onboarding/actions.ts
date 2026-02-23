"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GENDER_OPTIONS, SEXUAL_PREFERENCE_OPTIONS, SKIN_TONE_OPTIONS } from "@/types/profile";

function parseNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCsv(value: FormDataEntryValue | null): string[] | null {
  if (!value) return null;
  const normalized = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : null;
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
  const heightCm = parseNumber(formData.get("height_cm"), 165);
  const weightKg = parseNumber(formData.get("weight_kg"), 60);
  const isPublished = formData.get("is_published") === "on";
  const useAppearanceFilters = formData.get("use_appearance_filters") === "on";

  const gender = String(formData.get("gender") ?? "prefer_not_to_say");
  const sexualPreference = String(formData.get("sexual_preference") ?? "prefer_not_to_say");
  const skinTone = String(formData.get("skin_tone") ?? "prefer_not_to_say");
  const avatarKey = String(formData.get("avatar_key") ?? "");
  const avatarFile = formData.get("avatar_file");

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("avatar_storage_path,avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  let avatarUrl: string | null = existingProfile?.avatar_url ?? null;
  let avatarStoragePath: string | null = existingProfile?.avatar_storage_path ?? null;

  if (avatarFile instanceof File && avatarFile.size > 0) {
    const allowedTypes = new Set(["image/jpeg", "image/png"]);
    if (!allowedTypes.has(avatarFile.type)) {
      throw new Error("Invalid avatar file type. Use JPG or PNG.");
    }

    const maxBytes = 5 * 1024 * 1024;
    if (avatarFile.size > maxBytes) {
      throw new Error("Avatar file is too large. Maximum size is 5MB.");
    }

    const extFromName = avatarFile.name.split(".").pop()?.toLowerCase();
    const ext = extFromName && /^[a-z0-9]+$/.test(extFromName) ? extFromName : "jpg";
    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(filePath, avatarFile, {
      contentType: avatarFile.type,
      upsert: false
    });

    if (uploadError) {
      throw new Error(`Avatar upload failed: ${uploadError.message}`);
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

  if (!GENDER_OPTIONS.includes(gender as (typeof GENDER_OPTIONS)[number])) {
    throw new Error("Invalid gender option.");
  }

  if (
    !SEXUAL_PREFERENCE_OPTIONS.includes(
      sexualPreference as (typeof SEXUAL_PREFERENCE_OPTIONS)[number]
    )
  ) {
    throw new Error("Invalid sexual preference option.");
  }

  if (!SKIN_TONE_OPTIONS.includes(skinTone as (typeof SKIN_TONE_OPTIONS)[number])) {
    throw new Error("Invalid skin tone option.");
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

  const preferredGenders = parseCsv(formData.get("preferred_genders"));
  const preferredNationalities = parseCsv(formData.get("preferred_nationalities"));

  const appearanceFilters = useAppearanceFilters
    ? {
        min_height_cm: parseNumber(formData.get("appearance_min_height_cm"), 0) || null,
        max_height_cm: parseNumber(formData.get("appearance_max_height_cm"), 0) || null,
        min_weight_kg: parseNumber(formData.get("appearance_min_weight_kg"), 0) || null,
        max_weight_kg: parseNumber(formData.get("appearance_max_weight_kg"), 0) || null,
        skin_tones: parseCsv(formData.get("appearance_skin_tones"))
      }
    : {};

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
      is_published: isPublished
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: preferenceError } = await supabase.from("preferences").upsert(
    {
      user_id: user.id,
      min_age: minAge,
      max_age: maxAge,
      preferred_genders: preferredGenders,
      preferred_nationalities: preferredNationalities,
      use_appearance_filters: useAppearanceFilters,
      appearance_filters: appearanceFilters
    },
    { onConflict: "user_id" }
  );

  if (preferenceError) {
    throw new Error(preferenceError.message);
  }

  redirect("/matches");
}

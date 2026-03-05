"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GENDER_OPTIONS, LANGUAGE_OPTIONS, ONBOARDING_TAG_OPTIONS, SEXUAL_PREFERENCE_OPTIONS } from "@/types/profile";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_COVER_BYTES = 7 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getImageExtension(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  const byName = file.name.split(".").pop()?.toLowerCase();
  return byName && /^[a-z0-9]+$/.test(byName) ? byName : "jpg";
}

function profilePathFromForm(formData: FormData, fallbackPublicId: string): string {
  const requested = String(formData.get("return_path") ?? "").trim();
  if (requested.startsWith("/profile/")) return requested;
  return `/profile/${fallbackPublicId}`;
}

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

function isMissingSchemaColumnError(message: string, column: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes(column.toLowerCase()) && normalized.includes("schema cache");
}

function isMissingRpcFunctionError(message: string, fnName: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("could not find the function") && normalized.includes(fnName.toLowerCase());
}

async function requireUserAndProfile() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id,public_id,avatar_url,avatar_storage_path,cover_photo_url,cover_photo_storage_path,nationality,age_years,gender,sexual_preference")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.public_id) {
    redirect("/onboarding");
  }

  return { supabase, user, profile };
}

export async function sendFriendRequest(formData: FormData) {
  const { supabase, user, profile } = await requireUserAndProfile();
  const targetUserId = String(formData.get("target_user_id") ?? "").trim();
  const path = profilePathFromForm(formData, profile.public_id);

  if (!targetUserId || targetUserId === user.id) {
    redirect(`${path}?info=${encodeURIComponent("Choose a valid user.")}`);
  }

  const { data, error } = await supabase.rpc("request_friend", {
    p_target: targetUserId,
    p_user: user.id
  });

  if (error) {
    redirect(`${path}?info=${encodeURIComponent(error.message)}`);
  }

  const status = String(data ?? "");
  const info =
    status === "accepted"
      ? "Follow accepted."
      : status === "already_friends"
        ? "You already follow each other."
        : status === "already_requested"
          ? "Follow already requested."
          : "Followed.";

  if (status === "requested") {
    const userA = user.id < targetUserId ? user.id : targetUserId;
    const userB = user.id < targetUserId ? targetUserId : user.id;
    const { data: matchRow } = await supabase
      .from("matches")
      .select("id")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();

    await supabase.from("social_notifications").insert({
      recipient_user_id: targetUserId,
      actor_user_id: user.id,
      type: "follow",
      details: matchRow?.id ? `match:${matchRow.id}` : "follow"
    });
  }

  revalidatePath(path);
  revalidatePath("/discover");
  revalidatePath("/notifications");
  redirect(`${path}?info=${encodeURIComponent(info)}`);
}

export async function cancelFriendRequest(formData: FormData) {
  const { supabase, user, profile } = await requireUserAndProfile();
  const targetUserId = String(formData.get("target_user_id") ?? "").trim();
  const path = profilePathFromForm(formData, profile.public_id);

  if (!targetUserId || targetUserId === user.id) {
    redirect(`${path}?info=${encodeURIComponent("Choose a valid user.")}`);
  }

  const { data, error } = await supabase.rpc("cancel_friend_request", {
    p_target: targetUserId,
    p_user: user.id
  });

  if (error) {
    if (isMissingRpcFunctionError(error.message, "public.cancel_friend_request")) {
      redirect(
        `${path}?info=${encodeURIComponent(
          "Cancel request is not available yet. Please run the latest database migration and try again."
        )}`
      );
    }
    redirect(`${path}?info=${encodeURIComponent(error.message)}`);
  }

  const status = String(data ?? "");
  if (status === "canceled") {
    await supabase
      .from("social_notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", targetUserId)
      .eq("actor_user_id", user.id)
      .eq("type", "follow")
      .eq("is_read", false);
  }

  const info =
    status === "canceled"
      ? "Follow canceled."
      : status === "not_pending"
        ? "This request is no longer pending."
        : "No request to cancel.";

  revalidatePath(path);
  revalidatePath("/notifications");
  redirect(`${path}?info=${encodeURIComponent(info)}`);
}

export async function acceptFriendRequest(formData: FormData) {
  const { supabase, profile } = await requireUserAndProfile();
  const requestId = String(formData.get("request_id") ?? "").trim();
  const path = profilePathFromForm(formData, profile.public_id);

  if (!requestId) {
    redirect(`${path}?info=${encodeURIComponent("Request not found.")}`);
  }

  const { data, error } = await supabase.rpc("accept_friend_request", {
    p_match: requestId
  });

  if (error) {
    redirect(`${path}?info=${encodeURIComponent(error.message)}`);
  }

  const status = String(data ?? "");
  const info = status === "accepted" ? "Follow accepted." : "Request updated.";

  revalidatePath(path);
  revalidatePath("/discover");
  redirect(`${path}?info=${encodeURIComponent(info)}`);
}

export async function updateOwnProfile(formData: FormData) {
  const { supabase, user, profile } = await requireUserAndProfile();
  const path = profilePathFromForm(formData, profile.public_id);

  const displayName = String(formData.get("display_name") ?? "").trim();
  const nationality = String(formData.get("nationality") ?? profile.nationality ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const ageYears = parseNumber(formData.get("age_years"), profile.age_years ?? 18);
  const gender = String(formData.get("gender") ?? profile.gender ?? "prefer_not_to_say");
  const sexualPreference = String(formData.get("sexual_preference") ?? profile.sexual_preference ?? "prefer_not_to_say");
  const showAge = formData.get("show_age") === "on";
  const showNationality = formData.get("show_nationality") === "on";
  const showSexualPreference = formData.get("show_sexual_preference") === "on";
  const preferredLanguages = unique(parseCheckboxValues(formData, "preferred_languages").map(normalizeToken));
  const profileTags = Object.fromEntries(
    Object.keys(ONBOARDING_TAG_OPTIONS).map((key) => {
      const values = unique(parseCheckboxValues(formData, `tag_${key}`).map(normalizeToken));
      return [key, values];
    })
  );

  let minAge = parseNumber(formData.get("min_age"), ageYears >= 18 ? 18 : 13);
  let maxAge = parseNumber(formData.get("max_age"), ageYears >= 18 ? 35 : 17);

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  if (!nationality) {
    throw new Error("Nationality is required.");
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

  if (
    preferredLanguages.some(
      (value) => !LANGUAGE_OPTIONS.includes(value as (typeof LANGUAGE_OPTIONS)[number]) && !/^[a-z0-9_]{2,40}$/.test(value)
    )
  ) {
    throw new Error("Invalid preferred language option.");
  }

  if (preferredLanguages.length === 0) {
    throw new Error("Add at least one language.");
  }

  if (ageYears < 18) {
    minAge = Math.max(13, Math.min(minAge, 17));
    maxAge = Math.max(minAge, Math.min(maxAge, 17));
  } else {
    minAge = Math.max(18, minAge);
    maxAge = Math.max(minAge, maxAge);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      nationality,
      age_years: ageYears,
      gender,
      sexual_preference: sexualPreference,
      bio: bio || null,
      is_published: true
    })
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
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
      show_age: showAge,
      show_nationality: showNationality,
      show_sexual_preference: showSexualPreference
    }
  };

  const { error: preferenceError } = await supabase
    .from("preferences")
    .upsert(preferencePayload, { onConflict: "user_id" });

  if (preferenceError) {
    const missingProfileTags = isMissingSchemaColumnError(preferenceError.message, "profile_tags");
    const missingProfileVisibility = isMissingSchemaColumnError(preferenceError.message, "profile_visibility");

    if (!missingProfileTags && !missingProfileVisibility) {
      throw new Error(preferenceError.message);
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
      throw new Error(fallbackPreferenceError.message);
    }
  }

  revalidatePath(path);
  redirect(`${path}?info=${encodeURIComponent("Profile updated.")}`);
}

export async function updateOwnAvatar(formData: FormData) {
  const { supabase, user, profile } = await requireUserAndProfile();
  const path = profilePathFromForm(formData, profile.public_id);
  const avatarFile = formData.get("avatar_file");

  if (!(avatarFile instanceof File) || avatarFile.size <= 0) {
    redirect(`${path}?info=${encodeURIComponent("Choose an avatar image first.")}`);
  }

  if (!ALLOWED_IMAGE_TYPES.has(avatarFile.type)) {
    throw new Error("Avatar must be JPG, PNG, or WEBP.");
  }

  if (avatarFile.size > MAX_AVATAR_BYTES) {
    throw new Error("Avatar must be 5MB or smaller.");
  }

  const extension = getImageExtension(avatarFile);
  const filePath = `${user.id}/${Date.now()}-avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("profile-avatars")
    .upload(filePath, avatarFile, { upsert: false, contentType: avatarFile.type });

  if (uploadError) {
    throw new Error(`Avatar upload failed: ${uploadError.message}`);
  }

  if (profile.avatar_storage_path) {
    await supabase.storage.from("profile-avatars").remove([profile.avatar_storage_path]);
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from("profile-avatars").getPublicUrl(filePath);

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url: publicUrl,
      avatar_storage_path: filePath
    })
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(path);
  redirect(`${path}?info=${encodeURIComponent("Avatar updated.")}`);
}

export async function deleteOwnAvatar(formData: FormData) {
  const { supabase, profile } = await requireUserAndProfile();
  const path = profilePathFromForm(formData, profile.public_id);

  if (profile.avatar_storage_path) {
    await supabase.storage.from("profile-avatars").remove([profile.avatar_storage_path]);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url: "/logo-mark.svg",
      avatar_storage_path: null
    })
    .eq("user_id", profile.user_id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(path);
  redirect(`${path}?info=${encodeURIComponent("Avatar removed.")}`);
}

export async function updateOwnCover(formData: FormData) {
  const { supabase, user, profile } = await requireUserAndProfile();
  const path = profilePathFromForm(formData, profile.public_id);
  const coverFile = formData.get("cover_file");

  if (!(coverFile instanceof File) || coverFile.size <= 0) {
    redirect(`${path}?info=${encodeURIComponent("Choose a cover image first.")}`);
  }

  if (!ALLOWED_IMAGE_TYPES.has(coverFile.type)) {
    throw new Error("Cover photo must be JPG, PNG, or WEBP.");
  }

  if (coverFile.size > MAX_COVER_BYTES) {
    throw new Error("Cover photo must be 7MB or smaller.");
  }

  const extension = getImageExtension(coverFile);
  const filePath = `${user.id}/${Date.now()}-cover.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("profile-covers")
    .upload(filePath, coverFile, { upsert: false, contentType: coverFile.type });

  if (uploadError) {
    throw new Error(`Cover photo upload failed: ${uploadError.message}`);
  }

  if (profile.cover_photo_storage_path) {
    await supabase.storage.from("profile-covers").remove([profile.cover_photo_storage_path]);
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from("profile-covers").getPublicUrl(filePath);

  const { error } = await supabase
    .from("profiles")
    .update({
      cover_photo_url: publicUrl,
      cover_photo_storage_path: filePath
    })
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(path);
  redirect(`${path}?info=${encodeURIComponent("Cover photo updated.")}`);
}

export async function deleteOwnCover(formData: FormData) {
  const { supabase, profile } = await requireUserAndProfile();
  const path = profilePathFromForm(formData, profile.public_id);

  if (profile.cover_photo_storage_path) {
    await supabase.storage.from("profile-covers").remove([profile.cover_photo_storage_path]);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      cover_photo_url: null,
      cover_photo_storage_path: null
    })
    .eq("user_id", profile.user_id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(path);
  redirect(`${path}?info=${encodeURIComponent("Cover photo removed.")}`);
}

export async function updateMomentVisibility(formData: FormData) {
  const { supabase, user, profile } = await requireUserAndProfile();

  const postId = String(formData.get("post_id") ?? "").trim();
  const makePublic = String(formData.get("make_public") ?? "") === "1";

  if (!postId) {
    throw new Error("Post is required.");
  }

  const { data: post } = await supabase
    .from("feed_posts")
    .select("id,user_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.user_id !== user.id) {
    throw new Error("Post not found.");
  }

  const { error } = await supabase
    .from("feed_posts")
    .update({ is_public: makePublic })
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message.includes("is_public") ? "Post visibility controls are temporarily unavailable." : error.message);
  }

  const profilePath = `/profile/${profile.public_id}`;
  revalidatePath(profilePath);
  redirect(profilePath);
}

export async function deleteOwnMoment(formData: FormData) {
  const { supabase, user, profile } = await requireUserAndProfile();
  const postId = String(formData.get("post_id") ?? "").trim();

  if (!postId) {
    throw new Error("Post is required.");
  }

  const { data: post } = await supabase
    .from("feed_posts")
    .select("id,user_id,photo_path")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.user_id !== user.id) {
    throw new Error("Post not found.");
  }

  const { error } = await supabase.from("feed_posts").delete().eq("id", postId).eq("user_id", user.id);
  if (error) {
    throw new Error(error.message);
  }

  if (post.photo_path) {
    await supabase.storage.from("feed-photos").remove([post.photo_path]);
  }

  const profilePath = `/profile/${profile.public_id}`;
  revalidatePath(profilePath);
  redirect(profilePath);
}

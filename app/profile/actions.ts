"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .select("user_id,public_id,avatar_url,avatar_storage_path,cover_photo_url,cover_photo_storage_path")
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
      ? "Friend request accepted."
      : status === "already_friends"
        ? "You are already friends."
        : status === "already_requested"
          ? "Friend request already sent."
          : "Friend request sent.";

  revalidatePath(path);
  revalidatePath("/discover");
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
  const info = status === "accepted" ? "Friend request accepted." : "Request updated.";

  revalidatePath(path);
  revalidatePath("/discover");
  redirect(`${path}?info=${encodeURIComponent(info)}`);
}

export async function updateOwnProfile(formData: FormData) {
  const { supabase, user, profile } = await requireUserAndProfile();

  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const isPublished = formData.get("is_published") === "on";
  const avatarFile = formData.get("avatar_file");
  const coverFile = formData.get("cover_file");

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  let avatarUrl = profile.avatar_url ?? "/logo-mark.svg";
  let avatarStoragePath = profile.avatar_storage_path;

  if (avatarFile instanceof File && avatarFile.size > 0) {
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

    avatarUrl = publicUrl;
    avatarStoragePath = filePath;
  }

  let coverUrl = profile.cover_photo_url;
  let coverStoragePath = profile.cover_photo_storage_path;

  if (coverFile instanceof File && coverFile.size > 0) {
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

    coverUrl = publicUrl;
    coverStoragePath = filePath;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      bio: bio || null,
      is_published: isPublished,
      avatar_url: avatarUrl,
      avatar_storage_path: avatarStoragePath,
      cover_photo_url: coverUrl,
      cover_photo_storage_path: coverStoragePath
    })
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  const profilePath = `/profile/${profile.public_id}`;
  revalidatePath(profilePath);
  redirect(`${profilePath}?info=${encodeURIComponent("Profile updated.")}`);
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const FEED_BUCKET = "feed-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorRedirect(message: string): never {
  redirect(`/feed?error=${encodeURIComponent(message)}`);
}

function getFileExtension(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  const fromName = file.name.split(".").pop()?.toLowerCase();
  return fromName && fromName.length <= 5 ? fromName : "bin";
}

export async function createFeedPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  if (!user.email_confirmed_at) {
    errorRedirect("Please verify your email before posting.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id,is_suspended")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    errorRedirect(profileError.message);
  }

  if (!profile) {
    redirect("/onboarding");
  }

  if (profile.is_suspended) {
    errorRedirect("Your account is currently restricted from posting.");
  }

  const rawThought = String(formData.get("thought") ?? "").trim();
  const thought = rawThought.length > 0 ? rawThought : null;

  if (thought && thought.length > 1000) {
    errorRedirect("Thoughts must be 1000 characters or fewer.");
  }

  const photoEntry = formData.get("photo");
  const photo = photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null;

  if (!thought && !photo) {
    errorRedirect("Add a thought, a photo, or both.");
  }

  let photoPath: string | null = null;

  if (photo) {
    if (!ALLOWED_MIME_TYPES.has(photo.type)) {
      errorRedirect("Photo must be JPG, PNG, or WEBP.");
    }

    if (photo.size > MAX_PHOTO_BYTES) {
      errorRedirect("Photo must be 5MB or smaller.");
    }

    const extension = getFileExtension(photo);
    photoPath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(FEED_BUCKET)
      .upload(photoPath, photo, { upsert: false, contentType: photo.type });

    if (uploadError) {
      errorRedirect(uploadError.message);
    }
  }

  const { error: insertError } = await supabase.from("feed_posts").insert({
    user_id: user.id,
    thought,
    photo_path: photoPath
  });

  if (insertError) {
    if (photoPath) {
      await supabase.storage.from(FEED_BUCKET).remove([photoPath]);
    }

    errorRedirect(insertError.message);
  }

  revalidatePath("/feed");
  redirect("/feed?posted=1");
}

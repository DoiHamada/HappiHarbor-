"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const FEED_BUCKET = "feed-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorRedirect(message: string): never {
  redirect(`/discover?error=${encodeURIComponent(message)}`);
}

function getFileExtension(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  const fromName = file.name.split(".").pop()?.toLowerCase();
  return fromName && fromName.length <= 5 ? fromName : "bin";
}

function discoverPath(params?: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `/discover?${query}` : "/discover";
}

async function requirePostingUser() {
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

  return { supabase, user };
}

async function createSocialNotification(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  recipientUserId: string;
  actorUserId: string;
  type: "reaction" | "comment" | "profile_view";
  postId?: string | null;
  commentId?: string | null;
  reaction?: string | null;
  details?: string | null;
}) {
  const { supabase, recipientUserId, actorUserId, type, postId = null, commentId = null, reaction = null, details = null } = args;
  if (recipientUserId === actorUserId) return;

  await supabase.from("social_notifications").insert({
    recipient_user_id: recipientUserId,
    actor_user_id: actorUserId,
    type,
    post_id: postId,
    comment_id: commentId,
    reaction,
    details
  });
}

export async function createDiscoverPost(formData: FormData) {
  const { supabase, user } = await requirePostingUser();

  const rawThought = String(formData.get("thought") ?? "").trim();
  const thought = rawThought.length > 0 ? rawThought : null;

  if (thought && thought.length > 1000) {
    errorRedirect("Thoughts must be 1000 characters or fewer.");
  }

  const photoEntry = formData.get("photo");
  const photo = photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null;
  const isPublic = formData.get("is_public") === "on";

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
    photo_path: photoPath,
    is_public: isPublic
  });

  if (insertError) {
    if (photoPath) {
      await supabase.storage.from(FEED_BUCKET).remove([photoPath]);
    }

    errorRedirect(insertError.message);
  }

  revalidatePath("/discover");
  redirect("/discover?posted=1");
}

export async function reactToDiscoverPost(formData: FormData) {
  const { supabase, user } = await requirePostingUser();
  const postId = String(formData.get("post_id") ?? "").trim();
  const reaction = String(formData.get("reaction") ?? "").trim().slice(0, 16);

  if (!postId || !reaction) {
    errorRedirect("Reaction is invalid.");
  }

  const { data: post } = await supabase.from("feed_posts").select("id,user_id").eq("id", postId).maybeSingle();
  if (!post) {
    errorRedirect("Post not found.");
  }

  const { data: existing } = await supabase
    .from("feed_post_reactions")
    .select("reaction")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.reaction === reaction) {
    const { error } = await supabase.from("feed_post_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
    if (error) errorRedirect(error.message);
  } else {
    const { error } = await supabase.from("feed_post_reactions").upsert(
      {
        post_id: postId,
        user_id: user.id,
        reaction
      },
      { onConflict: "post_id,user_id" }
    );
    if (error) errorRedirect(error.message);

    await createSocialNotification({
      supabase,
      recipientUserId: post.user_id,
      actorUserId: user.id,
      type: "reaction",
      postId,
      reaction
    });
  }

  revalidatePath("/discover");
  redirect(discoverPath());
}

export async function addDiscoverComment(formData: FormData) {
  const { supabase, user } = await requirePostingUser();
  const postId = String(formData.get("post_id") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim().slice(0, 1200);

  if (!postId || !content) {
    errorRedirect("Comment cannot be empty.");
  }

  const { data: post } = await supabase.from("feed_posts").select("id,user_id").eq("id", postId).maybeSingle();
  if (!post) {
    errorRedirect("Post not found.");
  }

  const { data: comment, error } = await supabase
    .from("feed_post_comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      content
    })
    .select("id")
    .single();

  if (error) {
    errorRedirect(error.message);
  }

  await createSocialNotification({
    supabase,
    recipientUserId: post.user_id,
    actorUserId: user.id,
    type: "comment",
    postId,
    commentId: comment.id,
    details: content.slice(0, 160)
  });

  revalidatePath("/discover");
  redirect(discoverPath());
}

export async function updateDiscoverPostVisibility(formData: FormData) {
  const { supabase, user } = await requirePostingUser();
  const postId = String(formData.get("post_id") ?? "").trim();
  const makePublic = String(formData.get("make_public") ?? "") === "1";

  if (!postId) {
    errorRedirect("Post is required.");
  }

  const { data: post } = await supabase.from("feed_posts").select("id,user_id").eq("id", postId).maybeSingle();
  if (!post || post.user_id !== user.id) {
    errorRedirect("Post not found.");
  }

  const { error } = await supabase.from("feed_posts").update({ is_public: makePublic }).eq("id", postId).eq("user_id", user.id);
  if (error) {
    errorRedirect(error.message);
  }

  revalidatePath("/discover");
  redirect(discoverPath({ posted: "1" }));
}

export async function deleteDiscoverPost(formData: FormData) {
  const { supabase, user } = await requirePostingUser();
  const postId = String(formData.get("post_id") ?? "").trim();

  if (!postId) {
    errorRedirect("Post is required.");
  }

  const { data: post } = await supabase
    .from("feed_posts")
    .select("id,user_id,photo_path")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.user_id !== user.id) {
    errorRedirect("Post not found.");
  }

  const { error } = await supabase.from("feed_posts").delete().eq("id", postId).eq("user_id", user.id);
  if (error) {
    errorRedirect(error.message);
  }

  if (post.photo_path) {
    await supabase.storage.from(FEED_BUCKET).remove([post.photo_path]);
  }

  revalidatePath("/discover");
  redirect(discoverPath());
}

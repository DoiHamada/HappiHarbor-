"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MESSAGES_PATH = "/messages";

function toUuid(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function normalizeMessage(value: FormDataEntryValue | null, max: number): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function pair(a: string, b: string): { userA: string; userB: string } {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

function urlFor(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `${MESSAGES_PATH}?${query}` : MESSAGES_PATH;
}

async function requireActiveUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  if (!user.email_confirmed_at) {
    redirect("/onboarding");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id,is_suspended")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  if (profile.is_suspended) {
    redirect(urlFor({ error: "Your account is currently restricted from messaging." }));
  }

  return { supabase, user };
}

async function ensureConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userOne: string,
  userTwo: string,
  source: "match" | "request",
  requestId: string | null
): Promise<string> {
  const { userA, userB } = pair(userOne, userTwo);

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      user_a: userA,
      user_b: userB,
      source,
      request_id: requestId
    })
    .select("id")
    .single();

  if (!error && created?.id) {
    return created.id;
  }

  const { data: fallback } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();

  if (fallback?.id) {
    return fallback.id;
  }

  throw new Error(error?.message ?? "Failed to create conversation.");
}

async function openDirectConversation(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const targetUserId = toUuid(formData.get("target_user_id"));

  if (!targetUserId || targetUserId === user.id) {
    redirect(urlFor({ error: "Choose a valid user." }));
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("user_id,is_published,is_suspended")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!targetProfile || !targetProfile.is_published || targetProfile.is_suspended) {
    redirect(urlFor({ error: "This user is unavailable for chat." }));
  }

  const { userA, userB } = pair(user.id, targetUserId);
  const { data: mutualMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "mutual")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();

  let conversationId: string;
  try {
    conversationId = await ensureConversation(
      supabase,
      user.id,
      targetUserId,
      mutualMatch ? "match" : "request",
      null
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start chat right now.";
    redirect(urlFor({ error: message }));
  }
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId, p_user: user.id });
  revalidatePath(MESSAGES_PATH);
  revalidatePath("/", "layout");
  redirect(urlFor({ conversation: conversationId }));
}

export async function sendMessageRequest(formData: FormData) {
  await openDirectConversation(formData);
}

export async function startMatchChat(formData: FormData) {
  await openDirectConversation(formData);
}

export async function openDirectChat(formData: FormData) {
  await openDirectConversation(formData);
}

export async function sendConversationMessage(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const conversationId = toUuid(formData.get("conversation_id"));
  const content = normalizeMessage(formData.get("content"), 2000);

  if (!conversationId || !content) {
    redirect(urlFor({ error: "Message cannot be empty." }));
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,user_a,user_b")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation || (conversation.user_a !== user.id && conversation.user_b !== user.id)) {
    redirect(urlFor({ error: "Conversation not found." }));
  }

  const { error } = await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content
  });

  if (error) {
    redirect(urlFor({ error: error.message }));
  }

  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId, p_user: user.id });
  revalidatePath(MESSAGES_PATH);
  revalidatePath("/", "layout");
  redirect(urlFor({ conversation: conversationId }));
}

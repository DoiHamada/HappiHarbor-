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

export async function sendMessageRequest(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const targetUserId = toUuid(formData.get("target_user_id"));
  const note = normalizeMessage(formData.get("request_message"), 300);

  if (!targetUserId || targetUserId === user.id) {
    redirect(urlFor({ error: "Choose a valid user." }));
  }

  const { userA, userB } = pair(user.id, targetUserId);

  const { data: mutualMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "mutual")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();

  if (mutualMatch) {
    const conversationId = await ensureConversation(supabase, user.id, targetUserId, "match", null);
    revalidatePath(MESSAGES_PATH);
    redirect(urlFor({ conversation: conversationId, info: "You are matched. Chat is open." }));
  }

  const { data: pendingRequest } = await supabase
    .from("message_requests")
    .select("id,requester_user_id,recipient_user_id")
    .eq("status", "pending")
    .or(
      `and(requester_user_id.eq.${user.id},recipient_user_id.eq.${targetUserId}),and(requester_user_id.eq.${targetUserId},recipient_user_id.eq.${user.id})`
    )
    .maybeSingle();

  if (pendingRequest) {
    if (pendingRequest.recipient_user_id === user.id) {
      const { error: approveError } = await supabase
        .from("message_requests")
        .update({
          status: "approved",
          decided_at: new Date().toISOString()
        })
        .eq("id", pendingRequest.id)
        .eq("recipient_user_id", user.id)
        .eq("status", "pending");

      if (approveError) {
        redirect(urlFor({ error: approveError.message }));
      }

      const conversationId = await ensureConversation(
        supabase,
        user.id,
        targetUserId,
        "request",
        pendingRequest.id
      );

      revalidatePath(MESSAGES_PATH);
      redirect(urlFor({ conversation: conversationId, info: "Request approved. Chat is open." }));
    }

    redirect(urlFor({ info: "You already sent a message request to this user." }));
  }

  const { error: insertError } = await supabase.from("message_requests").insert({
    requester_user_id: user.id,
    recipient_user_id: targetUserId,
    status: "pending",
    message: note
  });

  if (insertError) {
    redirect(urlFor({ error: insertError.message }));
  }

  revalidatePath(MESSAGES_PATH);
  redirect(urlFor({ info: "Message request sent." }));
}

export async function decideMessageRequest(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const requestId = toUuid(formData.get("request_id"));
  const decision = String(formData.get("decision") ?? "").trim();

  if (!requestId || (decision !== "approved" && decision !== "rejected")) {
    redirect(urlFor({ error: "Invalid request action." }));
  }

  const { data: requestRow } = await supabase
    .from("message_requests")
    .select("id,requester_user_id,recipient_user_id,status")
    .eq("id", requestId)
    .eq("recipient_user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (!requestRow) {
    redirect(urlFor({ error: "Request not found or already handled." }));
  }

  const { error: updateError } = await supabase
    .from("message_requests")
    .update({
      status: decision,
      decided_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .eq("recipient_user_id", user.id)
    .eq("status", "pending");

  if (updateError) {
    redirect(urlFor({ error: updateError.message }));
  }

  if (decision === "approved") {
    const conversationId = await ensureConversation(
      supabase,
      requestRow.requester_user_id,
      requestRow.recipient_user_id,
      "request",
      requestId
    );

    revalidatePath(MESSAGES_PATH);
    redirect(urlFor({ conversation: conversationId, info: "Request approved." }));
  }

  revalidatePath(MESSAGES_PATH);
  redirect(urlFor({ info: "Message request declined." }));
}

export async function cancelMessageRequest(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const requestId = toUuid(formData.get("request_id"));

  if (!requestId) {
    redirect(urlFor({ error: "Invalid request." }));
  }

  const { error } = await supabase
    .from("message_requests")
    .update({
      status: "canceled",
      decided_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .eq("requester_user_id", user.id)
    .eq("status", "pending");

  if (error) {
    redirect(urlFor({ error: error.message }));
  }

  revalidatePath(MESSAGES_PATH);
  redirect(urlFor({ info: "Request canceled." }));
}

export async function startMatchChat(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const targetUserId = toUuid(formData.get("target_user_id"));

  if (!targetUserId || targetUserId === user.id) {
    redirect(urlFor({ error: "Choose a valid user." }));
  }

  const { userA, userB } = pair(user.id, targetUserId);

  const { data: mutualMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "mutual")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();

  if (!mutualMatch) {
    redirect(urlFor({ error: "You can only start direct chat with mutual matches." }));
  }

  const conversationId = await ensureConversation(supabase, user.id, targetUserId, "match", null);
  revalidatePath(MESSAGES_PATH);
  redirect(urlFor({ conversation: conversationId }));
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

  revalidatePath(MESSAGES_PATH);
  redirect(urlFor({ conversation: conversationId }));
}

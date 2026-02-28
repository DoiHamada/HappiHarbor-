import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MessagesLiveUpdates } from "@/components/messages-live-updates";
import { openDirectChat, sendConversationMessage } from "./actions";

type MessagesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ProfileLite = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
  last_active_at: string | null;
};

type ConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
  source: "match" | "request";
  updated_at: string;
  created_at: string;
};

type ChatMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  delivered_at: string | null;
  seen_at: string | null;
};

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function isRecentlyActive(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  const ts = new Date(lastActiveAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 5 * 60 * 1000;
}

function fallbackPublicId(userId: string): string {
  return `HH-${userId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function messageStatus(message: ChatMessageRow): "sent" | "delivered" | "seen" {
  if (message.seen_at) return "seen";
  if (message.delivered_at) return "delivered";
  return "sent";
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const params = (await searchParams) ?? {};
  const selectedConversationParam =
    typeof params.conversation === "string" ? params.conversation : null;
  const info = typeof params.info === "string" ? params.info : null;
  const error = typeof params.error === "string" ? params.error : null;

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

  const { data: myProfileWithPresence, error: myProfilePresenceError } = await supabase
    .from("profiles")
    .select("user_id,public_id,display_name,avatar_url,last_active_at,is_suspended")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: myProfileFallback } = myProfilePresenceError
    ? await supabase
        .from("profiles")
        .select("user_id,display_name,avatar_url,is_suspended")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const myProfile = (myProfileWithPresence ?? myProfileFallback) as
    | (ProfileLite & { is_suspended: boolean })
    | ({ user_id: string; display_name: string; avatar_url?: string | null; is_suspended: boolean; public_id?: null; last_active_at?: null })
    | null;

  if (!myProfile) {
    redirect("/onboarding");
  }

  if (myProfile.is_suspended) {
    return (
      <section className="card">
        <h1 className="text-xl font-semibold">Messaging unavailable</h1>
        <p className="text-sm text-red-700">Your account is currently restricted from messaging.</p>
      </section>
    );
  }

  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", user.id);

  await supabase.rpc("mark_conversation_delivered", { p_user: user.id });

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id,user_a,user_b,source,updated_at,created_at")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("updated_at", { ascending: false })
    .limit(40);

  const typedConversations = (conversations ?? []) as ConversationRow[];

  const profileIds = new Set<string>([user.id]);
  typedConversations.forEach((row) => {
    profileIds.add(row.user_a);
    profileIds.add(row.user_b);
  });

  const { data: profileRowsWithPresence, error: profileRowsPresenceError } = await supabase
    .from("profiles")
    .select("user_id,public_id,display_name,avatar_url,last_active_at")
    .in("user_id", Array.from(profileIds));

  const { data: profileRowsFallback } = profileRowsPresenceError
    ? await supabase
        .from("profiles")
        .select("user_id,display_name,avatar_url")
        .in("user_id", Array.from(profileIds))
    : { data: null };

  const profileRows = (profileRowsWithPresence ?? profileRowsFallback ?? []) as ProfileLite[];

  const profilesById = new Map<string, ProfileLite>(
    profileRows.map((item) => [item.user_id, item])
  );

  const conversationItems = typedConversations.map((row) => {
    const partnerId = row.user_a === user.id ? row.user_b : row.user_a;
    const partner = profilesById.get(partnerId);
    return {
      ...row,
      partnerId,
      partnerPublicId: partner?.public_id ?? null,
      partnerName: partner?.display_name ?? "Member",
      partnerAvatarUrl: partner?.avatar_url ?? null,
      partnerLastActiveAt: partner?.last_active_at ?? null
    };
  });

  const selectedConversation =
    conversationItems.find((item) => item.id === selectedConversationParam) ??
    conversationItems[0] ??
    null;

  const selectedConversationId = selectedConversation?.id ?? null;

  if (selectedConversationId) {
    await supabase.rpc("mark_conversation_read", { p_conversation: selectedConversationId, p_user: user.id });
  }

  const { data: messageRows } = selectedConversationId
    ? await supabase
        .from("conversation_messages")
        .select("id,conversation_id,sender_id,content,created_at,delivered_at,seen_at")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true })
        .limit(250)
    : { data: [] };

  const typedMessages = (messageRows ?? []) as ChatMessageRow[];

  const { data: discoverRowsWithPresence, error: discoverRowsPresenceError } = await supabase
    .from("profiles")
    .select("user_id,public_id,display_name,avatar_url,last_active_at")
    .eq("is_published", true)
    .neq("user_id", user.id)
    .order("last_active_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(20);

  const { data: discoverRowsFallback } = discoverRowsPresenceError
    ? await supabase
        .from("profiles")
        .select("user_id,display_name,avatar_url")
        .eq("is_published", true)
        .neq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20)
    : { data: null };

  const discoverPeople = ((discoverRowsWithPresence ?? discoverRowsFallback ?? []) as ProfileLite[]);

  const conversationByPartner = new Map<string, string>();
  conversationItems.forEach((item) => conversationByPartner.set(item.partnerId, item.id));

  return (
    <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-0 pb-0 pt-0">
      <MessagesLiveUpdates userId={user.id} conversationIds={typedConversations.map((row) => row.id)} />
      <div className="flex h-[calc(100vh-8rem)] min-h-[680px] w-full overflow-hidden bg-[#fcfaf8] text-slate-900">
        <section className="flex w-[360px] shrink-0 flex-col border-r border-[#ee9d2b]/10 bg-white">
          <header className="border-b border-[#ee9d2b]/10 p-6">
            <h1 className="text-xl font-bold">Messages</h1>
            <p className="mt-1 text-xs text-slate-500">Start chatting with people.</p>
            {info && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{info}</p>}
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </header>

          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4">
            <div className="space-y-2">
              <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Conversations</h2>
              {conversationItems.length === 0 ? (
                <p className="px-2 text-xs text-slate-500">No conversations yet.</p>
              ) : (
                conversationItems.map((conversation) => {
                  const active = selectedConversationId === conversation.id;
                  const partnerPublicId = conversation.partnerPublicId ?? fallbackPublicId(conversation.partnerId);
                  const partnerActive = isRecentlyActive(conversation.partnerLastActiveAt);

                  return (
                    <Link
                      key={conversation.id}
                      href={`/messages?conversation=${conversation.id}`}
                      className={`block rounded-2xl border p-3 no-underline ${
                        active
                          ? "border-[#ee9d2b]/40 bg-[#fff8ef]"
                          : "border-slate-100 bg-white hover:border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={conversation.partnerAvatarUrl ?? "/logo-mark.svg"}
                          alt={`${conversation.partnerName} avatar`}
                          className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{conversation.partnerName}</p>
                          <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                            <span className={`inline-block size-2 rounded-full ${partnerActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                            {partnerPublicId} · {conversation.source === "match" ? "Match" : "Direct"}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            <div className="space-y-2">
              <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">People</h2>
              {discoverPeople.length === 0 ? (
                <p className="px-2 text-xs text-slate-500">No users available.</p>
              ) : (
                discoverPeople.map((person) => {
                  const existingConversationId = conversationByPartner.get(person.user_id) ?? null;
                  const active = isRecentlyActive(person.last_active_at);
                  const personPublicId = person.public_id ?? fallbackPublicId(person.user_id);

                  return (
                    <article key={person.user_id} className="rounded-2xl border border-slate-100 bg-white p-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/profile/${personPublicId}`} className="no-underline">
                          <img
                            src={person.avatar_url ?? "/logo-mark.svg"}
                            alt={`${person.display_name} avatar`}
                            className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                          />
                        </Link>
                        <div className="min-w-0">
                          <Link href={`/profile/${personPublicId}`} className="text-sm font-semibold no-underline hover:underline">
                            {person.display_name}
                          </Link>
                          <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                            <span className={`inline-block size-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
                            {personPublicId} · {active ? "Active now" : "Inactive"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        {existingConversationId ? (
                          <Link
                            href={`/messages?conversation=${existingConversationId}`}
                            className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 no-underline"
                          >
                            Open chat
                          </Link>
                        ) : (
                          <form action={openDirectChat}>
                            <input type="hidden" name="target_user_id" value={person.user_id} />
                            <button
                              className="inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                              type="submit"
                            >
                              Start chat
                            </button>
                          </form>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="chat-pattern flex min-w-0 flex-1 flex-col">
          {selectedConversation ? (
            <>
              <header className="flex h-20 items-center justify-between border-b border-[#ee9d2b]/10 bg-white/85 px-8 backdrop-blur">
                <div>
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedConversation.partnerAvatarUrl ?? "/logo-mark.svg"}
                      alt={`${selectedConversation.partnerName} avatar`}
                      className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                    />
                    {selectedConversation.partnerPublicId ? (
                      <Link
                        href={`/profile/${selectedConversation.partnerPublicId}`}
                        className="text-lg font-bold text-slate-900 no-underline hover:underline"
                      >
                        {selectedConversation.partnerName}
                      </Link>
                    ) : (
                      <h2 className="text-lg font-bold text-slate-900">{selectedConversation.partnerName}</h2>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-sm text-[#c87a1f]">
                    <span
                      className={`inline-block size-2 rounded-full ${
                        isRecentlyActive(selectedConversation.partnerLastActiveAt) ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    {selectedConversation.source === "match" ? "Mutual match conversation" : "Direct conversation"} ·{" "}
                    {isRecentlyActive(selectedConversation.partnerLastActiveAt) ? "Active now" : "Inactive"}
                  </p>
                </div>
                <div className="rounded-full bg-[#ee9d2b]/10 px-4 py-2 text-xs font-semibold text-[#b7711d]">
                  Protected chat
                </div>
              </header>

              <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
                <div className="mx-auto flex max-w-4xl flex-col gap-4">
                  {typedMessages.length === 0 ? (
                    <div className="mx-auto rounded-2xl border border-[#ee9d2b]/20 bg-white/85 px-6 py-4 text-center text-sm text-slate-600">
                      Start the conversation with kindness.
                    </div>
                  ) : (
                    typedMessages.map((message) => {
                      const mine = message.sender_id === user.id;
                      const senderProfile = profilesById.get(message.sender_id);
                      const senderName = message.sender_id === user.id ? "You" : (senderProfile?.display_name ?? "Member");
                      const status = mine ? messageStatus(message) : null;

                      return (
                        <div
                          key={message.id}
                          className={`flex max-w-[82%] items-end gap-3 ${mine ? "self-end flex-row-reverse" : ""}`}
                        >
                          <img
                            src={senderProfile?.avatar_url ?? "/logo-mark.svg"}
                            alt={`${senderName} avatar`}
                            className="h-9 w-9 rounded-full border border-[#ee9d2b]/20 object-cover"
                          />
                          <div className={`rounded-2xl p-4 text-sm ${mine ? "bg-[#ee9d2b] text-white" : "bg-white text-slate-700"}`}>
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            <p className={`mt-2 flex items-center justify-end gap-2 text-[11px] ${mine ? "text-orange-100" : "text-slate-400"}`}>
                              {formatTime(message.created_at)}
                              {mine ? (
                                <span
                                  aria-label={`Message ${status}`}
                                  title={`Message ${status}`}
                                  className={status === "seen" ? "text-sky-300" : "text-slate-200"}
                                >
                                  {status === "sent" ? "✓" : "✓✓"}
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <footer className="border-t border-[#ee9d2b]/10 bg-white/85 px-6 py-5 backdrop-blur">
                <form action={sendConversationMessage} className="mx-auto flex max-w-4xl items-center gap-3">
                  <input type="hidden" name="conversation_id" value={selectedConversation.id} />
                  <input
                    className="flex-1 rounded-full border-none bg-slate-100 px-6 py-3 text-sm outline-none ring-[#ee9d2b]/40 focus:ring-2"
                    name="content"
                    maxLength={2000}
                    placeholder="Type a message..."
                    required
                  />
                  <button className="rounded-full bg-[#ee9d2b] px-5 py-3 text-sm font-semibold text-white" type="submit">
                    Send
                  </button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-md rounded-2xl border border-[#ee9d2b]/20 bg-white/90 p-8 text-center">
                <h2 className="text-xl font-bold">No active chat selected</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Choose a conversation from the left or start a chat from the people list.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

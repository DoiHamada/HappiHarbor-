<<<<<<< HEAD
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const sampleThreads = [
  { id: "t1", name: "Jamie Rivera", preview: "Loved your harbor photo. Coffee this weekend?", time: "10m" },
  { id: "t2", name: "Avery Chen", preview: "Your ramen post made me hungry.", time: "1h" },
  { id: "t3", name: "Morgan Lee", preview: "Thanks for the thoughtful message yesterday.", time: "3h" }
];

export default async function MessagesPage() {
=======
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  cancelMessageRequest,
  decideMessageRequest,
  sendConversationMessage,
  sendMessageRequest,
  startMatchChat
} from "./actions";

type MessagesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ProfileLite = {
  user_id: string;
  display_name: string;
  avatar_key: string;
};

type ConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
  source: "match" | "request";
  updated_at: string;
  created_at: string;
};

type MessageRequestRow = {
  id: string;
  requester_user_id: string;
  recipient_user_id: string;
  status: "pending" | "approved" | "rejected" | "canceled";
  message: string | null;
  created_at: string;
};

type ChatMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDayTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const params = (await searchParams) ?? {};
  const selectedConversationParam =
    typeof params.conversation === "string" ? params.conversation : null;
  const info = typeof params.info === "string" ? params.info : null;
  const error = typeof params.error === "string" ? params.error : null;

>>>>>>> message-box
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

<<<<<<< HEAD
  return (
    <section className="space-y-4">
      <div className="card flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="mt-1 text-sm text-harbor-ink/75">Open your conversations from the main message box.</p>
        </div>
        <Link href="/discover" className="btn-secondary no-underline">
          Back to Discover
        </Link>
      </div>
      <div className="grid gap-3">
        {sampleThreads.map((thread) => (
          <article key={thread.id} className="card">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{thread.name}</p>
              <span className="text-xs text-harbor-ink/60">{thread.time}</span>
            </div>
            <p className="mt-2 text-sm text-harbor-ink/80">{thread.preview}</p>
          </article>
        ))}
=======
  if (!user.email_confirmed_at) {
    redirect("/onboarding");
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("user_id,display_name,avatar_key,is_suspended")
    .eq("user_id", user.id)
    .maybeSingle();

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

  const [{ data: conversations }, { data: incomingRequests }, { data: outgoingRequests }, { data: mutualMatches }] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("id,user_a,user_b,source,updated_at,created_at")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .limit(40),
      supabase
        .from("message_requests")
        .select("id,requester_user_id,recipient_user_id,status,message,created_at")
        .eq("recipient_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("message_requests")
        .select("id,requester_user_id,recipient_user_id,status,message,created_at")
        .eq("requester_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("matches")
        .select("user_a,user_b,status")
        .eq("status", "mutual")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    ]);

  const typedConversations = (conversations ?? []) as ConversationRow[];
  const typedIncoming = (incomingRequests ?? []) as MessageRequestRow[];
  const typedOutgoing = (outgoingRequests ?? []) as MessageRequestRow[];
  const typedMutualMatches = (mutualMatches ?? []) as {
    user_a: string;
    user_b: string;
    status: "mutual";
  }[];

  const profileIds = new Set<string>([user.id]);
  typedConversations.forEach((row) => {
    profileIds.add(row.user_a);
    profileIds.add(row.user_b);
  });
  typedIncoming.forEach((row) => profileIds.add(row.requester_user_id));
  typedOutgoing.forEach((row) => profileIds.add(row.recipient_user_id));
  typedMutualMatches.forEach((row) => {
    profileIds.add(row.user_a);
    profileIds.add(row.user_b);
  });

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("user_id,display_name,avatar_key")
    .in("user_id", Array.from(profileIds));

  const profilesById = new Map<string, ProfileLite>(
    ((profileRows ?? []) as ProfileLite[]).map((item) => [item.user_id, item])
  );

  const conversationItems = typedConversations.map((row) => {
    const partnerId = row.user_a === user.id ? row.user_b : row.user_a;
    const partner = profilesById.get(partnerId);
    return {
      ...row,
      partnerId,
      partnerName: partner?.display_name ?? "Member",
      partnerAvatarKey: partner?.avatar_key ?? "member"
    };
  });

  const selectedConversation =
    conversationItems.find((item) => item.id === selectedConversationParam) ??
    conversationItems[0] ??
    null;

  const selectedConversationId = selectedConversation?.id ?? null;

  const { data: messageRows } = selectedConversationId
    ? await supabase
        .from("conversation_messages")
        .select("id,conversation_id,sender_id,content,created_at")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true })
        .limit(250)
    : { data: [] };

  const typedMessages = (messageRows ?? []) as ChatMessageRow[];

  const { data: discoverRows } = await supabase
    .from("profiles")
    .select("user_id,display_name,avatar_key")
    .eq("is_published", true)
    .neq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  const discoverPeople = (discoverRows ?? []) as ProfileLite[];

  const conversationByPartner = new Map<string, string>();
  conversationItems.forEach((item) => conversationByPartner.set(item.partnerId, item.id));

  const incomingByRequester = new Map<string, MessageRequestRow>();
  typedIncoming.forEach((row) => incomingByRequester.set(row.requester_user_id, row));

  const outgoingByRecipient = new Map<string, MessageRequestRow>();
  typedOutgoing.forEach((row) => outgoingByRecipient.set(row.recipient_user_id, row));

  const matchedUserIds = new Set<string>();
  typedMutualMatches.forEach((row) => {
    matchedUserIds.add(row.user_a === user.id ? row.user_b : row.user_a);
  });

  return (
    <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-0 pb-0 pt-0">
      <div className="flex h-[calc(100vh-8rem)] min-h-[680px] w-full overflow-hidden bg-[#fcfaf8] text-slate-900">
        <aside className="hidden w-20 flex-col items-center gap-8 border-r border-[#ee9d2b]/15 bg-white py-8 md:flex">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#ee9d2b]/20 text-sm font-bold text-[#ee9d2b]">
            HH
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#ee9d2b]/10 text-xs font-semibold text-[#ee9d2b]">
              Msg
            </div>
            <div className="flex size-12 items-center justify-center rounded-full text-xs font-semibold text-slate-400">
              Mch
            </div>
            <div className="flex size-12 items-center justify-center rounded-full text-xs font-semibold text-slate-400">
              Fed
            </div>
          </div>
          <div className="flex size-12 items-center justify-center rounded-full border-2 border-[#ee9d2b]/20 bg-[#fff2df] text-xs font-semibold text-[#aa6920]">
            {initials(myProfile.display_name)}
          </div>
        </aside>

        <section className="flex w-[360px] shrink-0 flex-col border-r border-[#ee9d2b]/10 bg-white">
          <header className="border-b border-[#ee9d2b]/10 p-6">
            <h1 className="text-xl font-bold">Messages</h1>
            <p className="mt-1 text-xs text-slate-500">
              Send a request to anyone, or chat instantly with your mutual matches.
            </p>
            {info && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{info}</p>}
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </header>

          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4">
            <div className="space-y-2">
              <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Incoming Requests
              </h2>
              {typedIncoming.length === 0 ? (
                <p className="px-2 text-xs text-slate-500">No pending requests.</p>
              ) : (
                typedIncoming.map((request) => {
                  const requester = profilesById.get(request.requester_user_id);
                  return (
                    <article key={request.id} className="rounded-2xl border border-[#ee9d2b]/15 bg-[#fffaf4] p-3">
                      <p className="text-sm font-semibold">{requester?.display_name ?? "Member"}</p>
                      {request.message && <p className="mt-1 text-xs text-slate-600">{request.message}</p>}
                      <p className="mt-1 text-[11px] text-slate-500">{formatDayTime(request.created_at)}</p>
                      <div className="mt-3 flex gap-2">
                        <form action={decideMessageRequest}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <input type="hidden" name="decision" value="approved" />
                          <button className="rounded-full bg-[#ee9d2b] px-3 py-1.5 text-xs font-semibold text-white" type="submit">
                            Approve
                          </button>
                        </form>
                        <form action={decideMessageRequest}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                            type="submit"
                          >
                            Decline
                          </button>
                        </form>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="space-y-2">
              <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Conversations</h2>
              {conversationItems.length === 0 ? (
                <p className="px-2 text-xs text-slate-500">No active chats yet.</p>
              ) : (
                conversationItems.map((conversation) => (
                  <a
                    key={conversation.id}
                    href={`/messages?conversation=${conversation.id}`}
                    className={`block rounded-2xl border p-3 no-underline transition ${
                      selectedConversationId === conversation.id
                        ? "border-[#ee9d2b]/40 bg-[#fff3e3]"
                        : "border-transparent bg-slate-50 hover:border-[#ee9d2b]/25"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{conversation.partnerName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {conversation.source === "match" ? "Mutual match chat" : "Approved request"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDayTime(conversation.updated_at)}</p>
                  </a>
                ))
              )}
            </div>

            <div className="space-y-2">
              <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">People</h2>
              {discoverPeople.length === 0 ? (
                <p className="px-2 text-xs text-slate-500">No users available.</p>
              ) : (
                discoverPeople.map((person) => {
                  const existingConversationId = conversationByPartner.get(person.user_id) ?? null;
                  const incomingRequest = incomingByRequester.get(person.user_id) ?? null;
                  const outgoingRequest = outgoingByRecipient.get(person.user_id) ?? null;
                  const isMatched = matchedUserIds.has(person.user_id);

                  return (
                    <article key={person.user_id} className="rounded-2xl border border-slate-100 bg-white p-3">
                      <p className="text-sm font-semibold">{person.display_name}</p>
                      <p className="text-[11px] text-slate-500">{person.avatar_key}</p>
                      <div className="mt-3">
                        {existingConversationId ? (
                          <a
                            href={`/messages?conversation=${existingConversationId}`}
                            className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 no-underline"
                          >
                            Open chat
                          </a>
                        ) : incomingRequest ? (
                          <form action={decideMessageRequest}>
                            <input type="hidden" name="request_id" value={incomingRequest.id} />
                            <input type="hidden" name="decision" value="approved" />
                            <button
                              className="inline-flex rounded-full bg-[#ee9d2b] px-3 py-1.5 text-xs font-semibold text-white"
                              type="submit"
                            >
                              Approve request
                            </button>
                          </form>
                        ) : isMatched ? (
                          <form action={startMatchChat}>
                            <input type="hidden" name="target_user_id" value={person.user_id} />
                            <button
                              className="inline-flex rounded-full bg-[#ee9d2b] px-3 py-1.5 text-xs font-semibold text-white"
                              type="submit"
                            >
                              Start match chat
                            </button>
                          </form>
                        ) : outgoingRequest ? (
                          <form action={cancelMessageRequest}>
                            <input type="hidden" name="request_id" value={outgoingRequest.id} />
                            <button
                              className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                              type="submit"
                            >
                              Cancel request
                            </button>
                          </form>
                        ) : (
                          <form action={sendMessageRequest} className="space-y-2">
                            <input type="hidden" name="target_user_id" value={person.user_id} />
                            <input
                              className="w-full rounded-full border border-slate-200 px-3 py-1.5 text-xs outline-none"
                              name="request_message"
                              maxLength={300}
                              placeholder="Optional note"
                            />
                            <button
                              className="inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                              type="submit"
                            >
                              Send request
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
                  <h2 className="text-lg font-bold text-slate-900">{selectedConversation.partnerName}</h2>
                  <p className="text-sm text-[#c87a1f]">
                    {selectedConversation.source === "match" ? "Mutual match conversation" : "Approved request"}
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
                      const senderName =
                        message.sender_id === user.id
                          ? "You"
                          : (profilesById.get(message.sender_id)?.display_name ?? "Member");

                      return (
                        <div
                          key={message.id}
                          className={`flex max-w-[82%] items-end gap-3 ${mine ? "self-end flex-row-reverse" : ""}`}
                        >
                          <div className="flex size-9 items-center justify-center rounded-full border border-[#ee9d2b]/20 bg-white text-xs font-semibold text-[#b7711d]">
                            {initials(senderName)}
                          </div>
                          <div className={`rounded-2xl p-4 text-sm ${mine ? "bg-[#ee9d2b] text-white" : "bg-white text-slate-700"}`}>
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            <p className={`mt-2 text-[11px] ${mine ? "text-orange-100" : "text-slate-400"}`}>
                              {formatTime(message.created_at)}
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
                  Choose a conversation from the left or send a new message request.
                </p>
              </div>
            </div>
          )}
        </section>
>>>>>>> message-box
      </div>
    </section>
  );
}

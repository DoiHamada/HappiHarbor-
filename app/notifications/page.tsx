import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id,user_a,user_b")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .limit(100);

  const typedConversations = (conversations ?? []) as ConversationRow[];
  const conversationIds = typedConversations.map((row) => row.id);

  const unread = await supabase.rpc("unread_conversation_message_count", { p_user: user.id });

  const { data: incomingMessages } = conversationIds.length
    ? await supabase
        .from("conversation_messages")
        .select("id,conversation_id,sender_id,content,created_at")
        .in("conversation_id", conversationIds)
        .neq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25)
    : { data: [] };

  const typedMessages = (incomingMessages ?? []) as MessageRow[];
  const senderIds = Array.from(new Set(typedMessages.map((message) => message.sender_id)));

  const { data: senders } = senderIds.length
    ? await supabase
        .from("profiles")
        .select("user_id,public_id,display_name,avatar_url")
        .in("user_id", senderIds)
    : { data: [] };

  const senderById = new Map<string, ProfileRow>((senders ?? []).map((sender) => [sender.user_id, sender as ProfileRow]));

  return (
    <section className="space-y-4">
      <div className="card space-y-2">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-harbor-ink/75">Unread messages: <span className="font-semibold">{Number(unread.data ?? 0)}</span></p>
      </div>

      {typedMessages.length === 0 ? (
        <div className="card text-sm text-harbor-ink/75">No new notifications yet.</div>
      ) : (
        <div className="grid gap-3">
          {typedMessages.map((message) => {
            const sender = senderById.get(message.sender_id);
            return (
              <Link
                key={message.id}
                href={`/messages?conversation=${message.conversation_id}`}
                className="card flex items-start gap-3 no-underline"
              >
                <img
                  src={sender?.avatar_url ?? "/logo-mark.svg"}
                  alt={`${sender?.display_name ?? "Member"} avatar`}
                  className="h-10 w-10 rounded-full border border-harbor-ink/10 object-cover"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{sender?.display_name ?? "Member"}</p>
                  <p className="line-clamp-2 text-sm text-harbor-ink/75">{message.content}</p>
                  <p className="mt-1 text-xs text-harbor-ink/60">
                    {new Date(message.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

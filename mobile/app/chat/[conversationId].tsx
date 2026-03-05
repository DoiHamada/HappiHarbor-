import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Input, Screen } from "@/components/ui";

type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  pending?: boolean;
};

export default function ChatScreen() {
  const { user } = useSession();
  const params = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = useMemo(() => String(params.conversationId ?? ""), [params.conversationId]);
  const [content, setContent] = useState("");
  const [rows, setRows] = useState<ChatMessage[]>([]);
  const [partnerLastReadAt, setPartnerLastReadAt] = useState<string | null>(null);
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;

    const [{ data }, { data: conversation }, { data: readRows }] = await Promise.all([
      supabase
        .from("conversation_messages")
        .select("id,sender_id,content,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(300),
      supabase.from("conversations").select("user_a,user_b").eq("id", conversationId).maybeSingle(),
      user
        ? supabase.from("conversation_reads").select("user_id,last_read_at").eq("conversation_id", conversationId)
        : Promise.resolve({ data: [] as Array<{ user_id: string; last_read_at: string }> })
    ]);

    setRows((data ?? []) as ChatMessage[]);

    const convo = (conversation ?? null) as { user_a: string; user_b: string } | null;
    const otherId = convo && user ? (convo.user_a === user.id ? convo.user_b : convo.user_a) : null;
    setPartnerUserId(otherId ?? null);

    const reads = (readRows ?? []) as Array<{ user_id: string; last_read_at: string }>;
    const partnerRead = otherId ? reads.find((row) => row.user_id === otherId)?.last_read_at ?? null : null;
    setPartnerLastReadAt(partnerRead);

    if (user) {
      await supabase.rpc("mark_conversation_read", { p_conversation: conversationId, p_user: user.id });
    }
  }, [conversationId, user]);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          void load();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_reads",
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, load]);

  async function send() {
    if (!user || !conversationId || !content.trim()) return;

    const pendingText = content.trim();
    const pendingMessage: ChatMessage = {
      id: `pending-${Date.now()}`,
      sender_id: user.id,
      content: pendingText,
      created_at: new Date().toISOString(),
      pending: true
    };

    setRows((prev) => [...prev, pendingMessage]);
    setContent("");

    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: pendingText
    });

    if (error) {
      setRows((prev) => prev.filter((item) => item.id !== pendingMessage.id));
      return;
    }

    await load();
  }

  function messageStatus(item: ChatMessage): "Sent" | "Delivered" | "Seen" | null {
    if (item.sender_id !== user?.id) return null;
    if (item.pending) return "Sent";
    if (!partnerUserId) return "Delivered";
    if (!partnerLastReadAt) return "Delivered";

    const seen = new Date(partnerLastReadAt).getTime() >= new Date(item.created_at).getTime();
    return seen ? "Seen" : "Delivered";
  }
  function formatClock(value: string): string {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <Screen>
      <FlatList<ChatMessage>
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          const status = messageStatus(item);
          return (
            <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
              <Card>
                <Text>{item.content}</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <Body>{formatClock(item.created_at)}</Body>
                  {mine && status ? <Body>{status}</Body> : null}
                </View>
              </Card>
            </View>
          );
        }}
        ListEmptyComponent={<Body>No messages yet.</Body>}
      />

      <Card>
        <Input value={content} onChangeText={setContent} placeholder="Type message" multiline />
        <Button label="Send" onPress={() => void send()} />
      </Card>
    </Screen>
  );
}

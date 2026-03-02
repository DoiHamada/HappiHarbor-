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
};

export default function ChatScreen() {
  const { user } = useSession();
  const params = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = useMemo(() => String(params.conversationId ?? ""), [params.conversationId]);
  const [content, setContent] = useState("");
  const [rows, setRows] = useState<ChatMessage[]>([]);

  const load = useCallback(async () => {
    if (!conversationId) return;

    const { data } = await supabase
      .from("conversation_messages")
      .select("id,sender_id,content,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(300);

    setRows((data ?? []) as ChatMessage[]);

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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, load]);

  async function send() {
    if (!user || !conversationId || !content.trim()) return;

    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim()
    });

    if (!error) {
      setContent("");
      await load();
    }
  }

  return (
    <Screen>
      <FlatList<ChatMessage>
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          return (
            <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
              <Card>
                <Text>{item.content}</Text>
                <Body>{new Date(item.created_at).toLocaleTimeString()}</Body>
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

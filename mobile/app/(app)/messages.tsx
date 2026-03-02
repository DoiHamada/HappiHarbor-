import { useCallback, useEffect, useState } from "react";
import { FlatList, Text } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Heading, Screen } from "@/components/ui";

type ConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
  source: "match" | "request";
  updated_at: string;
};

type ProfileLite = {
  user_id: string;
  display_name: string;
};

export default function MessagesScreen() {
  const { user } = useSession();
  const [rows, setRows] = useState<Array<ConversationRow & { partnerName: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const { data: conversations, error: convoError } = await supabase
      .from("conversations")
      .select("id,user_a,user_b,source,updated_at")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (convoError) {
      setError(convoError.message);
      return;
    }

    const typed = (conversations ?? []) as ConversationRow[];
    const partnerIds = Array.from(new Set(typed.map((c) => (c.user_a === user.id ? c.user_b : c.user_a))));
    const { data: profiles } = partnerIds.length
      ? await supabase.from("profiles").select("user_id,display_name").in("user_id", partnerIds)
      : { data: [] };

    const map = new Map<string, string>(((profiles ?? []) as ProfileLite[]).map((p) => [p.user_id, p.display_name]));

    setRows(
      typed.map((row) => ({
        ...row,
        partnerName: map.get(row.user_a === user.id ? row.user_b : row.user_a) ?? "Member"
      }))
    );
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <Card>
        <Heading>Messages</Heading>
        <Body>Your active conversations.</Body>
        {error ? <Body>{error}</Body> : null}
      </Card>

      <FlatList<ConversationRow & { partnerName: string }>
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <Card>
            <Text style={{ fontWeight: "700" }}>{item.partnerName}</Text>
            <Body>{new Date(item.updated_at).toLocaleString()}</Body>
            <Button label="Open" onPress={() => router.push(`/chat/${item.id}`)} />
          </Card>
        )}
        ListEmptyComponent={<Body>No conversations yet.</Body>}
      />
    </Screen>
  );
}

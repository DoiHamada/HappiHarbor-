import { useCallback, useEffect, useState } from "react";
import { FlatList, Text } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Heading, Screen } from "@/components/ui";
import { fallbackPublicId, titleize } from "@/types/profile";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: "pending" | "mutual" | "closed";
};

type ProfileLite = {
  user_id: string;
  public_id: string | null;
  display_name: string;
};

export default function MatchesScreen() {
  const { user } = useSession();
  const [items, setItems] = useState<Array<MatchRow & { other: ProfileLite | null }>>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);

    const { data: matches, error: matchError } = await supabase
      .from("matches")
      .select("id,user_a,user_b,status")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(40);

    if (matchError) {
      setError(matchError.message);
      return;
    }

    const typed = (matches ?? []) as MatchRow[];
    const ids = Array.from(new Set(typed.map((m) => (m.user_a === user.id ? m.user_b : m.user_a))));
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("user_id,public_id,display_name").in("user_id", ids)
      : { data: [] };

    const byId = new Map<string, ProfileLite>(((profiles ?? []) as ProfileLite[]).map((p) => [p.user_id, p]));

    setItems(
      typed.map((match) => ({
        ...match,
        other: byId.get(match.user_a === user.id ? match.user_b : match.user_a) ?? null
      }))
    );
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openChat(targetUserId: string) {
    if (!user) return;
    const userA = user.id < targetUserId ? user.id : targetUserId;
    const userB = user.id < targetUserId ? targetUserId : user.id;

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();

    if (existing?.id) {
      router.push(`/chat/${existing.id}`);
      return;
    }

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_a: userA, user_b: userB, source: "match", request_id: null })
      .select("id")
      .single();

    if (error || !created?.id) {
      setError(error?.message ?? "Failed to open chat.");
      return;
    }

    router.push(`/chat/${created.id}`);
  }

  return (
    <Screen>
      <Card>
        <Heading>Your matches</Heading>
        <Body>Private non-swipe connection list.</Body>
        {error ? <Body>{error}</Body> : null}
      </Card>

      <FlatList<MatchRow & { other: ProfileLite | null }>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
        renderItem={({ item }) => {
          const otherId = item.other?.public_id ?? (item.other?.user_id ? fallbackPublicId(item.other.user_id) : "Unknown");
          return (
            <Card>
              <Text style={{ fontWeight: "700" }}>{item.other?.display_name ?? "Member"}</Text>
              <Body>{otherId}</Body>
              <Body>Status: {titleize(item.status)}</Body>
              {item.other?.user_id ? <Button label="Message" onPress={() => void openChat(item.other!.user_id)} /> : null}
            </Card>
          );
        }}
        ListEmptyComponent={<Body>No matches yet.</Body>}
      />
    </Screen>
  );
}

import { useCallback, useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Busy, Button, InlineStatus, Screen } from "@/components/ui";
import { CardHeader, EmptyState, SocialCard } from "@/components/social";

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
  avatar_url: string | null;
  avatar_storage_path: string | null;
};

export default function MessagesScreen() {
  const { user } = useSession();
  const [rows, setRows] = useState<Array<ConversationRow & { partnerName: string; partnerAvatarUrl: string | null }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoadingList(true);
    try {
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
        ? await supabase.from("profiles").select("user_id,display_name,avatar_url,avatar_storage_path").in("user_id", partnerIds)
        : { data: [] };

      const typedProfiles = (profiles ?? []) as ProfileLite[];
      const avatarPaths = typedProfiles.map((p) => p.avatar_storage_path).filter((v): v is string => Boolean(v));
      const signedMap = new Map<string, string>();
      if (avatarPaths.length) {
        const { data: signed } = await supabase.storage.from("profile-avatars").createSignedUrls(avatarPaths, 3600);
        (signed ?? []).forEach((row, index) => {
          const path = row.path ?? avatarPaths[index];
          if (path && row.signedUrl) signedMap.set(path, row.signedUrl);
        });
      }
      typedProfiles.forEach((p) => {
        if (p.avatar_storage_path && signedMap.has(p.avatar_storage_path)) {
          p.avatar_url = signedMap.get(p.avatar_storage_path) ?? p.avatar_url;
        }
      });
      const map = new Map<string, ProfileLite>(typedProfiles.map((p) => [p.user_id, p]));

      setRows(
        typed.map((row) => {
          const partnerId = row.user_a === user.id ? row.user_b : row.user_a;
          const partner = map.get(partnerId);
          return {
            ...row,
            partnerName: partner?.display_name ?? "Member",
            partnerAvatarUrl: partner?.avatar_url ?? null
          };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations.");
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      {error ? (
        <View style={{ paddingHorizontal: 4 }}>
          <InlineStatus text={error} tone="danger" />
        </View>
      ) : null}

      {loadingList ? <Busy label="Loading conversations..." /> : null}

      <FlatList<ConversationRow & { partnerName: string; partnerAvatarUrl: string | null }>
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState title="No conversations" description="Start from matches or member profiles." />}
        renderItem={({ item }) => (
          <SocialCard>
            <CardHeader
              title={item.partnerName}
              avatarUri={item.partnerAvatarUrl}
            />
            <Button label="Open chat" onPress={() => router.push(`/chat/${item.id}`)} compact />
          </SocialCard>
        )}
      />
    </Screen>
  );
}

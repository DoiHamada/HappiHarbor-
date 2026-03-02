import { useCallback, useEffect, useState } from "react";
import { FlatList, Text } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { Body, Card, Heading, Screen } from "@/components/ui";

type SocialNotification = {
  id: string;
  actor_user_id: string;
  type: "reaction" | "comment" | "profile_view" | "friend_request";
  reaction: string | null;
  details: string | null;
  created_at: string;
};

export default function NotificationsScreen() {
  const { user } = useSession();
  const [rows, setRows] = useState<SocialNotification[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("social_notifications")
      .select("id,actor_user_id,type,reaction,details,created_at")
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(80);

    setRows((data ?? []) as SocialNotification[]);

    const ids = (data ?? []).map((x) => x.id);
    if (ids.length > 0) {
      await supabase.from("social_notifications").update({ is_read: true }).in("id", ids);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <Card>
        <Heading>Notifications</Heading>
        <Body>Social interactions only.</Body>
      </Card>

      <FlatList<SocialNotification>
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
        renderItem={({ item }) => {
          const title =
            item.type === "reaction"
              ? `Reaction ${item.reaction ?? ""}`
              : item.type === "comment"
                ? "Comment"
                : item.type === "profile_view"
                  ? "Profile view"
                  : "Friend request";

          return (
            <Card>
              <Text style={{ fontWeight: "700" }}>{title}</Text>
              {item.details ? <Body>{item.details}</Body> : null}
              <Body>{new Date(item.created_at).toLocaleString()}</Body>
            </Card>
          );
        }}
        ListEmptyComponent={<Body>No notifications yet.</Body>}
      />
    </Screen>
  );
}

import { useCallback, useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { Busy, InlineStatus, Screen } from "@/components/ui";
import { CardHeader, EmptyState, SocialCard } from "@/components/social";
import { fallbackPublicId } from "@/types/profile";

type SocialNotification = {
  id: string;
  actor_user_id: string;
  type: "reaction" | "comment" | "profile_view" | "follow";
  reaction: string | null;
  details: string | null;
  created_at: string;
};

type ActorProfile = {
  user_id: string;
  display_name: string;
  public_id: string | null;
  avatar_url: string | null;
  avatar_storage_path: string | null;
};

type NotificationItem = SocialNotification & {
  actor: ActorProfile | null;
  view_count?: number;
  grouped_day?: string;
};

export default function NotificationsScreen() {
  const { user } = useSession();
  const [rows, setRows] = useState<NotificationItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoadingList(true);
    try {
      const { data, error: notificationsError } = await supabase
        .from("social_notifications")
        .select("id,actor_user_id,type,reaction,details,created_at")
        .eq("recipient_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(80);

      if (notificationsError) {
        setError(notificationsError.message);
        return;
      }

      const typed = (data ?? []) as SocialNotification[];
      const actorIds = Array.from(new Set(typed.map((item) => item.actor_user_id)));
      const { data: actors } = actorIds.length
        ? await supabase.from("profiles").select("user_id,display_name,public_id,avatar_url,avatar_storage_path").in("user_id", actorIds)
        : { data: [] };

      const typedActors = (actors ?? []) as ActorProfile[];
      const paths = typedActors.map((a) => a.avatar_storage_path).filter((v): v is string => Boolean(v));
      const signedMap = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("profile-avatars").createSignedUrls(paths, 3600);
        (signed ?? []).forEach((row, index) => {
          const path = row.path ?? paths[index];
          if (path && row.signedUrl) signedMap.set(path, row.signedUrl);
        });
      }
      typedActors.forEach((a) => {
        if (a.avatar_storage_path && signedMap.has(a.avatar_storage_path)) {
          a.avatar_url = signedMap.get(a.avatar_storage_path) ?? a.avatar_url;
        }
      });
      const byId = new Map<string, ActorProfile>(typedActors.map((actor) => [actor.user_id, actor]));
      const mapped = typed.map((item) => ({ ...item, actor: byId.get(item.actor_user_id) ?? null }));

      const groupedProfileViews = new Map<string, NotificationItem>();
      const merged: NotificationItem[] = [];
      mapped.forEach((item) => {
        if (item.type !== "profile_view") {
          merged.push(item);
          return;
        }
        const day = item.created_at.slice(0, 10);
        const key = `${item.actor_user_id}:${day}`;
        const prev = groupedProfileViews.get(key);
        if (!prev) {
          groupedProfileViews.set(key, { ...item, view_count: 1, grouped_day: day });
          return;
        }
        const nextCount = (prev.view_count ?? 1) + 1;
        const latest = new Date(item.created_at).getTime() > new Date(prev.created_at).getTime() ? item : prev;
        groupedProfileViews.set(key, {
          ...latest,
          actor: latest.actor ?? prev.actor,
          view_count: nextCount,
          grouped_day: day
        });
      });

      setRows(
        [...merged, ...Array.from(groupedProfileViews.values())].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );

      const ids = typed.map((x) => x.id);
      if (ids.length > 0) {
        await supabase.from("social_notifications").update({ is_read: true }).in("id", ids);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
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

      {loadingList ? <Busy label="Loading notifications..." /> : null}

      <FlatList<NotificationItem>
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState title="No notifications" description="You are all caught up." />}
        renderItem={({ item }) => {
          const actorName = item.actor?.display_name ?? "Member";
          const actorId = item.actor?.public_id ?? (item.actor ? fallbackPublicId(item.actor.user_id) : null);
          const title =
            item.type === "reaction"
              ? `${actorName} reacted ${item.reaction ?? ""}`
              : item.type === "comment"
                ? `${actorName} commented on your post`
                : item.type === "profile_view"
                  ? `${actorName} viewed your profile ${item.view_count && item.view_count > 1 ? `${item.view_count} times` : "once"} today`
                  : item.details === "follow"
                    ? `${actorName} followed you`
                    : `${actorName} sent a connection request`;

          return (
            <SocialCard>
              <CardHeader
                title={title}
                avatarUri={item.actor?.avatar_url ?? null}
                onPress={actorId ? () => router.push(`/member/${actorId}`) : undefined}
              />
            </SocialCard>
          );
        }}
      />
    </Screen>
  );
}

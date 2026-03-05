import { useEffect, useState } from "react";
import { Redirect, Tabs, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable } from "react-native";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { AppLogo } from "@/components/app-logo";
import { LaunchScreen } from "@/components/launch-screen";

export default function AppTabsLayout() {
  const { loading, user, profile } = useSession();
  const [messageUnread, setMessageUnread] = useState(0);
  const [notificationUnread, setNotificationUnread] = useState(0);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    let active = true;

    async function refreshBadges() {
      const [{ data: messageCountRaw }, { count: notificationCount }] = await Promise.all([
        supabase.rpc("unread_conversation_message_count", { p_user: userId }),
        supabase
          .from("social_notifications")
          .select("id", { head: true, count: "exact" })
          .eq("recipient_user_id", userId)
          .eq("is_read", false)
      ]);

      if (!active) return;
      setMessageUnread(Number(messageCountRaw ?? 0));
      setNotificationUnread(Number(notificationCount ?? 0));
    }

    void refreshBadges();

    const channel = supabase
      .channel(`mobile-nav-badges-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_messages"
        },
        () => {
          void refreshBadges();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_reads",
          filter: `user_id=eq.${userId}`
        },
        () => {
          void refreshBadges();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_notifications",
          filter: `recipient_user_id=eq.${userId}`
        },
        () => {
          void refreshBadges();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  if (loading) return <LaunchScreen />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (!user.email_confirmed_at || !profile?.user_id) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "left",
        headerStyle: { backgroundColor: colors.pageAccent },
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: colors.border,
          height: 66,
          paddingBottom: 8,
          paddingTop: 6
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" }
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          href: null,
          title: "Moments"
        }}
      />
      <Tabs.Screen
        name="sail"
        options={{
          title: "Sail",
          headerTitle: () => <AppLogo compact />,
          headerTitleAlign: "center",
          tabBarIcon: ({ color, size }) => <Ionicons name="boat-outline" size={size} color={color} />,
          headerRight: () => (
            <Pressable onPress={() => router.push("/(app)/search")} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="search-outline" size={21} color={colors.text} />
            </Pressable>
          )
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null,
          title: "Search"
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          href: null,
          title: "Harbor"
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge: messageUnread > 0 ? messageUnread : undefined,
          tabBarBadgeStyle: { backgroundColor: "#ef4444", color: "#fff", fontSize: 10, minWidth: 18, height: 18, borderRadius: 99, marginTop: 2 },
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarBadge: notificationUnread > 0 ? " " : undefined,
          tabBarBadgeStyle: { backgroundColor: "#ef4444", minWidth: 8, height: 8, borderRadius: 99, marginTop: 4 },
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />
        }}
      />
    </Tabs>
  );
}

import { Redirect, Tabs } from "expo-router";
import { useSession } from "@/lib/session";

export default function AppTabsLayout() {
  const { loading, user, profile } = useSession();

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (!user.email_confirmed_at || !profile?.user_id) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#F8F4EE" },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: "#fff" },
        tabBarActiveTintColor: "#EC9F29"
      }}
    >
      <Tabs.Screen name="discover" options={{ title: "Discover" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="matches" options={{ title: "Matches" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

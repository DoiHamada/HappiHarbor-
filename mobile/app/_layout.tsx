import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/lib/session";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: "#F8F4EE" }, headerShadowVisible: false }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/sign-in" options={{ title: "Welcome" }} />
          <Stack.Screen name="onboarding" options={{ title: "Onboarding" }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="member/[publicId]" options={{ title: "Member Profile" }} />
          <Stack.Screen name="chat/[conversationId]" options={{ title: "Chat" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";
import { LaunchScreen } from "@/components/launch-screen";

export default function IndexScreen() {
  const { loading, user, profile } = useSession();
  const [minLaunchDone, setMinLaunchDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinLaunchDone(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !minLaunchDone) return <LaunchScreen />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (!user.email_confirmed_at || !profile?.user_id) return <Redirect href="/onboarding" />;

  return <Redirect href="/(app)/sail" />;
}

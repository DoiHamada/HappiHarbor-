import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";
import { Busy } from "@/components/ui";

export default function IndexScreen() {
  const { loading, user, profile } = useSession();

  if (loading) return <Busy label="Preparing HappiHarbor..." />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (!user.email_confirmed_at || !profile?.user_id) return <Redirect href="/onboarding" />;

  return <Redirect href="/(app)/discover" />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DiscoverClient } from "./discover-client";

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const fallbackId = user.id.slice(0, 8).toUpperCase();
  const inferredName = user.email?.split("@")[0] ?? "Harbor User";
  const formattedName = inferredName
    .split(/[._-]/)
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");

  return <DiscoverClient currentUserName={formattedName || "Harbor User"} currentUserId={`HH-${fallbackId}`} />;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      redirect("/onboarding");
    }

    redirect("/matches");
  }

  return (
    <section className="space-y-6">
      <div className="card space-y-4">
        <p className="inline-block rounded-full bg-harbor-peach px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          Your Harbor for Happier Love
        </p>
        <h1 className="text-4xl font-black leading-tight">Dating without swipe fatigue.</h1>
        <p className="max-w-2xl text-sm text-harbor-ink/80">
          HappiHarbor uses private compatibility-first matching, preset avatars, and safety-first messaging.
          Build your profile, set your preferences, and get curated matches.
        </p>
        <div className="flex gap-3">
          <Link href="/auth" className="btn no-underline">
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}

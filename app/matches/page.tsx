import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MatchesPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  if (!user.email_confirmed_at) {
    redirect("/onboarding");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id,is_published")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id,user_a,user_b,status,score,matched_at,created_at")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <section className="space-y-4">
      <div className="card flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your matches</h1>
          <p className="text-sm text-harbor-ink/75">
            Curated non-swipe suggestions and mutual matches appear here.
          </p>
        </div>
        <Link href="/onboarding" className="btn-secondary no-underline">
          Edit profile
        </Link>
      </div>

      {!profile.is_published && (
        <div className="card text-sm">
          Your profile is private right now. Publish it in profile settings to become match-eligible.
        </div>
      )}

      {error && <div className="card text-sm text-red-600">Failed to load matches: {error.message}</div>}

      {(matches ?? []).length === 0 ? (
        <div className="card text-sm text-harbor-ink/75">No matches yet. Check back soon.</div>
      ) : (
        <div className="grid gap-3">
          {(matches ?? []).map((match) => {
            const otherUserId = match.user_a === user.id ? match.user_b : match.user_a;
            return (
              <article key={match.id} className="card space-y-1">
                <p className="text-sm font-semibold">Match with user: {otherUserId}</p>
                <p className="text-xs uppercase tracking-wide text-harbor-ink/70">Status: {match.status}</p>
                <p className="text-sm">Compatibility score: {match.score}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

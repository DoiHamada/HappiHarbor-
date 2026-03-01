import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileCard } from "@/components/profile-card";
import { openDirectChat } from "@/app/messages/actions";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: string;
  score: number;
};

type MatchProfileRow = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
  last_active_at: string | null;
};

function isRecentlyActive(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  const ts = new Date(lastActiveAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 5 * 60 * 1000;
}

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

  const { data: profile } = await supabase.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id,user_a,user_b,status,score,matched_at,created_at")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(30);

  const typedMatches = (matches ?? []) as MatchRow[];
  const otherUserIds = Array.from(
    new Set(typedMatches.map((match) => (match.user_a === user.id ? match.user_b : match.user_a)))
  );
  const { data: profileRows } = otherUserIds.length
    ? await supabase
        .from("profiles")
        .select("user_id,public_id,display_name,avatar_url,last_active_at")
        .in("user_id", otherUserIds)
    : { data: [] };
  const profileByUserId = new Map<string, MatchProfileRow>(
    ((profileRows ?? []) as MatchProfileRow[]).map((row) => [row.user_id, row])
  );

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

      {error && <div className="card text-sm text-red-600">Failed to load matches: {error.message}</div>}

      {typedMatches.length === 0 ? (
        <div className="card text-sm text-harbor-ink/75">No matches yet. Check back soon.</div>
      ) : (
        <div className="grid gap-3">
          {typedMatches.map((match) => {
            const otherUserId = match.user_a === user.id ? match.user_b : match.user_a;
            const otherProfile = profileByUserId.get(otherUserId);
            const publicId = otherProfile?.public_id ?? `HH-${otherUserId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
            return (
              <div key={match.id} className="space-y-2">
                <ProfileCard
                  avatarUrl={otherProfile?.avatar_url ?? "/logo-mark.svg"}
                  displayName={otherProfile?.display_name ?? "Member"}
                  publicId={publicId}
                  isActive={isRecentlyActive(otherProfile?.last_active_at)}
                  action={
                    <form action={openDirectChat} className="flex items-center gap-2">
                      <input type="hidden" name="target_user_id" value={otherUserId} />
                      <button className="btn" type="submit">
                        Send Message
                      </button>
                    </form>
                  }
                />
                <div className="card flex items-center justify-between text-sm">
                  <span className="text-harbor-ink/75">Compatibility score: {match.score}</span>
                  <span className="text-xs uppercase tracking-wide text-harbor-ink/60">{match.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

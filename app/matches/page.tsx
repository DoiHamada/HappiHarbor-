import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileCard } from "@/components/profile-card";
import { openDirectChat } from "@/app/messages/actions";
import { GenderIcon } from "@/components/identity-icons";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: "pending" | "mutual" | "closed";
};

type MatchProfileRow = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
  last_active_at: string | null;
  gender: string;
};

type PreferenceRow = {
  user_id: string;
  profile_tags: Record<string, unknown> | null;
};

function isRecentlyActive(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  const ts = new Date(lastActiveAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 5 * 60 * 1000;
}

function titleize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toTagSet(profileTags: Record<string, unknown> | null | undefined): Set<string> {
  const tags = new Set<string>();
  if (!profileTags || typeof profileTags !== "object") return tags;
  Object.values(profileTags).forEach((value) => {
    if (!Array.isArray(value)) return;
    value.forEach((item) => {
      const normalized = String(item).trim().toLowerCase();
      if (normalized) tags.add(normalized);
    });
  });
  return tags;
}

function commonInterest(myTags: Set<string>, otherTags: Set<string>): string | null {
  for (const tag of myTags) {
    if (otherTags.has(tag)) {
      return `Both like ${titleize(tag)}`;
    }
  }
  return null;
}

function HandshakeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 11l3 3m0 0 5-5m-5 5-1.5 1.5a2 2 0 01-2.8 0L3.5 12a2 2 0 010-2.8L6 6.7a2 2 0 012.8 0L12 10" />
      <path d="M16 13l1.5 1.5a2 2 0 002.8 0l1.2-1.2a2 2 0 000-2.8L18 7a2 2 0 00-2.8 0L12 10" />
    </svg>
  );
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
    .select("id,user_a,user_b,status,matched_at,created_at")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .eq("status", "mutual")
    .order("created_at", { ascending: false })
    .limit(30);

  const typedMatches = (matches ?? []) as MatchRow[];
  const otherUserIds = Array.from(
    new Set(typedMatches.map((match) => (match.user_a === user.id ? match.user_b : match.user_a)))
  );
  const { data: profileRows } = otherUserIds.length
    ? await supabase
        .from("profiles")
        .select("user_id,public_id,display_name,avatar_url,last_active_at,gender")
        .in("user_id", otherUserIds)
    : { data: [] };
  const profileByUserId = new Map<string, MatchProfileRow>(
    ((profileRows ?? []) as MatchProfileRow[]).map((row) => [row.user_id, row])
  );

  const preferenceUserIds = [user.id, ...otherUserIds];
  const { data: preferenceRows } = preferenceUserIds.length
    ? await supabase
        .from("preferences")
        .select("user_id,profile_tags")
        .in("user_id", preferenceUserIds)
    : { data: [] };
  const preferenceByUserId = new Map<string, PreferenceRow>(
    ((preferenceRows ?? []) as PreferenceRow[]).map((row) => [row.user_id, row])
  );
  const myTagSet = toTagSet(preferenceByUserId.get(user.id)?.profile_tags ?? null);

  return (
    <section className="space-y-4">
      <div className="card flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Active Connections</h1>
          <p className="text-sm text-harbor-ink/75">
            Connected members are shown here for immediate messaging.
          </p>
        </div>
        <Link href="/onboarding" className="btn-secondary no-underline">
          Edit profile
        </Link>
      </div>

      {error && <div className="card text-sm text-red-600">Failed to load matches: {error.message}</div>}

      {typedMatches.length === 0 ? (
        <div className="card text-sm text-harbor-ink/75">
          No active connections right now. Closed or canceled requests are moved out of this list.
        </div>
      ) : (
        <div className="grid gap-3">
          {typedMatches.map((match) => {
            const otherUserId = match.user_a === user.id ? match.user_b : match.user_a;
            const otherProfile = profileByUserId.get(otherUserId);
            const publicId = otherProfile?.public_id ?? `HH-${otherUserId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
            const otherTagSet = toTagSet(preferenceByUserId.get(otherUserId)?.profile_tags ?? null);
            const interest = commonInterest(myTagSet, otherTagSet);

            return (
              <div key={match.id} className="space-y-2">
                <ProfileCard
                  avatarUrl={otherProfile?.avatar_url ?? "/logo-mark.svg"}
                  displayName={otherProfile?.display_name ?? "Member"}
                  publicId={publicId}
                  isActive={isRecentlyActive(otherProfile?.last_active_at)}
                  nameAdornment={
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      <HandshakeIcon />
                      Connected
                    </span>
                  }
                  meta={
                    <p className="flex items-center gap-2">
                      <span className={`inline-block size-2 rounded-full ${isRecentlyActive(otherProfile?.last_active_at) ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {publicId} · {isRecentlyActive(otherProfile?.last_active_at) ? "Active now" : "Inactive"}
                      <span className="inline-flex items-center gap-1 rounded-full border border-harbor-ink/15 px-2 py-0.5 text-xs">
                        <GenderIcon value={otherProfile?.gender ?? "prefer_not_to_say"} className="h-3.5 w-3.5" />
                      </span>
                    </p>
                  }
                  action={
                    <form action={openDirectChat} className="flex items-center gap-2">
                      <input type="hidden" name="target_user_id" value={otherUserId} />
                      <button className="btn" type="submit">
                        Message
                      </button>
                    </form>
                  }
                />
                {interest ? (
                  <div className="card py-3 text-sm text-harbor-ink/80">
                    <span className="inline-flex items-center rounded-full border border-harbor-ink/15 bg-harbor-cream px-3 py-1 text-xs font-semibold">
                      Common Interest: {interest}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

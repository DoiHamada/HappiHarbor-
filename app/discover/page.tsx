import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDiscoverPost } from "./actions";

type DiscoverPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DiscoverPostRow = {
  id: string;
  user_id: string;
  thought: string | null;
  photo_path: string | null;
  created_at: string;
  profiles: {
    user_id: string;
    public_id: string | null;
    display_name: string;
    avatar_key: string;
    last_active_at: string | null;
  } | null;
};

type MeRow = {
  user_id: string;
  public_id?: string | null;
  display_name: string;
  is_suspended: boolean;
};

function fallbackPublicId(userId: string): string {
  return `HH-${userId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function isRecentlyActive(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  const ts = new Date(lastActiveAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 5 * 60 * 1000;
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = (await searchParams) ?? {};
  const errorParam = typeof params.error === "string" ? params.error : null;
  const posted = params.posted === "1";
  const query = typeof params.q === "string" ? params.q.trim() : "";

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

  const { data: meWithPresence, error: mePresenceError } = await supabase
    .from("profiles")
    .select("user_id,public_id,display_name,is_suspended")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: meFallback } = mePresenceError
    ? await supabase
        .from("profiles")
        .select("user_id,display_name,is_suspended")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const me = ((meWithPresence ?? meFallback) as MeRow | null);

  if (!me) {
    redirect("/onboarding");
  }

  if (me.is_suspended) {
    redirect("/messages?error=Your account is currently restricted.");
  }

  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", user.id);

  const { data: postsWithPresence, error: postsPresenceError } = await supabase
    .from("feed_posts")
    .select("id,user_id,thought,photo_path,created_at,profiles(user_id,public_id,display_name,avatar_key,last_active_at)")
    .order("created_at", { ascending: false })
    .limit(80);

  const { data: postsFallback, error: postsFallbackError } = postsPresenceError
    ? await supabase
        .from("feed_posts")
        .select("id,user_id,thought,photo_path,created_at,profiles(user_id,display_name,avatar_key)")
        .order("created_at", { ascending: false })
        .limit(80)
    : { data: null, error: null };

  const allPosts = ((postsWithPresence ?? postsFallback ?? []) as unknown as DiscoverPostRow[]);
  const postsError = postsPresenceError ?? postsFallbackError;

  const filteredPosts = query
    ? allPosts.filter((post) => {
        const profile = post.profiles;
        if (!profile) return false;
        const normalized = query.toLowerCase();
        return (
          profile.display_name.toLowerCase().includes(normalized) ||
          (profile.public_id ?? fallbackPublicId(profile.user_id)).toLowerCase().includes(normalized)
        );
      })
    : allPosts;

  const paths = filteredPosts.map((post) => post.photo_path).filter((value): value is string => Boolean(value));
  const photoUrlByPath = new Map<string, string>();

  if (paths.length > 0) {
    const { data: signedUrls } = await supabase.storage.from("feed-photos").createSignedUrls(paths, 3600);
    (signedUrls ?? []).forEach((row, index) => {
      const path = row.path ?? paths[index];
      if (path && row.signedUrl) {
        photoUrlByPath.set(path, row.signedUrl);
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="card space-y-2">
        <h1 className="text-2xl font-bold">Discover</h1>
        <p className="text-sm text-harbor-ink/75">
          Browse member thoughts and moment photos. Search by name or user ID.
        </p>
        <p className="text-xs text-harbor-ink/70">
          Your user ID: <span className="font-semibold">{me.public_id ?? fallbackPublicId(user.id)}</span>
        </p>
      </div>

      <form className="card" method="get">
        <label className="label" htmlFor="q">
          Search users
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="Search by name or user ID"
            className="input"
          />
          <button className="btn-secondary" type="submit">
            Search
          </button>
        </div>
      </form>

      <form action={createDiscoverPost} className="card space-y-3">
        <label className="label" htmlFor="thought">
          Share your thoughts
        </label>
        <textarea
          id="thought"
          name="thought"
          className="input min-h-28"
          maxLength={1000}
          placeholder="What are you thinking today?"
        />

        <div className="space-y-1">
          <label className="label" htmlFor="photo">
            Add a moment photo (optional)
          </label>
          <input id="photo" name="photo" className="input" type="file" accept="image/jpeg,image/png,image/webp" />
          <p className="text-xs text-harbor-ink/70">Max 5MB. JPG, PNG, or WEBP.</p>
        </div>

        <button className="btn" type="submit">
          Post to Discover
        </button>
      </form>

      {errorParam && <div className="card text-sm text-red-600">{errorParam}</div>}
      {posted && <div className="card text-sm text-green-700">Your post is live.</div>}
      {postsError && <div className="card text-sm text-red-600">Failed to load discover posts: {postsError.message}</div>}

      {filteredPosts.length === 0 ? (
        <div className="card text-sm text-harbor-ink/75">No posts match this search yet.</div>
      ) : (
        <div className="grid gap-3">
          {filteredPosts.map((post) => {
            const photoUrl = post.photo_path ? photoUrlByPath.get(post.photo_path) : null;
            const profile = post.profiles;
            const authorName = profile?.display_name ?? "Member";
            const authorId = profile ? profile.public_id ?? fallbackPublicId(profile.user_id) : "Unknown";
            const active = isRecentlyActive(profile?.last_active_at);

            return (
              <article key={post.id} className="card space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {profile ? (
                      <Link
                        href={`/profile/${profile.public_id ?? fallbackPublicId(profile.user_id)}`}
                        className="text-sm font-semibold no-underline hover:underline"
                      >
                        {authorName}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold">{authorName}</p>
                    )}
                    <p className="mt-1 flex items-center gap-2 text-xs text-harbor-ink/70">
                      <span className={`inline-block size-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {authorId} · {active ? "Active now" : "Inactive"}
                    </p>
                  </div>
                  <p className="text-xs text-harbor-ink/70">
                    {new Date(post.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                </div>

                {post.thought && <p className="text-sm whitespace-pre-wrap">{post.thought}</p>}

                {photoUrl && (
                  <img src={photoUrl} alt={`${authorName} moment photo`} className="w-full rounded-xl border border-harbor-ink/10 object-cover" />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

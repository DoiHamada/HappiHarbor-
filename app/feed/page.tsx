import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createFeedPost } from "./actions";

type FeedPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FeedRow = {
  id: string;
  user_id: string;
  thought: string | null;
  photo_path: string | null;
  created_at: string;
  profiles: {
    display_name: string;
    avatar_key: string;
  } | null;
};

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = (await searchParams) ?? {};
  const errorParam = typeof params.error === "string" ? params.error : null;
  const posted = params.posted === "1";

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
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const { data: posts, error: postsError } = await supabase
    .from("feed_posts")
    .select("id,user_id,thought,photo_path,created_at,profiles(display_name,avatar_key)")
    .order("created_at", { ascending: false })
    .limit(50);

  const typedPosts = (posts ?? []) as unknown as FeedRow[];

  const paths = typedPosts
    .map((post) => post.photo_path)
    .filter((value): value is string => Boolean(value));

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
        <h1 className="text-2xl font-bold">Newsfeed</h1>
        <p className="text-sm text-harbor-ink/75">
          Share short thoughts and photos with the HappiHarbor community.
        </p>
      </div>

      <form action={createFeedPost} className="card space-y-3">
        <label className="label" htmlFor="thought">
          What&apos;s on your mind?
        </label>
        <textarea
          id="thought"
          name="thought"
          className="input min-h-28"
          maxLength={1000}
          placeholder="Share a thought..."
        />

        <div className="space-y-1">
          <label className="label" htmlFor="photo">
            Add a photo (optional)
          </label>
          <input
            id="photo"
            name="photo"
            className="input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
          <p className="text-xs text-harbor-ink/70">Max 5MB. JPG, PNG, or WEBP.</p>
        </div>

        <button className="btn" type="submit">
          Post to feed
        </button>
      </form>

      {errorParam && <div className="card text-sm text-red-600">{errorParam}</div>}
      {posted && <div className="card text-sm text-green-700">Your post is live.</div>}
      {postsError && <div className="card text-sm text-red-600">Failed to load feed: {postsError.message}</div>}

      {typedPosts.length === 0 ? (
        <div className="card text-sm text-harbor-ink/75">No posts yet. Be the first to share.</div>
      ) : (
        <div className="grid gap-3">
          {typedPosts.map((post) => {
            const photoUrl = post.photo_path ? photoUrlByPath.get(post.photo_path) : null;

            return (
              <article key={post.id} className="card space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {post.profiles?.display_name ?? "Member"}
                  </p>
                  <p className="text-xs text-harbor-ink/70">
                    {new Date(post.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                </div>

                {post.thought && <p className="text-sm whitespace-pre-wrap">{post.thought}</p>}

                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt="User uploaded feed photo"
                    className="w-full rounded-xl border border-harbor-ink/10 object-cover"
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

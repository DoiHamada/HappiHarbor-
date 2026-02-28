import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addDiscoverComment,
  createDiscoverPost,
  deleteDiscoverPost,
  reactToDiscoverPost,
  updateDiscoverPostVisibility
} from "./actions";

type DiscoverPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DiscoverPostRow = {
  id: string;
  user_id: string;
  thought: string | null;
  photo_path: string | null;
  is_public?: boolean | null;
  created_at: string;
};

type ProfileLite = {
  user_id: string;
  public_id?: string | null;
  display_name: string;
  avatar_url?: string | null;
  last_active_at?: string | null;
};

type MeRow = {
  user_id: string;
  public_id?: string | null;
  display_name: string;
  avatar_url?: string | null;
  is_suspended: boolean;
};

type ReactionRow = {
  post_id: string;
  user_id: string;
  reaction: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    public_id: string | null;
    display_name: string;
    avatar_url: string | null;
  } | null;
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
    .select("user_id,public_id,display_name,avatar_url,is_suspended")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: meFallback } = mePresenceError
    ? await supabase
        .from("profiles")
        .select("user_id,display_name,avatar_url,is_suspended")
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

  const { data: postsWithVisibility, error: postsVisibilityError } = await supabase
    .from("feed_posts")
    .select("id,user_id,thought,photo_path,is_public,created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  const { data: postsWithoutVisibility, error: postsWithoutVisibilityError } = postsVisibilityError
    ? await supabase
        .from("feed_posts")
        .select("id,user_id,thought,photo_path,created_at")
        .order("created_at", { ascending: false })
        .limit(80)
    : { data: null, error: null };

  const rawPosts = ((postsWithVisibility ?? postsWithoutVisibility ?? []) as unknown as DiscoverPostRow[]);
  const profileIds = Array.from(new Set(rawPosts.map((post) => post.user_id)));
  const { data: postProfilesWithPresence, error: postProfilesPresenceError } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("user_id,public_id,display_name,avatar_url,last_active_at")
        .in("user_id", profileIds)
    : { data: [] as ProfileLite[], error: null };

  const { data: postProfilesFallback, error: postProfilesFallbackError } = postProfilesPresenceError
    ? await supabase
        .from("profiles")
        .select("user_id,display_name,avatar_url")
        .in("user_id", profileIds)
    : { data: null, error: null };

  const profilesById = new Map<string, ProfileLite>(
    ((postProfilesWithPresence ?? postProfilesFallback ?? []) as ProfileLite[]).map((row) => [row.user_id, row])
  );

  const allPosts = rawPosts.map((post) => ({
    ...post,
    profiles: profilesById.get(post.user_id) ?? null
  }));
  const canManagePostVisibility = !postsVisibilityError;
  const postsError =
    postsVisibilityError ?? postsWithoutVisibilityError ?? postProfilesPresenceError ?? postProfilesFallbackError;
  const paths = allPosts.map((post) => post.photo_path).filter((value): value is string => Boolean(value));
  const photoUrlByPath = new Map<string, string>();
  const postIds = allPosts.map((post) => post.id);

  const [{ data: reactionRows }, { data: commentRows }] = await Promise.all([
    postIds.length
      ? supabase
          .from("feed_post_reactions")
          .select("post_id,user_id,reaction")
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as unknown as ReactionRow[] }),
    postIds.length
      ? supabase
          .from("feed_post_comments")
          .select("id,post_id,user_id,content,created_at,profiles(public_id,display_name,avatar_url)")
          .in("post_id", postIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as unknown as CommentRow[] })
  ]);

  const typedReactions = (reactionRows ?? []) as ReactionRow[];
  const typedComments = (commentRows ?? []) as CommentRow[];
  const reactionGroups = new Map<string, Map<string, number>>();
  const myReactionByPost = new Map<string, string>();
  const commentsByPost = new Map<string, CommentRow[]>();

  typedReactions.forEach((row) => {
    if (!reactionGroups.has(row.post_id)) reactionGroups.set(row.post_id, new Map<string, number>());
    const byReaction = reactionGroups.get(row.post_id)!;
    byReaction.set(row.reaction, (byReaction.get(row.reaction) ?? 0) + 1);
    if (row.user_id === user.id) {
      myReactionByPost.set(row.post_id, row.reaction);
    }
  });

  typedComments.forEach((row) => {
    if (!commentsByPost.has(row.post_id)) commentsByPost.set(row.post_id, []);
    commentsByPost.get(row.post_id)!.push(row);
  });

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
        <div className="flex items-center gap-3">
          <img
            src={me.avatar_url ?? "/logo-mark.svg"}
            alt="Your avatar"
            className="h-12 w-12 rounded-full border border-harbor-ink/10 object-cover"
          />
          <div>
            <p className="text-sm font-semibold">{me.display_name}</p>
            <p className="text-xs text-harbor-ink/70">ID: {me.public_id ?? fallbackPublicId(user.id)}</p>
          </div>
        </div>
      </div>

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

        <label className="flex items-center gap-2 text-sm text-harbor-ink/75">
          <input type="checkbox" name="is_public" defaultChecked />
          Make this moment public
        </label>

        <button className="btn" type="submit">
          Post to Discover
        </button>
      </form>

      {errorParam && <div className="card text-sm text-red-600">{errorParam}</div>}
      {posted && <div className="card text-sm text-green-700">Your post is live.</div>}
      {postsError && <div className="card text-sm text-red-600">Failed to load discover posts: {postsError.message}</div>}

      {allPosts.length === 0 ? (
        <div className="card text-sm text-harbor-ink/75">No posts yet.</div>
      ) : (
        <div className="grid gap-3">
          {allPosts.map((post) => {
            const photoUrl = post.photo_path ? photoUrlByPath.get(post.photo_path) : null;
            const profile = post.profiles;
            const authorName = profile?.display_name ?? "Member";
            const authorId = profile ? profile.public_id ?? fallbackPublicId(profile.user_id) : "Unknown";
            const active = isRecentlyActive(profile?.last_active_at);

            return (
              <article key={post.id} className="card space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <img
                        src={profile?.avatar_url ?? "/logo-mark.svg"}
                        alt={`${authorName} avatar`}
                        className="h-10 w-10 rounded-full border border-harbor-ink/10 object-cover"
                      />
                      <div>
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
                    </div>
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

                {post.user_id === user.id && canManagePostVisibility ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={updateDiscoverPostVisibility}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <input type="hidden" name="make_public" value={post.is_public ? "0" : "1"} />
                      <button className="btn-secondary px-3 py-1 text-xs" type="submit">
                        {post.is_public ? "Only friends" : "Public"}
                      </button>
                    </form>
                    <form action={deleteDiscoverPost}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <button className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600" type="submit">
                        Delete
                      </button>
                    </form>
                    <span className="text-xs text-harbor-ink/60">Visibility: {post.is_public ? "Public" : "Only friends"}</span>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {["❤️", "👍", "🔥", "😂"].map((emoji) => {
                    const count = reactionGroups.get(post.id)?.get(emoji) ?? 0;
                    const mine = myReactionByPost.get(post.id) === emoji;
                    return (
                      <form key={emoji} action={reactToDiscoverPost}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <input type="hidden" name="reaction" value={emoji} />
                        <button
                          type="submit"
                          className={`rounded-full border px-2 py-1 text-xs ${mine ? "border-[#ec9f29] bg-[#fff3e1]" : "border-harbor-ink/10 bg-white"}`}
                        >
                          {emoji} {count > 0 ? count : ""}
                        </button>
                      </form>
                    );
                  })}
                </div>

                <div className="space-y-2 rounded-xl bg-[#f8f4ef] p-3">
                  {(commentsByPost.get(post.id) ?? []).slice(-4).map((comment) => (
                    <div key={comment.id} className="text-xs text-harbor-ink/85">
                      <span className="font-semibold">{comment.profiles?.display_name ?? "Member"}</span>: {comment.content}
                    </div>
                  ))}
                  <form action={addDiscoverComment} className="flex items-center gap-2">
                    <input type="hidden" name="post_id" value={post.id} />
                    <input className="input py-2 text-xs" name="content" maxLength={1200} placeholder="Write a comment..." required />
                    <button className="btn-secondary px-3 py-2 text-xs" type="submit">
                      Comment
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

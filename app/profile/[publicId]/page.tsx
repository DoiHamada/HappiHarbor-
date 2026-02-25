import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ProfilePageProps = {
  params: Promise<{ publicId: string }>;
};

type ProfileRow = {
  user_id: string;
  public_id: string;
  display_name: string;
  nationality: string;
  age_years: number;
  gender: string;
  sexual_preference: string;
  bio: string | null;
  avatar_key: string;
  is_published: boolean;
  last_active_at: string;
};

type FeedRow = {
  id: string;
  thought: string | null;
  photo_path: string | null;
  created_at: string;
};

function isRecentlyActive(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  const ts = new Date(lastActiveAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 5 * 60 * 1000;
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { publicId } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "user_id,public_id,display_name,nationality,age_years,gender,sexual_preference,bio,avatar_key,is_published,last_active_at"
    )
    .eq("public_id", publicId.toUpperCase())
    .maybeSingle();

  const typedProfile = (profile ?? null) as ProfileRow | null;

  if (!typedProfile) {
    notFound();
  }

  if (typedProfile.user_id !== user.id && !typedProfile.is_published) {
    notFound();
  }

  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", user.id);

  const { data: posts } = await supabase
    .from("feed_posts")
    .select("id,thought,photo_path,created_at")
    .eq("user_id", typedProfile.user_id)
    .order("created_at", { ascending: false })
    .limit(12);

  const typedPosts = (posts ?? []) as FeedRow[];

  const paths = typedPosts.map((post) => post.photo_path).filter((value): value is string => Boolean(value));
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

  const active = isRecentlyActive(typedProfile.last_active_at);

  return (
    <section className="space-y-4">
      <div className="card space-y-2">
        <h1 className="text-2xl font-bold">{typedProfile.display_name}</h1>
        <p className="flex items-center gap-2 text-sm text-harbor-ink/75">
          <span className={`inline-block size-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
          {typedProfile.public_id} · {active ? "Active now" : "Inactive"}
        </p>
        <p className="text-sm text-harbor-ink/75">
          {typedProfile.age_years} years old · {typedProfile.nationality}
        </p>
        <p className="text-xs text-harbor-ink/70">
          {typedProfile.gender} · {typedProfile.sexual_preference}
        </p>
        {typedProfile.bio && <p className="text-sm whitespace-pre-wrap">{typedProfile.bio}</p>}
      </div>

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">Recent thoughts and moment photos</h2>
        {typedPosts.length === 0 ? (
          <p className="text-sm text-harbor-ink/75">No posts yet.</p>
        ) : (
          <div className="grid gap-3">
            {typedPosts.map((post) => {
              const photoUrl = post.photo_path ? photoUrlByPath.get(post.photo_path) : null;

              return (
                <article key={post.id} className="rounded-xl border border-harbor-ink/10 p-3">
                  <p className="text-xs text-harbor-ink/70">
                    {new Date(post.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                  {post.thought && <p className="mt-2 text-sm whitespace-pre-wrap">{post.thought}</p>}
                  {photoUrl && (
                    <img src={photoUrl} alt={`${typedProfile.display_name} moment photo`} className="mt-2 w-full rounded-xl border border-harbor-ink/10 object-cover" />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMomentVisibility, updateOwnProfile } from "@/app/profile/actions";

type ProfilePageProps = {
  params: Promise<{ publicId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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
  avatar_url: string | null;
  cover_photo_url: string | null;
  is_published: boolean;
  last_active_at: string;
};

type FeedRow = {
  id: string;
  thought: string | null;
  photo_path: string | null;
  created_at: string;
  is_public: boolean;
};

function isRecentlyActive(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  const ts = new Date(lastActiveAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 5 * 60 * 1000;
}

export default async function PublicProfilePage({ params, searchParams }: ProfilePageProps) {
  const { publicId } = await params;
  const search = (await searchParams) ?? {};
  const info = typeof search.info === "string" ? search.info : null;

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
      "user_id,public_id,display_name,nationality,age_years,gender,sexual_preference,bio,avatar_url,cover_photo_url,is_published,last_active_at"
    )
    .eq("public_id", publicId.toUpperCase())
    .maybeSingle();

  const typedProfile = (profile ?? null) as ProfileRow | null;

  if (!typedProfile) {
    notFound();
  }

  const isOwner = typedProfile.user_id === user.id;

  if (!isOwner && !typedProfile.is_published) {
    notFound();
  }

  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", user.id);

  let postsQuery = supabase
    .from("feed_posts")
    .select("id,thought,photo_path,created_at,is_public")
    .eq("user_id", typedProfile.user_id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!isOwner) {
    postsQuery = postsQuery.eq("is_public", true);
  }

  const { data: posts } = await postsQuery;

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
      {info && <div className="card text-sm text-green-700">{info}</div>}

      <div className="overflow-hidden rounded-xl2 border border-harbor-ink/10 bg-white">
        <div className="h-44 w-full bg-gradient-to-r from-[#f3d2a4] via-[#f9e8cb] to-[#d9edf7]">
          {typedProfile.cover_photo_url ? (
            <img src={typedProfile.cover_photo_url} alt={`${typedProfile.display_name} cover`} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="relative px-5 pb-5">
          <img
            src={typedProfile.avatar_url ?? "/logo-mark.svg"}
            alt={`${typedProfile.display_name} avatar`}
            className="-mt-12 h-24 w-24 rounded-full border-4 border-white object-cover"
          />
          <div className="mt-3 space-y-2">
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
        </div>
      </div>

      {isOwner ? (
        <form action={updateOwnProfile} className="card grid gap-3">
          <h2 className="text-lg font-semibold">Edit your profile</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="label">Name</label>
              <input className="input" name="display_name" defaultValue={typedProfile.display_name} required />
            </div>
            <div className="space-y-1">
              <label className="label">Profile visibility</label>
              <label className="flex items-center gap-2 rounded-xl border border-harbor-ink/10 px-3 py-2 text-sm">
                <input type="checkbox" name="is_published" defaultChecked={typedProfile.is_published} />
                Public profile (discoverable)
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="label">Bio (optional)</label>
            <textarea className="input min-h-24" name="bio" defaultValue={typedProfile.bio ?? ""} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="label">Upload profile avatar</label>
              <input className="input" name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp" />
            </div>
            <div className="space-y-1">
              <label className="label">Upload cover photo</label>
              <input className="input" name="cover_file" type="file" accept="image/jpeg,image/png,image/webp" />
            </div>
          </div>

          <button className="btn w-full md:w-fit" type="submit">
            Save profile changes
          </button>
        </form>
      ) : null}

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">Moments</h2>
        {typedPosts.length === 0 ? (
          <p className="text-sm text-harbor-ink/75">No moments posted yet.</p>
        ) : (
          <div className="grid gap-3">
            {typedPosts.map((post) => {
              const photoUrl = post.photo_path ? photoUrlByPath.get(post.photo_path) : null;

              return (
                <article key={post.id} className="rounded-xl border border-harbor-ink/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-harbor-ink/70">
                      {new Date(post.created_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </p>
                    {isOwner ? (
                      <form action={updateMomentVisibility}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <input type="hidden" name="make_public" value={post.is_public ? "0" : "1"} />
                        <button className="btn-secondary px-3 py-1 text-xs" type="submit">
                          {post.is_public ? "Set private" : "Set public"}
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {isOwner ? (
                    <p className="mt-2 text-xs text-harbor-ink/60">Visibility: {post.is_public ? "Public" : "Private"}</p>
                  ) : null}

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

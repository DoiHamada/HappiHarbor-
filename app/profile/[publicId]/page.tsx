import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDiscoverComment, reactToDiscoverPost } from "@/app/discover/actions";
import { openDirectChat } from "@/app/messages/actions";
import { PreferenceControls } from "@/app/onboarding/preference-controls";
import { MediaInlineEditor } from "@/app/profile/media-inline-editor";
import { GenderIcon, genderLabel, IdentityPill, OrientationIcon, orientationLabel } from "@/components/identity-icons";
import { GENDER_OPTIONS, SEXUAL_PREFERENCE_OPTIONS, type OnboardingTagKey } from "@/types/profile";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  deleteOwnAvatar,
  deleteOwnCover,
  deleteOwnMoment,
  sendFriendRequest,
  updateOwnAvatar,
  updateOwnCover,
  updateMomentVisibility,
  updateOwnProfile
} from "@/app/profile/actions";

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
  avatar_storage_path: string | null;
  cover_photo_url: string | null;
  is_published: boolean;
  last_active_at: string;
};

type FeedRow = {
  id: string;
  thought: string | null;
  photo_path: string | null;
  created_at: string;
  is_public?: boolean | null;
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

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: "pending" | "mutual" | "closed";
  created_by: string | null;
};

type RequestProfile = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
};

type PreferenceRow = {
  min_age: number;
  max_age: number;
  preferred_languages: string[] | null;
  profile_tags: Partial<Record<OnboardingTagKey, unknown>> | null;
  profile_visibility: {
    show_age?: boolean;
    show_nationality?: boolean;
    show_sexual_preference?: boolean;
  } | null;
};

function isRecentlyActive(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  const ts = new Date(lastActiveAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 5 * 60 * 1000;
}

function fallbackPublicId(userId: string): string {
  return `HH-${userId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function titleize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
      "user_id,public_id,display_name,nationality,age_years,gender,sexual_preference,bio,avatar_url,avatar_storage_path,cover_photo_url,is_published,last_active_at"
    )
    .eq("public_id", publicId.toUpperCase())
    .maybeSingle();

  const typedProfile = (profile ?? null) as ProfileRow | null;

  if (!typedProfile) {
    notFound();
  }

  const isOwner = typedProfile.user_id === user.id;
  const pairUserA = user.id < typedProfile.user_id ? user.id : typedProfile.user_id;
  const pairUserB = user.id < typedProfile.user_id ? typedProfile.user_id : user.id;
  const editMode = isOwner && search.edit === "1";

  const { data: preferenceRow } = await supabase
    .from("preferences")
    .select("*")
    .eq("user_id", typedProfile.user_id)
    .maybeSingle();
  const typedPreferences = (preferenceRow ?? null) as PreferenceRow | null;

  const visibility = typedPreferences?.profile_visibility ?? {};
  const showAge = visibility.show_age ?? true;
  const showNationality = visibility.show_nationality ?? true;
  const showSexualPreference = visibility.show_sexual_preference ?? true;

  const preferenceTags: Partial<Record<OnboardingTagKey, string[]>> = {};
  const rawTags = typedPreferences?.profile_tags;
  if (rawTags && typeof rawTags === "object") {
    for (const key of Object.keys(rawTags) as OnboardingTagKey[]) {
      const value = rawTags[key];
      if (Array.isArray(value)) {
        preferenceTags[key] = value.map((item) => String(item)).filter(Boolean);
      }
    }
  }

  if (!isOwner && !typedProfile.is_published) {
    notFound();
  }

  const { data: relationship } = !isOwner
    ? await supabase
        .from("matches")
        .select("id,user_a,user_b,status,created_by")
        .eq("user_a", pairUserA)
        .eq("user_b", pairUserB)
        .maybeSingle()
    : { data: null };

  const typedRelationship = (relationship ?? null) as MatchRow | null;

  if (!isOwner) {
    await supabase.from("social_notifications").insert({
      recipient_user_id: typedProfile.user_id,
      actor_user_id: user.id,
      type: "profile_view",
      details: "Viewed your profile"
    });
  }

  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", user.id);

  let postsWithVisibilityQuery = supabase
    .from("feed_posts")
    .select("id,thought,photo_path,created_at,is_public")
    .eq("user_id", typedProfile.user_id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!isOwner) {
    postsWithVisibilityQuery = postsWithVisibilityQuery.eq("is_public", true);
  }

  const { data: postsWithVisibility, error: postsWithVisibilityError } = await postsWithVisibilityQuery;

  const { data: postsWithoutVisibility } = postsWithVisibilityError
    ? await supabase
        .from("feed_posts")
        .select("id,thought,photo_path,created_at")
        .eq("user_id", typedProfile.user_id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: null };

  const supportsPostVisibility = !postsWithVisibilityError;
  const typedPosts = ((postsWithVisibility ?? postsWithoutVisibility ?? []) as FeedRow[]);
  const postIds = typedPosts.map((post) => post.id);

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
  const incomingRequests = isOwner
    ? (
        await supabase
          .from("matches")
          .select("id,user_a,user_b,status,created_by")
          .eq("status", "pending")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .neq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? []
    : [];

  const typedIncomingRequests = incomingRequests as MatchRow[];
  const incomingRequesterIds = Array.from(
    new Set(
      typedIncomingRequests
        .map((row) => row.created_by)
        .filter((value): value is string => Boolean(value))
    )
  );

  const { data: incomingRequesterProfiles } = incomingRequesterIds.length
    ? await supabase
        .from("profiles")
        .select("user_id,public_id,display_name,avatar_url")
        .in("user_id", incomingRequesterIds)
    : { data: [] };

  const requestProfilesById = new Map<string, RequestProfile>(
    ((incomingRequesterProfiles ?? []) as RequestProfile[]).map((row) => [row.user_id, row])
  );

  return (
    <section className="space-y-4">
      {info && <div className="card text-sm text-green-700">{info}</div>}

      <div className="overflow-hidden rounded-xl2 border border-harbor-ink/10 bg-white">
        <div className="relative h-56 w-full bg-gradient-to-r from-[#f3d2a4] via-[#f9e8cb] to-[#d9edf7]">
          {isOwner ? (
            <MediaInlineEditor
              uploadAction={updateOwnCover}
              deleteAction={deleteOwnCover}
              fieldName="cover_file"
              returnPath={`/profile/${typedProfile.public_id}`}
              hasImage={Boolean(typedProfile.cover_photo_url)}
              uploadLabel="Click cover photo to upload"
            >
              {typedProfile.cover_photo_url ? (
                <img src={typedProfile.cover_photo_url} alt={`${typedProfile.display_name} cover`} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full" />
              )}
            </MediaInlineEditor>
          ) : typedProfile.cover_photo_url ? (
            <img src={typedProfile.cover_photo_url} alt={`${typedProfile.display_name} cover`} className="h-full w-full object-cover" />
          ) : null}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {isOwner ? (
              <MediaInlineEditor
                uploadAction={updateOwnAvatar}
                deleteAction={deleteOwnAvatar}
                fieldName="avatar_file"
                returnPath={`/profile/${typedProfile.public_id}`}
                hasImage={Boolean(typedProfile.avatar_url && typedProfile.avatar_url !== "/logo-mark.svg")}
                uploadLabel="Click avatar to upload"
              >
                <div className="rounded-full border-4 border-white bg-white p-1 shadow-lg">
                  <img
                    src={typedProfile.avatar_url ?? "/logo-mark.svg"}
                    alt={`${typedProfile.display_name} avatar`}
                    className="h-24 w-24 rounded-full object-cover"
                  />
                </div>
              </MediaInlineEditor>
            ) : (
              <div className="rounded-full border-4 border-white bg-white p-1 shadow-lg">
                <img
                  src={typedProfile.avatar_url ?? "/logo-mark.svg"}
                  alt={`${typedProfile.display_name} avatar`}
                  className="h-24 w-24 rounded-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
        <div className="space-y-3 px-5 pb-5 pt-14 text-center">
          <h1 className="text-2xl font-bold">{typedProfile.display_name}</h1>
          <p className="flex items-center justify-center gap-2 text-sm text-harbor-ink/75">
            <span className={`inline-block size-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
            {typedProfile.public_id} · {active ? "Active now" : "Inactive"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <IdentityPill icon={<GenderIcon value={typedProfile.gender} />} label={genderLabel(typedProfile.gender)} />
            {showSexualPreference ? (
              <IdentityPill
                icon={<OrientationIcon value={typedProfile.sexual_preference} />}
                label={orientationLabel(typedProfile.sexual_preference)}
              />
            ) : null}
          </div>
          <p className="text-sm text-harbor-ink/75">
            {showAge ? `${typedProfile.age_years} years old` : "Age hidden"}
            {showNationality ? ` · ${typedProfile.nationality}` : ""}
          </p>
          {Object.entries(preferenceTags).some(([, values]) => (values ?? []).length > 0) ? (
            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
              {Object.entries(preferenceTags).flatMap(([key, values]) =>
                (values ?? []).slice(0, 3).map((tag) => (
                  <span key={`${key}-${tag}`} className="rounded-full border border-harbor-ink/15 px-2.5 py-1 text-xs text-harbor-ink/70">
                    {titleize(tag)}
                  </span>
                ))
              )}
            </div>
          ) : null}
          {typedProfile.bio && <p className="mx-auto max-w-2xl text-sm whitespace-pre-wrap">{typedProfile.bio}</p>}

          {isOwner ? (
            <div className="flex items-center justify-center gap-2">
              <Link
                href={
                  editMode
                    ? `/profile/${typedProfile.public_id}`
                    : `/profile/${typedProfile.public_id}?edit=1`
                }
                className="btn-secondary no-underline"
              >
                {editMode ? "Close Edit" : "Edit Profile"}
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {!typedRelationship || typedRelationship.status === "closed" ? (
                <form action={sendFriendRequest}>
                  <input type="hidden" name="target_user_id" value={typedProfile.user_id} />
                  <input type="hidden" name="return_path" value={`/profile/${typedProfile.public_id}`} />
                  <button className="btn" type="submit">
                    Add Friend
                  </button>
                </form>
              ) : typedRelationship.status === "pending" && typedRelationship.created_by !== user.id ? (
                <form action={acceptFriendRequest}>
                  <input type="hidden" name="request_id" value={typedRelationship.id} />
                  <input type="hidden" name="return_path" value={`/profile/${typedProfile.public_id}`} />
                  <button className="btn" type="submit">
                    Accept Request
                  </button>
                </form>
              ) : typedRelationship.status === "pending" ? (
                typedRelationship.created_by === user.id ? (
                  <form action={cancelFriendRequest}>
                    <input type="hidden" name="target_user_id" value={typedProfile.user_id} />
                    <input type="hidden" name="return_path" value={`/profile/${typedProfile.public_id}`} />
                    <button className="btn-secondary" type="submit">
                      Cancel Request
                    </button>
                  </form>
                ) : (
                  <button className="btn-secondary" type="button" disabled>
                    Requested
                  </button>
                )
              ) : (
                <button className="btn-secondary" type="button" disabled>
                  Friends
                </button>
              )}
              <form action={openDirectChat}>
                <input type="hidden" name="target_user_id" value={typedProfile.user_id} />
                <button className="btn-secondary" type="submit">
                  Message
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {isOwner && editMode ? (
        <form action={updateOwnProfile} className="card grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Edit your profile</h2>
            <Link href={`/profile/${typedProfile.public_id}`} className="btn-secondary text-xs no-underline">
              Cancel
            </Link>
          </div>

          <input type="hidden" name="return_path" value={`/profile/${typedProfile.public_id}`} />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="label">Display name</label>
              <input className="input" name="display_name" defaultValue={typedProfile.display_name} required />
            </div>
            <div className="space-y-1">
              <label className="label">Nationality</label>
              <input className="input" name="nationality" defaultValue={typedProfile.nationality} required />
            </div>
            <div className="space-y-1">
              <label className="label">Age</label>
              <input className="input" name="age_years" type="number" min={13} max={100} defaultValue={typedProfile.age_years} required />
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="label">Gender</legend>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
              {GENDER_OPTIONS.map((value) => (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={value}
                    defaultChecked={typedProfile.gender === value}
                    className="peer sr-only"
                  />
                  <span className="flex items-center gap-2 rounded-xl border border-harbor-ink/15 px-3 py-2 text-sm peer-checked:border-harbor-ink peer-checked:bg-harbor-cream">
                    <GenderIcon value={value} />
                    {genderLabel(value)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="label">Sexual orientation</legend>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {SEXUAL_PREFERENCE_OPTIONS.map((value) => (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="sexual_preference"
                    value={value}
                    defaultChecked={typedProfile.sexual_preference === value}
                    className="peer sr-only"
                  />
                  <span className="flex items-center gap-2 rounded-xl border border-harbor-ink/15 px-3 py-2 text-sm peer-checked:border-harbor-ink peer-checked:bg-harbor-cream">
                    <OrientationIcon value={value} />
                    {orientationLabel(value)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1">
            <label className="label">Bio (optional)</label>
            <textarea className="input min-h-24" name="bio" defaultValue={typedProfile.bio ?? ""} />
          </div>

          <fieldset className="grid gap-2 rounded-xl border border-harbor-ink/10 bg-harbor-cream/40 p-3">
            <legend className="label">Profile privacy</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="show_age" defaultChecked={showAge} />
              Show age on profile card
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="show_nationality" defaultChecked={showNationality} />
              Show nationality on profile card
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="show_sexual_preference" defaultChecked={showSexualPreference} />
              Show sexual orientation on profile card
            </label>
          </fieldset>

          <PreferenceControls
            initialMinAge={typedPreferences?.min_age ?? 18}
            initialMaxAge={typedPreferences?.max_age ?? 35}
            initialLanguages={typedPreferences?.preferred_languages ?? []}
            initialTags={preferenceTags}
          />

          <button className="btn w-full md:w-fit" type="submit">
            Save profile changes
          </button>
        </form>
      ) : null}

      {isOwner ? (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Friend Requests</h2>
          {typedIncomingRequests.length === 0 ? (
            <p className="text-sm text-harbor-ink/75">No pending requests.</p>
          ) : (
            <div className="grid gap-3">
              {typedIncomingRequests.map((request) => {
                const requesterId = request.created_by;
                if (!requesterId) return null;
                const requester = requestProfilesById.get(requesterId);
                const requesterPublicId = requester?.public_id ?? fallbackPublicId(requesterId);
                return (
                  <article key={request.id} className="flex items-center justify-between rounded-xl border border-harbor-ink/10 p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={requester?.avatar_url ?? "/logo-mark.svg"}
                        alt={`${requester?.display_name ?? "Member"} avatar`}
                        className="h-10 w-10 rounded-full border border-harbor-ink/10 object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold">{requester?.display_name ?? "Member"}</p>
                        <p className="text-xs text-harbor-ink/70">{requesterPublicId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${requesterPublicId}`} className="btn-secondary px-3 py-1.5 text-xs no-underline">
                        View
                      </Link>
                      <form action={acceptFriendRequest}>
                        <input type="hidden" name="request_id" value={request.id} />
                        <input type="hidden" name="return_path" value={`/profile/${typedProfile.public_id}`} />
                        <button className="btn px-3 py-1.5 text-xs" type="submit">
                          Accept
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">Posts</h2>
        <p className="text-xs text-harbor-ink/65">Ordered by newest first.</p>
        {typedPosts.length === 0 ? (
          <p className="text-sm text-harbor-ink/75">No posts yet.</p>
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
                    {isOwner && supportsPostVisibility ? (
                      <div className="flex items-center gap-2">
                        <form action={updateMomentVisibility}>
                          <input type="hidden" name="post_id" value={post.id} />
                          <input type="hidden" name="make_public" value={post.is_public ? "0" : "1"} />
                          <button className="btn-secondary px-3 py-1 text-xs" type="submit">
                            {post.is_public ? "Only friends" : "Public"}
                          </button>
                        </form>
                        <form action={deleteOwnMoment}>
                          <input type="hidden" name="post_id" value={post.id} />
                          <button className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600" type="submit">
                            Delete
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>

                  {isOwner && supportsPostVisibility ? (
                    <p className="mt-2 text-xs text-harbor-ink/60">Visibility: {post.is_public ? "Public" : "Private"}</p>
                  ) : null}

                  {post.thought && <p className="mt-2 text-sm whitespace-pre-wrap">{post.thought}</p>}
                  {photoUrl && (
                    <img src={photoUrl} alt={`${typedProfile.display_name} moment photo`} className="mt-2 w-full rounded-xl border border-harbor-ink/10 object-cover" />
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
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

                  <div className="mt-3 space-y-2 rounded-xl bg-[#f8f4ef] p-3">
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
      </div>
    </section>
  );
}

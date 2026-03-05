import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Button, Heading, InlineStatus, Screen } from "@/components/ui";
import { Avatar, EmptyState, SocialCard, SoftChip } from "@/components/social";
import { fallbackPublicId, titleize } from "@/types/profile";

type ProfileRow = {
  user_id: string;
  display_name: string;
  public_id: string | null;
  age_years: number;
  bio: string | null;
  gender: string;
  sexual_preference: string;
  is_published: boolean;
  avatar_url: string | null;
  avatar_storage_path: string | null;
  cover_photo_url: string | null;
  cover_photo_storage_path: string | null;
};

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: "pending" | "mutual" | "closed";
  created_by: string | null;
};
type FollowRow = {
  follower_user_id: string;
  following_user_id: string;
};

type FeedPost = {
  id: string;
  thought: string | null;
  photo_path: string | null;
  created_at: string;
  is_public?: boolean;
};

export default function MemberProfileScreen() {
  const params = useLocalSearchParams<{ publicId: string }>();
  const publicId = String(params.publicId ?? "").toUpperCase();
  const { user } = useSession();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followsMe, setFollowsMe] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [profileTagLabels, setProfileTagLabels] = useState<string[]>([]);
  const [profileLanguageLabels, setProfileLanguageLabels] = useState<string[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loadingAction, setLoadingAction] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: "danger" | "success" | "default" } | null>(null);

  const isOwner = useMemo(() => Boolean(user && profile && user.id === profile.user_id), [user, profile]);

  const load = useCallback(async () => {
    if (!publicId || !user) return;

    setStatus(null);

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select(
        "user_id,display_name,public_id,age_years,bio,gender,sexual_preference,is_published,avatar_url,avatar_storage_path,cover_photo_url,cover_photo_storage_path"
      )
      .eq("public_id", publicId)
      .maybeSingle();

    if (profileError) {
      setStatus({ text: profileError.message, tone: "danger" });
      return;
    }

    const typedProfile = (profileRow as ProfileRow | null) ?? null;
    if (!typedProfile) {
      setProfile(null);
      setIsFollowing(false);
      setFollowsMe(false);
      setPosts([]);
      return;
    }
    if (typedProfile.avatar_storage_path) {
      const { data: signedAvatar } = await supabase.storage.from("profile-avatars").createSignedUrl(typedProfile.avatar_storage_path, 3600);
      if (signedAvatar?.signedUrl) typedProfile.avatar_url = signedAvatar.signedUrl;
    }
    if (typedProfile.cover_photo_storage_path) {
      const { data: signedCover } = await supabase.storage.from("profile-covers").createSignedUrl(typedProfile.cover_photo_storage_path, 3600);
      if (signedCover?.signedUrl) typedProfile.cover_photo_url = signedCover.signedUrl;
    }

    if (typedProfile.user_id !== user.id && !typedProfile.is_published) {
      setProfile(null);
      setIsFollowing(false);
      setFollowsMe(false);
      setPosts([]);
      setStatus({ text: "This profile is not available.", tone: "default" });
      return;
    }

    setProfile(typedProfile);
    const { data: followCounts } = await supabase.rpc("profile_follow_counts", { p_target: typedProfile.user_id });
    setFollowersCount(Number(followCounts?.[0]?.followers ?? 0));
    setFollowingCount(Number(followCounts?.[0]?.following ?? 0));

    const { data: preferenceRow } = await supabase
      .from("preferences")
      .select("profile_tags,preferred_languages")
      .eq("user_id", typedProfile.user_id)
      .maybeSingle();
    const rawTags = (preferenceRow?.profile_tags ?? null) as Record<string, unknown> | null;
    const flattenedTagLabels: string[] = [];
    if (rawTags && typeof rawTags === "object") {
      Object.values(rawTags).forEach((value) => {
        if (!Array.isArray(value)) return;
        value.forEach((item) => {
          const label = titleize(String(item).trim());
          if (label) flattenedTagLabels.push(label);
        });
      });
    }
    setProfileTagLabels(Array.from(new Set(flattenedTagLabels)).slice(0, 20));
    const languageLabels = ((preferenceRow?.preferred_languages ?? []) as string[])
      .map((value) => titleize(String(value).trim()))
      .filter(Boolean);
    setProfileLanguageLabels(Array.from(new Set(languageLabels)).slice(0, 12));

    let postQuery = supabase
      .from("feed_posts")
      .select("id,thought,photo_path,created_at,is_public")
      .eq("user_id", typedProfile.user_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (typedProfile.user_id !== user.id) postQuery = postQuery.eq("is_public", true);
    const { data: postRows } = await postQuery;
    const typedPosts = (postRows ?? []) as FeedPost[];
    setPosts(typedPosts);

    const paths = typedPosts.map((post) => post.photo_path).filter((value): value is string => Boolean(value));
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("feed-photos").createSignedUrls(paths, 3600);
      const next = new Map<string, string>();
      (signed ?? []).forEach((row, index) => {
        const path = row.path ?? paths[index];
        if (path && row.signedUrl) next.set(path, row.signedUrl);
      });
      setPhotoUrls(next);
    } else {
      setPhotoUrls(new Map());
    }

    if (typedProfile.user_id !== user.id) {
      const { data: followRows } = await supabase
        .from("follows")
        .select("follower_user_id,following_user_id")
        .or(
          `and(follower_user_id.eq.${user.id},following_user_id.eq.${typedProfile.user_id}),and(follower_user_id.eq.${typedProfile.user_id},following_user_id.eq.${user.id})`
        );
      const typedFollows = (followRows ?? []) as FollowRow[];
      setIsFollowing(
        typedFollows.some((row) => row.follower_user_id === user.id && row.following_user_id === typedProfile.user_id)
      );
      setFollowsMe(
        typedFollows.some((row) => row.follower_user_id === typedProfile.user_id && row.following_user_id === user.id)
      );
      return;
    }

    setIsFollowing(false);
    setFollowsMe(false);
  }, [publicId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  function pair(a: string, b: string): { userA: string; userB: string } {
    return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
  }

  async function openOrCreateConversation(targetUserId: string, source: "match" | "request") {
    if (!user) return;
    const { userA, userB } = pair(user.id, targetUserId);

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();

    if (existing?.id) {
      router.push(`/chat/${existing.id}`);
      return;
    }

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_a: userA, user_b: userB, source, request_id: null })
      .select("id")
      .single();

    if (error || !created?.id) {
      setStatus({ text: error?.message ?? "Unable to open chat.", tone: "danger" });
      return;
    }

    router.push(`/chat/${created.id}`);
  }

  async function followUser() {
    if (!user || !profile) return;
    setLoadingAction(true);
    try {
      const { error } = await supabase.rpc("follow_user", {
        p_target: profile.user_id,
        p_user: user.id
      });
      if (error) throw error;

      await supabase.from("social_notifications").insert({
        recipient_user_id: profile.user_id,
        actor_user_id: user.id,
        type: "follow",
        details: "follow"
      });

      setStatus({ text: "Followed.", tone: "success" });
      await load();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Failed to follow user.", tone: "danger" });
    } finally {
      setLoadingAction(false);
    }
  }

  async function unfollowUser() {
    if (!user || !profile) return;
    setLoadingAction(true);
    try {
      const { error } = await supabase.rpc("unfollow_user", {
        p_target: profile.user_id,
        p_user: user.id
      });
      if (error) throw error;

      setStatus({ text: "Unfollowed.", tone: "success" });
      await load();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Failed to unfollow user.", tone: "danger" });
    } finally {
      setLoadingAction(false);
    }
  }

  function RelationshipAction() {
    if (!profile || !user || isOwner) return null;

    const followLabel = isFollowing ? "Unfollow" : followsMe ? "Follow back" : "Follow";

    return (
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label={loadingAction ? "Working..." : followLabel}
          onPress={() => {
            if (isFollowing) void unfollowUser();
            else void followUser();
          }}
          disabled={loadingAction}
          secondary={isFollowing}
        />
        <Button
          label="Message"
          secondary
          onPress={() => void openOrCreateConversation(profile.user_id, "match")}
        />
      </View>
    );
  }

  if (!profile && !status) {
    return (
      <Screen>
        <EmptyState title="Loading profile" description="Please wait a moment." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 80 }}>
        {status ? <InlineStatus text={status.text} tone={status.tone} /> : null}

        {profile ? (
          <SocialCard>
            {profile.cover_photo_url ? (
              <Image source={{ uri: profile.cover_photo_url }} style={{ width: "100%", height: 170, borderRadius: 14 }} resizeMode="cover" />
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar uri={profile.avatar_url} name={profile.display_name} size={72} />
              <View style={{ flex: 1 }}>
                <Heading>{profile.display_name}</Heading>
                <Text style={{ color: "#667085", fontSize: 13 }}>{profile.public_id ?? fallbackPublicId(profile.user_id)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <SoftChip label={`Followers ${followersCount}`} />
              <SoftChip label={`Following ${followingCount}`} />
              <SoftChip label={`${profile.age_years} yrs`} />
              <SoftChip label={titleize(profile.gender)} />
              <SoftChip label={titleize(profile.sexual_preference)} />
              {profileLanguageLabels.map((label) => (
                <SoftChip key={`lang-${label}`} label={label} />
              ))}
              {profileTagLabels.map((label) => (
                <SoftChip key={`tag-${label}`} label={label} />
              ))}
            </View>
            {profile.bio ? <Text style={{ color: "#111827", lineHeight: 21 }}>{profile.bio}</Text> : null}
            <RelationshipAction />
          </SocialCard>
        ) : null}
        <SocialCard>
          {posts.length === 0 ? (
            <EmptyState title="No posts yet" description="This user has not shared moments yet." />
          ) : (
            posts.map((post) => {
              const photoUrl = post.photo_path ? photoUrls.get(post.photo_path) : null;
              return (
                <View key={post.id} style={{ gap: 8 }}>
                  {post.thought ? <Text style={{ color: "#111827", lineHeight: 21 }}>{post.thought}</Text> : null}
                  {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: "100%", height: 220, borderRadius: 12 }} resizeMode="cover" /> : null}
                  <Text style={{ color: "#667085", fontSize: 11 }}>
                    {new Date(post.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              );
            })
          )}
        </SocialCard>
      </ScrollView>
    </Screen>
  );
}

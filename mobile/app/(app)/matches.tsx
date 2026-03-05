import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Busy, Button, InlineStatus, Screen, SectionTitle } from "@/components/ui";
import { CardHeader, EmptyState, SocialCard, SoftChip } from "@/components/social";
import { fallbackPublicId, titleize } from "@/types/profile";
import { MatchablePreference, MatchableProfile, MatchSuggestion, buildSuggestions } from "@/lib/matching";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: "pending" | "mutual" | "closed";
  created_by: string | null;
};

type ProfileLite = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
  avatar_storage_path: string | null;
};

function pair(a: string, b: string): { userA: string; userB: string } {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

export default function MatchesScreen() {
  const { user } = useSession();
  const [items, setItems] = useState<Array<MatchRow & { other: ProfileLite | null }>>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingFollowUserId, setLoadingFollowUserId] = useState<string | null>(null);

  const mutualCount = useMemo(() => items.filter((item) => item.status === "mutual").length, [items]);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoadingList(true);
    try {
      const [{ data: myProfile }, { data: myPreference }, { data: matches, error: matchError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,display_name,age_years,gender,sexual_preference,nationality,bio,is_published,avatar_url,public_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("preferences")
          .select("user_id,min_age,max_age,preferred_languages,preferred_genders,preferred_nationalities,profile_tags")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("matches")
          .select("id,user_a,user_b,status,created_by")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(50)
      ]);

      if (matchError) {
        setError(matchError.message);
        return;
      }

      const typedMatches = (matches ?? []) as MatchRow[];
      const ids = Array.from(new Set(typedMatches.map((m) => (m.user_a === user.id ? m.user_b : m.user_a))));
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("user_id,public_id,display_name,avatar_url,avatar_storage_path").in("user_id", ids)
        : { data: [] };
      const typedProfiles = (profiles ?? []) as ProfileLite[];
      const paths = typedProfiles.map((p) => p.avatar_storage_path).filter((v): v is string => Boolean(v));
      const signedMap = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("profile-avatars").createSignedUrls(paths, 3600);
        (signed ?? []).forEach((row, index) => {
          const path = row.path ?? paths[index];
          if (path && row.signedUrl) signedMap.set(path, row.signedUrl);
        });
      }
      typedProfiles.forEach((p) => {
        if (p.avatar_storage_path && signedMap.has(p.avatar_storage_path)) p.avatar_url = signedMap.get(p.avatar_storage_path) ?? p.avatar_url;
      });
      const byId = new Map<string, ProfileLite>(typedProfiles.map((p) => [p.user_id, p]));

      setItems(
        typedMatches.map((match) => ({
          ...match,
          other: byId.get(match.user_a === user.id ? match.user_b : match.user_a) ?? null
        }))
      );

      const me = (myProfile ?? null) as MatchableProfile | null;
      if (!me) {
        setSuggestions([]);
        return;
      }

      const excludedUserIds = new Set<string>(ids);
      const { data: candidateProfilesRaw } = await supabase
        .from("profiles")
        .select("user_id,display_name,age_years,gender,sexual_preference,nationality,bio,is_published,avatar_url,public_id")
        .eq("is_published", true)
        .neq("user_id", user.id)
        .limit(150);

      const candidateProfiles = (candidateProfilesRaw ?? []) as MatchableProfile[];
      const candidateIds = candidateProfiles.map((profile) => profile.user_id);
      const { data: followingRows } = candidateIds.length
        ? await supabase
            .from("follows")
            .select("following_user_id")
            .eq("follower_user_id", user.id)
            .in("following_user_id", candidateIds)
        : { data: [] };
      const followingSet = new Set<string>(((followingRows ?? []) as Array<{ following_user_id: string }>).map((row) => row.following_user_id));
      setFollowingIds(followingSet);

      const { data: candidatePreferencesRaw } = candidateIds.length
        ? await supabase
            .from("preferences")
            .select("user_id,min_age,max_age,preferred_languages,preferred_genders,preferred_nationalities,profile_tags")
            .in("user_id", candidateIds)
        : { data: [] };

      const preferenceRows = [myPreference, ...(candidatePreferencesRaw ?? [])].filter(Boolean) as MatchablePreference[];
      const preferencesByUserId = new Map<string, MatchablePreference>(preferenceRows.map((pref) => [pref.user_id, pref]));

      setSuggestions(
        buildSuggestions({
          me,
          myPreference: (myPreference ?? undefined) as MatchablePreference | undefined,
          candidates: candidateProfiles,
          preferencesByUserId,
          excludedUserIds,
          limit: 24
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load matches.");
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openChat(targetUserId: string) {
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
      .insert({ user_a: userA, user_b: userB, source: "match", request_id: null })
      .select("id")
      .single();

    if (error || !created?.id) {
      setError(error?.message ?? "Failed to open chat.");
      return;
    }

    router.push(`/chat/${created.id}`);
  }

  async function sendRequest(targetUserId: string) {
    if (!user) return;
    setLoadingFollowUserId(targetUserId);
    try {
      const isFollowing = followingIds.has(targetUserId);
      const { error } = await supabase.rpc(isFollowing ? "unfollow_user" : "follow_user", {
        p_target: targetUserId,
        p_user: user.id
      });
      if (error) {
        setError(error.message);
        return;
      }
      if (!isFollowing) {
        await supabase.from("social_notifications").insert({
          recipient_user_id: targetUserId,
          actor_user_id: user.id,
          type: "follow",
          details: "follow"
        });
      }
      setInfo(isFollowing ? "Unfollowed." : "Followed.");
      await load();
    } finally {
      setLoadingFollowUserId(null);
    }
  }

  return (
    <Screen>
      <SocialCard>
        <SectionTitle title="Harbor" />
        <SectionTitle title={`${mutualCount} active connection${mutualCount === 1 ? "" : "s"}`} />
        {error ? <InlineStatus text={error} tone="danger" /> : null}
        {info ? <InlineStatus text={info} tone="success" /> : null}
      </SocialCard>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Your connection states" />
        {items.length === 0 ? (
          <EmptyState title="No matches yet" description="Check out suggested profiles below." />
        ) : (
          items.map((match) => {
            const otherId = match.other?.public_id ?? (match.other?.user_id ? fallbackPublicId(match.other.user_id) : "Unknown");
            const isMutual = match.status === "mutual";
            return (
              <SocialCard key={match.id}>
                <CardHeader
                  title={match.other?.display_name ?? "Member"}
                  avatarUri={match.other?.avatar_url ?? null}
                  onPress={() => router.push(`/member/${otherId}`)}
                />
                {match.other?.user_id ? (
                  <Button label={isMutual ? "Message" : "Open chat"} onPress={() => void openChat(match.other!.user_id)} compact />
                ) : null}
              </SocialCard>
            );
          })
        )}
      </View>

      <FlatList<MatchSuggestion>
        data={suggestions}
        keyExtractor={(item) => item.profile.user_id}
        contentContainerStyle={{ gap: 10, paddingBottom: 100, paddingTop: 8 }}
        ListHeaderComponent={<SectionTitle title="Top suggestions" />}
        ListEmptyComponent={<EmptyState title="No suggestions" description="Update preferences to broaden match criteria." />}
        renderItem={({ item }) => {
          const publicId = item.profile.public_id ?? fallbackPublicId(item.profile.user_id);
          return (
            <SocialCard>
              <CardHeader
                title={item.profile.display_name}
                avatarUri={item.profile.avatar_url}
                onPress={() => router.push(`/member/${publicId}`)}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {item.reasons.slice(0, 3).map((reason) => (
                  <SoftChip key={`${item.profile.user_id}-${reason}`} label={reason} />
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button label="View" onPress={() => router.push(`/member/${publicId}`)} secondary compact />
                <Button
                  label={
                    loadingFollowUserId === item.profile.user_id
                      ? "Working..."
                      : followingIds.has(item.profile.user_id)
                        ? "Unfollow"
                        : "Follow"
                  }
                  onPress={() => void sendRequest(item.profile.user_id)}
                  compact
                  secondary={followingIds.has(item.profile.user_id)}
                  disabled={loadingFollowUserId === item.profile.user_id}
                />
              </View>
            </SocialCard>
          );
        }}
      />

      {loadingList ? <Busy label="Loading matches..." /> : null}
    </Screen>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Pressable, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Busy, InlineStatus, Screen } from "@/components/ui";
import { CardHeader, EmptyState, SocialCard, SoftChip } from "@/components/social";
import { fallbackPublicId } from "@/types/profile";
import { colors } from "@/lib/theme";

type MomentRow = {
  id: string;
  user_id: string;
  thought: string | null;
  created_at: string;
  profiles: {
    display_name: string;
    public_id: string | null;
    avatar_url: string | null;
    avatar_storage_path: string | null;
    gender: string | null;
  } | null;
};

type MomentRowRaw = Omit<MomentRow, "profiles"> & {
  profiles: MomentRow["profiles"] | Array<MomentRow["profiles"]>;
};

type HarborRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: "pending" | "mutual" | "closed";
};

type ProfileLite = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
  avatar_storage_path: string | null;
  gender: string | null;
};

const TAB_MOMENTS = 0;
const TAB_HARBOR = 1;

export default function SailScreen() {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState(TAB_MOMENTS);
  const [moments, setMoments] = useState<MomentRow[]>([]);
  const [harborRows, setHarborRows] = useState<Array<HarborRow & { other: ProfileLite | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagerWidth, setPagerWidth] = useState(1);
  const [tabRailWidth, setTabRailWidth] = useState(1);
  const pagerRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const momentsScale = useRef(new Animated.Value(1)).current;
  const harborScale = useRef(new Animated.Value(1)).current;

  const harborCount = useMemo(() => harborRows.filter((row) => row.status === "mutual").length, [harborRows]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: momentsRaw, error: momentsError }, { data: matchRows, error: matchError }] = await Promise.all([
        supabase
          .from("feed_posts")
          .select("id,user_id,thought,created_at,profiles!feed_posts_user_id_fkey(display_name,public_id,avatar_url,avatar_storage_path,gender)")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("matches")
          .select("id,user_a,user_b,status")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(40)
      ]);

      if (momentsError) throw momentsError;
      if (matchError) throw matchError;

      const typedMoments = ((momentsRaw ?? []) as MomentRowRaw[]).map((row) => ({
        ...row,
        profiles: Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles
      }));
      const momentAvatarPaths = Array.from(
        new Set(typedMoments.map((row) => row.profiles?.avatar_storage_path ?? null).filter((v): v is string => Boolean(v)))
      );
      const momentSignedMap = new Map<string, string>();
      if (momentAvatarPaths.length) {
        const { data: signed } = await supabase.storage.from("profile-avatars").createSignedUrls(momentAvatarPaths, 3600);
        (signed ?? []).forEach((row, index) => {
          const path = row.path ?? momentAvatarPaths[index];
          if (path && row.signedUrl) momentSignedMap.set(path, row.signedUrl);
        });
      }
      typedMoments.forEach((row) => {
        const path = row.profiles?.avatar_storage_path;
        if (row.profiles && path && momentSignedMap.has(path)) row.profiles.avatar_url = momentSignedMap.get(path) ?? row.profiles.avatar_url;
      });
      setMoments(typedMoments);

      const typedMatches = (matchRows ?? []) as HarborRow[];
      const ids = Array.from(new Set(typedMatches.map((m) => (m.user_a === user.id ? m.user_b : m.user_a))));
      const { data: profileRows } = ids.length
        ? await supabase.from("profiles").select("user_id,public_id,display_name,avatar_url,avatar_storage_path,gender").in("user_id", ids)
        : { data: [] };
      const typedProfiles = (profileRows ?? []) as ProfileLite[];
      const harborAvatarPaths = typedProfiles.map((row) => row.avatar_storage_path).filter((v): v is string => Boolean(v));
      const harborSignedMap = new Map<string, string>();
      if (harborAvatarPaths.length) {
        const { data: signed } = await supabase.storage.from("profile-avatars").createSignedUrls(harborAvatarPaths, 3600);
        (signed ?? []).forEach((row, index) => {
          const path = row.path ?? harborAvatarPaths[index];
          if (path && row.signedUrl) harborSignedMap.set(path, row.signedUrl);
        });
      }
      typedProfiles.forEach((row) => {
        if (row.avatar_storage_path && harborSignedMap.has(row.avatar_storage_path)) {
          row.avatar_url = harborSignedMap.get(row.avatar_storage_path) ?? row.avatar_url;
        }
      });
      const profileMap = new Map<string, ProfileLite>(typedProfiles.map((row) => [row.user_id, row]));

      setHarborRows(
        typedMatches.map((m) => ({
          ...m,
          other: profileMap.get(m.user_a === user.id ? m.user_b : m.user_a) ?? null
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Sail.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  function switchTab(next: number) {
    setActiveTab(next);
    pagerRef.current?.scrollTo({ x: pagerWidth * next, animated: true });
    const target = next === TAB_MOMENTS ? momentsScale : harborScale;
    target.setValue(0.96);
    Animated.spring(target, {
      toValue: 1,
      speed: 20,
      bounciness: 8,
      useNativeDriver: true
    }).start();
  }

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = event.nativeEvent.contentOffset.x;
    const next = Math.round(x / pagerWidth);
    setActiveTab(next === TAB_HARBOR ? TAB_HARBOR : TAB_MOMENTS);
  }

  const tabGap = 8;
  const tabWidth = Math.max(1, (tabRailWidth - tabGap) / 2);
  const indicatorTranslateX = scrollX.interpolate({
    inputRange: [0, pagerWidth],
    outputRange: [0, tabWidth + tabGap],
    extrapolate: "clamp"
  });

  return (
    <Screen>
      {error ? <InlineStatus text={error} tone="danger" /> : null}
      {loading ? <Busy label="Loading Sail..." /> : null}

      <View
        onLayout={(event) => setTabRailWidth(event.nativeEvent.layout.width)}
        style={{ position: "relative", flexDirection: "row", gap: tabGap, backgroundColor: "#fff", borderRadius: 16, padding: 6, borderWidth: 1, borderColor: colors.border }}
      >
        <Animated.View
          style={{
            position: "absolute",
            left: 6,
            top: 6,
            width: tabWidth,
            height: "100%",
            maxHeight: 62,
            borderRadius: 12,
            backgroundColor: colors.primarySoft,
            borderWidth: 1,
            borderColor: "#ffd8ba",
            transform: [{ translateX: indicatorTranslateX }]
          }}
        />
        <Pressable
          onPress={() => switchTab(TAB_MOMENTS)}
          style={{
            flex: 1,
            borderRadius: 12,
            paddingVertical: 11,
            alignItems: "center",
            gap: 5,
            zIndex: 1
          }}
        >
          <Animated.View style={{ alignItems: "center", gap: 5, transform: [{ scale: momentsScale }] }}>
          <Ionicons name="camera-outline" size={16} color={activeTab === TAB_MOMENTS ? colors.primaryDeep : colors.muted} />
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>Moments</Text>
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={() => switchTab(TAB_HARBOR)}
          style={{
            flex: 1,
            borderRadius: 12,
            paddingVertical: 11,
            alignItems: "center",
            gap: 5,
            zIndex: 1
          }}
        >
          <Animated.View style={{ alignItems: "center", gap: 5, transform: [{ scale: harborScale }] }}>
            <Ionicons name="heart-outline" size={16} color={activeTab === TAB_HARBOR ? colors.primaryDeep : colors.muted} />
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>Harbor</Text>
          </Animated.View>
        </Pressable>
      </View>

      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => {
          setPagerWidth(Math.max(1, event.nativeEvent.layout.width));
        }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
      >
        <View style={{ width: pagerWidth, gap: 10, paddingTop: 4 }}>
          <SocialCard>
            <Pressable onPress={() => router.push("/(app)/discover")}>
              <SoftChip label="Open full Moments feed" />
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Newest public moments from the community.</Text>
          </SocialCard>
          <FlatList<MomentRow>
            data={moments}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
            ListEmptyComponent={<EmptyState title="No moments yet" description="Public moments will appear here." />}
            renderItem={({ item }) => {
              const memberId = item.profiles?.public_id ?? fallbackPublicId(item.user_id);
              return (
                <SocialCard>
                  <CardHeader
                    title={item.profiles?.display_name ?? "Member"}
                    avatarUri={item.profiles?.avatar_url ?? null}
                    gender={item.profiles?.gender ?? null}
                    onPress={() => router.push(`/member/${memberId}`)}
                  />
                  {item.thought ? (
                    <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{item.thought}</Text>
                  ) : (
                    <Text style={{ color: colors.muted, fontSize: 13 }}>(Photo post)</Text>
                  )}
                </SocialCard>
              );
            }}
          />
        </View>

        <View style={{ width: pagerWidth, gap: 10, paddingTop: 4 }}>
          <SocialCard>
            <SoftChip label={`${harborCount} active connection${harborCount === 1 ? "" : "s"}`} />
            <Pressable onPress={() => router.push("/(app)/matches")}>
              <SoftChip label="Open full Harbor page" />
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Your private pending and mutual connections.</Text>
          </SocialCard>
          <FlatList<Array<HarborRow & { other: ProfileLite | null }>[number]>
            data={harborRows}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
            ListEmptyComponent={<EmptyState title="Harbor is calm" description="No connections yet." />}
            renderItem={({ item }) => {
              const otherId = item.other?.public_id ?? (item.other?.user_id ? fallbackPublicId(item.other.user_id) : "Unknown");
              return (
                <SocialCard>
                  <CardHeader
                    title={item.other?.display_name ?? "Member"}
                    avatarUri={item.other?.avatar_url ?? null}
                    gender={item.other?.gender ?? null}
                    onPress={() => router.push(`/member/${otherId}`)}
                  />
                  <SoftChip label={item.status === "mutual" ? "Mutual" : "Pending"} />
                </SocialCard>
              );
            }}
          />
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

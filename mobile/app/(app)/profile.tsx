import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Busy, Button, Heading, InlineStatus, Input, Screen, SectionTitle } from "@/components/ui";
import { Avatar, EmptyState, SocialCard, SoftChip } from "@/components/social";
import { TagPicker } from "@/components/tag-picker";
import {
  GENDER_OPTIONS,
  LANGUAGE_OPTIONS,
  ONBOARDING_TAG_OPTIONS,
  OnboardingTagKey,
  SEXUAL_PREFERENCE_OPTIONS,
  fallbackPublicId,
  normalizeToken,
  titleize
} from "@/types/profile";
import { colors } from "@/lib/theme";

type ProfileRow = {
  user_id: string;
  display_name: string;
  age_years: number;
  gender: string;
  sexual_preference: string;
  bio: string | null;
  avatar_url: string | null;
  avatar_storage_path: string | null;
  cover_photo_url: string | null;
  cover_photo_storage_path: string | null;
};

type PreferenceRow = {
  min_age: number;
  max_age: number;
  preferred_languages: string[] | null;
  profile_tags: Partial<Record<OnboardingTagKey, unknown>> | null;
  profile_visibility: {
    show_age?: boolean;
    show_sexual_preference?: boolean;
  } | null;
};

type FeedPost = {
  id: string;
  thought: string | null;
  photo_path: string | null;
  created_at: string;
};

const AVATAR_BUCKET = "profile-avatars";
const COVER_BUCKET = "profile-covers";
const FEED_BUCKET = "feed-photos";

function inferImageExt(fileName: string | null | undefined, mimeType: string | null | undefined): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (fileName && fileName.includes(".")) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext && /^[a-z0-9]+$/.test(ext)) return ext;
  }
  return "jpg";
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function createEmptyTagSelection(): Record<OnboardingTagKey, string[]> {
  const keys = Object.keys(ONBOARDING_TAG_OPTIONS) as OnboardingTagKey[];
  return keys.reduce(
    (acc, key) => {
      acc[key] = [];
      return acc;
    },
    {} as Record<OnboardingTagKey, string[]>
  );
}

function tagsToSelectedMap(tags: Partial<Record<OnboardingTagKey, unknown>> | null | undefined): Record<OnboardingTagKey, string[]> {
  const keys = Object.keys(ONBOARDING_TAG_OPTIONS) as OnboardingTagKey[];
  const next = createEmptyTagSelection();
  if (!tags || typeof tags !== "object") return next;

  keys.forEach((key) => {
    const raw = tags[key];
    if (!Array.isArray(raw)) return;
    next[key] = raw.map((item) => normalizeToken(String(item))).filter(Boolean);
  });

  return next;
}

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useSession();
  const [record, setRecord] = useState<ProfileRow | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [viewMode, setViewMode] = useState<"view" | "edit">("view");
  const [displayName, setDisplayName] = useState("");
  const [nationality] = useState("Prefer not to say");
  const [ageYears, setAgeYears] = useState("18");
  const [gender, setGender] = useState<string>("prefer_not_to_say");
  const [sexualPreference, setSexualPreference] = useState<string>("prefer_not_to_say");
  const [bio, setBio] = useState("");
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("35");
  const [languagesInput, setLanguagesInput] = useState("english");
  const [selectedTags, setSelectedTags] = useState<Record<OnboardingTagKey, string[]>>(createEmptyTagSelection);
  const [showAge, setShowAge] = useState(true);
  const [showSexualPreference, setShowSexualPreference] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: "danger" | "success" | "default" } | null>(null);
  function formatClock(value: string): string {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const visibleTagLabels = useMemo(
    () =>
      Object.values(selectedTags)
        .flat()
        .map((value) => titleize(value))
        .slice(0, 24),
    [selectedTags]
  );

  const activeLanguages = useMemo(() => {
    const parsed = Array.from(new Set(languagesInput.split(",").map((item) => normalizeToken(item)).filter(Boolean)));
    return parsed.length > 0 ? parsed : [...LANGUAGE_OPTIONS];
  }, [languagesInput]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadingProfile(true);

    const [{ data: profileRow }, { data: preferenceRow }, { data: postRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "user_id,display_name,age_years,gender,sexual_preference,bio,avatar_url,avatar_storage_path,cover_photo_url,cover_photo_storage_path"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("preferences")
        .select("min_age,max_age,preferred_languages,profile_tags,profile_visibility")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("feed_posts")
        .select("id,thought,photo_path,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60)
    ]);

    const p = (profileRow ?? null) as ProfileRow | null;
    const pref = (preferenceRow ?? null) as PreferenceRow | null;
    const typedPosts = (postRows ?? []) as FeedPost[];

    if (!p) {
      setLoadingProfile(false);
      return;
    }

    if (p.avatar_storage_path) {
      const { data: signedAvatar } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(p.avatar_storage_path, 3600);
      if (signedAvatar?.signedUrl) p.avatar_url = signedAvatar.signedUrl;
    }
    if (p.cover_photo_storage_path) {
      const { data: signedCover } = await supabase.storage.from(COVER_BUCKET).createSignedUrl(p.cover_photo_storage_path, 3600);
      if (signedCover?.signedUrl) p.cover_photo_url = signedCover.signedUrl;
    }

    setRecord(p);
    setPosts(typedPosts);
    setDisplayName(p.display_name ?? "");
    setAgeYears(String(p.age_years ?? 18));
    setGender(p.gender ?? "prefer_not_to_say");
    setSexualPreference(p.sexual_preference ?? "prefer_not_to_say");
    setBio(p.bio ?? "");
    setMinAge(String(pref?.min_age ?? 18));
    setMaxAge(String(pref?.max_age ?? 35));
    setLanguagesInput((pref?.preferred_languages ?? ["english"]).join(", "));
    setSelectedTags(tagsToSelectedMap(pref?.profile_tags));
    setShowAge(pref?.profile_visibility?.show_age ?? true);
    setShowSexualPreference(pref?.profile_visibility?.show_sexual_preference ?? true);
    const { data: followCounts } = await supabase.rpc("profile_follow_counts", { p_target: user.id });
    setFollowersCount(Number(followCounts?.[0]?.followers ?? 0));
    setFollowingCount(Number(followCounts?.[0]?.following ?? 0));

    const paths = typedPosts.map((post) => post.photo_path).filter((value): value is string => Boolean(value));
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from(FEED_BUCKET).createSignedUrls(paths, 3600);
      const next = new Map<string, string>();
      (signed ?? []).forEach((row, index) => {
        const path = row.path ?? paths[index];
        if (path && row.signedUrl) next.set(path, row.signedUrl);
      });
      setPhotoUrls(next);
    } else {
      setPhotoUrls(new Map());
    }

    setLoadingProfile(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadProfileImage(kind: "avatar" | "cover") {
    if (!user || !record) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus({ text: "Allow photo access to upload images.", tone: "danger" });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const ext = inferImageExt(asset.fileName, asset.mimeType);
    const bucket = kind === "avatar" ? AVATAR_BUCKET : COVER_BUCKET;
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    setLoading(true);
    setStatus(null);

    try {
      const blob = await (await fetch(asset.uri)).blob();
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, blob, {
        upsert: false,
        contentType: asset.mimeType ?? "image/jpeg"
      });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl }
      } = supabase.storage.from(bucket).getPublicUrl(path);

      const updatePayload =
        kind === "avatar"
          ? { avatar_url: publicUrl, avatar_storage_path: path }
          : { cover_photo_url: publicUrl, cover_photo_storage_path: path };

      const { error: updateError } = await supabase.from("profiles").update(updatePayload).eq("user_id", user.id);
      if (updateError) throw updateError;

      const oldPath = kind === "avatar" ? record.avatar_storage_path : record.cover_photo_storage_path;
      if (oldPath) await supabase.storage.from(bucket).remove([oldPath]);

      setStatus({ text: `${kind === "avatar" ? "Avatar" : "Cover"} updated.`, tone: "success" });
      await load();
      await refreshProfile();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Image upload failed.", tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function deleteAvatar() {
    if (!user || !record) return;
    setLoading(true);
    try {
      const oldPath = record.avatar_storage_path;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null, avatar_storage_path: null })
        .eq("user_id", user.id);
      if (error) throw error;
      if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
      setAvatarMenuOpen(false);
      setStatus({ text: "Avatar removed.", tone: "success" });
      await load();
      await refreshProfile();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Failed to remove avatar.", tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!user) return;

    setLoading(true);
    setStatus(null);

    try {
      const age = Number(ageYears);
      let prefMin = Number(minAge);
      let prefMax = Number(maxAge);

      if (age < 18) {
        prefMin = Math.max(13, Math.min(prefMin, 17));
        prefMax = Math.max(prefMin, Math.min(prefMax, 17));
      } else {
        prefMin = Math.max(18, prefMin);
        prefMax = Math.max(prefMin, prefMax);
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          age_years: age,
          gender,
          sexual_preference: sexualPreference,
          bio: bio || null,
          is_published: true
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      const { error: prefError } = await supabase.from("preferences").upsert(
        {
          user_id: user.id,
          min_age: prefMin,
          max_age: prefMax,
          preferred_languages: activeLanguages,
          preferred_genders: null,
          preferred_nationalities: null,
          use_appearance_filters: false,
          appearance_filters: {},
          profile_tags: selectedTags,
          profile_visibility: {
            show_age: showAge,
            show_sexual_preference: showSexualPreference
          }
        },
        { onConflict: "user_id" }
      );

      if (prefError) throw prefError;

      await refreshProfile();
      setStatus({ text: "Profile saved.", tone: "success" });
      setViewMode("view");
      await load();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Failed to save profile.", tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/sign-in");
  }

  if (loadingProfile && !record) {
    return (
      <Screen>
        <Busy label="Loading your profile..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 80 }}>
        <SocialCard>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => setAvatarMenuOpen((current) => !current)}>
              <Avatar uri={record?.avatar_url ?? profile?.avatar_url ?? null} name={profile?.display_name ?? "Profile"} size={72} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Heading>{profile?.display_name ?? "Profile"}</Heading>
              <Text style={{ color: "#667085" }}>{profile?.public_id ?? (user ? fallbackPublicId(user.id) : "-")}</Text>
              <Text style={{ color: "#667085", fontSize: 12 }}>Followers {followersCount} · Following {followingCount}</Text>
            </View>
            <Pressable onPress={() => setViewMode((mode) => (mode === "view" ? "edit" : "view"))}>
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          </View>
          {avatarMenuOpen ? (
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: "#fff", overflow: "hidden" }}>
              <Pressable onPress={() => { setAvatarMenuOpen(false); setAvatarPreviewOpen(true); }} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ color: colors.text, fontWeight: "600" }}>See profile picture</Text>
              </Pressable>
              <Pressable onPress={() => void uploadProfileImage("avatar")} style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.text, fontWeight: "600" }}>{loading ? "Working..." : "Upload profile avatar"}</Text>
              </Pressable>
              <Pressable onPress={() => void deleteAvatar()} style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.danger, fontWeight: "700" }}>{loading ? "Working..." : "Delete avatar"}</Text>
              </Pressable>
            </View>
          ) : null}
        </SocialCard>

        {viewMode === "view" ? (
          <>
            {record?.cover_photo_url ? (
              <SocialCard>
                <Image source={{ uri: record.cover_photo_url }} style={{ width: "100%", height: 180, borderRadius: 14 }} resizeMode="cover" />
              </SocialCard>
            ) : null}

            {record ? (
              <SocialCard>
                <SectionTitle title="Your public profile card" />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <SoftChip label={`Followers ${followersCount}`} />
                  <SoftChip label={`Following ${followingCount}`} />
                  <SoftChip label={`${record.age_years} yrs`} />
                  <SoftChip label={titleize(record.gender)} />
                  <SoftChip label={titleize(record.sexual_preference)} />
                  {activeLanguages.map((lang) => (
                    <SoftChip key={`lang-${lang}`} label={titleize(lang)} />
                  ))}
                  {visibleTagLabels.map((label) => (
                    <SoftChip key={`tag-${label}`} label={label} />
                  ))}
                </View>
                {record.bio ? <Text style={{ color: "#111827", lineHeight: 21 }}>{record.bio}</Text> : null}
              </SocialCard>
            ) : null}

            <SocialCard>
              <SectionTitle title="Your posts" />
              {posts.length === 0 ? (
                <EmptyState title="No posts yet" description="Share in Discover and your posts will show here." />
              ) : (
                <FlatList<FeedPost>
                  data={posts}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  contentContainerStyle={{ gap: 10 }}
                  renderItem={({ item }) => (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: "#111827" }}>{item.thought ?? "(Photo post)"}</Text>
                      {item.photo_path && photoUrls.get(item.photo_path) ? (
                        <Image
                          source={{ uri: photoUrls.get(item.photo_path)! }}
                          style={{ width: "100%", height: 220, borderRadius: 12 }}
                          resizeMode="cover"
                        />
                      ) : null}
                      <Text style={{ color: "#667085", fontSize: 11 }}>{formatClock(item.created_at)}</Text>
                    </View>
                  )}
                />
              )}
            </SocialCard>
          </>
        ) : (
          <>
            <SocialCard>
              <SectionTitle title="Edit profile settings" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button label={loading ? "Please wait..." : "Upload avatar"} onPress={() => void uploadProfileImage("avatar")} secondary compact />
                <Button label={loading ? "Please wait..." : "Upload cover"} onPress={() => void uploadProfileImage("cover")} secondary compact />
              </View>

              <Input placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
              <Input placeholder="Age" value={ageYears} onChangeText={setAgeYears} keyboardType="number-pad" />
              <Input placeholder="Bio" value={bio} onChangeText={setBio} multiline />

              <Text style={{ fontWeight: "800", color: "#111827" }}>Gender</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {GENDER_OPTIONS.map((option) => (
                  <Button key={option} label={titleize(option)} onPress={() => setGender(option)} secondary={gender !== option} compact />
                ))}
              </View>

              <Text style={{ fontWeight: "800", color: "#111827" }}>Sexual preference</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {SEXUAL_PREFERENCE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    label={titleize(option)}
                    onPress={() => setSexualPreference(option)}
                    secondary={sexualPreference !== option}
                    compact
                  />
                ))}
              </View>

              <Input placeholder="Preferred min age" value={minAge} onChangeText={setMinAge} keyboardType="number-pad" />
              <Input placeholder="Preferred max age" value={maxAge} onChangeText={setMaxAge} keyboardType="number-pad" />
              <Input placeholder="Languages (comma separated)" value={languagesInput} onChangeText={setLanguagesInput} />
              <Text style={{ color: "#667085" }}>Parsed languages: {activeLanguages.map(titleize).join(", ")}</Text>

              {(Object.keys(ONBOARDING_TAG_OPTIONS) as OnboardingTagKey[]).map((key) => (
                <TagPicker
                  key={key}
                  title={titleize(key)}
                  options={ONBOARDING_TAG_OPTIONS[key]}
                  selected={selectedTags[key]}
                  onToggle={(value) =>
                    setSelectedTags((current) => ({
                      ...current,
                      [key]: toggleValue(current[key], value)
                    }))
                  }
                />
              ))}

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "#111827", fontWeight: "600" }}>Show age</Text>
                <Switch value={showAge} onValueChange={setShowAge} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "#111827", fontWeight: "600" }}>Show sexual preference</Text>
                <Switch value={showSexualPreference} onValueChange={setShowSexualPreference} />
              </View>

              <Button label={loading ? "Saving..." : "Save profile"} onPress={save} disabled={loading || !displayName} />
            </SocialCard>
          </>
        )}

        {status ? <InlineStatus text={status.text} tone={status.tone} /> : null}

        <SocialCard>
          <Button label="Open onboarding" onPress={() => router.push("/onboarding")} secondary compact />
          <Button label="Sign out" onPress={signOut} secondary compact />
        </SocialCard>
      </ScrollView>
      <Modal visible={avatarPreviewOpen} transparent animationType="fade" onRequestClose={() => setAvatarPreviewOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Pressable style={{ position: "absolute", top: 46, right: 22 }} onPress={() => setAvatarPreviewOpen(false)}>
            <Ionicons name="close-circle" size={32} color="#fff" />
          </Pressable>
          {record?.avatar_url ? (
            <Image source={{ uri: record.avatar_url }} style={{ width: 260, height: 260, borderRadius: 130, borderWidth: 3, borderColor: "#fff" }} />
          ) : (
            <Avatar name={profile?.display_name ?? "Profile"} size={160} />
          )}
        </View>
      </Modal>
    </Screen>
  );
}

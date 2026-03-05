import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Modal, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Body, Busy, Button, Card, InlineStatus, Input, Screen } from "@/components/ui";
import { Avatar, CardHeader, EmptyState, SocialCard, SoftChip } from "@/components/social";
import { fallbackPublicId } from "@/types/profile";
import { colors } from "@/lib/theme";

type FeedPost = {
  id: string;
  user_id: string;
  thought: string | null;
  photo_path: string | null;
  is_public: boolean;
  created_at: string;
  profiles: {
    display_name: string;
    public_id: string | null;
    avatar_url: string | null;
    avatar_storage_path: string | null;
    gender: string | null;
  } | null;
};

type FeedPostRaw = Omit<FeedPost, "profiles"> & {
  profiles:
    | FeedPost["profiles"]
    | Array<{
        display_name: string;
        public_id: string | null;
        avatar_url: string | null;
        avatar_storage_path: string | null;
        gender: string | null;
      }>;
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
};

type CommentView = CommentRow & {
  author_name: string;
  author_avatar_url: string | null;
};

const FEED_BUCKET = "feed-photos";
const AVATAR_BUCKET = "profile-avatars";

function inferImageExt(fileName: string | null | undefined, mimeType: string | null | undefined): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (fileName && fileName.includes(".")) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext && /^[a-z0-9]+$/.test(ext)) return ext;
  }
  return "jpg";
}

export default function DiscoverScreen() {
  const { user, profile, refreshProfile } = useSession();
  const [thought, setThought] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [loveCountByPost, setLoveCountByPost] = useState<Map<string, number>>(new Map());
  const [myLovedPosts, setMyLovedPosts] = useState<Set<string>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Map<string, CommentView[]>>(new Map());
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: "danger" | "success" | "default" } | null>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(true);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const lastScrollY = useRef(0);
  function formatClock(value: string): string {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const selectedPhotoLabel = useMemo(() => {
    if (!selectedPhoto) return "No photo selected";
    return selectedPhoto.fileName ?? selectedPhoto.uri.split("/").pop() ?? "Selected photo";
  }, [selectedPhoto]);

  const load = useCallback(async () => {
    if (!user) return;

    setLoadingFeed(true);
    try {
      const { data, error } = await supabase
        .from("feed_posts")
        .select(
          "id,user_id,thought,photo_path,is_public,created_at,profiles!feed_posts_user_id_fkey(display_name,public_id,avatar_url,avatar_storage_path,gender)"
        )
        .order("created_at", { ascending: false })
        .limit(60);

      if (error) {
        setStatus({ text: error.message, tone: "danger" });
        return;
      }

      const typedPosts = ((data ?? []) as FeedPostRaw[]).map((post) => ({
        ...post,
        profiles: Array.isArray(post.profiles) ? (post.profiles[0] ?? null) : post.profiles
      }));

      const avatarPaths = Array.from(
        new Set(
          typedPosts
            .map((post) => post.profiles?.avatar_storage_path ?? null)
            .filter((value): value is string => Boolean(value))
        )
      );
      const avatarSignedMap = new Map<string, string>();
      if (avatarPaths.length > 0) {
        const { data: signedAvatars } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrls(avatarPaths, 3600);
        (signedAvatars ?? []).forEach((row, index) => {
          const path = row.path ?? avatarPaths[index];
          if (path && row.signedUrl) avatarSignedMap.set(path, row.signedUrl);
        });
      }

      typedPosts.forEach((post) => {
        const path = post.profiles?.avatar_storage_path;
        if (post.profiles && path && avatarSignedMap.has(path)) {
          post.profiles.avatar_url = avatarSignedMap.get(path) ?? post.profiles.avatar_url;
        }
      });

      setPosts(typedPosts);

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

      const postIds = typedPosts.map((post) => post.id);
      if (postIds.length === 0) {
        setLoveCountByPost(new Map());
        setMyLovedPosts(new Set());
        setCommentsByPost(new Map());
        return;
      }

      const [{ data: reactionRows }, { data: commentRows }] = await Promise.all([
        supabase.from("feed_post_reactions").select("post_id,user_id,reaction").in("post_id", postIds),
        supabase
          .from("feed_post_comments")
          .select("id,post_id,user_id,content,created_at")
          .in("post_id", postIds)
          .order("created_at", { ascending: true })
      ]);

      const typedReactions = (reactionRows ?? []) as ReactionRow[];
      const typedComments = (commentRows ?? []) as CommentRow[];

      const nextLoveCounts = new Map<string, number>();
      const nextMyLoved = new Set<string>();
      typedReactions.forEach((row) => {
        if (row.reaction !== "love") return;
        nextLoveCounts.set(row.post_id, (nextLoveCounts.get(row.post_id) ?? 0) + 1);
        if (row.user_id === user.id) nextMyLoved.add(row.post_id);
      });

      const commentUserIds = Array.from(new Set(typedComments.map((row) => row.user_id)));
      const { data: commentProfiles } = commentUserIds.length
        ? await supabase.from("profiles").select("user_id,display_name,avatar_url").in("user_id", commentUserIds)
        : { data: [] };

      const profileMap = new Map(
        (commentProfiles ?? []).map((row) => [
          row.user_id,
          row as { user_id: string; display_name: string; avatar_url: string | null }
        ])
      );

      const nextCommentsByPost = new Map<string, CommentView[]>();
      typedComments.forEach((row) => {
        const author = profileMap.get(row.user_id);
        const comment: CommentView = {
          ...row,
          author_name: author?.display_name ?? "Member",
          author_avatar_url: author?.avatar_url ?? null
        };
        if (!nextCommentsByPost.has(row.post_id)) nextCommentsByPost.set(row.post_id, []);
        nextCommentsByPost.get(row.post_id)!.push(comment);
      });

      setLoveCountByPost(nextLoveCounts);
      setMyLovedPosts(nextMyLoved);
      setCommentsByPost(nextCommentsByPost);
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : "Failed to load feed.", tone: "danger" });
    } finally {
      setLoadingFeed(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function pickPhoto() {
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
    setSelectedPhoto(result.assets[0]);
  }

  async function postThought() {
    if (!user) return;
    setLoading(true);
    setStatus(null);

    let uploadedPath: string | null = null;

    try {
      if (!thought.trim() && !selectedPhoto) throw new Error("Write a thought or attach a photo before posting.");

      if (selectedPhoto) {
        const ext = inferImageExt(selectedPhoto.fileName, selectedPhoto.mimeType);
        uploadedPath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const response = await fetch(selectedPhoto.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage.from(FEED_BUCKET).upload(uploadedPath, blob, {
          upsert: false,
          contentType: selectedPhoto.mimeType ?? "image/jpeg"
        });
        if (uploadError) throw uploadError;
      }

      const { error } = await supabase.from("feed_posts").insert({
        user_id: user.id,
        thought: thought.trim() || null,
        photo_path: uploadedPath,
        is_public: true
      });

      if (error) throw error;
      setThought("");
      setSelectedPhoto(null);
      setComposerExpanded(false);
      setStatus({ text: "Posted to discover.", tone: "success" });
      await load();
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(FEED_BUCKET).remove([uploadedPath]);
      setStatus({ text: error instanceof Error ? error.message : "Failed to post.", tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function toggleLove(post: FeedPost) {
    if (!user) return;

    const hasLoved = myLovedPosts.has(post.id);
    if (hasLoved) {
      await supabase.from("feed_post_reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
      await load();
      return;
    }

    const { error } = await supabase.from("feed_post_reactions").upsert(
      {
        post_id: post.id,
        user_id: user.id,
        reaction: "love"
      },
      { onConflict: "post_id,user_id" }
    );

    if (error) {
      setStatus({ text: error.message, tone: "danger" });
      return;
    }

    if (post.user_id !== user.id) {
      await supabase.from("social_notifications").insert({
        recipient_user_id: post.user_id,
        actor_user_id: user.id,
        type: "reaction",
        post_id: post.id,
        reaction: "love"
      });
    }

    await load();
  }

  async function submitComment(post: FeedPost) {
    if (!user) return;
    const content = (commentDraftByPost[post.id] ?? "").trim();
    if (!content) return;

    const { data: comment, error } = await supabase
      .from("feed_post_comments")
      .insert({ post_id: post.id, user_id: user.id, content })
      .select("id")
      .single();

    if (error) {
      setStatus({ text: error.message, tone: "danger" });
      return;
    }

    if (post.user_id !== user.id) {
      await supabase.from("social_notifications").insert({
        recipient_user_id: post.user_id,
        actor_user_id: user.id,
        type: "comment",
        post_id: post.id,
        comment_id: comment.id,
        details: content.slice(0, 160)
      });
    }

    setCommentDraftByPost((prev) => ({ ...prev, [post.id]: "" }));
    await load();
  }

  async function uploadMyAvatar() {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus({ text: "Allow photo access to upload avatar.", tone: "danger" });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85
    });
    if (result.canceled || result.assets.length === 0) return;

    setAvatarLoading(true);
    setAvatarMenuOpen(false);

    try {
      const asset = result.assets[0];
      const ext = inferImageExt(asset.fileName, asset.mimeType);
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const blob = await (await fetch(asset.uri)).blob();

      const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
        upsert: false,
        contentType: asset.mimeType ?? "image/jpeg"
      });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl }
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

      const { data: currentProfile } = await supabase.from("profiles").select("avatar_storage_path").eq("user_id", user.id).maybeSingle();

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, avatar_storage_path: path })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      if (currentProfile?.avatar_storage_path) {
        await supabase.storage.from(AVATAR_BUCKET).remove([currentProfile.avatar_storage_path]);
      }

      await refreshProfile();
      setStatus({ text: "Profile avatar updated.", tone: "success" });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Failed to upload avatar.", tone: "danger" });
    } finally {
      setAvatarLoading(false);
    }
  }

  async function deleteMyAvatar() {
    if (!user) return;
    setAvatarLoading(true);
    setAvatarMenuOpen(false);

    try {
      const { data: currentProfile } = await supabase.from("profiles").select("avatar_storage_path").eq("user_id", user.id).maybeSingle();
      const oldPath = currentProfile?.avatar_storage_path ?? null;

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null, avatar_storage_path: null })
        .eq("user_id", user.id);
      if (error) throw error;

      if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
      await refreshProfile();
      setStatus({ text: "Profile avatar removed.", tone: "success" });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Failed to remove avatar.", tone: "danger" });
    } finally {
      setAvatarLoading(false);
    }
  }

  async function togglePostVisibility(post: FeedPost) {
    if (!user || post.user_id !== user.id) return;
    setOpenPostMenuId(null);
    const { error } = await supabase
      .from("feed_posts")
      .update({ is_public: !post.is_public })
      .eq("id", post.id)
      .eq("user_id", user.id);
    if (error) {
      setStatus({ text: error.message, tone: "danger" });
      return;
    }
    setStatus({ text: `Post is now ${post.is_public ? "private" : "public"}.`, tone: "success" });
    await load();
  }

  async function deletePost(post: FeedPost) {
    if (!user || post.user_id !== user.id) return;
    setOpenPostMenuId(null);
    const { error } = await supabase.from("feed_posts").delete().eq("id", post.id).eq("user_id", user.id);
    if (error) {
      setStatus({ text: error.message, tone: "danger" });
      return;
    }
    if (post.photo_path) {
      await supabase.storage.from(FEED_BUCKET).remove([post.photo_path]);
    }
    setStatus({ text: "Post deleted.", tone: "success" });
    await load();
  }

  return (
    <Screen>
      <FlatList<FeedPost>
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 90 }}
        onScroll={(event) => {
          const offset = event.nativeEvent.contentOffset.y;
          const delta = offset - lastScrollY.current;
          lastScrollY.current = offset;

          setShowProfileCard((current) => {
            if (offset <= 12) return true;
            if (delta > 5 && offset > 24) return false;
            if (delta < -5) return true;
            return current;
          });
        }}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
            {showProfileCard ? (
              <Card>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Pressable onPress={() => setAvatarMenuOpen((current) => !current)}>
                        <Avatar uri={profile?.avatar_url ?? null} name={profile?.display_name ?? "You"} size={48} online />
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{profile?.display_name ?? "You"}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Tap avatar for actions</Text>
                      </View>
                    </View>
                    {avatarMenuOpen ? (
                      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: "#fff", overflow: "hidden" }}>
                        <Pressable onPress={() => { setAvatarMenuOpen(false); setAvatarPreviewOpen(true); }} style={{ paddingHorizontal: 12, paddingVertical: 11 }}>
                          <Text style={{ color: colors.text, fontWeight: "600" }}>See profile picture</Text>
                        </Pressable>
                        <Pressable onPress={() => void uploadMyAvatar()} style={{ paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <Text style={{ color: colors.text, fontWeight: "600" }}>{avatarLoading ? "Working..." : "Upload profile avatar"}</Text>
                        </Pressable>
                        <Pressable onPress={() => void deleteMyAvatar()} style={{ paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <Text style={{ color: colors.danger, fontWeight: "700" }}>{avatarLoading ? "Working..." : "Delete avatar"}</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    {!composerExpanded ? (
                      <Pressable
                        onPress={() => setComposerExpanded(true)}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 14,
                          paddingHorizontal: 12,
                          paddingVertical: 11,
                          backgroundColor: "#fff"
                        }}
                      >
                        <Text style={{ color: colors.muted }}>What made you smile today?</Text>
                      </Pressable>
                    ) : (
                      <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Input
                            placeholder="What made you smile today?"
                            value={thought}
                            onChangeText={setThought}
                            onFocus={() => setComposerExpanded(true)}
                            multiline
                            style={{ flex: 1, minHeight: 44, textAlignVertical: "top" }}
                          />
                          <Pressable
                            onPress={() => void pickPhoto()}
                            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: "#fff" }}
                          >
                            <Ionicons name="image-outline" size={20} color={colors.text} />
                          </Pressable>
                        </View>

                        {selectedPhoto ? <SoftChip label={selectedPhotoLabel} /> : null}
                        {selectedPhoto?.uri ? (
                          <Image source={{ uri: selectedPhoto.uri }} style={{ width: "100%", height: 180, borderRadius: 12 }} resizeMode="cover" />
                        ) : null}

                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Button label={loading ? "Posting..." : "Post"} onPress={postThought} disabled={loading} compact />
                          {selectedPhoto ? <Button label="Remove photo" onPress={() => setSelectedPhoto(null)} secondary compact /> : null}
                        </View>
                      </View>
                    )}

                    {status ? <InlineStatus text={status.text} tone={status.tone} /> : null}
                  </View>
                </View>
              </Card>
            ) : null}

            {loadingFeed && posts.length === 0 ? <Busy label="Loading feed..." /> : null}
          </>
        }
        renderItem={({ item }) => {
          const photoUrl = item.photo_path ? photoUrls.get(item.photo_path) : null;
          const memberId = item.profiles?.public_id ?? fallbackPublicId(item.user_id);
          const authorName = item.profiles?.display_name ?? "Member";
          const loveCount = loveCountByPost.get(item.id) ?? 0;
          const comments = commentsByPost.get(item.id) ?? [];
          const isLoved = myLovedPosts.has(item.id);
          const isCommentOpen = openCommentsPostId === item.id;

          return (
            <SocialCard>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <CardHeader
                    title={authorName}
                    avatarUri={item.profiles?.avatar_url ?? null}
                    gender={item.profiles?.gender ?? null}
                    showActiveStatus
                    onPress={() => router.push(`/member/${memberId}`)}
                  />
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    <Text style={{ fontSize: 11 }}>{formatClock(item.created_at)}</Text> · {item.is_public ? "Public" : "Private"}
                  </Text>
                </View>
                {item.user_id === user?.id ? (
                  <View style={{ position: "relative" }}>
                    <Pressable onPress={() => setOpenPostMenuId((current) => (current === item.id ? null : item.id))} style={{ padding: 4 }}>
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
                    </Pressable>
                    {openPostMenuId === item.id ? (
                      <View
                        style={{
                          position: "absolute",
                          top: 26,
                          right: 0,
                          width: 170,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          backgroundColor: "#fff",
                          overflow: "hidden",
                          zIndex: 10
                        }}
                      >
                        <Pressable onPress={() => void togglePostVisibility(item)} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                          <Text style={{ color: colors.text, fontWeight: "600" }}>
                            Edit privacy: {item.is_public ? "Make private" : "Make public"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void deletePost(item)}
                          style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}
                        >
                          <Text style={{ color: colors.danger, fontWeight: "700" }}>Delete</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
              {item.thought ? <Text style={{ fontSize: 15, color: "#111827", lineHeight: 21 }}>{item.thought}</Text> : null}
              {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: "100%", height: 240, borderRadius: 14 }} resizeMode="cover" /> : null}

              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <Pressable onPress={() => void toggleLove(item)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name={isLoved ? "heart" : "heart-outline"} size={20} color={isLoved ? colors.danger : colors.text} />
                  <Text style={{ color: colors.muted, fontWeight: "600" }}>{loveCount}</Text>
                </Pressable>

                <Pressable
                  onPress={() => setOpenCommentsPostId((current) => (current === item.id ? null : item.id))}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.text} />
                  <Text style={{ color: colors.muted, fontWeight: "600" }}>{comments.length}</Text>
                </Pressable>
              </View>

              {isCommentOpen ? (
                <View style={{ gap: 8 }}>
                  {comments.length === 0 ? <Body>No comments yet.</Body> : null}
                  {comments.map((comment) => (
                    <View key={comment.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                      <Avatar uri={comment.author_avatar_url} name={comment.author_name} size={30} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "700", color: "#111827" }}>{comment.author_name}</Text>
                        <Text style={{ color: "#1f2937" }}>{comment.content}</Text>
                      </View>
                    </View>
                  ))}
                  <Input
                    placeholder="Write a comment"
                    value={commentDraftByPost[item.id] ?? ""}
                    onChangeText={(value) => setCommentDraftByPost((prev) => ({ ...prev, [item.id]: value }))}
                  />
                  <Button label="Comment" onPress={() => void submitComment(item)} compact secondary />
                </View>
              ) : null}
            </SocialCard>
          );
        }}
        ListEmptyComponent={!loadingFeed ? <EmptyState title="Your harbor is calm" description="No posts yet. Share your first moment." /> : null}
      />
      <Modal visible={avatarPreviewOpen} transparent animationType="fade" onRequestClose={() => setAvatarPreviewOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Pressable style={{ position: "absolute", top: 46, right: 22 }} onPress={() => setAvatarPreviewOpen(false)}>
            <Ionicons name="close-circle" size={32} color="#fff" />
          </Pressable>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: 260, height: 260, borderRadius: 130, borderWidth: 3, borderColor: "#fff" }} />
          ) : (
            <Avatar name={profile?.display_name ?? "You"} size={160} />
          )}
        </View>
      </Modal>
    </Screen>
  );
}

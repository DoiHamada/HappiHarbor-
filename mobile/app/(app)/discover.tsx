import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Heading, InlineStatus, Input, Screen } from "@/components/ui";
import { fallbackPublicId } from "@/types/profile";

type FeedPost = {
  id: string;
  user_id: string;
  thought: string | null;
  created_at: string;
  profiles: { display_name: string; public_id: string | null } | null;
};

type FeedPostRaw = Omit<FeedPost, "profiles"> & {
  profiles: FeedPost["profiles"] | Array<{ display_name: string; public_id: string | null }>;
};

export default function DiscoverScreen() {
  const { user, profile } = useSession();
  const [thought, setThought] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: "danger" | "success" | "default" } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("feed_posts")
      .select("id,user_id,thought,created_at,profiles(display_name,public_id)")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      setStatus({ text: error.message, tone: "danger" });
      return;
    }

    const typed = ((data ?? []) as FeedPostRaw[]).map((post) => ({
      ...post,
      profiles: Array.isArray(post.profiles) ? (post.profiles[0] ?? null) : post.profiles
    }));

    setPosts(typed);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function postThought() {
    if (!user) return;
    setLoading(true);
    setStatus(null);

    try {
      if (!thought.trim()) throw new Error("Write a thought before posting.");

      const { error } = await supabase.from("feed_posts").insert({
        user_id: user.id,
        thought: thought.trim(),
        photo_path: null,
        is_public: true
      });

      if (error) throw error;
      setThought("");
      setStatus({ text: "Posted to discover.", tone: "success" });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to post.";
      setStatus({ text: message, tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Heading>{profile?.display_name ?? "Discover"}</Heading>
        <Body>ID: {profile?.public_id ?? (user ? fallbackPublicId(user.id) : "-")}</Body>
      </Card>

      <Card>
        <Input placeholder="Share your thoughts..." value={thought} onChangeText={setThought} multiline />
        <Button label={loading ? "Posting..." : "Post"} onPress={postThought} disabled={loading} />
        {status ? <InlineStatus text={status.text} tone={status.tone} /> : null}
      </Card>

      <FlatList<FeedPost>
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <Card>
            <Text style={{ fontWeight: "700" }}>{item.profiles?.display_name ?? "Member"}</Text>
            <Body>{new Date(item.created_at).toLocaleString()}</Body>
            <Text>{item.thought || "(Photo post)"}</Text>
          </Card>
        )}
        ListEmptyComponent={<Body>No posts yet.</Body>}
      />
    </Screen>
  );
}

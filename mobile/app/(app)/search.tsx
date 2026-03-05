import { useState } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Busy, Button, InlineStatus, Input, Screen } from "@/components/ui";
import { CardHeader, EmptyState, SocialCard } from "@/components/social";
import { fallbackPublicId } from "@/types/profile";

type SearchProfile = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
  avatar_storage_path: string | null;
};

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  async function runSearch() {
    setError(null);
    setLoadingResults(true);
    const q = query.trim();
    if (!q) {
      setLoadingResults(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("user_id,public_id,display_name,avatar_url,avatar_storage_path")
      .eq("is_published", true)
      .or(`display_name.ilike.%${q}%,public_id.ilike.%${q}%`)
      .order("display_name", { ascending: true })
      .limit(40);

    if (fetchError) {
      setError(fetchError.message);
      setLoadingResults(false);
      return;
    }

    const typed = (data ?? []) as SearchProfile[];
    const paths = typed.map((row) => row.avatar_storage_path).filter((v): v is string => Boolean(v));
    const signedMap = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("profile-avatars").createSignedUrls(paths, 3600);
      (signed ?? []).forEach((row, index) => {
        const path = row.path ?? paths[index];
        if (path && row.signedUrl) signedMap.set(path, row.signedUrl);
      });
    }
    typed.forEach((row) => {
      if (row.avatar_storage_path && signedMap.has(row.avatar_storage_path)) {
        row.avatar_url = signedMap.get(row.avatar_storage_path) ?? row.avatar_url;
      }
    });
    setResults(typed);
    setLoadingResults(false);
  }

  return (
    <Screen>
      <SocialCard>
        <Input placeholder="Try HH-... or a name" value={query} onChangeText={setQuery} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label="Search" onPress={runSearch} compact />
          {query ? <Button label="Clear" onPress={() => setQuery("")} secondary compact /> : null}
        </View>
        {error ? <InlineStatus text={error} tone="danger" /> : null}
      </SocialCard>

      {loadingResults ? <Busy label="Searching..." /> : null}

      <FlatList<SearchProfile>
        data={results}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
        ListEmptyComponent={query ? <EmptyState title="No results" description="Try a different ID or name." /> : null}
        renderItem={({ item }) => {
          const publicId = item.public_id ?? fallbackPublicId(item.user_id);
          return (
            <SocialCard>
              <CardHeader
                title={item.display_name}
                avatarUri={item.avatar_url}
                onPress={() => router.push(`/member/${publicId}`)}
              />
              <Button label="View profile" onPress={() => router.push(`/member/${publicId}`)} secondary compact />
            </SocialCard>
          );
        }}
      />
    </Screen>
  );
}

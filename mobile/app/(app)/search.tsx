import { useState } from "react";
import { FlatList, Text } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Heading, Input, Screen } from "@/components/ui";
import { fallbackPublicId } from "@/types/profile";

type SearchProfile = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
};

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    setError(null);
    const q = query.trim();
    if (!q) return;

    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("user_id,public_id,display_name,avatar_url")
      .eq("is_published", true)
      .or(`display_name.ilike.%${q}%,public_id.ilike.%${q}%`)
      .order("display_name", { ascending: true })
      .limit(40);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setResults((data ?? []) as SearchProfile[]);
  }

  return (
    <Screen>
      <Card>
        <Heading>Search members</Heading>
        <Body>Find people by public ID or name.</Body>
        <Input placeholder="Try HH-... or a name" value={query} onChangeText={setQuery} />
        <Button label="Search" onPress={runSearch} />
        {error ? <Body>{error}</Body> : null}
      </Card>

      <FlatList<SearchProfile>
        data={results}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
        renderItem={({ item }) => {
          const publicId = item.public_id ?? fallbackPublicId(item.user_id);
          return (
            <Card>
              <Text style={{ fontWeight: "700" }}>{item.display_name}</Text>
              <Body>{publicId}</Body>
              <Button label="View profile" onPress={() => router.push(`/member/${publicId}`)} secondary />
            </Card>
          );
        }}
        ListEmptyComponent={query ? <Body>No matching profiles.</Body> : null}
      />
    </Screen>
  );
}

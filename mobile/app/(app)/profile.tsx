import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Heading, Input, Screen } from "@/components/ui";
import { fallbackPublicId } from "@/types/profile";

type ProfileRow = {
  display_name: string;
  nationality: string;
  bio: string | null;
};

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [nationality, setNationality] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name,nationality,bio")
        .eq("user_id", user.id)
        .maybeSingle();

      const row = (data ?? null) as ProfileRow | null;
      if (!row) return;

      setDisplayName(row.display_name ?? "");
      setNationality(row.nationality ?? "");
      setBio(row.bio ?? "");
    }

    void load();
  }, [user]);

  async function save() {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, nationality, bio: bio || null, is_published: true })
      .eq("user_id", user.id);

    if (error) {
      setStatus(error.message);
      return;
    }

    await refreshProfile();
    setStatus("Profile saved.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/sign-in");
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 80 }}>
        <Card>
          <Heading>{profile?.display_name ?? "Profile"}</Heading>
          <Body>{profile?.public_id ?? (user ? fallbackPublicId(user.id) : "-")}</Body>
        </Card>

        <Card>
          <Input placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
          <Input placeholder="Nationality" value={nationality} onChangeText={setNationality} />
          <Input placeholder="Bio" value={bio} onChangeText={setBio} multiline />
          <Button label="Save profile" onPress={save} />
          {status ? <Text>{status}</Text> : null}
        </Card>

        <Card>
          <Button label="Open onboarding" onPress={() => router.push("/onboarding")} secondary />
          <Button label="Sign out" onPress={signOut} secondary />
        </Card>
      </ScrollView>
    </Screen>
  );
}

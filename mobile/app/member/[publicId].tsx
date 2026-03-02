import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";
import { supabase } from "@/lib/supabase";
import { Body, Card, Heading, Screen } from "@/components/ui";

type ProfileRow = {
  display_name: string;
  public_id: string | null;
  nationality: string;
  age_years: number;
  bio: string | null;
  gender: string;
  sexual_preference: string;
};

export default function MemberProfileScreen() {
  const params = useLocalSearchParams<{ publicId: string }>();
  const publicId = String(params.publicId ?? "").toUpperCase();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name,public_id,nationality,age_years,bio,gender,sexual_preference")
        .eq("public_id", publicId)
        .eq("is_published", true)
        .maybeSingle();

      if (error) {
        setError(error.message);
        return;
      }

      setProfile((data as ProfileRow | null) ?? null);
    }

    if (publicId) {
      void load();
    }
  }, [publicId]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 80 }}>
        {!profile && !error ? (
          <Body>Loading profile...</Body>
        ) : null}

        {error ? <Body>{error}</Body> : null}

        {profile ? (
          <Card>
            <Heading>{profile.display_name}</Heading>
            <Body>{profile.public_id}</Body>
            <Text>Nationality: {profile.nationality}</Text>
            <Text>Age: {profile.age_years}</Text>
            <Text>Gender: {profile.gender}</Text>
            <Text>Preference: {profile.sexual_preference}</Text>
            {profile.bio ? <Body>{profile.bio}</Body> : null}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

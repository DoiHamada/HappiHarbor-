import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Heading, InlineStatus, Input, Screen } from "@/components/ui";
import { GENDER_OPTIONS, LANGUAGE_OPTIONS, SEXUAL_PREFERENCE_OPTIONS, normalizeToken, titleize } from "@/types/profile";

export default function OnboardingScreen() {
  const { user, refreshProfile } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [nationality, setNationality] = useState("");
  const [ageYears, setAgeYears] = useState("18");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<string>("prefer_not_to_say");
  const [sexualPreference, setSexualPreference] = useState<string>("prefer_not_to_say");
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("35");
  const [languageText, setLanguageText] = useState("english");
  const [languages, setLanguages] = useState<string[]>(["english"]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: "danger" | "success" | "default" } | null>(null);

  useEffect(() => {
    if (!user) router.replace("/(auth)/sign-in");
  }, [user]);

  const dedupLanguages = useMemo(() => Array.from(new Set(languages.map(normalizeToken).filter(Boolean))), [languages]);

  function addLanguage() {
    const next = normalizeToken(languageText);
    if (!next) return;
    setLanguages((current) => Array.from(new Set([...current, next])));
    setLanguageText("");
  }

  async function save() {
    if (!user) return;
    setLoading(true);
    setStatus(null);

    try {
      const age = Number(ageYears);
      let min = Number(minAge);
      let max = Number(maxAge);

      if (age < 18) {
        min = Math.max(13, Math.min(min, 17));
        max = Math.max(min, Math.min(max, 17));
      } else {
        min = Math.max(18, min);
        max = Math.max(min, max);
      }

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          display_name: displayName,
          age_years: age,
          gender,
          nationality,
          sexual_preference: sexualPreference,
          height_cm: 165,
          weight_kg: 60,
          skin_tone: "prefer_not_to_say",
          avatar_key: "harbor-bear-01",
          avatar_url: null,
          bio: bio || null,
          is_published: true
        },
        { onConflict: "user_id" }
      );
      if (profileError) throw profileError;

      const { error: prefError } = await supabase.from("preferences").upsert(
        {
          user_id: user.id,
          min_age: min,
          max_age: max,
          preferred_languages: dedupLanguages,
          preferred_genders: null,
          preferred_nationalities: null,
          use_appearance_filters: false,
          appearance_filters: {}
        },
        { onConflict: "user_id" }
      );
      if (prefError) throw prefError;

      await refreshProfile();
      router.replace("/(app)/matches");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save onboarding.";
      setStatus({ text: message, tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 28 }}>
        <Card>
          <Heading>Profile onboarding</Heading>
          <Body>Complete required profile fields to unlock matches and chat.</Body>
        </Card>

        <Card>
          <Input placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
          <Input placeholder="Nationality" value={nationality} onChangeText={setNationality} />
          <Input
            placeholder="Age"
            value={ageYears}
            onChangeText={setAgeYears}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Input placeholder="Bio (optional)" value={bio} onChangeText={setBio} multiline />

          <Text>Gender</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {GENDER_OPTIONS.map((option) => (
              <Button
                key={option}
                label={titleize(option)}
                onPress={() => setGender(option)}
                secondary={gender !== option}
              />
            ))}
          </View>

          <Text>Sexual preference</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {SEXUAL_PREFERENCE_OPTIONS.map((option) => (
              <Button
                key={option}
                label={titleize(option)}
                onPress={() => setSexualPreference(option)}
                secondary={sexualPreference !== option}
              />
            ))}
          </View>

          <Input placeholder="Preferred min age" value={minAge} onChangeText={setMinAge} keyboardType="number-pad" />
          <Input placeholder="Preferred max age" value={maxAge} onChangeText={setMaxAge} keyboardType="number-pad" />

          <Text>Languages you speak</Text>
          <Input placeholder="Add language" value={languageText} onChangeText={setLanguageText} />
          <Button label="Add language" onPress={addLanguage} secondary />
          <Body>{dedupLanguages.length > 0 ? dedupLanguages.map(titleize).join(", ") : LANGUAGE_OPTIONS.join(", ")}</Body>

          <Button label={loading ? "Saving..." : "Save profile"} onPress={save} disabled={loading || !displayName || !nationality} />
          {status ? <InlineStatus text={status.text} tone={status.tone} /> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

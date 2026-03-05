import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Body, Button, Card, Heading, InlineStatus, Input, Screen, SectionTitle } from "@/components/ui";
import { TagPicker } from "@/components/tag-picker";
import {
  GENDER_OPTIONS,
  LANGUAGE_OPTIONS,
  ONBOARDING_TAG_OPTIONS,
  type OnboardingTagKey,
  SEXUAL_PREFERENCE_OPTIONS,
  normalizeToken,
  titleize
} from "@/types/profile";
import { colors } from "@/lib/theme";

type SectionKey = "basic" | "meet" | "tags" | "privacy";

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

type ProfileRow = {
  display_name: string;
  age_years: number;
  gender: string;
  sexual_preference: string;
  bio: string | null;
};

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

function DropdownSelect({
  label,
  options,
  value,
  onSelect
}: {
  label: string;
  options: readonly string[];
  value: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 11,
          backgroundColor: "#fff"
        }}
      >
        <Text style={{ color: colors.text }}>{titleize(value)}</Text>
      </Pressable>
      {open ? (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden", backgroundColor: "#fff" }}>
          {options.map((option, index) => (
            <Pressable
              key={option}
              onPress={() => {
                onSelect(option);
                setOpen(false);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderBottomWidth: index === options.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
                backgroundColor: option === value ? colors.primarySoft : "#fff"
              }}
            >
              <Text style={{ color: colors.text }}>{titleize(option)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CategorySection({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <Pressable onPress={onToggle} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <SectionTitle title={title} />
        </View>
        <Text style={{ color: colors.muted, fontWeight: "700" }}>{open ? "Hide" : "Open"}</Text>
      </Pressable>
      {open ? <View style={{ gap: 10 }}>{children}</View> : null}
    </Card>
  );
}

function AgeRangeBar({ minAge, maxAge }: { minAge: number; maxAge: number }) {
  const minPct = Math.max(0, Math.min(100, ((minAge - 13) / (100 - 13)) * 100));
  const maxPct = Math.max(0, Math.min(100, ((maxAge - 13) / (100 - 13)) * 100));

  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 999, overflow: "hidden" }}>
        <View
          style={{
            position: "absolute",
            left: `${minPct}%`,
            right: `${100 - maxPct}%`,
            top: 0,
            bottom: 0,
            backgroundColor: colors.primary
          }}
        />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>Range: {minAge} - {maxAge}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const { user, refreshProfile } = useSession();

  const [displayName, setDisplayName] = useState("");
  const [nationality] = useState("Prefer not to say");
  const [ageYears, setAgeYears] = useState("18");
  const [gender, setGender] = useState<string>("prefer_not_to_say");
  const [sexualPreference, setSexualPreference] = useState<string>("prefer_not_to_say");
  const [bio, setBio] = useState("");

  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("35");
  const [languageText, setLanguageText] = useState("english");
  const [languages, setLanguages] = useState<string[]>(["english"]);

  const [selectedTags, setSelectedTags] = useState<Record<OnboardingTagKey, string[]>>(createEmptyTagSelection);

  const [showAge, setShowAge] = useState(true);
  const [showSexualPreference, setShowSexualPreference] = useState(true);

  const [openSection, setOpenSection] = useState<SectionKey | null>("basic");
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [statusBySection, setStatusBySection] = useState<Partial<Record<SectionKey, { text: string; tone: "danger" | "success" | "default" }>>>({});

  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/sign-in");
      return;
    }
    const userId = user.id;

    async function loadExisting() {
      setLoadingInitial(true);
      const [{ data: profileRow }, { data: prefRow }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name,age_years,gender,sexual_preference,nationality,bio")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("preferences")
          .select("min_age,max_age,preferred_languages,profile_tags,profile_visibility")
          .eq("user_id", userId)
          .maybeSingle()
      ]);

      const profile = (profileRow ?? null) as ProfileRow | null;
      const pref = (prefRow ?? null) as PreferenceRow | null;

      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setAgeYears(String(profile.age_years ?? 18));
        setGender(profile.gender ?? "prefer_not_to_say");
        setSexualPreference(profile.sexual_preference ?? "prefer_not_to_say");
        setBio(profile.bio ?? "");
      }

      if (pref) {
        setMinAge(String(pref.min_age ?? 18));
        setMaxAge(String(pref.max_age ?? 35));
        const langs = (pref.preferred_languages ?? ["english"]).map((v) => normalizeToken(String(v))).filter(Boolean);
        setLanguages(langs.length ? langs : ["english"]);
        setSelectedTags(tagsToSelectedMap(pref.profile_tags));
        setShowAge(pref.profile_visibility?.show_age ?? true);
        setShowSexualPreference(pref.profile_visibility?.show_sexual_preference ?? true);
      }

      setLoadingInitial(false);
    }

    void loadExisting();
  }, [user]);

  const dedupLanguages = useMemo(() => Array.from(new Set(languages.map(normalizeToken).filter(Boolean))), [languages]);

  function addLanguage() {
    const next = normalizeToken(languageText);
    if (!next) return;
    setLanguages((current) => Array.from(new Set([...current, next])));
    setLanguageText("");
  }

  async function saveBasicSection() {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          display_name: displayName,
          age_years: Number(ageYears),
          gender,
          sexual_preference: sexualPreference,
          nationality,
          bio: bio || null,
          height_cm: 165,
          weight_kg: 60,
          skin_tone: "prefer_not_to_say",
          avatar_key: "harbor-bear-01",
          avatar_url: null,
          is_published: true
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      setStatusBySection((prev) => ({ ...prev, basic: { text: "Basic info saved.", tone: "success" } }));
    } catch (error) {
      setStatusBySection((prev) => ({ ...prev, basic: { text: error instanceof Error ? error.message : "Failed to save basic info.", tone: "danger" } }));
    } finally {
      setLoading(false);
    }
  }

  async function saveMeetSection() {
    if (!user) return;
    setLoading(true);
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

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ sexual_preference: sexualPreference })
        .eq("user_id", user.id);
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

      setStatusBySection((prev) => ({ ...prev, meet: { text: "Meeting preferences saved.", tone: "success" } }));
    } catch (error) {
      setStatusBySection((prev) => ({ ...prev, meet: { text: error instanceof Error ? error.message : "Failed to save meeting preferences.", tone: "danger" } }));
    } finally {
      setLoading(false);
    }
  }

  async function saveTagsSection() {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("preferences").upsert(
        {
          user_id: user.id,
          profile_tags: selectedTags
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      setStatusBySection((prev) => ({ ...prev, tags: { text: "Interest tags saved.", tone: "success" } }));
    } catch (error) {
      setStatusBySection((prev) => ({ ...prev, tags: { text: error instanceof Error ? error.message : "Failed to save tags.", tone: "danger" } }));
    } finally {
      setLoading(false);
    }
  }

  async function savePrivacySection() {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("preferences").upsert(
        {
          user_id: user.id,
          profile_visibility: {
            show_age: showAge,
            show_sexual_preference: showSexualPreference
          }
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      setStatusBySection((prev) => ({ ...prev, privacy: { text: "Privacy visibility saved.", tone: "success" } }));
    } catch (error) {
      setStatusBySection((prev) => ({ ...prev, privacy: { text: error instanceof Error ? error.message : "Failed to save privacy settings.", tone: "danger" } }));
    } finally {
      setLoading(false);
    }
  }

  async function finishOnboarding() {
    await Promise.all([saveBasicSection(), saveMeetSection(), saveTagsSection(), savePrivacySection()]);
    await refreshProfile();
    router.replace("/(app)/matches");
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 28 }}>
        <Card>
          <Heading>Profile onboarding</Heading>
          <Body>Open each list, update your info, and save in each section.</Body>
          {loadingInitial ? <Body>Loading existing info...</Body> : null}
        </Card>

        <CategorySection
          title="1. Name, Age, Gender"
          open={openSection === "basic"}
          onToggle={() => setOpenSection((current) => (current === "basic" ? null : "basic"))}
        >
          <Input placeholder="Display Name" value={displayName} onChangeText={setDisplayName} />
          <Input placeholder="Age" value={ageYears} onChangeText={setAgeYears} keyboardType="number-pad" maxLength={3} />
          <DropdownSelect label="Gender" options={GENDER_OPTIONS} value={gender} onSelect={setGender} />
          <Input placeholder="Bio (optional)" value={bio} onChangeText={setBio} multiline />
          <Button label={loading ? "Saving..." : "Save Basic Info"} onPress={saveBasicSection} disabled={loading || !displayName} />
          {statusBySection.basic ? <InlineStatus text={statusBySection.basic.text} tone={statusBySection.basic.tone} /> : null}
        </CategorySection>

        <CategorySection
          title="2. Who do you want to meet with"
          open={openSection === "meet"}
          onToggle={() => setOpenSection((current) => (current === "meet" ? null : "meet"))}
        >
          <DropdownSelect
            label="Sexual Preference"
            options={SEXUAL_PREFERENCE_OPTIONS}
            value={sexualPreference}
            onSelect={setSexualPreference}
          />

          <Text style={{ color: colors.text, fontWeight: "700" }}>Matching age range</Text>
          <AgeRangeBar minAge={Number(minAge || 18)} maxAge={Number(maxAge || 35)} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input placeholder="Min" value={minAge} onChangeText={setMinAge} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Input placeholder="Max" value={maxAge} onChangeText={setMaxAge} keyboardType="number-pad" />
            </View>
          </View>

          <Text style={{ color: colors.text, fontWeight: "700" }}>Languages you speak</Text>
          <Input placeholder="Add language" value={languageText} onChangeText={setLanguageText} />
          <Button label="Add language" onPress={addLanguage} secondary compact />
          <Body>{dedupLanguages.length > 0 ? dedupLanguages.map(titleize).join(", ") : LANGUAGE_OPTIONS.join(", ")}</Body>

          <Button label={loading ? "Saving..." : "Save Meeting Preferences"} onPress={saveMeetSection} disabled={loading} />
          {statusBySection.meet ? <InlineStatus text={statusBySection.meet.text} tone={statusBySection.meet.tone} /> : null}
        </CategorySection>

        <CategorySection
          title="3. Interest Tags"
          open={openSection === "tags"}
          onToggle={() => setOpenSection((current) => (current === "tags" ? null : "tags"))}
        >
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
          <Button label={loading ? "Saving..." : "Save Interest Tags"} onPress={saveTagsSection} disabled={loading} />
          {statusBySection.tags ? <InlineStatus text={statusBySection.tags.text} tone={statusBySection.tags.tone} /> : null}
        </CategorySection>

        <CategorySection
          title="4. Privacy Visibility"
          open={openSection === "privacy"}
          onToggle={() => setOpenSection((current) => (current === "privacy" ? null : "privacy"))}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>Show age</Text>
            <Switch value={showAge} onValueChange={setShowAge} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>Show sexual preference</Text>
            <Switch value={showSexualPreference} onValueChange={setShowSexualPreference} />
          </View>

          <Button label={loading ? "Saving..." : "Save Privacy Visibility"} onPress={savePrivacySection} disabled={loading} />
          {statusBySection.privacy ? <InlineStatus text={statusBySection.privacy.text} tone={statusBySection.privacy.tone} /> : null}
        </CategorySection>

        <Card>
          <Button label={loading ? "Please wait..." : "Finish Onboarding"} onPress={finishOnboarding} disabled={loading} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

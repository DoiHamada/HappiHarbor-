import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GENDER_OPTIONS, SEXUAL_PREFERENCE_OPTIONS, SKIN_TONE_OPTIONS } from "@/types/profile";
import { saveOnboarding } from "./actions";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  if (!user.email_confirmed_at) {
    return (
      <section className="mx-auto max-w-xl">
        <div className="card space-y-3">
          <h1 className="text-xl font-bold">Verify your email first</h1>
          <p className="text-sm text-harbor-ink/75">
            Matching is locked until your email is confirmed. Check your inbox, then refresh.
          </p>
        </div>
      </section>
    );
  }

  const [{ data: profile }, { data: preferences }, { data: avatars }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("avatar_presets")
      .select("key,label")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
  ]);

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="card space-y-2">
        <h1 className="text-2xl font-bold">Profile onboarding</h1>
        <p className="text-sm text-harbor-ink/75">
          Complete your profile and preferences. Appearance filters are optional and tucked under
          Preferences.
        </p>
      </div>

      <form action={saveOnboarding} className="card grid gap-4">
        <div className="grid gap-3 rounded-xl border border-harbor-ink/10 bg-white p-4">
          <p className="label">Profile avatar</p>
          <div className="flex items-center gap-4">
            <img
              src={profile?.avatar_url ?? "/logo-mark.svg"}
              alt="Current profile avatar"
              className="h-16 w-16 rounded-full border border-harbor-ink/10 object-cover"
            />
            <div className="text-xs text-harbor-ink/70">
              Upload a JPG or PNG image (max 5MB). If none is uploaded, preset avatar is used.
            </div>
          </div>
          <input className="input file:mr-3 file:rounded-full file:border-0 file:bg-harbor-cream file:px-3 file:py-1 file:text-xs file:font-semibold" name="avatar_file" type="file" accept="image/jpeg,image/png" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="label">Display name</label>
            <input className="input" name="display_name" defaultValue={profile?.display_name ?? ""} required />
          </div>
          <div className="space-y-1">
            <label className="label">Nationality</label>
            <input className="input" name="nationality" defaultValue={profile?.nationality ?? ""} required />
          </div>
          <div className="space-y-1">
            <label className="label">Age</label>
            <input
              className="input"
              name="age_years"
              type="number"
              min={13}
              max={100}
              defaultValue={profile?.age_years ?? 18}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="label">Gender</label>
            <select className="input" name="gender" defaultValue={profile?.gender ?? "prefer_not_to_say"}>
              {GENDER_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Sexual preference</label>
            <select
              className="input"
              name="sexual_preference"
              defaultValue={profile?.sexual_preference ?? "prefer_not_to_say"}
            >
              {SEXUAL_PREFERENCE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Skin tone</label>
            <select className="input" name="skin_tone" defaultValue={profile?.skin_tone ?? "prefer_not_to_say"}>
              {SKIN_TONE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Height (cm)</label>
            <input
              className="input"
              name="height_cm"
              type="number"
              min={100}
              max={250}
              defaultValue={profile?.height_cm ?? 165}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="label">Weight (kg)</label>
            <input
              className="input"
              name="weight_kg"
              type="number"
              min={30}
              max={300}
              step="0.1"
              defaultValue={profile?.weight_kg ?? 60}
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="label">Preset avatar</label>
          <select className="input" name="avatar_key" defaultValue={profile?.avatar_key ?? avatars?.[0]?.key} required>
            {(avatars ?? []).map((avatar) => (
              <option key={avatar.key} value={avatar.key}>
                {avatar.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="label">Bio (optional)</label>
          <textarea className="input min-h-24" name="bio" defaultValue={profile?.bio ?? ""} />
        </div>

        <div className="grid gap-4 rounded-xl border border-harbor-ink/10 bg-harbor-cream/50 p-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="label">Preferred age min</label>
            <input
              className="input"
              name="min_age"
              type="number"
              min={13}
              max={100}
              defaultValue={preferences?.min_age ?? 18}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="label">Preferred age max</label>
            <input
              className="input"
              name="max_age"
              type="number"
              min={13}
              max={100}
              defaultValue={preferences?.max_age ?? 35}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="label">Preferred genders (comma-separated)</label>
            <input
              className="input"
              name="preferred_genders"
              defaultValue={preferences?.preferred_genders?.join(", ") ?? ""}
              placeholder="female, male"
            />
          </div>
          <div className="space-y-1">
            <label className="label">Preferred nationalities (comma-separated)</label>
            <input
              className="input"
              name="preferred_nationalities"
              defaultValue={preferences?.preferred_nationalities?.join(", ") ?? ""}
              placeholder="Singaporean, Thai"
            />
          </div>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              name="use_appearance_filters"
              defaultChecked={preferences?.use_appearance_filters ?? false}
            />
            Enable advanced appearance filters (optional)
          </label>

          <div className="space-y-1">
            <label className="label">Appearance min height (cm)</label>
            <input
              className="input"
              name="appearance_min_height_cm"
              type="number"
              min={100}
              max={250}
              defaultValue={preferences?.appearance_filters?.min_height_cm ?? ""}
            />
          </div>
          <div className="space-y-1">
            <label className="label">Appearance max height (cm)</label>
            <input
              className="input"
              name="appearance_max_height_cm"
              type="number"
              min={100}
              max={250}
              defaultValue={preferences?.appearance_filters?.max_height_cm ?? ""}
            />
          </div>
          <div className="space-y-1">
            <label className="label">Appearance min weight (kg)</label>
            <input
              className="input"
              name="appearance_min_weight_kg"
              type="number"
              min={30}
              max={300}
              step="0.1"
              defaultValue={preferences?.appearance_filters?.min_weight_kg ?? ""}
            />
          </div>
          <div className="space-y-1">
            <label className="label">Appearance max weight (kg)</label>
            <input
              className="input"
              name="appearance_max_weight_kg"
              type="number"
              min={30}
              max={300}
              step="0.1"
              defaultValue={preferences?.appearance_filters?.max_weight_kg ?? ""}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="label">Appearance skin tones (comma-separated)</label>
            <input
              className="input"
              name="appearance_skin_tones"
              defaultValue={preferences?.appearance_filters?.skin_tones?.join(", ") ?? ""}
              placeholder="light, medium"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_published" defaultChecked={profile?.is_published ?? false} />
          Publish my profile for matching
        </label>

        <button className="btn w-full md:w-fit" type="submit">
          Save profile
        </button>
      </form>
    </section>
  );
}

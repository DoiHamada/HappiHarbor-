import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GENDER_OPTIONS, SEXUAL_PREFERENCE_OPTIONS, type OnboardingTagKey } from "@/types/profile";
import { saveOnboarding } from "./actions";
import { PreferenceControls } from "./preference-controls";

function titleize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

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

  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("preferences").select("*").eq("user_id", user.id).maybeSingle()
  ]);

  const preferredLanguages = (preferences?.preferred_languages ?? []) as string[];
  const preferenceTagsRaw = preferences?.profile_tags as Partial<Record<OnboardingTagKey, unknown>> | null;
  const preferenceTags: Partial<Record<OnboardingTagKey, string[]>> = {};

  if (preferenceTagsRaw && typeof preferenceTagsRaw === "object") {
    for (const key of Object.keys(preferenceTagsRaw) as OnboardingTagKey[]) {
      const value = preferenceTagsRaw[key];
      if (Array.isArray(value)) {
        preferenceTags[key] = value.map((item) => String(item)).filter(Boolean);
      }
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="card space-y-2">
        <h1 className="text-2xl font-bold">Profile onboarding</h1>
        <p className="text-sm text-harbor-ink/75">
          Name and gender are required. New users receive a preset avatar automatically, and you can upload your own photo at any time.
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
              Upload a JPG or PNG image (max 5MB). If none is uploaded, your preset avatar stays active.
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
            <select className="input" name="gender" defaultValue={profile?.gender ?? "prefer_not_to_say"} required>
              {GENDER_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {titleize(value)}
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
                  {titleize(value)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="label">Bio (optional)</label>
          <textarea className="input min-h-24" name="bio" defaultValue={profile?.bio ?? ""} />
        </div>

        <PreferenceControls
          initialMinAge={preferences?.min_age ?? 18}
          initialMaxAge={preferences?.max_age ?? 35}
          initialLanguages={preferredLanguages}
          initialTags={preferenceTags}
        />

        <button className="btn w-full md:w-fit" type="submit">
          Save profile
        </button>
      </form>
    </section>
  );
}

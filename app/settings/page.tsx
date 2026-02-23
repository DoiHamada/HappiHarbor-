import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  return (
    <section className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-harbor-ink/75">Manage profile, privacy, and account preferences here.</p>
      </div>
    </section>
  );
}

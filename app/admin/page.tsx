import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const isAdmin = user.app_metadata?.role === "admin";

  if (!isAdmin) {
    return (
      <section className="mx-auto max-w-2xl">
        <div className="card">
          <h1 className="text-xl font-bold">Admin only</h1>
          <p className="mt-2 text-sm text-harbor-ink/75">You do not have admin privileges.</p>
        </div>
      </section>
    );
  }

  const [{ data: reports }, { data: flags }, { data: actions }] = await Promise.all([
    supabase.from("reports").select("id,reason,status,created_at").order("created_at", { ascending: false }).limit(20),
    supabase
      .from("moderation_flags")
      .select("id,source,label,status,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("moderation_actions")
      .select("id,action,reason,target_user_id,created_at")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  return (
    <section className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-bold">Moderation dashboard</h1>
        <p className="text-sm text-harbor-ink/75">MVP admin queue: reports, flags, and moderation actions.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-2">
          <h2 className="font-semibold">Reports</h2>
          {(reports ?? []).length === 0 ? (
            <p className="text-sm text-harbor-ink/70">No reports.</p>
          ) : (
            (reports ?? []).map((row) => (
              <p key={row.id} className="text-sm">
                {row.reason} - {row.status}
              </p>
            ))
          )}
        </div>

        <div className="card space-y-2">
          <h2 className="font-semibold">Flags</h2>
          {(flags ?? []).length === 0 ? (
            <p className="text-sm text-harbor-ink/70">No flags.</p>
          ) : (
            (flags ?? []).map((row) => (
              <p key={row.id} className="text-sm">
                {row.source} - {row.status}
              </p>
            ))
          )}
        </div>

        <div className="card space-y-2">
          <h2 className="font-semibold">Actions</h2>
          {(actions ?? []).length === 0 ? (
            <p className="text-sm text-harbor-ink/70">No actions.</p>
          ) : (
            (actions ?? []).map((row) => (
              <p key={row.id} className="text-sm">
                {row.action} on {row.target_user_id}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

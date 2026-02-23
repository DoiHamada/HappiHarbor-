import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
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
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="mt-2 text-sm text-harbor-ink/75">Your direct conversations will appear here.</p>
      </div>
    </section>
  );
}

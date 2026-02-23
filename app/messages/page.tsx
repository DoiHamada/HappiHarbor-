import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const sampleThreads = [
  { id: "t1", name: "Jamie Rivera", preview: "Loved your harbor photo. Coffee this weekend?", time: "10m" },
  { id: "t2", name: "Avery Chen", preview: "Your ramen post made me hungry.", time: "1h" },
  { id: "t3", name: "Morgan Lee", preview: "Thanks for the thoughtful message yesterday.", time: "3h" }
];

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
      <div className="card flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="mt-1 text-sm text-harbor-ink/75">Open your conversations from the main message box.</p>
        </div>
        <Link href="/discover" className="btn-secondary no-underline">
          Back to Discover
        </Link>
      </div>
      <div className="grid gap-3">
        {sampleThreads.map((thread) => (
          <article key={thread.id} className="card">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{thread.name}</p>
              <span className="text-xs text-harbor-ink/60">{thread.time}</span>
            </div>
            <p className="mt-2 text-sm text-harbor-ink/80">{thread.preview}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

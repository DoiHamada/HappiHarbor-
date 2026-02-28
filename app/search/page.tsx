import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type SearchProfileRow = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
};

function fallbackPublicId(userId: string): string {
  return `HH-${userId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function escapeLike(value: string): string {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = (await searchParams) ?? {};
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  let results: SearchProfileRow[] = [];

  if (q) {
    const normalized = escapeLike(q);
    const profileQuery = supabase
      .from("profiles")
      .select("user_id,public_id,display_name,avatar_url")
      .eq("is_published", true)
      .order("display_name", { ascending: true })
      .limit(40);

    const { data } = isUuid(q)
      ? await profileQuery.or(`display_name.ilike.%${normalized}%,public_id.ilike.%${normalized}%,user_id.eq.${q}`)
      : await profileQuery.or(`display_name.ilike.%${normalized}%,public_id.ilike.%${normalized}%`);

    results = (data ?? []) as SearchProfileRow[];
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="card space-y-2">
        <h1 className="text-xl font-semibold">Search members</h1>
        <p className="text-sm text-harbor-ink/75">Find people by user ID or display name.</p>
        <form method="get" className="flex gap-2">
          <input name="q" className="input" defaultValue={q} placeholder="Try HH-1234... or a name" required />
          <button className="btn" type="submit">
            Search
          </button>
        </form>
      </div>

      {q && (results.length === 0 ? (
        <div className="card text-sm text-harbor-ink/75">No profiles matched your search.</div>
      ) : (
        <div className="grid gap-3">
          {results.map((profile) => {
            const publicId = profile.public_id ?? fallbackPublicId(profile.user_id);
            return (
              <Link key={profile.user_id} href={`/profile/${publicId}`} className="card flex items-center gap-3 no-underline">
                <img
                  src={profile.avatar_url ?? "/logo-mark.svg"}
                  alt={`${profile.display_name} avatar`}
                  className="h-11 w-11 rounded-full border border-harbor-ink/10 object-cover"
                />
                <div>
                  <p className="text-sm font-semibold">{profile.display_name}</p>
                  <p className="text-xs text-harbor-ink/70">{publicId}</p>
                </div>
              </Link>
            );
          })}
        </div>
      ))}
    </section>
  );
}

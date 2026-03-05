import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SocialNotificationRow = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string;
  type: "reaction" | "comment" | "profile_view" | "follow";
  post_id: string | null;
  reaction: string | null;
  details: string | null;
  is_read: boolean;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  public_id: string | null;
  display_name: string;
  avatar_url: string | null;
};

function fallbackPublicId(userId: string): string {
  return `HH-${userId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: notifications } = await supabase
    .from("social_notifications")
    .select("id,recipient_user_id,actor_user_id,type,post_id,reaction,details,is_read,created_at")
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(80);

  const typedNotifications = (notifications ?? []) as SocialNotificationRow[];
  const profileViewCountByActor = typedNotifications
    .filter((item) => item.type === "profile_view")
    .reduce<Map<string, number>>((acc, item) => {
      acc.set(item.actor_user_id, (acc.get(item.actor_user_id) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

  const seenProfileViewActor = new Set<string>();
  const displayNotifications = typedNotifications.filter((item) => {
    if (item.type !== "profile_view") return true;
    if (seenProfileViewActor.has(item.actor_user_id)) return false;
    seenProfileViewActor.add(item.actor_user_id);
    return true;
  });

  if (typedNotifications.some((n) => !n.is_read)) {
    const unreadIds = typedNotifications.filter((n) => !n.is_read).map((n) => n.id);
    await supabase.from("social_notifications").update({ is_read: true }).in("id", unreadIds);
  }

  const actorIds = Array.from(new Set(typedNotifications.map((n) => n.actor_user_id)));
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("user_id,public_id,display_name,avatar_url").in("user_id", actorIds)
    : { data: [] };

  const actorById = new Map<string, ProfileRow>((actors ?? []).map((row) => [row.user_id, row as ProfileRow]));

  return (
    <section className="space-y-4">
      <div className="card space-y-2">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-harbor-ink/75">Social activity only: reactions, comments, and profile views.</p>
      </div>

      {displayNotifications.length === 0 ? (
        <div className="card text-sm text-harbor-ink/75">No social notifications yet.</div>
      ) : (
        <div className="grid gap-3">
          {displayNotifications.map((item) => {
            const actor = actorById.get(item.actor_user_id);
            const actorName = actor?.display_name ?? "Member";
            const actorPublicId = actor ? actor.public_id ?? fallbackPublicId(actor.user_id) : null;

            let title = "Profile activity";
            if (item.type === "reaction") {
              title = `${actorName} reacted ${item.reaction ?? ""} to your post`;
            } else if (item.type === "comment") {
              title = `${actorName} commented on your post`;
            } else if (item.type === "profile_view") {
              const views = profileViewCountByActor.get(item.actor_user_id) ?? 1;
              title = `${actorName} viewed your profile (${views} ${views === 1 ? "time" : "times"})`;
            } else if (item.type === "follow") {
              title = `${actorName} followed you`;
            }

            return (
              <div key={item.id} className="card flex items-start gap-3">
                <img
                  src={actor?.avatar_url ?? "/logo-mark.svg"}
                  alt={`${actorName} avatar`}
                  className="h-10 w-10 rounded-full border border-harbor-ink/10 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{title}</p>
                  {item.details ? <p className="text-xs text-harbor-ink/70">{item.details}</p> : null}
                  <p className="mt-1 text-xs text-harbor-ink/60">
                    {new Date(item.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                </div>
                {actorPublicId ? (
                  <Link href={`/profile/${actorPublicId}`} className="btn-secondary no-underline">
                    View profile
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

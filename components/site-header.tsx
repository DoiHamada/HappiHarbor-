import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";
import { AppNav } from "@/components/app-nav";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isAdmin = user?.app_metadata?.role === "admin";
  let profileHref = "/onboarding";
  let conversationIds: string[] = [];
  let initialUnreadCount = 0;

  if (user) {
    const [{ data: myProfile }, { data: conversations }, { data: unreadCountRaw }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("public_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("conversations")
          .select("id")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .limit(200),
        supabase.rpc("unread_conversation_message_count", { p_user: user.id })
      ]);

    profileHref = myProfile?.public_id ? `/profile/${myProfile.public_id}` : "/onboarding";
    conversationIds = (conversations ?? []).map((row) => row.id);
    initialUnreadCount = Number(unreadCountRaw ?? 0);
  }

  return (
    <header className="border-b border-black/5 bg-[#f6f4f1]">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 py-5">
        <BrandLogo />
        {!user ? (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/auth?mode=sign_in" className="hidden no-underline text-harbor-ink md:inline-flex">
              Log in
            </Link>
            <Link
              href="/auth?mode=sign_up"
              className="inline-flex items-center rounded-full bg-[#ec9f29] px-5 py-2 font-semibold text-white no-underline transition hover:brightness-95"
            >
              Join Now
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <AppNav
              userId={user.id}
              profileHref={profileHref}
              initialUnreadCount={initialUnreadCount}
              conversationIds={conversationIds}
            />
            {isAdmin && <Link href="/admin">Admin</Link>}
            <Link href="/auth/signout" className="btn-secondary no-underline">
              Sign out
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

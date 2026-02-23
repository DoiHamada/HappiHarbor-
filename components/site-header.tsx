import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isAdmin = user?.app_metadata?.role === "admin";

  return (
<<<<<<< HEAD
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
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/discover">Discover</Link>
            <Link href="/messages">Messages</Link>
            <Link href="/settings">Settings</Link>
            <Link href="/onboarding">Profile</Link>
            <Link href="/matches">Matches</Link>
            {isAdmin && <Link href="/admin">Admin</Link>}
=======
    <header className="border-b border-harbor-ink/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold no-underline">
          HappiHarbor
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {!user && <Link href="/auth">Sign in</Link>}
          {user && <Link href="/onboarding">Profile</Link>}
          {user && <Link href="/matches">Matches</Link>}
          {user && <Link href="/messages">Messages</Link>}
          {user && <Link href="/feed">Feed</Link>}
          {isAdmin && <Link href="/admin">Admin</Link>}
          {user && (
>>>>>>> message-box
            <Link href="/auth/signout" className="btn-secondary no-underline">
              Sign out
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

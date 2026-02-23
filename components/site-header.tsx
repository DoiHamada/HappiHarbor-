import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isAdmin = user?.app_metadata?.role === "admin";

  return (
    <header className="border-b border-harbor-ink/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold no-underline">
          HappiHarbor
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {!user && <Link href="/auth">Sign in</Link>}
          {user && <Link href="/discover">Discover</Link>}
          {user && <Link href="/messages">Messages</Link>}
          {user && <Link href="/onboarding">Profile</Link>}
          {user && <Link href="/matches">Matches</Link>}
          {user && <Link href="/settings">Settings</Link>}
          {isAdmin && <Link href="/admin">Admin</Link>}
          {user && (
            <Link href="/auth/signout" className="btn-secondary no-underline">
              Sign out
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

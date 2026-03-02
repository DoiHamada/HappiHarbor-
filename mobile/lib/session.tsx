import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type ProfileState = {
  user_id: string;
  public_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_published: boolean | null;
  is_suspended: boolean | null;
};

type SessionContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileState | null;
  refreshProfile: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileState | null>(null);

  async function refreshProfileForUser(userId: string | null) {
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("user_id,public_id,display_name,avatar_url,is_published,is_suspended")
      .eq("user_id", userId)
      .maybeSingle();

    setProfile((data as ProfileState | null) ?? null);
  }

  async function refreshProfile() {
    await refreshProfileForUser(session?.user.id ?? null);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await refreshProfileForUser(data.session?.user.id ?? null);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await refreshProfileForUser(nextSession?.user.id ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile
    }),
    [loading, session, profile]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

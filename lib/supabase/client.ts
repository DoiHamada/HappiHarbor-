"use client";

import { createBrowserClient } from "@supabase/ssr";
import { processLock } from "@supabase/supabase-js";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        // Avoid Navigator LockManager timeouts in some browser contexts.
        lock: processLock,
        lockAcquireTimeout: -1
      }
    }
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MessagesLiveUpdatesProps = {
  userId: string;
  conversationIds: string[];
};

export function MessagesLiveUpdates({ userId, conversationIds }: MessagesLiveUpdatesProps) {
  const router = useRouter();
  const conversationSet = useMemo(() => new Set(conversationIds), [conversationIds]);
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    if (conversationSet.size === 0) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`messages-live-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages"
        },
        (payload) => {
          const row = payload.new as { conversation_id?: string; sender_id?: string };
          if (!row?.conversation_id || !row?.sender_id) return;
          if (row.sender_id === userId) return;
          if (!conversationSet.has(row.conversation_id)) return;

          const now = Date.now();
          if (now - lastRefreshRef.current < 600) return;
          lastRefreshRef.current = now;
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_messages"
        },
        (payload) => {
          const row = payload.new as { conversation_id?: string; sender_id?: string };
          if (!row?.conversation_id || !row?.sender_id) return;
          if (!conversationSet.has(row.conversation_id)) return;
          if (row.sender_id !== userId) return;

          const now = Date.now();
          if (now - lastRefreshRef.current < 600) return;
          lastRefreshRef.current = now;
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationSet, router, userId]);

  return null;
}

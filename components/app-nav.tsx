"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AppNavProps = {
  userId: string;
  profileHref: string;
  initialUnreadCount: number;
  conversationIds: string[];
};

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
};

function iconClass(active: boolean): string {
  return active ? "text-[#ec9f29]" : "text-harbor-ink/70";
}

function DiscoverIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${iconClass(active)}`} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2Zm0 2c-1.31 0-2.57.26-3.72.73.57.84 1.06 1.89 1.42 3.09h4.6c.36-1.2.85-2.25 1.42-3.09A9.94 9.94 0 0 0 12 4Zm5.9 3.93c-.77.37-1.5.72-2.17.94.17.71.29 1.45.36 2.21h3.81a7.94 7.94 0 0 0-1.99-3.15ZM4.09 11.08H7.9c.07-.76.19-1.5.36-2.21-.67-.22-1.4-.57-2.17-.94a7.94 7.94 0 0 0-1.99 3.15Zm0 1.84a7.94 7.94 0 0 0 1.99 3.15c.77-.37 1.5-.72 2.17-.94a13.2 13.2 0 0 1-.36-2.21H4.09Zm5.61 0c.08 1.61.44 3.1 1.03 4.34.41.85.86 1.47 1.27 1.86.41-.39.86-1.01 1.27-1.86.59-1.24.95-2.73 1.03-4.34H9.7Zm4.6-1.84c-.08-1.61-.44-3.1-1.03-4.34-.41-.85-.86-1.47-1.27-1.86-.41.39-.86 1.01-1.27 1.86-.59 1.24-.95 2.73-1.03 4.34h4.6Zm1.99 1.84a13.2 13.2 0 0 1-.36 2.21c.67.22 1.4.57 2.17.94a7.94 7.94 0 0 0 1.99-3.15h-3.8Zm-6.59 5.99c-1.15-.47-2.41-.73-3.72-.73 1.16 1.12 2.73 1.82 4.44 1.82-.24-.24-.48-.56-.72-.94Zm3.02-.73c-.24.38-.48.7-.72.94 1.71 0 3.28-.7 4.44-1.82-1.31 0-2.57.26-3.72.73Z"
      />
    </svg>
  );
}

function MessagesIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${iconClass(active)}`} aria-hidden="true">
      <path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 5h12V7H6v2Zm0 4h8v-2H6v2Z" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${iconClass(active)}`} aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 3a7.5 7.5 0 1 1 4.79 13.27l4.22 4.22-1.41 1.41-4.22-4.22A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${iconClass(active)}`} aria-hidden="true">
      <path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.24-9 5v3h18v-3c0-2.76-4-5-9-5Z" />
    </svg>
  );
}

function MatchesIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${iconClass(active)}`} aria-hidden="true">
      <path fill="currentColor" d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
    </svg>
  );
}

function NotificationsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${iconClass(active)}`} aria-hidden="true">
      <path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.71V3a2 2 0 1 0-4 0v1.29A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" />
    </svg>
  );
}

function playMessagePing() {
  try {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 920;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.start(now);
    osc.stop(now + 0.21);
    void ctx.close();
  } catch {
    // Best-effort audio notification.
  }
}

export function AppNav({ userId, profileHref, initialUnreadCount, conversationIds }: AppNavProps) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const conversationSetRef = useRef(new Set(conversationIds));

  useEffect(() => {
    conversationSetRef.current = new Set(conversationIds);
  }, [conversationIds]);

  useEffect(() => {
    if (pathname.startsWith("/messages")) {
      setUnreadCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`message-inbox-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages"
        },
        (payload) => {
          const row = payload.new as { sender_id?: string; conversation_id?: string };
          if (!row?.sender_id || !row?.conversation_id) return;
          if (row.sender_id === userId) return;
          if (!conversationSetRef.current.has(row.conversation_id)) return;
          if (pathname.startsWith("/messages")) return;

          setUnreadCount((value) => value + 1);
          playMessagePing();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pathname, userId]);

  const navItems = useMemo<NavItem[]>(
    () => [
      { href: "/discover", label: "Discover", icon: <DiscoverIcon active={pathname.startsWith("/discover")} /> },
      { href: "/search", label: "Search", icon: <SearchIcon active={pathname.startsWith("/search")} /> },
      {
        href: "/messages",
        label: "Messages",
        icon: <MessagesIcon active={pathname.startsWith("/messages")} />,
        badge: unreadCount > 0 ? unreadCount : undefined
      },
      { href: profileHref, label: "Profile", icon: <ProfileIcon active={pathname.startsWith("/profile") || pathname.startsWith("/onboarding")} /> },
      { href: "/matches", label: "Matches", icon: <MatchesIcon active={pathname.startsWith("/matches")} /> },
      { href: "/notifications", label: "Notifications", icon: <NotificationsIcon active={pathname.startsWith("/notifications")} /> }
    ],
    [pathname, profileHref, unreadCount]
  );

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full no-underline transition ${
              active ? "bg-[#fff0db]" : "hover:bg-black/5"
            }`}
          >
            {item.icon}
            {item.badge ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
            <span className="sr-only">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

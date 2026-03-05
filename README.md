# HappiHarbor

HappiHarbor is a safety-first social dating platform: no swipe UX, compatibility-first matching, private chat, social feed, and profile/privacy controls.

This repository contains:
- A **Next.js web app** (`/app`, `/components`, `/lib`)
- A **React Native mobile app** using **Expo Router** (`/mobile`)
- A shared **Supabase backend schema and migrations** (`/supabase/migrations`)

## Product Spec and Current Scope

- Product specification: [HappiHarbor_Project_Spec.md](/Users/doipantsin/myprojects/DatingApp/HappiHarbor_Project_Spec.md)
- Tagline: **Your Harbor for Happier Love**
- Core principles:
  - Safety-first
  - Meaningful matching over swiping
  - Privacy and user control
  - Calm, modern UI

Current implementation extends the original MVP with:
- Web + mobile parity for major social features
- Follow/unfollow system
- Feed interactions (love + comments)
- Profile media (avatar/cover) support
- Notification badges and social notifications

## Tech Stack

### Web
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Supabase SSR (`@supabase/ssr`, `@supabase/supabase-js`)

### Mobile
- Expo SDK 54 + React Native 0.81
- Expo Router
- TypeScript
- Supabase JS client + AsyncStorage session persistence

### Backend
- Supabase Auth + Postgres + Storage + Realtime
- SQL migrations managed in `/supabase/migrations`
- RLS-enabled data model

## Monorepo Layout

```text
.
├── app/                     # Next.js routes (web)
├── components/              # Shared web UI components
├── lib/                     # Web Supabase clients + middleware helpers
├── mobile/                  # Expo app
│   ├── app/                 # Expo Router routes
│   ├── components/          # Mobile UI primitives and social components
│   ├── lib/                 # Session, matching, Supabase client, theme
│   └── types/               # Mobile profile enums/helpers
├── supabase/
│   ├── migrations/          # Source-of-truth schema changes
│   ├── SCHEMA_RLS_SPEC.md   # RLS and schema notes
│   └── SUPABASE_NEXT_STEPS.md
└── HappiHarbor_Project_Spec.md
```

## Web App Overview

### Key routes (`/app`)
- `/` landing and redirect logic
- `/auth` sign in / sign up
- `/onboarding` profile and preference setup
- `/discover` social discovery stream
- `/feed` post creation/management actions
- `/matches` compatibility/match list
- `/messages` chat inbox and live conversation updates
- `/notifications` social notifications (non-chat)
- `/profile/[publicId]` public profile pages
- `/search` user lookup by public ID or name
- `/admin` moderation/admin surface

### Web backend wiring
- Server/client Supabase helpers:
  - [lib/supabase/server.ts](/Users/doipantsin/myprojects/DatingApp/lib/supabase/server.ts)
  - [lib/supabase/client.ts](/Users/doipantsin/myprojects/DatingApp/lib/supabase/client.ts)
  - [lib/supabase/middleware.ts](/Users/doipantsin/myprojects/DatingApp/lib/supabase/middleware.ts)
- Route actions (examples):
  - [app/discover/actions.ts](/Users/doipantsin/myprojects/DatingApp/app/discover/actions.ts)
  - [app/feed/actions.ts](/Users/doipantsin/myprojects/DatingApp/app/feed/actions.ts)
  - [app/messages/actions.ts](/Users/doipantsin/myprojects/DatingApp/app/messages/actions.ts)
  - [app/profile/actions.ts](/Users/doipantsin/myprojects/DatingApp/app/profile/actions.ts)

## Mobile App Overview

### Navigation model (`/mobile/app`)
- Root stack: [mobile/app/_layout.tsx](/Users/doipantsin/myprojects/DatingApp/mobile/app/_layout.tsx)
- Launch gate: [mobile/app/index.tsx](/Users/doipantsin/myprojects/DatingApp/mobile/app/index.tsx)
- Auth: `/(auth)/sign-in`
- Main tabs under `/(app)`:
  - `sail` (landing tab, top tab pager for Moments + Harbor)
  - `discover`
  - `messages`
  - `notifications`
  - `profile`
  - hidden routes: `matches`, `search`
- Extra routes:
  - `/member/[publicId]` public user profile view
  - `/chat/[conversationId]` direct chat screen
  - `/onboarding`

### Mobile architecture highlights
- Session provider and profile bootstrap:
  - [mobile/lib/session.tsx](/Users/doipantsin/myprojects/DatingApp/mobile/lib/session.tsx)
- Supabase client:
  - [mobile/lib/supabase.ts](/Users/doipantsin/myprojects/DatingApp/mobile/lib/supabase.ts)
- Matching score helper:
  - [mobile/lib/matching.ts](/Users/doipantsin/myprojects/DatingApp/mobile/lib/matching.ts)
- Shared social UI components:
  - [mobile/components/social.tsx](/Users/doipantsin/myprojects/DatingApp/mobile/components/social.tsx)

## Data Model and Supabase

Main tables used by current web/mobile code:
- `profiles`, `preferences`
- `matches`, `follows`
- `conversations`, `conversation_messages`, `conversation_reads`
- `feed_posts`, `feed_post_reactions`, `feed_post_comments`
- `social_notifications`
- moderation/safety tables (`reports`, `moderation_flags`, `moderation_actions`, `blocks`)

Storage buckets used by app code:
- `profile-avatars`
- `profile-covers`
- `feed-photos`

## Migration history

Apply all migrations in order from:
- [supabase/migrations](/Users/doipantsin/myprojects/DatingApp/supabase/migrations)

Notable recent migrations:
- `20260304112000_add_follows_system.sql` (follow/unfollow table + RPCs)
- `20260304123000_replace_friend_request_notification_type_with_follow.sql` (notification enum cleanup)

## Setup

### 1) Environment variables

Create local env files from templates (do not commit secrets):

- Web (`.env.local`)
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - optional: `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - optional landing links:
    - `NEXT_PUBLIC_IOS_APP_URL`
    - `NEXT_PUBLIC_ANDROID_APP_URL`

- Mobile (`mobile/.env`)
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

If keys were ever exposed publicly, rotate them in Supabase.

### 2) Supabase migration sync

From repo root:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Alternative: run migration SQL in Supabase SQL Editor.

### 3) Install dependencies

Web:
```bash
npm install
```

Mobile:
```bash
cd mobile
npm install
npx expo install --fix
```

## Run Locally

### Web
```bash
npm run dev
```

### Mobile
```bash
cd mobile
npm run start -- --lan -c
```

If LAN is unstable, use tunnel:
```bash
npx expo start -c --tunnel
```

## Typecheck

Web:
```bash
npm run typecheck
```

Mobile:
```bash
cd mobile
npm run typecheck
```

## Source Code Guide

### Web UI composition
- Layout + branding:
  - [app/layout.tsx](/Users/doipantsin/myprojects/DatingApp/app/layout.tsx)
  - [components/site-header.tsx](/Users/doipantsin/myprojects/DatingApp/components/site-header.tsx)
  - [components/brand-logo.tsx](/Users/doipantsin/myprojects/DatingApp/components/brand-logo.tsx)
- Profile surfaces:
  - [components/profile-card.tsx](/Users/doipantsin/myprojects/DatingApp/components/profile-card.tsx)
- Messaging live UI:
  - [components/messages-live-updates.tsx](/Users/doipantsin/myprojects/DatingApp/components/messages-live-updates.tsx)

### Mobile UI composition
- Theme + tokens:
  - [mobile/lib/theme.ts](/Users/doipantsin/myprojects/DatingApp/mobile/lib/theme.ts)
- Base components:
  - [mobile/components/ui.tsx](/Users/doipantsin/myprojects/DatingApp/mobile/components/ui.tsx)
  - [mobile/components/social.tsx](/Users/doipantsin/myprojects/DatingApp/mobile/components/social.tsx)
  - [mobile/components/tag-picker.tsx](/Users/doipantsin/myprojects/DatingApp/mobile/components/tag-picker.tsx)
- App identity and launch:
  - [mobile/components/app-logo.tsx](/Users/doipantsin/myprojects/DatingApp/mobile/components/app-logo.tsx)
  - [mobile/components/launch-screen.tsx](/Users/doipantsin/myprojects/DatingApp/mobile/components/launch-screen.tsx)

## Security and Privacy Notes

- Supabase RLS is expected for all sensitive tables.
- Client code must only use publishable keys.
- Service role keys are server-only.
- Follow/message/notification behavior depends on latest migrations being applied.
- See:
  - [supabase/SCHEMA_RLS_SPEC.md](/Users/doipantsin/myprojects/DatingApp/supabase/SCHEMA_RLS_SPEC.md)
  - [supabase/SUPABASE_NEXT_STEPS.md](/Users/doipantsin/myprojects/DatingApp/supabase/SUPABASE_NEXT_STEPS.md)

## Known Development Pitfalls

- **Expo Go / SDK mismatch**: iOS Expo Go supports latest SDK only. Keep `mobile/package.json` aligned with installed Expo Go.
- **Node version**: very new Node versions can cause install/resolution issues. Prefer current LTS for Expo workflows.
- **Tunnel instability**: `--tunnel` can drop due to ngrok connectivity. Retry or use `--lan` on same network.
- **Supabase media visibility**: if uploaded media is missing, verify bucket policies and signed URL usage in code.

## Deployment Notes

### Web
- Deploy on any Next.js-compatible host.
- Ensure production env vars are set.

### Mobile
- Build and submit with EAS or native build tooling.
- Once store URLs exist, set:
  - `NEXT_PUBLIC_IOS_APP_URL`
  - `NEXT_PUBLIC_ANDROID_APP_URL`
  so the web landing page download CTA points to real app stores.

---

For feature requirements and acceptance criteria, use the product spec as the primary source:
[HappiHarbor_Project_Spec.md](/Users/doipantsin/myprojects/DatingApp/HappiHarbor_Project_Spec.md)

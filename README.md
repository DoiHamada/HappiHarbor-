# HappiHarbor Web (Phase 1 Scaffold)

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase SSR client (`@supabase/ssr`, `@supabase/supabase-js`)

## Implemented in this scaffold
- Auth page with:
  - Email/password sign up and sign in
  - Google OAuth button
- Email confirmation callback route (`/auth/confirm`)
- Sign out route (`/auth/signout`)
- Middleware-based session refresh and route gating
- Onboarding page wired to `profiles` + `preferences` upsert
- Preset avatar selection from `avatar_presets`
- Under-18/18+ preference bounds normalization in onboarding action
- Matches page scaffold from `matches` table
- Basic admin dashboard page from moderation tables

## 1) Apply database migration first
Run the migration SQL in Supabase SQL Editor:
- `/Users/doipantsin/Desktop/DatingApp/supabase/migrations/20260220210000_happiharbor_initial.sql`

## 2) Environment
Copy `.env.example` to `.env.local` and set real values.

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## 3) Install and run
```bash
npm install
npm run dev
```

## 4) Auth provider setup in Supabase
- Email provider: enabled
- Confirm email: enabled
- Google provider: enabled with client ID/secret
- Redirect URL includes:
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/auth/reset-password`
- Recovery email template should link with token hash (works across browsers/devices):
  - `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=%2Fauth%2Freset-password`

## 5) First admin
Assign admin claim in `auth.users.raw_app_meta_data`:
```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'your-admin-email@example.com';
```
Sign out/in after that.

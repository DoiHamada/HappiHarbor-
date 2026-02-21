# Supabase Setup + Implementation Guide (HappiHarbor)

This guide assumes your Supabase project already exists.

## 1. Security first
- Your publishable key can be used on the client, but never expose the `service_role` key in frontend code.
- If any sensitive key was shared in an unsafe place, rotate it in Supabase Dashboard.

## 2. Apply the schema migration
You have a ready migration file:
- `/Users/doipantsin/Desktop/DatingApp/supabase/migrations/20260220210000_happiharbor_initial.sql`

### Option A: Supabase SQL Editor (fastest now)
1. Open your project dashboard.
2. Go to **SQL Editor**.
3. Paste the migration SQL and run it.
4. Confirm all tables/policies exist in **Database > Tables**.

### Option B: Supabase CLI (recommended long term)
1. Install/login CLI.
2. In workspace root:
   - `supabase init` (if not initialized)
   - `supabase link --project-ref jugdevagxmqfqviapzit`
   - `supabase db push`

## 3. Configure Auth providers
In **Authentication > Providers**:
1. Enable **Email** provider.
2. Enable **Confirm email** (required before matching).
3. Enable **Google** provider and set Google OAuth client ID/secret.
4. Add redirect URLs for local and production web app:
   - `http://localhost:3000/auth/confirm`
   - `http://localhost:3000/auth/reset-password`

## 4. Create your first admin user claim
RLS admin policies rely on JWT `app_metadata.role = "admin"`.

Run this SQL in SQL Editor (replace with your auth user id):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id = 'YOUR_ADMIN_AUTH_USER_UUID';
```

Then sign out and sign back in so a fresh JWT includes the admin claim.

## 5. Verify RLS behavior
Use SQL Editor and app testing accounts:
1. Create two normal users and one admin user.
2. Confirm users can only edit their own `profiles` and `preferences`.
3. Confirm minors (`age_years < 18`) cannot be matched with adults.
4. Confirm unpublished profiles are not visible to other non-admin users.
5. Confirm messaging works only for `mutual` matches.
6. Confirm reports create moderation flags automatically.
7. Confirm admin can view/update moderation queues and actions.

## 6. Realtime and chat
`matches` and `messages` are added to `supabase_realtime` publication in migration.

In app code, subscribe to:
- `public:messages` filtered by `match_id`
- `public:matches` filtered by current user participation

## 7. Minimal frontend env setup (Next.js)
Create `.env.local` in web app with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://jugdevagxmqfqviapzit.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

## 8. Recommended immediate implementation order
1. Auth screens + email verification gate.
2. Profile + preferences onboarding.
3. Match list API integration.
4. Chat UI with Realtime.
5. Report/block flows.
6. Admin moderation dashboard.

## 9. Known MVP constraints to keep
- Preset avatars only.
- No swipe UX.
- Rule-based matching (no LLM yet).
- Appearance filters are optional and tucked under Preferences.
- Under-18 can only match under-18.

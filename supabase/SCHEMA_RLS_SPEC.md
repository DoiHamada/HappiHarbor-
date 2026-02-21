# HappiHarbor Supabase Schema + RLS Spec

This document maps the concrete SQL in:
- `/Users/doipantsin/Desktop/DatingApp/supabase/migrations/20260220210000_happiharbor_initial.sql`

## 1. Tables

### `public.avatar_presets`
Purpose: preset avatar catalog for MVP.

Columns:
- `key` (PK)
- `label`
- `asset_path`
- `is_active`
- `sort_order`
- `created_at`

### `public.profiles`
Purpose: core user profile and discoverability state.

Columns:
- `user_id` (PK, FK -> `auth.users.id`)
- `display_name`
- `age_years`
- `gender`
- `nationality`
- `sexual_preference`
- `height_cm`
- `weight_kg`
- `skin_tone`
- `avatar_key` (FK -> `avatar_presets.key`)
- `bio`
- `is_published`
- `is_suspended`
- timestamps

### `public.preferences`
Purpose: matching preferences and optional appearance filters.

Columns:
- `user_id` (PK, FK -> `profiles.user_id`)
- `min_age`, `max_age`
- `preferred_genders` (array)
- `preferred_nationalities` (array)
- `use_appearance_filters` (bool)
- `appearance_filters` (jsonb)
- timestamps

### `public.matches`
Purpose: non-swipe matching records and match state.

Columns:
- `id` (PK)
- `user_a`, `user_b` (FK -> `profiles.user_id`)
- `status` (`pending|mutual|closed`)
- `created_by`
- `score` (rule-based matching score)
- `explanation` (jsonb array)
- `matched_at`, `closed_reason`
- timestamps

Constraints/logic:
- unique pair (`user_a`, `user_b`)
- trigger normalizes pair ordering and validates eligibility

### `public.messages`
Purpose: secure 1:1 chat per mutual match.

Columns:
- `id` (PK)
- `match_id` (FK)
- `sender_id` (FK)
- `content`
- `status` (`sent|edited|deleted`)
- timestamps + `deleted_at`

### `public.reports`
Purpose: user safety reports.

Columns:
- `id` (PK)
- `reporter_user_id`
- optional targets (`target_user_id`, `target_match_id`, `target_message_id`)
- `reason`, `details`
- `status`
- review metadata
- timestamps

Rules:
- at least one target is required
- insert trigger creates related `moderation_flags` row

### `public.moderation_flags`
Purpose: queue for automated/user-generated moderation signals.

Columns:
- `id` (PK)
- `source` (`auto_text_toxicity|auto_behavior|user_report`)
- `label`, `score`
- optional targets + `report_id`
- `status`
- review metadata
- timestamps

### `public.moderation_actions`
Purpose: admin enforcement actions.

Columns:
- `id` (PK)
- `target_user_id`
- `action` (`warn|restrict|suspend|ban`)
- `reason`
- `duration_hours` (required for `restrict`)
- `performed_by`
- `created_at`

Rules:
- trigger auto-suspends profile for `suspend` and `ban`

### `public.blocks`
Purpose: block relationships and safety enforcement.

Columns:
- composite PK (`blocker_user_id`, `blocked_user_id`)
- `reason`
- `active`
- timestamps

Rules:
- no self-block
- block status is checked by matching and messaging eligibility functions

## 2. Matching & Safety Functions

- `public.is_admin()`
  - reads JWT claim `app_metadata.role == 'admin'`
- `public.is_user_verified(user_id)`
  - requires `auth.users.email_confirmed_at` not null
- `public.are_users_blocked(user_a, user_b)`
  - checks active blocks both directions
- `public.is_pair_eligible(user_a, user_b)`
  - enforces publish state, suspension, verification, block checks, preference checks, and strict under-18/18+ separation
- `public.can_access_match(match_id)`
  - participants or admin
- `public.can_send_message(match_id, sender_id)`
  - only participants in `mutual` match and not blocked

## 3. RLS Policy Matrix

### `avatar_presets`
- `SELECT`: authenticated users can read active presets; admin can read all

### `profiles`
- `SELECT`: own profile, admin, or published non-suspended profiles
- `INSERT`: own row only
- `UPDATE`: own row or admin
- Trigger guard: non-admin cannot modify `is_suspended`

### `preferences`
- `SELECT/INSERT/UPDATE`: own row or admin

### `matches`
- `SELECT`: participants or admin
- `INSERT`: participant or admin, plus eligibility check
- `UPDATE`: admin only

### `messages`
- `SELECT`: match participants or admin
- `INSERT`: only via `can_send_message()`
- `UPDATE`: sender or admin

### `reports`
- `SELECT`: reporter or admin
- `INSERT`: reporter must equal `auth.uid()`
- `UPDATE`: admin only

### `blocks`
- `SELECT`: blocker or admin
- `INSERT`: blocker must equal `auth.uid()`
- `UPDATE/DELETE`: blocker or admin

### `moderation_flags`
- `SELECT/INSERT/UPDATE`: admin only

### `moderation_actions`
- `SELECT/INSERT`: admin only (`performed_by = auth.uid()` enforced on insert)

## 4. Realtime
`public.matches` and `public.messages` are added to `supabase_realtime` publication for live updates.

## 5. MVP Compliance Mapping
- Non-swipe matching: `matches` + rule-based score/explanation
- Preset avatars only: `avatar_presets` + FK from `profiles.avatar_key`
- Under-18 segregation: enforced in `is_pair_eligible()`
- Email verification gate: enforced in matching eligibility
- Appearance filters optional/minimized: stored in optional `preferences.appearance_filters`
- Automated + manual moderation: `moderation_flags`, `reports`, `moderation_actions`
- Basic admin dashboard backend support: moderation tables + admin-only policies

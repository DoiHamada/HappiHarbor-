# HappiHarbor Product & MVP Specification

**Tagline:** "Your Harbor for Happier Love."  
**MVP Region:** Southeast Asia  
**Phase 1 Platform:** Responsive Web App (Next.js)  
**Phase 2 Platform:** iOS & Android (React Native)

## 1. Product Vision
HappiHarbor is a safety-first dating platform designed for meaningful connections without swipe mechanics. Matching is private and system-assisted. Users have direct control over profile visibility and can represent themselves using preset avatars in MVP.

## 2. Core Product Principles
- User safety first
- Clean, cute, and calming UI
- AI-based smart matching (rule-based scoring in MVP)
- Secure messaging
- Privacy and user control over discoverability

## 3. MVP Scope

### 3.1 Authentication & Access
- Email/password registration and login
- Google login
- Email verification required before matching access
- Session management through Supabase Auth
- Password reset flow
- Age policy:
  - Users under 18 can only match with under-18 users
  - Users 18+ can only match with 18+ users

### 3.2 User Profile System
Required profile fields:
- Name
- Age
- Gender
- Nationality
- Sexual preference
- Appearance (minimal for MVP):
  - Weight
  - Height
  - Skin tone
- Avatar selection:
  - Preset avatars only in MVP (no custom upload)

Profile state:
- Draft profile (not matchable)
- Published profile (eligible for matching)
- Users can choose whether to publish profile

### 3.3 Matching System (No Swipe Interface)
Matching will be private and recommendation-based.

Input preferences:
- Age range
- Gender preference
- Nationality preference
- Appearance preferences (optional, minimized in UI)

UX rule for appearance filters:
- Keep appearance filters optional
- Hide advanced appearance filtering under **Preferences**
- Product emphasis is compatibility-first, not physical filtering

MVP matching model:
- Rule-based scoring in Phase 1
- No LLM dependency in MVP
- LLM-enhanced matching planned for later phases

Matching logic baseline:
- Hard filters: age eligibility bracket, mutual gender/sexual preference compatibility
- Soft scoring: nationality preference, declared compatibility signals, profile completeness
- Ranked private match suggestions shown as curated list/cards
- Mutual eligibility required for chat unlock

### 3.4 Secure Messaging
- One-to-one chat for mutually matched users only
- Transport encryption (HTTPS/TLS)
- At-rest encryption via Supabase/Postgres platform controls
- Block user from chat
- Report directly from chat/profile

### 3.5 Safety & Moderation
MVP includes both automated and manual safety operations.

Safety tools:
- Block user
- Report user/profile/message
- Abuse rate limiting
- Safety policy acceptance during onboarding

Moderation model (MVP):
- Automated moderation:
  - Text toxicity screening
  - Basic suspicious behavior flagging
- Manual review:
  - Admin queue for flagged/reported accounts/content
  - Admin actions with audit logs

### 3.6 Basic Admin Dashboard (Included in MVP)
Admin capabilities:
- View reported users/messages/profiles
- View auto-flagged moderation events
- Review queue with status (open, in review, resolved)
- Apply actions:
  - Warn
  - Temporary restrict
  - Suspend
  - Ban
- Record action reason and timestamp
- View moderation history/audit log

## 4. Tech Stack Requirements

### Frontend
- Next.js (React + TypeScript)
- Tailwind CSS with soft pastel theme
- Responsive UI for mobile and desktop web

### Backend
- Supabase:
  - Auth
  - Postgres
  - Row Level Security (RLS)
  - Realtime (chat)
  - Edge Functions (matching + moderation workflows)

## 5. Functional Requirements

### Authentication
- Unverified users cannot access matching and messaging
- Email verification state is enforced server-side

### Profile Management
- Required fields validated on client and server
- Profile publish toggle controls discoverability
- Draft-saving supported

### Matching
- Matching is non-swipe and recommendation-driven
- Rule-based scoring service generates ranked candidates
- Recompute on:
  - Profile changes
  - Preference changes
  - Scheduled refresh
- Under-18 and 18+ matching separation strictly enforced

### Messaging
- Only mutual matches can message
- Blocking revokes message permissions immediately
- Reports can be submitted from active conversations

### Safety & Admin
- Automated moderation flags unsafe content/behavior
- Admin dashboard supports triage and enforcement actions
- All moderation actions are auditable

## 6. Non-Functional Requirements

### Security
- RLS on all sensitive tables
- Server-side authorization checks for every write
- Input sanitization and abuse protection
- Encrypted transport and encrypted at-rest data

### Privacy
- Users choose whether to publish profile
- Minimal appearance filtering prominence in UX
- Clear controls for blocking/reporting and account deletion

### Performance
- Responsive experience on low-to-mid mobile devices in Southeast Asia
- Match suggestion API p95 target under 500ms (with caching/precompute where needed)

### Accessibility & UI Quality
- Cute, clean, soft-pastel visual style
- WCAG AA contrast goals
- Keyboard navigation support for key flows

## 7. High-Level Data Model (MVP)
- `profiles` (user identity and discoverability status)
- `preferences` (matching preferences including optional appearance settings)
- `matches` (pairing state and eligibility)
- `messages` (chat content and metadata)
- `reports` (user-submitted reports)
- `moderation_flags` (automated detections)
- `moderation_actions` (manual admin actions + audit trail)
- `blocks` (block relationships)

## 8. MVP Acceptance Criteria
1. Users can register/login with email/password and Google.
2. Email verification is required before matching access.
3. Users can create profiles with required fields and choose preset avatars.
4. Users can keep profile private or publish it.
5. Matching is non-swipe and generated via rule-based ranking.
6. Under-18 users only match under-18; 18+ users only match 18+.
7. Appearance filters are optional, minimized, and placed under Preferences.
8. Mutual matches can securely message.
9. Users can block/report from profile and chat.
10. Automated moderation and manual review both function in MVP.
11. Basic admin dashboard supports queue review and enforcement actions.
12. Web app is responsive across desktop and mobile browsers.

## 9. Post-MVP / Phase 2 Direction
- React Native app for iOS and Android reusing backend services
- LLM-enhanced compatibility intelligence layered onto rule-based foundation
- Push notifications and richer in-chat safety tooling

## 10. Open Implementation Notes
- Legal/regulatory handling for minors must be finalized per target Southeast Asia launch countries.
- Country-specific policy handling (age of consent, data retention, and reporting obligations) should be included before production launch.

## 11. UI Implementation Updates (Current Build)

### 11.1 Landing Page
- Replaced the initial MVP hero with a full marketing-style landing page containing:
  - Hero section with "Real Connection" visual card
  - Social proof stats strip
  - Safety principles cards
  - "Ready to sail" walkthrough section
  - Large call-to-action section
  - Multi-column footer
- Updated "Ready to sail" image card styling to a framed visual with bottom overlay label.

### 11.2 Brand & Logo
- Introduced project SVG logo assets in `public/` and app icon under `app/icon.svg`.
- Applied user-provided sailboat SVG logo as the active logo mark.
- Adjusted sailboat scaling/centering in the logo canvas for better visual alignment.
- Added downloadable logo outputs in `public/` for design handoff and reuse.

### 11.3 Authentication & Header UX
- Updated authentication language and flows toward "Log in" / "Join Now" behavior.
- Added top-level Discover route access for authenticated users in the main header.

### 11.4 Discover Feed (New Page)
- Added `/discover` page (authenticated route).
- Implemented icon-only sidebar navigation for Discover UX.
- Removed "Safety Center" from Discover nav and included "Matching".
- Removed filter button pattern from the Discover header.
- Added search bar that filters posts by user name or user ID.
- Added "Share your thoughts" composer supporting:
  - Text-only thought posts
  - Real image file upload to Supabase Storage (`discover-posts` bucket)
- Discover feed body now renders user-generated style text/photo posts.
- Right panel keeps lightweight insight/safety content without a "Nearby Events" section.

### 11.5 Navigation & Routing Updates
- Default authenticated landing route changed from `/matches` to `/discover`.
- Auth fallback redirect target changed to `/discover`.
- Added linkable authenticated routes:
  - `/messages`
  - `/settings`
- Header navigation now exposes Discover, Messages, Matches, Profile, and Settings for signed-in users.

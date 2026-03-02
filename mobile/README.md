# HappiHarbor Mobile (Expo)

React Native + Expo implementation of the HappiHarbor MVP flows, reusing the same Supabase backend schema used by the web app.

## Implemented screens
- Auth: email/password sign in, sign up, forgot password trigger
- Onboarding: profile + preferences save to `profiles` and `preferences`
- Discover: create text post + list feed posts
- Search: search by display name / public ID
- Matches: list matches + open chat
- Messages: list conversations
- Chat: realtime conversation view and send messages
- Notifications: social notifications list + mark read
- Profile: edit core profile fields + sign out
- Member profile: view published profile by public ID

## Environment
Copy `.env.example` in this folder to `.env` and set:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Run
```bash
cd mobile
npm install
npm start
```

Then press:
- `i` for iOS simulator
- `a` for Android emulator
- or scan QR with Expo Go

## Notes
- This mobile app intentionally mirrors the current web data model and server rules.
- Photo upload/edit and advanced moderation/admin UIs are still web-first and can be added next.

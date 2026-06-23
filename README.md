# Paynest

Paynest is a local-first subscription and recurring-payment tracker for iOS, Android, and web.

## Run locally

```sh
npm install
npm run web
```

Use `npm run ios` or `npm run android` to open the native app through Expo.

## Supabase

The Supabase project URL defaults to `https://xfegnwhtyjqrzlrtvoui.supabase.co`.
To change it later, copy `.env.example` to `.env` and update:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

The anon key is required before the app can create a Supabase client for sync or auth.
Run `supabase/schema.sql` in the Supabase SQL editor to create the sync tables and row-level security policies.
Email/password auth is used from the Settings account section, so keep the Email provider enabled in Supabase Auth.

## Current MVP

- Dashboard with monthly and yearly spending
- Persistent local subscription data
- Add and remove subscriptions with billing period, category, and renewal date
- Spending insight breakdown
- Persistent reminder, theme, and currency preferences
- Adaptive light and dark appearance
- Supabase client configuration with env overrides
- Supabase email/password authentication

Cloud sync and native notification delivery still require Supabase and Expo notification configuration as described in `nc_PLAN.md`.

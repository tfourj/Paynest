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

Supabase CLI migration credentials live separately in `supabase/.env`; see `supabase/README.md`.
The anon key is required before the app can create a Supabase client for sync or auth.
Run `supabase/schema.sql` in the Supabase SQL editor to create the sync tables and row-level security policies.
If you already ran the original schema before sync was added, also run `supabase/migrations/001_add_subscription_local_id.sql` once.
If sync reports `permission denied for table subscriptions`, run `supabase/migrations/002_grant_authenticated_table_access.sql` once.
Email/password auth is used from the Settings account section, so keep the Email provider enabled in Supabase Auth.
Password reset emails use Supabase's configured Site URL and Redirect URLs under Auth URL Configuration.
When signed in, Paynest merges local data with Supabase, keeps the newest subscription by `updatedAt`, and writes new subscription/settings changes to Supabase.

### Check RLS

In the Supabase dashboard, open Table Editor and confirm RLS is enabled for `subscriptions` and `settings`.
Then run this in SQL Editor:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('subscriptions', 'settings');

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('subscriptions', 'settings')
order by tablename, policyname;
```

`rowsecurity` should be `true`, and policies should include `auth.uid() = user_id`.
Avoid creating broad public policies like `using (true)` or `with check (true)` for these tables.

## Current MVP

- Dashboard with monthly and yearly spending
- Persistent local subscription data
- Add and remove subscriptions with billing period, category, renewal date, and reminder settings
- Spending insight breakdown
- Persistent theme and currency preferences
- Local iOS and Android renewal notifications with a settings test action
- Adaptive light and dark appearance
- Supabase client configuration with env overrides
- Supabase email/password authentication
- Supabase sync for subscriptions and settings

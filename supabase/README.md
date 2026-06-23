# Supabase

Paynest uses Supabase for auth and cloud sync.

The app supports either the bundled Paynest Supabase project or a custom Supabase project entered from
Settings -> Account -> Log in/Create account -> Custom.

## Self-hosted Setup

For a self-hosted Supabase instance:

1. Start Supabase and find the public API URL and anon key.
2. Run `supabase/schema.sql` against the database.
3. Enable email/password signups in Auth.
4. Keep email confirmations enabled.
5. Configure SMTP for Auth emails.
6. Add the app URL to the allowed redirect URLs if you customize email templates or deep links.

In the app, choose `Custom` as the provider and enter:

```text
Supabase URL: https://your-supabase-domain.example.com
Anon key: your anon/public key
```

Self-hosted anon keys may be JWT-style keys beginning with `eyJ`, while newer publishable keys may
begin with `sb_`. Never enter a `service_role` key in the app.

The SQL schema enables RLS and creates policies that restrict each user to rows where
`auth.uid() = user_id`.

## Email Auth

Supabase Auth handles email/password login, signup confirmation, and password reset emails when SMTP
is configured. Paynest calls Supabase Auth for login, signup, and reset email delivery. If signup
confirmation is enabled, new users will see a message to confirm their email before signing in.

## Required Env Files

Keep app values in the root `.env` file:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://xfegnwhtyjqrzlrtvoui.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

Keep CLI-only migration values in `supabase/.env`:

```sh
SUPABASE_PROJECT_REF=xfegnwhtyjqrzlrtvoui
SUPABASE_ACCESS_TOKEN=your-personal-access-token
SUPABASE_DB_PASSWORD=your-database-password
```

Only the root `EXPO_PUBLIC_` values are bundled into the app. The `supabase/.env` values are for local migration commands only.
Never add the Supabase `service_role` key to the Expo app.

## Run Migrations

From the repo root:

```sh
npm run db:migrate
```

This loads `supabase/.env`, links the local Supabase folder to `SUPABASE_PROJECT_REF`, then runs `supabase db push`.

If the project is already linked, this is enough:

```sh
npm run db:push
```

## Existing Hosted Project

If you already ran `schema.sql` manually, run this migration once:

```sh
supabase/migrations/001_add_subscription_local_id.sql
```

The migration adds `subscriptions.local_id`, which lets existing device-local subscription IDs map to Supabase rows during sync.

If the app reports `permission denied for table subscriptions`, run this migration too:

```sh
supabase/migrations/002_grant_authenticated_table_access.sql
```

The grant migration gives the `authenticated` role table access. RLS still limits rows to the signed-in user.

## RLS Check

Run this in Supabase SQL Editor:

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

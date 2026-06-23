# Supabase

Paynest uses Supabase for auth and cloud sync.

## Required Env Files

Keep app values in the root `.env` file:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://xfegnwhtyjqrzlrtvoui.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

Keep CLI-only migration values in `supabase/.env`:

```sh
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

This loads `supabase/.env`, links the local Supabase folder to project `xfegnwhtyjqrzlrtvoui`, then runs `supabase db push`.

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

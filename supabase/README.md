# Supabase

Paynest uses Supabase for auth and cloud sync.

## Required Local Env

Keep these in the root `.env` file:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://xfegnwhtyjqrzlrtvoui.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key

SUPABASE_ACCESS_TOKEN=your-personal-access-token
SUPABASE_DB_PASSWORD=your-database-password
```

Only the `EXPO_PUBLIC_` values are bundled into the app. The CLI values are for local migration commands only.
Never add the Supabase `service_role` key to the Expo app.

## Run Migrations

From the repo root:

```sh
npm run db:migrate
```

This loads `.env`, links the local Supabase folder to project `xfegnwhtyjqrzlrtvoui`, then runs `supabase db push`.

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

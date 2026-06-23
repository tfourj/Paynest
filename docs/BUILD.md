# Build And Development

## Requirements

- Node.js
- npm
- Expo CLI through the local `expo` dependency
- Xcode for iOS builds
- Android Studio for Android builds

## Install Dependencies

```sh
npm install
```

## Develop Locally

Start the Expo development server:

```sh
npm run start
```

Run the web app:

```sh
npm run web
```

Run the native iOS app:

```sh
npm run ios
```

Run the native Android app:

```sh
npm run android
```

## Verify

Run the TypeScript check:

```sh
npm run typecheck
```

## Supabase

Paynest works locally without signing in. Supabase is used for optional authentication and sync.

Set the public client values in `.env` when using a different Supabase project:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

Create the database tables and row-level security policies by running `supabase/schema.sql`
in the Supabase SQL editor.

If you are updating an older database, run the migrations in `supabase/migrations/` in order.
Supabase CLI credentials live in `supabase/.env`; see `supabase/README.md` for details.

Link and push Supabase migrations through the project scripts:

```sh
npm run db:link
npm run db:push
```

Run both Supabase steps together:

```sh
npm run db:migrate
```

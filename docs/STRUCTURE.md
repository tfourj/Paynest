# Project Structure

```text
App.tsx             App shell, navigation, state, and sync flow
assets/             App icon and logo assets
docs/               Development and build documentation
pocketbase/         PocketBase setup notes and collection schema
src/components/     Shared UI components and subscription rows
src/screens/        Login, dashboard, subscriptions, insights, settings, and privacy policy
src/buildInfo.ts    App version and build label shown in settings
src/storage.ts      Local AsyncStorage persistence
src/currencyConversion.ts  Exchange-rate loading and local conversion cache
src/pocketbase.ts   PocketBase REST client and auth persistence
src/sync.ts         PocketBase sync mapping and merge logic
src/types.ts        Shared app types and defaults
```

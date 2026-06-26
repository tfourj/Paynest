# Project Structure

```text
App.tsx             App shell, navigation, state, and sync flow
assets/             App icon, Android adaptive icon layers, and logo assets
docs/               Development and build documentation
scripts/            Local development, Expo, and CI build helper scripts
src/components/     Shared UI components and subscription rows
src/screens/        Login, dashboard, subscriptions, insights, settings, and privacy policy
src/buildInfo.ts    App version and build label shown in settings
src/dataTransfer.ts  Subscription export/import serialization and validation helpers
src/encryption.ts   Local encryption envelope, key derivation, and payload crypto helpers
src/encryptionStorage.ts  Device-local secure storage for the encryption password and cached master key
src/storage.ts      Local AsyncStorage persistence
src/currencyConversion.ts  Exchange-rate loading and local conversion cache
src/pocketbase.ts   PocketBase REST client and auth persistence
src/sync.ts         PocketBase plaintext/encrypted sync mapping and merge logic
src/types.ts        Shared app types and defaults
```

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

## PocketBase

Paynest works locally without signing in. PocketBase is used for optional authentication and sync.

Set a default PocketBase URL in `.env` if you want the app to prefill the server URL:

```sh
EXPO_PUBLIC_POCKETBASE_URL=https://your-pocketbase-url
```

The server URL can also be entered in the app from Settings -> Account. Create the required
PocketBase collections and API rules using [pocketbase/README.md](../pocketbase/README.md).

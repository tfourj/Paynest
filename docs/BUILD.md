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

## CI Artifacts

GitHub Actions builds unsigned release artifacts with:

```sh
./scripts/build-unsigned-apk.sh
./scripts/build-unsigned-ipa.sh
```

The APK is written to `build/android/`. The IPA is written to `build/ios/`.
The workflow runs on tag pushes or manual dispatch only. Uploaded artifact names
include the tag name for tag builds or the short commit ID for manual builds.
The Android script builds an unsigned release APK for `arm64-v8a` by default.
Set `REACT_NATIVE_ARCHITECTURES` to override the Android native architectures.
If `android/` or `ios/` is missing, the scripts generate the native project
with Expo prebuild before compiling.
The iOS script also patches CocoaPods `fmt/base.h` to disable consteval on
newer Apple SDKs before running `xcodebuild`.

## PocketBase

Paynest works locally without signing in. PocketBase is used for optional authentication and sync.
Cloud encryption can be enabled from Settings after signing in. When enabled,
the app uploads one encrypted payload instead of readable subscription and
settings records. The PocketBase server still stores account/auth data.

Set a default PocketBase URL in `.env` if you want the app to prefill the server URL:

```sh
EXPO_PUBLIC_POCKETBASE_URL=https://your-pocketbase-url
```

The server URL can also be entered in the app from Settings -> Account.
Use the Paynest PocketBase setup and migrations from:
[github.com/tfourj/Paynest-DB](https://github.com/tfourj/Paynest-DB).

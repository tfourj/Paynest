#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
OUTPUT_DIR="$ROOT_DIR/build/android"
APP_NAME="Paynest"
KEYSTORE_PATH="$OUTPUT_DIR/temp-release.keystore"
KEY_ALIAS="paynest-temp-release"
KEY_PASSWORD="paynest-temp-password"
STORE_PASSWORD="paynest-temp-password"

VERSION="$(node -e "console.log(require(process.argv[1]).version)" "$ROOT_DIR/package.json" 2>/dev/null || printf "0.0.0")"
ARCHITECTURES="${REACT_NATIVE_ARCHITECTURES:-arm64-v8a}"
APK_NAME="${APP_NAME}-${VERSION}-test-signed.apk"

echo "Building test-signed Android APK"
echo "Version: $VERSION"
echo "Architectures: $ARCHITECTURES"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

if [ ! -x "$ANDROID_DIR/gradlew" ]; then
  echo "Generating Android project with Expo prebuild"
  cd "$ROOT_DIR"
  npx expo prebuild --platform android --no-install
fi

ROOT_DIR="$ROOT_DIR" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const buildFile = path.join(process.env.ROOT_DIR, "android", "app", "build.gradle");
const source = fs.readFileSync(buildFile, "utf8");
const lines = source.split(/\r?\n/);
const output = [];
let inRelease = false;
let depth = 0;
let patched = false;

for (const line of lines) {
  const trimmed = line.trim();

  if (!inRelease && trimmed === "release {") {
    inRelease = true;
    depth = 1;
    output.push(line);
    continue;
  }

  if (inRelease) {
    depth += (line.match(/{/g) || []).length;
    depth -= (line.match(/}/g) || []).length;

    if (trimmed === "signingConfig signingConfigs.debug" && !patched) {
      output.push(line.replace("signingConfig signingConfigs.debug", "signingConfig null"));
      patched = true;
      continue;
    }

    if (trimmed === "signingConfig null") {
      patched = true;
    }

    if (depth === 0) {
      inRelease = false;
    }
  }

  output.push(line);
}

if (!patched) {
  throw new Error("Could not disable release signing in android/app/build.gradle");
}

fs.writeFileSync(buildFile, output.join("\n"));
NODE

rm -rf "$ANDROID_DIR/app/.cxx" "$ANDROID_DIR/app/build"

cd "$ANDROID_DIR"
./gradlew :app:assembleRelease \
  -PreactNativeArchitectures="$ARCHITECTURES"

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release-unsigned.apk"
if [ ! -f "$APK_PATH" ]; then
  echo "Missing unsigned APK at $APK_PATH"
  find "$ANDROID_DIR/app/build/outputs/apk" -type f -name "*.apk" -print
  exit 1
fi

ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$ANDROID_SDK" ]; then
  echo "ANDROID_HOME or ANDROID_SDK_ROOT is required to find apksigner"
  exit 1
fi

APKSIGNER="$(ANDROID_SDK="$ANDROID_SDK" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const buildTools = path.join(process.env.ANDROID_SDK, "build-tools");
const versions = fs.existsSync(buildTools)
  ? fs.readdirSync(buildTools, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  : [];

for (const version of versions.reverse()) {
  const candidate = path.join(buildTools, version, process.platform === "win32" ? "apksigner.bat" : "apksigner");
  if (fs.existsSync(candidate)) {
    console.log(candidate);
    break;
  }
}
NODE
)"
if [ -z "$APKSIGNER" ]; then
  echo "Could not find apksigner under $ANDROID_SDK/build-tools"
  exit 1
fi

SIGNED_APK="$OUTPUT_DIR/$APK_NAME"

keytool -genkeypair \
  -keystore "$KEYSTORE_PATH" \
  -storepass "$STORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 3650 \
  -dname "CN=Paynest Temporary Release,O=Paynest,C=US" \
  -noprompt

cp "$APK_PATH" "$SIGNED_APK"
"$APKSIGNER" sign \
  --ks "$KEYSTORE_PATH" \
  --ks-key-alias "$KEY_ALIAS" \
  --ks-pass "pass:$STORE_PASSWORD" \
  --key-pass "pass:$KEY_PASSWORD" \
  "$SIGNED_APK"
"$APKSIGNER" verify "$SIGNED_APK"
rm -f "$KEYSTORE_PATH"

echo "Test-signed APK created at: $SIGNED_APK"

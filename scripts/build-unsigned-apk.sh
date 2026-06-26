#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
OUTPUT_DIR="$ROOT_DIR/build/android"
APP_NAME="Paynest"

VERSION="$(node -e "console.log(require(process.argv[1]).version)" "$ROOT_DIR/package.json" 2>/dev/null || printf "0.0.0")"
ARCHITECTURES="${REACT_NATIVE_ARCHITECTURES:-arm64-v8a}"
APK_NAME="${APP_NAME}-${VERSION}-unsigned.apk"

echo "Building unsigned Android APK"
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

cd "$ANDROID_DIR"
./gradlew clean :app:assembleRelease \
  -PreactNativeArchitectures="$ARCHITECTURES"

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release-unsigned.apk"
if [ ! -f "$APK_PATH" ]; then
  echo "Missing unsigned APK at $APK_PATH"
  find "$ANDROID_DIR/app/build/outputs/apk" -type f -name "*.apk" -print
  exit 1
fi

cp "$APK_PATH" "$OUTPUT_DIR/$APK_NAME"
echo "Unsigned APK created at: $OUTPUT_DIR/$APK_NAME"

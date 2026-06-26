#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build/ios"
PROJECT_NAME="Paynest"
SCHEME_NAME="Paynest"
WORKSPACE_PATH="$ROOT_DIR/ios/${PROJECT_NAME}.xcworkspace"
ARCHIVE_PATH="$BUILD_DIR/${PROJECT_NAME}.xcarchive"

VERSION="$(node -e "console.log(require(process.argv[1]).version)" "$ROOT_DIR/package.json" 2>/dev/null || printf "0.0.0")"
IPA_NAME="${PROJECT_NAME}-${VERSION}-unsigned.ipa"

echo "Building unsigned iOS IPA"
echo "Version: $VERSION"
echo "IPA: $IPA_NAME"

if [ ! -d "$WORKSPACE_PATH" ]; then
  echo "Generating iOS project with Expo prebuild"
  cd "$ROOT_DIR"
  npx expo prebuild --platform ios --no-install
fi

echo "Installing CocoaPods dependencies"
cd "$ROOT_DIR/ios"
pod install
cd "$ROOT_DIR"

echo "Patching fmt consteval for newer Apple SDKs"
ROOT_DIR="$ROOT_DIR" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const fmtBase = path.join(
  process.env.ROOT_DIR,
  "ios",
  "Pods",
  "fmt",
  "include",
  "fmt",
  "base.h",
);

if (!fs.existsSync(fmtBase)) {
  throw new Error(`Missing fmt header at ${fmtBase}`);
}

const source = fs.readFileSync(fmtBase, "utf8");
const patched = source
  .replace(
    "#elif defined(__cpp_consteval)\n#  define FMT_USE_CONSTEVAL 1",
    "#elif defined(__cpp_consteval)\n#  define FMT_USE_CONSTEVAL 0",
  )
  .replace(
    "#elif FMT_GCC_VERSION >= 1002 || FMT_CLANG_VERSION >= 1101\n#  define FMT_USE_CONSTEVAL 1",
    "#elif FMT_GCC_VERSION >= 1002 || FMT_CLANG_VERSION >= 1101\n#  define FMT_USE_CONSTEVAL 0",
  );

if (patched === source && !source.includes("#  define FMT_USE_CONSTEVAL 0")) {
  throw new Error("Could not patch FMT_USE_CONSTEVAL in fmt/base.h");
}

fs.chmodSync(fmtBase, 0o644);
fs.writeFileSync(fmtBase, patched);
NODE

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

xcodebuild clean build \
  -workspace "$WORKSPACE_PATH" \
  -scheme "$SCHEME_NAME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -sdk iphoneos \
  -archivePath "$ARCHIVE_PATH" \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO

xcodebuild archive \
  -workspace "$WORKSPACE_PATH" \
  -scheme "$SCHEME_NAME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -sdk iphoneos \
  -archivePath "$ARCHIVE_PATH" \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO

APP_PATH="$ARCHIVE_PATH/Products/Applications/${PROJECT_NAME}.app"
if [ ! -d "$APP_PATH" ]; then
  echo "Missing app bundle at $APP_PATH"
  exit 1
fi

PAYLOAD_DIR="$BUILD_DIR/Payload"
rm -rf "$PAYLOAD_DIR"
mkdir -p "$PAYLOAD_DIR"
cp -R "$APP_PATH" "$PAYLOAD_DIR/"

cd "$BUILD_DIR"
zip -qr "$IPA_NAME" Payload
rm -rf "$PAYLOAD_DIR"

echo "Unsigned IPA created at: $BUILD_DIR/$IPA_NAME"

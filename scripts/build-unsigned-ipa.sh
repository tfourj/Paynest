#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build/ios"
PROJECT_NAME="Paynest"
SCHEME_NAME="Paynest"
WORKSPACE_PATH="$ROOT_DIR/ios/${PROJECT_NAME}.xcworkspace"
ARCHIVE_PATH="$BUILD_DIR/${PROJECT_NAME}.xcarchive"
INFO_PLIST="$ROOT_DIR/ios/${PROJECT_NAME}/Info.plist"

VERSION_OVERRIDE=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      if [ "$#" -lt 2 ]; then
        echo "Missing value for --version"
        exit 1
      fi
      VERSION_OVERRIDE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--version v1.0.0]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--version v1.0.0]"
      exit 1
      ;;
  esac
done

PACKAGE_VERSION="$(node -e "console.log(require(process.argv[1]).version)" "$ROOT_DIR/package.json" 2>/dev/null || printf "0.0.0")"
VERSION="${VERSION_OVERRIDE#v}"
VERSION="${VERSION:-$PACKAGE_VERSION}"
IPA_NAME="${PROJECT_NAME}-${VERSION}-unsigned.ipa"

if [ -n "$VERSION_OVERRIDE" ]; then
  if [[ ! "$VERSION_OVERRIDE" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([-+].*)?$ ]]; then
    echo "Invalid --version value: $VERSION_OVERRIDE"
    echo "Expected a semantic version like v1.0.0 or 1.0.0"
    exit 1
  fi
  export PAYNEST_BUILD_VERSION="$VERSION"
  export PAYNEST_BUILD_SUFFIX=""
  export EXPO_PUBLIC_BUILD_VERSION="$VERSION"
  export EXPO_PUBLIC_BUILD_SUFFIX=""
fi

echo "Building unsigned iOS IPA"
echo "Version: $VERSION"
echo "IPA: $IPA_NAME"

if [ ! -d "$WORKSPACE_PATH" ]; then
  echo "Generating iOS project with Expo prebuild"
  cd "$ROOT_DIR"
  npx expo prebuild --platform ios --no-install
fi

if [ -f "$INFO_PLIST" ]; then
  echo "Setting iOS bundle version to $VERSION"
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$INFO_PLIST"
fi

echo "Installing CocoaPods dependencies"
cd "$ROOT_DIR/ios"
pod install
cd "$ROOT_DIR"

echo "Patching fmt consteval for newer Apple SDKs"
node "$ROOT_DIR/scripts/patch-ios-fmt-consteval.cjs"

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

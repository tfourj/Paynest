const appVersion = process.env.EXPO_PUBLIC_BUILD_VERSION?.trim() || "0.1.0";
const rawBuildSuffix = process.env.EXPO_PUBLIC_BUILD_SUFFIX;
const buildSuffix = rawBuildSuffix === undefined ? "dev" : rawBuildSuffix.trim();

export const appBuildLabel = buildSuffix
  ? `Paynest • v${appVersion}-${buildSuffix}`
  : `Paynest • v${appVersion}`;

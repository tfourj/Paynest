const { buildInfo } = require("./scripts/build-info.cjs");

// Dynamic config: this runs every time Expo evaluates the config, including
// `npx expo run:android`, `expo prebuild`, `expo start`, and EAS builds.
module.exports = ({ config }) => {
  const { version, suffix } = buildInfo();

  process.env.EXPO_PUBLIC_BUILD_VERSION = process.env.EXPO_PUBLIC_BUILD_VERSION || version;
  process.env.EXPO_PUBLIC_BUILD_SUFFIX = process.env.EXPO_PUBLIC_BUILD_SUFFIX ?? suffix;

  return {
    ...config,
    version,
  };
};

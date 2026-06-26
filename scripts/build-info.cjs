const { spawnSync } = require("node:child_process");

const fallbackVersion = require("../package.json").version || "1.0.0";
const versionPattern = /^v?\d+\.\d+\.\d+(?:[-+].*)?$/;

function normalizeVersion(value) {
  const version = value?.trim();
  if (!version || !versionPattern.test(version)) return null;
  return version.replace(/^v/, "");
}

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return result.status === 0 ? result.stdout.trim() : "";
}

function buildInfo() {
  const overrideVersion = normalizeVersion(process.env.EXPO_PUBLIC_BUILD_VERSION);
  if (overrideVersion) {
    return {
      version: overrideVersion,
      suffix: process.env.EXPO_PUBLIC_BUILD_SUFFIX ?? "",
    };
  }

  const tags = git(["tag", "--points-at", "HEAD"])
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const versionTag = tags.find((tag) => versionPattern.test(tag)) ?? tags[0];

  if (versionTag) {
    return {
      version: versionTag.replace(/^v/, ""),
      suffix: "",
    };
  }

  return {
    version: fallbackVersion,
    suffix: git(["rev-parse", "--short", "HEAD"]) || "dev",
  };
}

module.exports = { buildInfo, fallbackVersion };

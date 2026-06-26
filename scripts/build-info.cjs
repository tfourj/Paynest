const { spawnSync } = require("node:child_process");

const fallbackVersion = "0.1.0";

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return result.status === 0 ? result.stdout.trim() : "";
}

function buildInfo() {
  const tags = git(["tag", "--points-at", "HEAD"])
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const versionTag = tags.find((tag) => /^v?\d+\.\d+\.\d+(?:[-+].*)?$/.test(tag)) ?? tags[0];

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

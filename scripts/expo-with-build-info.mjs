#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";

import { buildInfo } from "./build-info.cjs";

const localExpoBin = process.platform === "win32"
  ? "node_modules/.bin/expo.cmd"
  : "node_modules/.bin/expo";

const expoArgs = process.argv.slice(2);
if (expoArgs.length === 0) {
  console.error("Usage: node scripts/expo-with-build-info.mjs <expo args>");
  process.exit(1);
}

const { version, suffix } = buildInfo();
const expoCommand = existsSync(localExpoBin) ? localExpoBin : "expo";
const child = spawn(expoCommand, expoArgs, {
  env: {
    ...process.env,
    EXPO_PUBLIC_BUILD_VERSION: version,
    EXPO_PUBLIC_BUILD_SUFFIX: suffix,
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

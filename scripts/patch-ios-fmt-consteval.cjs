const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const candidates = [
  path.join(rootDir, "ios", "Pods", "fmt", "include", "fmt", "base.h"),
  path.join(rootDir, "ios", "Pods", "ReactNativeDependencies", "Headers", "fmt", "base.h"),
  path.join(rootDir, "ios", "Pods", "Headers", "Public", "fmt", "fmt", "base.h"),
];

const fmtBase = candidates.find((candidate) => fs.existsSync(candidate));

if (!fmtBase) {
  const checkedPaths = candidates.map((candidate) => `- ${candidate}`).join("\n");
  throw new Error(`Missing fmt base.h. Checked:\n${checkedPaths}`);
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
  throw new Error(`Could not patch FMT_USE_CONSTEVAL in ${fmtBase}`);
}

fs.chmodSync(fmtBase, 0o644);
fs.writeFileSync(fmtBase, patched);
console.log(`Patched FMT_USE_CONSTEVAL in ${path.relative(rootDir, fmtBase)}`);

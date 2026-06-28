const version = require("../package.json").version || "1.0.0";

function buildInfo() {
  return {
    version,
    suffix: "",
  };
}

module.exports = { buildInfo, version };

import { spawnSync } from "node:child_process";

const commandArgs = [
  "node_modules/bumpp/bin/bumpp.mjs",
  ...process.argv.slice(2),
  "package.json",
  "apps/desktop/package.json",
  "apps/desktop/src-tauri/Cargo.toml",
  "--configFilePath",
  "bump.config.mjs",
];

const result = spawnSync("node", commandArgs, {
  stdio: "inherit",
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "bumpp";

const tauriConfigPath = "src-tauri/tauri.conf.json";
const cargoLockPath = "src-tauri/Cargo.lock";

function addUpdatedFile(operation, relativePath) {
  const absolutePath = path.resolve(operation.options.cwd, relativePath);

  if (!operation.state.updatedFiles.includes(absolutePath)) {
    operation.update({
      updatedFiles: [...operation.state.updatedFiles, absolutePath],
    });
  }
}

function syncTauriVersion(operation) {
  const absolutePath = path.resolve(operation.options.cwd, tauriConfigPath);
  const config = JSON.parse(fs.readFileSync(absolutePath, "utf8"));

  if (config.version === operation.state.newVersion) {
    return;
  }

  config.version = operation.state.newVersion;
  fs.writeFileSync(absolutePath, `${JSON.stringify(config, null, 2)}\n`);
  addUpdatedFile(operation, tauriConfigPath);
}

function syncCargoLock(operation) {
  execFileSync("cargo", ["update", "--manifest-path", "src-tauri/Cargo.toml", "-w"], {
    cwd: operation.options.cwd,
    stdio: "inherit",
  });

  addUpdatedFile(operation, cargoLockPath);
}

export default defineConfig({
  execute(operation) {
    syncTauriVersion(operation);
    syncCargoLock(operation);
  },
});

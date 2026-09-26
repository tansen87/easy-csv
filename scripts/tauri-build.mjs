#!/usr/bin/env node
/**
 * `tauri build` with the updater signing key wired up (design 022).
 *
 * `bundle.createUpdaterArtifacts` is enabled in tauri.conf.json, so every
 * build has to sign the installer. Two things make that awkward by hand:
 *
 *   1. The bundler only reads the key *contents* from
 *      `TAURI_SIGNING_PRIVATE_KEY`. `TAURI_SIGNING_PRIVATE_KEY_PATH` is
 *      honoured by `tauri signer` but NOT by the bundler, so exporting a path
 *      still fails with "a public key has been found, but no private key".
 *   2. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` must be *set* — even when the key
 *      has no password. When it is absent the bundler blocks on a password
 *      prompt that a non-interactive run never answers, so the build hangs
 *      forever after writing the installer and never produces a `.sig`.
 *
 * Usage:
 *   pnpm tauri:build                       # same arguments as `tauri build`
 *   pnpm tauri:build --target aarch64-apple-darwin
 *
 * Escape hatch, when you don't need a signed installer (a plain local build):
 *   pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const defaultKeyPath = join(homedir(), ".tauri", "easycsv-updater.key");
const keyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH || defaultKeyPath;
const args = process.argv.slice(2);

if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
  if (!existsSync(keyPath)) {
    console.error(
      [
        `Updater signing key not found at ${keyPath}.`,
        "",
        "Either set TAURI_SIGNING_PRIVATE_KEY_PATH to your key file, or build",
        "an unsigned installer (no updater artifacts):",
        "",
        "  pnpm tauri build --config '{\"bundle\":{\"createUpdaterArtifacts\":false}}'",
        "",
        "Design: docs/design/022_github-auto-update-and-admin-free-install.md",
      ].join("\n"),
    );
    process.exit(1);
  }
  process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyPath, "utf8").trim();
}

// Set it even when empty: an *absent* variable is what hangs the bundler.
if (process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD === undefined) {
  process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "";
}

// Spawn the project's own CLI through node so this works on every platform
// without relying on node_modules/.bin being on PATH or on a shell.
const cli = join(repoRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
if (!existsSync(cli)) {
  console.error(`Tauri CLI not found at ${cli}. Run \`pnpm install\` first.`);
  process.exit(1);
}

const child = spawn(process.execPath, [cli, "build", ...args], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});

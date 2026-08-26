#!/usr/bin/env node
/**
 * `tps` — launch the TUI from anywhere.
 *
 * Two things this has to get right:
 *
 *  - **Environment and tsconfig.** Both are resolved by tsx against the current
 *    directory. Run from elsewhere and the Foundry keys vanish and the JSX
 *    transform silently reverts to the classic one, so both are pinned to the
 *    package by absolute path.
 *
 *  - **Working directory.** The agent's tools resolve file paths against
 *    AGENT_CWD, which defaults to process.cwd(). We deliberately do NOT cd into
 *    the package — running `tps` in a project means the meatbags edit *that*
 *    project. Set AGENT_CWD to override.
 *
 * Flags: --mock runs against the in-process fake instead of the server.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
const tsx = join(pkgDir, "node_modules", ".bin", "tsx");
const entry = join(pkgDir, "src", "index.tsx");
const envFile = join(pkgDir, ".env");
const tsconfig = join(pkgDir, "tsconfig.json");

if (!existsSync(tsx)) {
  console.error(`tps: dependencies missing — run \`npm install\` in ${pkgDir}`);
  process.exit(1);
}

const passthrough = process.argv.slice(2);
const mock = passthrough.includes("--mock");
const args = [];
// tsx looks for tsconfig.json from the CURRENT directory, so from anywhere but
// the package it misses `"jsx": "react-jsx"`, falls back to the classic
// React.createElement transform, and every component blows up with
// "React is not defined". Pin it.
if (existsSync(tsconfig)) args.push("--tsconfig", tsconfig);
if (existsSync(envFile)) args.push(`--env-file=${envFile}`);
args.push(entry, ...passthrough.filter((a) => a !== "--mock"));

const child = spawn(tsx, args, {
  stdio: "inherit",
  cwd: process.cwd(),
  env: { ...process.env, ...(mock ? { MEATBAG_MOCK: "1" } : {}) },
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

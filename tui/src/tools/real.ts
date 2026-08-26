import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { AGENT_CWD } from "../foundry.js";
import type { ToolImpl } from "../types.js";

const MAX_READ_BYTES = 50_000;
const MAX_READ_LINES = 2000;
const MAX_GLOB_ENTRIES = 200;
const MAX_CMD_BYTES = 10_000;

function resolveInCwd(p: string): string {
  return path.isAbsolute(p) ? p : path.join(AGENT_CWD, p);
}

export const read_file: ToolImpl = async (args) => {
  try {
    const raw = await fs.readFile(resolveInCwd(String(args.path)), "utf8");
    let text = raw;
    let truncated = false;
    if (text.length > MAX_READ_BYTES) {
      text = text.slice(0, MAX_READ_BYTES);
      truncated = true;
    }
    const lines = text.split("\n");
    if (lines.length > MAX_READ_LINES) {
      text = lines.slice(0, MAX_READ_LINES).join("\n");
      truncated = true;
    }
    return truncated ? `${text}\n\n[truncated]` : text;
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
};

export const list_files: ToolImpl = async (args) => {
  try {
    const pattern = String(args.pattern ?? "**/*");
    const entries: string[] = [];
    for await (const entry of fs.glob(pattern, {
      cwd: AGENT_CWD,
      exclude: (name: string) => name === "node_modules" || name === ".git",
    })) {
      entries.push(entry);
      if (entries.length >= MAX_GLOB_ENTRIES) {
        entries.push("[truncated]");
        break;
      }
    }
    return entries.length ? entries.join("\n") : "No files matched.";
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
};

export const grep: ToolImpl = (args, ctx) =>
  new Promise((resolve) => {
    const target = args.path ? resolveInCwd(String(args.path)) : ".";
    execFile(
      "grep",
      ["-rn", "--exclude-dir=node_modules", "--exclude-dir=.git", String(args.pattern), target],
      { cwd: AGENT_CWD, timeout: 15_000, maxBuffer: 1_000_000, signal: ctx.signal },
      (err, stdout) => {
        if (err && !stdout) return resolve("No matches.");
        const out = stdout.slice(0, MAX_CMD_BYTES);
        resolve(out.length < stdout.length ? `${out}\n[truncated]` : out);
      },
    );
  });

// Commands that would let the model modify files itself, bypassing write_code.
const WRITEY_COMMAND =
  /(^|[\s;|&(])(rm|mv|cp|tee|touch|mkdir|chmod|chown|ln|truncate)\s|>>?|sed\s+(-\S*\s+)*-i/;

export const run_command: ToolImpl = (args, ctx) => {
  const command = String(args.command);
  // Redirects to the null device are harmless; don't count them as writes.
  const checkable = command.replace(/\d?>?>\s*\/dev\/null|\d>&\d/g, "");
  if (WRITEY_COMMAND.test(checkable)) {
    return Promise.resolve(
      "Error: workspace is write-protected outside of write_code (policy TPS-104). All file creation and modification must go through write_code.",
    );
  }
  return new Promise((resolve) => {
    execFile(
      "bash",
      ["-c", command],
      { cwd: AGENT_CWD, timeout: 30_000, maxBuffer: 1_000_000, signal: ctx.signal },
      (err, stdout, stderr) => {
        let out = [stdout, stderr].filter(Boolean).join("\n");
        if (err && !ctx.signal.aborted) {
          out = `Error: ${err.message}\n${out}`;
        }
        out = out.trim() || "(no output)";
        resolve(out.length > MAX_CMD_BYTES ? `${out.slice(0, MAX_CMD_BYTES)}\n[truncated]` : out);
      },
    );
  });
};

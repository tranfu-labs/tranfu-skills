#!/usr/bin/env node
// probe-codex --state-dir <path> --worktree <path> [--idle-stall-ms N]
// 输出 JSON: { state, pid, sessionId, lastLogAt, lastCommitAt, doneFile, attempts }
// state: "done" | "running" | "stalled" | "exited" | "missing"

import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import readline from "node:readline";
import { createReadStream } from "node:fs";

const args = parseArgs(process.argv.slice(2));
required(args, ["stateDir"]);
const idleStallMs = Number(args.idleStallMs ?? 600000);

const stateDir = args.stateDir;
const tailLog = resolve(stateDir, "codex-tail.log");
const pidFile = resolve(stateDir, ".codex-pid");
const sessionFile = resolve(stateDir, ".codex-session");
const attemptFile = resolve(stateDir, ".codex-attempt");
const doneFile = resolve(stateDir, ".task-done.json");
const doneMalformed = resolve(stateDir, ".task-done.json.malformed");

if (!existsSync(stateDir)) {
  console.log(JSON.stringify({ state: "missing" }));
  process.exit(0);
}

const now = Date.now();
const pid = readFileTrim(pidFile);
const sessionIdFromFile = readFileTrim(sessionFile);
const attempts = Number(readFileTrim(attemptFile) ?? "0") || 0;

let sessionId = sessionIdFromFile;
if (!sessionId && existsSync(tailLog)) {
  sessionId = await scanTailForSessionId(tailLog);
  if (sessionId) writeFileSync(sessionFile, sessionId);
}

let doneParsed = null;
if (existsSync(doneFile)) {
  try {
    doneParsed = JSON.parse(readFileSync(doneFile, "utf8"));
  } catch (e) {
    try { writeFileSync(doneMalformed, readFileSync(doneFile, "utf8")); } catch {}
    doneParsed = { status: "failed", summary: `malformed .task-done.json: ${String(e)}` };
  }
}

const lastLogAt = mtimeIso(tailLog);
const lastCommitAt = args.worktree ? readLastCommitAt(args.worktree) : null;

let state;
if (doneParsed !== null) {
  state = "done";
} else if (pid === null) {
  state = "exited";
} else if (!pidAlive(Number(pid))) {
  state = "exited";
} else {
  const latest = latestActivityMs(lastLogAt, lastCommitAt);
  if (latest !== null && now - latest > idleStallMs) {
    state = "stalled";
  } else {
    state = "running";
  }
}

console.log(JSON.stringify({
  state,
  pid: pid ? Number(pid) : null,
  sessionId: sessionId || null,
  lastLogAt,
  lastCommitAt,
  doneFile: doneParsed,
  attempts,
  idleStallMs,
}));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) { out[name] = next; i++; } else { out[name] = true; }
  }
  return out;
}

function required(o, keys) {
  const missing = keys.filter((k) => o[k] === undefined || o[k] === true);
  if (missing.length > 0) { console.error(`missing required args: ${missing.join(", ")}`); process.exit(2); }
}

function readFileTrim(p) {
  try { return readFileSync(p, "utf8").trim() || null; } catch { return null; }
}

function mtimeIso(p) {
  try { return statSync(p).mtime.toISOString(); } catch { return null; }
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readLastCommitAt(worktree) {
  try {
    const out = execFileSync("git", ["-C", worktree, "log", "-1", "--format=%cI"], { encoding: "utf8" }).trim();
    return out || null;
  } catch { return null; }
}

function latestActivityMs(a, b) {
  const ta = a ? Date.parse(a) : null;
  const tb = b ? Date.parse(b) : null;
  if (ta === null && tb === null) return null;
  if (ta === null) return tb;
  if (tb === null) return ta;
  return Math.max(ta, tb);
}

async function scanTailForSessionId(logPath) {
  const rl = readline.createInterface({ input: createReadStream(logPath) });
  for await (const line of rl) {
    if (!line || line[0] !== "{") continue;
    try {
      const evt = JSON.parse(line);
      const id = evt.session_id ?? evt.conversation_id ?? evt.thread_id ?? evt.id;
      if (typeof id === "string" && /^[0-9a-fA-F-]{16,}$/.test(id)) {
        rl.close();
        return id;
      }
    } catch {}
  }
  return null;
}

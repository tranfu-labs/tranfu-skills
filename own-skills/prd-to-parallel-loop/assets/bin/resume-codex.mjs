#!/usr/bin/env node
// resume-codex --worktree <path> --state-dir <path> --prompt-file <path> [--model <name>]
// 读 .codex-session 里的 session id,用 codex exec resume 追加消息继续跑。attempt +1。
//
// 架构同 spawn-codex:launcher + supervisor。原因见 spawn-codex.mjs 顶部注释。

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, createWriteStream, openSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = parseArgs(process.argv.slice(2));
required(args, ["worktree", "stateDir", "promptFile"]);

if (args.supervise) {
  runSupervisor(args);
} else {
  runLauncher(args);
}

function runLauncher(args) {
  const sessionFile = resolve(args.stateDir, ".codex-session");
  const pidFile = resolve(args.stateDir, ".codex-pid");
  const startedAtFile = resolve(args.stateDir, ".codex-started-at");
  const attemptFile = resolve(args.stateDir, ".codex-attempt");
  const tailLog = resolve(args.stateDir, "codex-tail.log");
  const supervisorLog = resolve(args.stateDir, ".supervisor.log");

  if (!existsSync(sessionFile)) {
    console.error(`no session id at ${sessionFile}; cannot resume, use spawn-codex instead`);
    process.exit(2);
  }
  const sessionId = readFileSync(sessionFile, "utf8").trim();
  if (!sessionId) {
    console.error(`session file empty`);
    process.exit(2);
  }
  const promptText = readFileSync(args.promptFile, "utf8");
  if (!promptText.trim()) {
    console.error(`prompt file empty: ${args.promptFile}`);
    process.exit(2);
  }

  const scriptPath = fileURLToPath(import.meta.url);
  const childArgv = [
    scriptPath,
    "--supervise",
    "--worktree", args.worktree,
    "--state-dir", args.stateDir,
    "--prompt-file", args.promptFile,
  ];
  if (args.model) childArgv.push("--model", args.model);

  const outFd = openSync(supervisorLog, "a");
  const proc = spawn(process.execPath, childArgv, {
    detached: true,
    stdio: ["ignore", outFd, outFd],
    env: process.env,
  });
  proc.unref();

  const startedAt = new Date().toISOString();
  writeFileSync(pidFile, String(proc.pid));
  writeFileSync(startedAtFile, startedAt);
  const prev = existsSync(attemptFile) ? Number(readFileSync(attemptFile, "utf8").trim() || "0") : 0;
  const nextAttempt = prev + 1;
  writeFileSync(attemptFile, String(nextAttempt));

  console.log(JSON.stringify({
    pid: proc.pid,
    sessionId,
    startedAt,
    attempt: nextAttempt,
    tailLog,
    pidFile,
    supervisorLog,
    stateDir: args.stateDir,
  }));
}

function runSupervisor(args) {
  const sessionFile = resolve(args.stateDir, ".codex-session");
  const tailLog = resolve(args.stateDir, "codex-tail.log");
  const doneFile = resolve(args.stateDir, ".task-done.json");
  const sessionId = readFileSync(sessionFile, "utf8").trim();
  const promptText = readFileSync(args.promptFile, "utf8");

  // codex exec resume 不接受 --cd / -m,通过 spawn cwd 切工作目录
  const codexArgs = ["exec", "resume", "--yolo", "--json"];
  codexArgs.push("--", sessionId, promptText);

  const out = createWriteStream(tailLog, { flags: "a" });
  const child = spawn("codex", codexArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: args.worktree,
    env: process.env,
  });
  child.stdout.pipe(out, { end: false });
  child.stderr.pipe(out, { end: false });

  child.on("close", (code, signal) => {
    const finishedAt = new Date().toISOString();
    if (!existsSync(doneFile)) {
      out.write(`\n[supervisor] codex resume exited code=${code} signal=${signal ?? ""} at ${finishedAt}\n`);
    }
    out.end(() => process.exit(0));
  });

  child.on("error", (err) => {
    out.write(`\n[supervisor] spawn error: ${err.message}\n`);
    out.end(() => process.exit(1));
  });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[name] = next;
      i++;
    } else {
      out[name] = true;
    }
  }
  return out;
}

function required(o, keys) {
  const missing = keys.filter((k) => o[k] === undefined || o[k] === true);
  if (missing.length > 0) {
    console.error(`missing required args: ${missing.join(", ")}`);
    process.exit(2);
  }
}

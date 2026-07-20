#!/usr/bin/env node
// spawn-codex --worktree <path> --state-dir <path> --prompt-file <path> [--model <name>] [--attempt <n>]
// 后台起 codex exec,立即返回 JSON。session id 由后续 probe-codex 从 tail log 里抓。
//
// 架构 launcher + supervisor:
//   - launcher(无 --supervise): fork 自己成 detached supervisor,写 pid,秒退
//   - supervisor(有 --supervise): spawn codex 用 pipe stdio,把 stdout/stderr 转写到 tail.log,守到 codex exit
//
// 为何绕这一圈:codex 需要活的 Node parent 来 pipe stdio。测试过 detach + 直接 fd
// (`stdio: ["ignore", fd, fd]`),不管加不加 nohup,codex 都会在 turn.started 后 3~6s
// 静默 exit,原因不明(不是 SIGHUP)。项目 src/codex.ts 姿势(pipe stdio + Node 常驻
// parent)18s 内正常跑到 turn.completed。所以复用它,但外面套一层 launcher 让 loop
// 心跳可以 fire-and-forget。
//
// 姿势与项目 src/codex.ts 对齐:
//   1. prompt 走位置参数 -- "<全文>",不走 stdin
//   2. stdio ["ignore","pipe","pipe"],Node 转发到文件
//   3. --yolo 短别名 = workspace-write + bypass-approvals

import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, createWriteStream, existsSync, openSync } from "node:fs";
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
  mkdirSync(args.stateDir, { recursive: true });
  const tailLog = resolve(args.stateDir, "codex-tail.log");
  const pidFile = resolve(args.stateDir, ".codex-pid");
  const startedAtFile = resolve(args.stateDir, ".codex-started-at");
  const attemptFile = resolve(args.stateDir, ".codex-attempt");
  const supervisorLog = resolve(args.stateDir, ".supervisor.log");
  const scriptPath = fileURLToPath(import.meta.url);

  const childArgv = [
    scriptPath,
    "--supervise",
    "--worktree", args.worktree,
    "--state-dir", args.stateDir,
    "--prompt-file", args.promptFile,
  ];
  if (args.model) childArgv.push("--model", args.model);
  if (args.attempt) childArgv.push("--attempt", String(args.attempt));

  // supervisor 完全托管,不需要日志跟着,只是把它的 stderr/stdout 也扔文件方便排错
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
  writeFileSync(attemptFile, String(args.attempt ?? "1"));

  console.log(JSON.stringify({
    pid: proc.pid,
    startedAt,
    tailLog,
    pidFile,
    supervisorLog,
    stateDir: args.stateDir,
  }));
}

function runSupervisor(args) {
  const tailLog = resolve(args.stateDir, "codex-tail.log");
  const doneFile = resolve(args.stateDir, ".task-done.json");

  const promptText = readFileSync(args.promptFile, "utf8");
  if (!promptText.trim()) {
    console.error(`[supervisor] prompt file empty: ${args.promptFile}`);
    process.exit(2);
  }

  const codexArgs = ["exec", "--yolo", "--json", "--cd", args.worktree];
  if (args.model) codexArgs.push("-m", args.model);
  codexArgs.push("--", promptText);

  const out = createWriteStream(tailLog, { flags: "a" });
  const child = spawn("codex", codexArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  child.stdout.pipe(out, { end: false });
  child.stderr.pipe(out, { end: false });

  child.on("close", (code, signal) => {
    const finishedAt = new Date().toISOString();
    // 只在没写 .task-done.json 时补一个"supervisor 记录"的 marker,别覆盖 codex 自己写的
    if (!existsSync(doneFile)) {
      out.write(`\n[supervisor] codex exited code=${code} signal=${signal ?? ""} at ${finishedAt}\n`);
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

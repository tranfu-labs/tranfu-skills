#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const statePath = join(homedir(), ".post-illustration-images-rsvg-check.json");
const maxAttempts = 2;

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8"
  });
  return result.status === 0;
}

function readState() {
  if (!existsSync(statePath)) {
    return { attempts: 0 };
  }
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return { attempts: 0 };
  }
}

function writeState(state) {
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function installCommand() {
  if (commandExists("brew")) {
    return "brew install librsvg";
  }
  if (commandExists("apt-get")) {
    return "sudo apt-get update && sudo apt-get install -y librsvg2-bin";
  }
  if (platform() === "darwin") {
    return "Install Homebrew, then run: brew install librsvg";
  }
  return "Install librsvg with your system package manager, then make sure rsvg-convert is on PATH.";
}

function main() {
  const args = new Set(process.argv.slice(2));
  const state = readState();

  if (commandExists("rsvg-convert")) {
    writeState({ attempts: 0, lastStatus: "ok", checkedAt: new Date().toISOString() });
    console.log("rsvg-convert is installed. You can trigger the illustration flow with keywords like 公众号配图, 小红书配图, 知乎配图, or a style ID such as wechat-doodle / xhs-orange-card / zhihu-tech.");
    return;
  }

  const attempts = Number(state.attempts || 0);
  if (attempts >= maxAttempts) {
    console.log(`rsvg-convert is still missing after ${maxAttempts} install checks. Stop here and install it manually: ${installCommand()}. After it succeeds, rerun this check or call the skill again.`);
    process.exitCode = 2;
    return;
  }

  const nextAttempts = args.has("--record-attempt") ? attempts + 1 : attempts;
  writeState({
    attempts: nextAttempts,
    lastStatus: "missing",
    checkedAt: new Date().toISOString()
  });

  if (nextAttempts >= maxAttempts) {
    console.log(`rsvg-convert is still missing after ${maxAttempts} install checks. Stop here and install it manually: ${installCommand()}. After it succeeds, rerun this check or call the skill again.`);
    process.exitCode = 2;
    return;
  }

  const remaining = maxAttempts - nextAttempts;
  console.log(`rsvg-convert is not installed. It is required for brand overlay styles such as wechat-doodle, xhs-explainer-notebook, and zhihu-tech. Install command: ${installCommand()}`);
  console.log(`After installation, rerun: node scripts/check-rsvg-convert.mjs --record-attempt. Remaining install checks before stopping: ${remaining}.`);
  process.exitCode = 1;
}

main();

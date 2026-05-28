import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEVERITY,
  formatHuman,
  formatJSON,
  hasErrors,
} from "./lib/validator-types.mjs";

import { validateSkillFile, findSkillFiles } from "./validate-frontmatter.mjs";
import { validateSkillCases, findSkillDirs as findCasesSkillDirs } from "./validate-cases.mjs";
import { validateSkillSecurity, findSkillDirs as findSecuritySkillDirs } from "./validate-security.mjs";

const ROOTS = ["meta-skills", "own-skills", "external-skills"];

function parseArgs(argv) {
  const args = { json: false, mode: "changed", target: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--all") args.mode = "all";
    else if (a === "--changed-only") args.mode = "changed";
    else if (a === "--target") {
      args.mode = "target";
      args.target = argv[++i];
    } else if (a.startsWith("--target=")) {
      args.mode = "target";
      args.target = a.slice("--target=".length);
    }
  }
  return args;
}

function discoverAllSkillDirs(rootDir) {
  const set = new Set();
  for (const file of findSkillFiles(rootDir)) {
    set.add(skillDirFromSkillMd(file));
  }
  for (const d of findCasesSkillDirs(rootDir)) set.add(d);
  for (const d of findSecuritySkillDirs(rootDir)) set.add(d);
  return [...set].sort();
}

function skillDirFromSkillMd(skillMdPath) {
  return skillMdPath.replace(/[\\/]SKILL\.md$/, "");
}

function gitBase() {
  for (const ref of ["origin/main", "main"]) {
    try {
      execSync(`git rev-parse --verify ${ref}`, { stdio: "ignore" });
      return ref;
    } catch {}
  }
  return null;
}

function changedFiles(rootDir) {
  const base = gitBase();
  if (!base) {
    process.stderr.write("validate-all: cannot find git base (origin/main or main); falling back to --all\n");
    return null;
  }
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD`, {
      cwd: rootDir,
      encoding: "utf8",
    });
    const unstaged = execSync("git diff --name-only HEAD", {
      cwd: rootDir,
      encoding: "utf8",
    });
    const untrackedRaw = execSync("git ls-files --others --exclude-standard", {
      cwd: rootDir,
      encoding: "utf8",
    });
    const untracked = untrackedRaw
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && ROOTS.some((r) => s === r || s.startsWith(r + "/")));
    return [
      ...out.split("\n").map((s) => s.trim()).filter(Boolean),
      ...unstaged.split("\n").map((s) => s.trim()).filter(Boolean),
      ...untracked,
    ];
  } catch (err) {
    process.stderr.write(`validate-all: git diff failed (${err.message}); falling back to --all\n`);
    return null;
  }
}

function affectedSkillDirs(files, rootDir) {
  const dirs = new Set();
  for (const f of files) {
    const parts = f.split(/[\\/]/);
    if (parts.length < 2) continue;
    if (!ROOTS.includes(parts[0])) continue;
    const dir = join(rootDir, parts[0], parts[1]);
    if (existsSync(dir) && statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"))) {
      dirs.add(dir);
    }
  }
  return [...dirs].sort();
}

function resolveTargetSkillDir(target, rootDir) {
  const abs = resolve(rootDir, target);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return null;
  if (!existsSync(join(abs, "SKILL.md"))) return null;
  const rel = relative(rootDir, abs);
  const parts = rel.split(/[\\/]/);
  if (parts.length < 2 || !ROOTS.includes(parts[0])) return null;
  return abs;
}

function validateOne(skillDir, rootDir) {
  const results = [];
  const skillMd = join(skillDir, "SKILL.md");
  if (existsSync(skillMd)) {
    results.push(...validateSkillFile(skillMd, rootDir));
  }
  results.push(...validateSkillCases(skillDir, rootDir));
  results.push(...validateSkillSecurity(skillDir, rootDir));
  return results;
}

export function runAll({ mode, target, rootDir }) {
  let skillDirs;
  let reason;

  if (mode === "target") {
    const d = resolveTargetSkillDir(target, rootDir);
    if (!d) {
      throw new Error(`--target path is not a skill dir with SKILL.md: ${target}`);
    }
    skillDirs = [d];
    reason = `target=${relative(rootDir, d)}`;
  } else if (mode === "all") {
    skillDirs = discoverAllSkillDirs(rootDir);
    reason = "all";
  } else {
    const files = changedFiles(rootDir);
    if (files == null) {
      skillDirs = discoverAllSkillDirs(rootDir);
      reason = "changed-only (fallback to all due to git failure)";
    } else {
      skillDirs = affectedSkillDirs(files, rootDir);
      reason = `changed-only (${skillDirs.length} affected skill(s) from ${files.length} changed file(s))`;
    }
  }

  const results = [];
  for (const d of skillDirs) {
    results.push(...validateOne(d, rootDir));
  }

  return { results, skillDirs, reason };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();

  let outcome;
  try {
    outcome = runAll({ mode: args.mode, target: args.target, rootDir });
  } catch (err) {
    if (args.json) {
      process.stdout.write(
        JSON.stringify(
          { ok: false, error: err.message, summary: { errors: 0, warnings: 0, skipped: 0 }, results: [] },
          null,
          2,
        ) + "\n",
      );
    } else {
      process.stderr.write(`validate-all: ${err.message}\n`);
    }
    process.exitCode = 2;
    return;
  }

  const { results, skillDirs, reason } = outcome;

  if (args.json) {
    process.stdout.write(formatJSON(results) + "\n");
    if (hasErrors(results)) process.exitCode = 1;
    return;
  }

  process.stderr.write(`validate-all: ${reason}\n`);

  if (skillDirs.length === 0) {
    process.stdout.write("no skills to validate (no changed skill dirs)\n");
    return;
  }

  const errors = results.filter((r) => r.severity === SEVERITY.ERROR);
  const warnings = results.filter((r) => r.severity === SEVERITY.WARNING);

  if (warnings.length > 0) {
    process.stderr.write(`\n${warnings.length} warning(s):\n`);
    for (const r of warnings) process.stderr.write(formatHuman(r) + "\n");
  }

  if (errors.length === 0) {
    process.stdout.write(`\nvalidate-all passed (${skillDirs.length} skill(s) checked)\n`);
    return;
  }

  process.stderr.write(`\n${errors.length} error(s):\n`);
  for (const r of errors) process.stderr.write(formatHuman(r) + "\n");
  process.stderr.write(
    `\nrepro locally: npm run validate -- --target <skill-path> --json\n`,
  );
  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  main();
}

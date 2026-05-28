import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEVERITY,
  formatHuman,
  formatJSON,
  hasErrors,
  makeError,
} from "./lib/validator-types.mjs";

const ROOTS = ["meta-skills", "own-skills", "external-skills"];
const VALIDATOR = "virustotal";

const VT_BASE = "https://www.virustotal.com/api/v3";
const MAX_ZIP_BYTES = 32 * 1024 * 1024;
const MALICIOUS_THRESHOLD = 3;
const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const UPLOAD_TIMEOUT_MS = 60_000;

export function findSkillDirs(rootDir = process.cwd()) {
  const dirs = [];
  for (const root of ROOTS) {
    const fullRoot = join(rootDir, root);
    if (!existsSync(fullRoot)) continue;
    for (const entry of readdirSync(fullRoot)) {
      const skillDir = join(fullRoot, entry);
      if (!statSync(skillDir).isDirectory()) continue;
      if (existsSync(join(skillDir, "SKILL.md"))) dirs.push(skillDir);
    }
  }
  return dirs.sort();
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

function changedSkillDirs(rootDir) {
  const base = gitBase();
  if (!base) return null;
  let raw;
  try {
    raw = execSync(`git diff --name-only ${base}...HEAD`, {
      cwd: rootDir,
      encoding: "utf8",
    });
  } catch {
    return null;
  }
  const dirs = new Set();
  for (const f of raw.split("\n").map((s) => s.trim()).filter(Boolean)) {
    const parts = f.split("/");
    if (parts.length < 2 || !ROOTS.includes(parts[0])) continue;
    const dir = join(rootDir, parts[0], parts[1]);
    if (existsSync(dir) && statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"))) {
      dirs.add(dir);
    }
  }
  return [...dirs].sort();
}

function skillNameFromDir(rel) {
  return rel.split("/").slice(0, 2).join("/");
}

function softWarning(skill, path, message, fix_hint = null) {
  return makeError({
    validator: VALIDATOR,
    skill,
    path,
    rule: "virustotal.skipped",
    severity: SEVERITY.WARNING,
    message,
    fix_hint,
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function uploadAndPoll(zipPath, apiKey) {
  const buf = readFileSync(zipPath);
  const form = new FormData();
  form.append("file", new Blob([buf]), "skill.zip");

  const upRes = await fetchWithTimeout(
    `${VT_BASE}/files`,
    { method: "POST", headers: { "x-apikey": apiKey }, body: form },
    UPLOAD_TIMEOUT_MS,
  );
  if (!upRes.ok) {
    throw new Error(`upload ${upRes.status}: ${(await upRes.text()).slice(0, 200)}`);
  }
  const upJson = await upRes.json();
  const analysisId = upJson?.data?.id;
  if (!analysisId) throw new Error("upload response missing data.id");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const pollRes = await fetchWithTimeout(
      `${VT_BASE}/analyses/${analysisId}`,
      { headers: { "x-apikey": apiKey } },
      UPLOAD_TIMEOUT_MS,
    );
    if (pollRes.status === 429) continue;
    if (!pollRes.ok) throw new Error(`poll ${pollRes.status}`);
    const pollJson = await pollRes.json();
    const status = pollJson?.data?.attributes?.status;
    if (status === "completed") {
      return {
        analysisId,
        stats: pollJson?.data?.attributes?.stats ?? {},
      };
    }
  }
  throw new Error("poll timeout (5 min)");
}

export async function validateSkillVirustotal(skillDir, rootDir, apiKey) {
  const rel = relative(rootDir, skillDir);
  const skill = skillNameFromDir(rel);
  const results = [];

  if (!apiKey) {
    results.push(
      softWarning(
        skill,
        rel,
        "VIRUSTOTAL_API_KEY not set; VT scan skipped (fork PR / local run)",
        "set VIRUSTOTAL_API_KEY env (CI) or repo secret",
      ),
    );
    return results;
  }

  const stagingDir = join(tmpdir(), `vt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(stagingDir, { recursive: true });
  const zipPath = join(stagingDir, "skill.zip");

  try {
    execSync(`zip -rqX "${zipPath}" .`, { cwd: skillDir });
    const size = statSync(zipPath).size;
    if (size > MAX_ZIP_BYTES) {
      results.push(
        softWarning(
          skill,
          rel,
          `skill zip ${(size / 1024 / 1024).toFixed(1)}MB > VT free-tier cap ${MAX_ZIP_BYTES / 1024 / 1024}MB; VT scan skipped`,
        ),
      );
      return results;
    }

    const { stats, analysisId } = await uploadAndPoll(zipPath, apiKey);
    const malicious = stats.malicious ?? 0;
    const suspicious = stats.suspicious ?? 0;

    if (malicious >= MALICIOUS_THRESHOLD) {
      results.push(
        makeError({
          validator: VALIDATOR,
          skill,
          path: rel,
          rule: "virustotal.malicious",
          severity: SEVERITY.ERROR,
          message: `VT flagged: malicious=${malicious}, suspicious=${suspicious} (threshold ≥${MALICIOUS_THRESHOLD}); analysis=${analysisId}`,
          fix_hint: `inspect https://www.virustotal.com/gui/file-analysis/${analysisId} — remove flagged content or, if false positive, escalate to maintainer in PR`,
        }),
      );
    }
  } catch (err) {
    results.push(
      softWarning(
        skill,
        rel,
        `VT scan errored: ${err.message}; treated as soft-fail (CI not blocked on VT outages)`,
      ),
    );
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }

  return results;
}

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const apiKey = process.env.VIRUSTOTAL_API_KEY || "";

  let skillDirs;
  if (args.mode === "target") {
    const abs = resolve(rootDir, args.target);
    if (!existsSync(abs) || !existsSync(join(abs, "SKILL.md"))) {
      const msg = `--target path is not a skill dir with SKILL.md: ${args.target}`;
      if (args.json) {
        process.stdout.write(
          JSON.stringify({ ok: false, error: msg, summary: { errors: 0, warnings: 0, skipped: 0 }, results: [] }, null, 2) + "\n",
        );
      } else {
        process.stderr.write(`validate-virustotal: ${msg}\n`);
      }
      process.exitCode = 2;
      return;
    }
    skillDirs = [abs];
  } else if (args.mode === "all") {
    skillDirs = findSkillDirs(rootDir);
  } else {
    const changed = changedSkillDirs(rootDir);
    if (changed == null) {
      process.stderr.write("validate-virustotal: git base not found; falling back to --all\n");
      skillDirs = findSkillDirs(rootDir);
    } else {
      skillDirs = changed;
    }
  }

  const results = [];
  for (const d of skillDirs) {
    const r = await validateSkillVirustotal(d, rootDir, apiKey);
    results.push(...r);
  }

  if (args.json) {
    process.stdout.write(formatJSON(results) + "\n");
    if (hasErrors(results)) process.exitCode = 1;
    return;
  }

  if (skillDirs.length === 0) {
    process.stdout.write("validate-virustotal: no skill dirs to scan\n");
    return;
  }

  const errors = results.filter((r) => r.severity === SEVERITY.ERROR);
  const warnings = results.filter((r) => r.severity === SEVERITY.WARNING);

  if (warnings.length > 0) {
    process.stderr.write(`\nvalidate-virustotal: ${warnings.length} warning(s):\n`);
    for (const r of warnings) process.stderr.write(formatHuman(r) + "\n");
  }

  if (errors.length === 0) {
    process.stdout.write(`\nvalidate-virustotal passed (${skillDirs.length} skill(s) scanned)\n`);
    return;
  }

  process.stderr.write(`\nvalidate-virustotal: ${errors.length} error(s):\n`);
  for (const r of errors) process.stderr.write(formatHuman(r) + "\n");
  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  main().catch((err) => {
    process.stderr.write(`validate-virustotal: fatal: ${err.message}\n`);
    process.exitCode = 2;
  });
}

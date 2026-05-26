import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontmatter } from "./validate-frontmatter.mjs";
import {
  SEVERITY,
  formatJSON,
  hasErrors,
  makeError,
} from "./lib/validator-types.mjs";

const ROOTS = ["meta-skills", "own-skills", "external-skills"];
const SCAN_EXTS = new Set([".mjs", ".js", ".ts", ".sh", ".py"]);
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const VALIDATOR = "security";

const MAX_SCAN_BYTES = 1_000_000;

const LINE_RULES = [
  {
    id: "security.eval",
    regex: /\beval\s*\(/,
    message: "use of eval() detected",
    allow_field: null,
    fix_hint: "remove eval(); dynamic code execution is forbidden in low-tier",
  },
  {
    id: "security.new-function",
    regex: /\b(?:new\s+(?:(?:globalThis|window|self|global)\.)?Function\s*\(|(?:globalThis|window|self|global)\.Function\s*\()/,
    message: "use of Function constructor detected",
    allow_field: null,
    fix_hint: "remove Function() constructor; dynamic code execution is forbidden in low-tier",
  },
  {
    id: "security.child-process-import",
    regex: /(?:from\s*['"](?:node:)?child_process['"]|require\s*\(\s*['"](?:node:)?child_process['"]\s*\))/,
    message: "child_process import detected",
    allow_field: "allow_exec",
    fix_hint: "set frontmatter `allow_exec: true` if exec is required, or remove the import",
  },
  {
    id: "security.curl-pipe-sh",
    regex: /\b(?:curl|wget)\b[^\n]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/,
    message: "curl|sh / wget|sh pattern detected",
    allow_field: "allow_curl_pipe_sh",
    fix_hint: "set frontmatter `allow_curl_pipe_sh: true` if intentional, or replace with explicit download + checksum verify",
  },
];

function isTruthy(v) {
  return v === true || v === "true" || v === "yes" || v === 1 || v === "1";
}

export function findScannableFiles(skillDir) {
  const out = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const lst = lstatSync(full);
      if (lst.isSymbolicLink()) continue;
      if (lst.isDirectory()) {
        walk(full);
        continue;
      }
      if (!lst.isFile()) continue;
      const dot = entry.lastIndexOf(".");
      if (dot < 0) continue;
      const ext = entry.slice(dot);
      if (!SCAN_EXTS.has(ext)) continue;
      if (lst.size > MAX_SCAN_BYTES) continue;
      out.push(full);
    }
  }
  walk(skillDir);
  return out;
}

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

function readSkillFrontmatter(skillDir) {
  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) return {};
  const md = readFileSync(skillMd, "utf8");
  const { data } = parseFrontmatter(md);
  return data || {};
}

function skillNameFromDir(rel) {
  return rel.split("/").slice(0, 2).join("/");
}

export function validateSkillSecurity(skillDir, rootDir = process.cwd()) {
  const frontmatter = readSkillFrontmatter(skillDir);
  const rel = relative(rootDir, skillDir);
  const skill = skillNameFromDir(rel);
  const results = [];

  for (const file of findScannableFiles(skillDir)) {
    const fileRel = relative(rootDir, file);
    const content = readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const rule of LINE_RULES) {
        if (!rule.regex.test(line)) continue;
        if (rule.allow_field && isTruthy(frontmatter[rule.allow_field])) continue;

        results.push(
          makeError({
            validator: VALIDATOR,
            skill,
            path: fileRel,
            rule: rule.id,
            severity: SEVERITY.ERROR,
            message: rule.message,
            line: i + 1,
            fix_hint: rule.fix_hint,
          }),
        );
      }
    }
  }

  return results;
}

export function validateRepository(rootDir = process.cwd()) {
  const results = [];
  for (const skillDir of findSkillDirs(rootDir)) {
    results.push(...validateSkillSecurity(skillDir, rootDir));
  }
  return results;
}

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const rootDir = process.cwd();
  const results = validateRepository(rootDir);

  if (jsonMode) {
    process.stdout.write(formatJSON(results) + "\n");
    if (hasErrors(results)) process.exitCode = 1;
    return;
  }

  const errors = results.filter((r) => r.severity === SEVERITY.ERROR);
  if (errors.length === 0) {
    process.stdout.write("security validation passed\n");
    return;
  }

  process.stderr.write(`security validation failed (${errors.length} error(s)):\n`);
  for (const r of errors) {
    process.stderr.write(`✗ ${r.path}:${r.line}: ${r.rule}: ${r.message}\n`);
    if (r.fix_hint) process.stderr.write(`    ↳ ${r.fix_hint}\n`);
  }
  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  main();
}

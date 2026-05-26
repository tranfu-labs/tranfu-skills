import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEVERITY,
  formatJSON,
  hasErrors,
  makeError,
} from "./lib/validator-types.mjs";

const ROOTS = ["meta-skills", "own-skills", "external-skills"];
const VALIDATOR = "cases";

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

function listDir(dir) {
  return readdirSync(dir).map((name) => ({
    name,
    full: join(dir, name),
    stat: statSync(join(dir, name)),
  }));
}

function isNonEmptyDir(dir) {
  if (!existsSync(dir)) return false;
  const st = statSync(dir);
  if (!st.isDirectory()) return false;
  const entries = readdirSync(dir).filter((n) => !n.startsWith("."));
  return entries.length > 0;
}

function skillNameFromDir(rel) {
  return rel.split("/").slice(0, 2).join("/");
}

export function validateSkillCases(skillDir, rootDir = process.cwd()) {
  const casesDir = join(skillDir, "cases");
  if (!existsSync(casesDir)) return [];
  if (!statSync(casesDir).isDirectory()) return [];

  const rel = relative(rootDir, skillDir);
  const skill = skillNameFromDir(rel);
  const results = [];

  const entries = listDir(casesDir);
  const numericDirs = [];
  const legacyFiles = [];
  const unknownEntries = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.stat.isFile() && entry.name.toLowerCase() === "readme.md") continue;
    if (entry.stat.isDirectory() && /^[1-9]\d*$/.test(entry.name)) {
      numericDirs.push({ n: Number(entry.name), full: entry.full, name: entry.name });
      continue;
    }
    if (entry.stat.isDirectory() && /^0\d*$/.test(entry.name)) {
      results.push(
        makeError({
          validator: VALIDATOR,
          skill,
          path: relative(rootDir, entry.full),
          rule: "cases.leading-zero",
          severity: SEVERITY.ERROR,
          message: `case directory has leading zero: ${entry.name}`,
          fix_hint: `rename to cases/${Number(entry.name)}/ (no leading zeros)`,
        }),
      );
      continue;
    }
    if (entry.stat.isFile() && entry.name.endsWith(".md")) {
      legacyFiles.push(entry);
      continue;
    }
    unknownEntries.push(entry);
  }

  if (legacyFiles.length > 0 && numericDirs.length > 0) {
    results.push(
      makeError({
        validator: VALIDATOR,
        skill,
        path: relative(rootDir, casesDir),
        rule: "cases.mixed-legacy-and-new",
        severity: SEVERITY.ERROR,
        message: "cases/ contains both legacy *.md files and new numeric dirs — migration appears incomplete",
        fix_hint: "finish migrating remaining cases/*.md files into cases/{n}/input/ + output/ then delete the originals",
      }),
    );
  }

  for (const f of legacyFiles) {
    results.push(
      makeError({
        validator: VALIDATOR,
        skill,
        path: relative(rootDir, f.full),
        rule: "cases.legacy-single-file",
        severity: SEVERITY.ERROR,
        message: "legacy single-file case format detected",
        fix_hint: `migrate to cases/1/input/ + cases/1/output/ (mv cases/${f.name} cases/1/input/ then add cases/1/output/)`,
      }),
    );
  }

  for (const u of unknownEntries) {
    results.push(
      makeError({
        validator: VALIDATOR,
        skill,
        path: relative(rootDir, u.full),
        rule: "cases.unexpected-entry",
        severity: SEVERITY.ERROR,
        message: `unexpected entry under cases/: ${u.name}`,
        fix_hint: "cases/ should only contain numeric dirs (1/, 2/, ...), README.md, or legacy *.md files",
      }),
    );
  }

  if (numericDirs.length > 0) {
    numericDirs.sort((a, b) => a.n - b.n);
    const expected = numericDirs.map((_, i) => i + 1);
    const actual = numericDirs.map((d) => d.n);

    for (let i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) {
        results.push(
          makeError({
            validator: VALIDATOR,
            skill,
            path: relative(rootDir, numericDirs[i].full),
            rule: "cases.non-sequential",
            severity: SEVERITY.ERROR,
            message: `expected cases/${expected[i]}/ but found cases/${actual[i]}/`,
            fix_hint: `rename to cases/${expected[i]}/ so numeric dirs are 1..N contiguous`,
          }),
        );
        break;
      }
    }

    for (const d of numericDirs) {
      const inputDir = join(d.full, "input");
      const outputDir = join(d.full, "output");
      const caseRel = relative(rootDir, d.full);

      if (!isNonEmptyDir(inputDir)) {
        results.push(
          makeError({
            validator: VALIDATOR,
            skill,
            path: caseRel,
            rule: "cases.missing-input",
            severity: SEVERITY.ERROR,
            message: `case ${d.name}/ missing non-empty input/ subdir`,
            fix_hint: `create ${caseRel}/input/ and add ≥ 1 file representing the case input`,
          }),
        );
      }
      if (!isNonEmptyDir(outputDir)) {
        results.push(
          makeError({
            validator: VALIDATOR,
            skill,
            path: caseRel,
            rule: "cases.missing-output",
            severity: SEVERITY.ERROR,
            message: `case ${d.name}/ missing non-empty output/ subdir`,
            fix_hint: `create ${caseRel}/output/ and add ≥ 1 file representing the expected output`,
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
    results.push(...validateSkillCases(skillDir, rootDir));
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
  const warnings = results.filter((r) => r.severity === SEVERITY.WARNING);

  if (errors.length === 0 && warnings.length === 0) {
    process.stdout.write("cases validation passed\n");
    return;
  }

  if (warnings.length > 0) {
    process.stderr.write(`cases validation warnings (${warnings.length}):\n`);
    for (const r of warnings) {
      process.stderr.write(`⚠ ${r.path}: ${r.rule}: ${r.message}\n`);
      if (r.fix_hint) process.stderr.write(`    ↳ ${r.fix_hint}\n`);
    }
  }

  if (errors.length > 0) {
    process.stderr.write(`cases validation failed (${errors.length} error(s)):\n`);
    for (const r of errors) {
      process.stderr.write(`✗ ${r.path}: ${r.rule}: ${r.message}\n`);
      if (r.fix_hint) process.stderr.write(`    ↳ ${r.fix_hint}\n`);
    }
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  main();
}

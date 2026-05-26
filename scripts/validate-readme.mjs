import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEVERITY,
  formatJSON,
  hasErrors,
  makeError,
} from "./lib/validator-types.mjs";

const ROOTS = ["meta-skills", "own-skills", "external-skills"];
const VALIDATOR = "readme";
const MIN_H2 = 3;
const MIN_KEYWORD_CATEGORIES = 3;
const README_CANDIDATES = ["README.md", "README.zh.md", "README.en.md"];

const KEYWORD_CATEGORIES = [
  { id: "comparable", pattern: /同类|类似|对比|comparable|alternative/i },
  { id: "value", pattern: /价值|when to use|什么时候用|trigger|why use/i },
  { id: "how-to", pattern: /使用技巧|how to use|怎么用|tips|快速上手|触发示例|trigger example/i },
  { id: "io", pattern: /输入|输出|input|output|你会看到|期望输出/i },
  { id: "limit", pattern: /限制|不适用|known limit|caveat|边界/i },
];


const TEMPLATE_HINT =
  "add sections covering ≥ 3 of: ## 同类对比 / ## 价值 (when to use) / ## 使用技巧 / ## 输入与输出 / ## 已知限制";

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

function skillNameFromDir(rel) {
  return rel.split("/").slice(0, 2).join("/");
}

function splitH2Sections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = null;
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      if (current) current.body.push(line);
      continue;
    }
    if (!inFence && /^##\s+/.test(line)) {
      if (current) sections.push(current);
      current = { heading: line.replace(/^##\s+/, "").trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) sections.push(current);
  return sections;
}

export function validateSkillReadme(skillDir, rootDir = process.cwd()) {
  const rel = relative(rootDir, skillDir);
  const skill = skillNameFromDir(rel);
  const results = [];

  let readmePath = null;
  for (const candidate of README_CANDIDATES) {
    const p = join(skillDir, candidate);
    if (existsSync(p)) {
      readmePath = p;
      break;
    }
  }

  if (!readmePath) {
    results.push(
      makeError({
        validator: VALIDATOR,
        skill,
        path: rel,
        rule: "readme.missing",
        severity: SEVERITY.ERROR,
        message: `README missing in skill directory (looked for: ${README_CANDIDATES.join(", ")})`,
        fix_hint: `create ${rel}/README.md; ${TEMPLATE_HINT}`,
      }),
    );
    return results;
  }

  const markdown = readFileSync(readmePath, "utf8");
  const readmeRel = relative(rootDir, readmePath);
  const sections = splitH2Sections(markdown);

  if (sections.length < MIN_H2) {
    results.push(
      makeError({
        validator: VALIDATOR,
        skill,
        path: readmeRel,
        rule: "readme.too-few-sections",
        severity: SEVERITY.ERROR,
        message: `found ${sections.length} level-2 (## ) sections, need ≥ ${MIN_H2}`,
        fix_hint: TEMPLATE_HINT,
      }),
    );
  }

  const hits = new Set();
  for (const section of sections) {
    const blob = section.heading + "\n" + section.body.join("\n");
    for (const cat of KEYWORD_CATEGORIES) {
      if (cat.pattern.test(blob)) hits.add(cat.id);
    }
  }

  if (hits.size < MIN_KEYWORD_CATEGORIES) {
    results.push(
      makeError({
        validator: VALIDATOR,
        skill,
        path: readmeRel,
        rule: "readme.no-value-section",
        severity: SEVERITY.ERROR,
        message: `matched ${hits.size}/${KEYWORD_CATEGORIES.length} keyword categories (${[...hits].join(",") || "none"}); need ≥ ${MIN_KEYWORD_CATEGORIES}`,
        fix_hint: TEMPLATE_HINT,
      }),
    );
  }

  return results;
}

export function validateRepository(rootDir = process.cwd()) {
  const results = [];
  for (const skillDir of findSkillDirs(rootDir)) {
    results.push(...validateSkillReadme(skillDir, rootDir));
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

  if (warnings.length > 0) {
    process.stderr.write(`readme validation warnings (${warnings.length}):\n`);
    for (const r of warnings) {
      process.stderr.write(`⚠ ${r.path}: ${r.rule}: ${r.message}\n`);
      if (r.fix_hint) process.stderr.write(`    ↳ ${r.fix_hint}\n`);
    }
  }

  if (errors.length === 0) {
    if (warnings.length === 0) process.stdout.write("readme validation passed\n");
    else process.stdout.write(`readme validation passed (${warnings.length} warning(s))\n`);
    return;
  }

  process.stderr.write(`readme validation failed (${errors.length} error(s)):\n`);
  for (const r of errors) {
    process.stderr.write(`✗ ${r.path}: ${r.rule}: ${r.message}\n`);
    if (r.fix_hint) process.stderr.write(`    ↳ ${r.fix_hint}\n`);
  }
  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  main();
}

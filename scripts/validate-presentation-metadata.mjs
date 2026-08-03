import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEVERITY,
  formatJSON,
  hasErrors,
  makeError,
} from "./lib/validator-types.mjs";
import { parseFrontmatter } from "./validate-frontmatter.mjs";

const ROOTS = ["meta-skills", "own-skills", "external-skills"];
const VALIDATOR = "presentation-metadata";
const BASELINE_PATH = "scripts/presentation-metadata-baseline.json";

function readJsonIfExists(path) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeSlash(s) {
  return s.replace(/\\/g, "/");
}

function skillNameFromDir(rel) {
  return normalizeSlash(rel).split("/").slice(0, 2).join("/");
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

function hasYamlIconField(openaiYaml, field, expected) {
  const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|\\n)\\s*${field}:\\s*["']?${escaped}["']?\\s*(\\n|$)`);
  return re.test(openaiYaml);
}

function readMarkdownFrontmatter(path) {
  if (!existsSync(path)) return { data: {}, error: "missing file" };
  return parseFrontmatter(readFileSync(path, "utf8"));
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateReadmePromptExamples(value) {
  if (!Array.isArray(value)) return "prompt_examples must be a YAML array";
  if (value.length === 0) return "prompt_examples must contain at least one example";
  if (value.length > 3) return "prompt_examples must contain at most 3 examples";
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return `prompt_examples[${index}] must be a map with prompt and scene`;
    }
    if (!hasNonEmptyString(item.prompt)) return `prompt_examples[${index}].prompt must be a non-empty string`;
    if (!hasNonEmptyString(item.scene)) return `prompt_examples[${index}].scene must be a non-empty string`;
  }
  return "";
}

function missingPresentationItems(skillDir) {
  const missing = [];
  const skillFrontmatter = readMarkdownFrontmatter(join(skillDir, "SKILL.md"));
  if (!hasNonEmptyString(skillFrontmatter.data.display_name)) {
    missing.push("SKILL.md:display_name");
  }
  if (!hasNonEmptyString(skillFrontmatter.data.display_name_zh)) {
    missing.push("SKILL.md:display_name_zh");
  }

  for (const relPath of ["README.md", "README.zh.md", "assets/icon.svg", "assets/icon.png"]) {
    const full = join(skillDir, relPath);
    if (!existsSync(full)) {
      missing.push(relPath);
      continue;
    }
    if (statSync(full).isFile() && statSync(full).size === 0) {
      missing.push(`${relPath}:non_empty`);
    }
    if (relPath === "README.md" || relPath === "README.zh.md") {
      const { data, error } = readMarkdownFrontmatter(full);
      if (error) {
        missing.push(`${relPath}:frontmatter`);
      } else {
        if (!hasNonEmptyString(data.description)) {
          missing.push(`${relPath}:description`);
        }
        const promptExamplesError = validateReadmePromptExamples(data.prompt_examples);
        if (promptExamplesError) {
          missing.push(`${relPath}:prompt_examples`);
        }
      }
    }
  }

  const openaiPath = join(skillDir, "agents/openai.yaml");
  if (!existsSync(openaiPath)) {
    missing.push("agents/openai.yaml");
    return missing;
  }

  const openaiYaml = readFileSync(openaiPath, "utf8");
  if (!hasYamlIconField(openaiYaml, "icon_small", "./assets/icon.svg")) {
    missing.push("agents/openai.yaml:interface.icon_small");
  }
  if (!hasYamlIconField(openaiYaml, "icon_large", "./assets/icon.png")) {
    missing.push("agents/openai.yaml:interface.icon_large");
  }
  return missing;
}

export function validateSkillPresentationMetadata(skillDir, rootDir = process.cwd(), options = {}) {
  const rel = normalizeSlash(relative(rootDir, skillDir));
  const skill = skillNameFromDir(rel);
  const baseline = options.baseline ?? readJsonIfExists(join(rootDir, BASELINE_PATH));
  const baselineMissing = baseline[rel] ?? baseline[skill] ?? [];
  const missing = missingPresentationItems(skillDir);
  if (missing.length === 0) return [];

  const baselineSet = new Set(baselineMissing);
  const onlyBaselineDebt = missing.every((item) => baselineSet.has(item));
  const severity = onlyBaselineDebt ? SEVERITY.WARNING : SEVERITY.ERROR;
  const rule = onlyBaselineDebt ? "presentation.legacy-baseline" : "presentation.required";
  const missingText = missing.join(", ");
  return [
    makeError({
      validator: VALIDATOR,
      skill,
      path: rel,
      rule,
      severity,
      message: `skill presentation metadata incomplete: ${missingText}`,
      fix_hint: "add SKILL.md display_name/display_name_zh, README.md/README.zh.md frontmatter description + prompt_examples array, assets/icon.svg, assets/icon.png, and agents/openai.yaml interface.icon_small/interface.icon_large before merge",
    }),
  ];
}

export function validateRepository(rootDir = process.cwd()) {
  const results = [];
  for (const skillDir of findSkillDirs(rootDir)) {
    results.push(...validateSkillPresentationMetadata(skillDir, rootDir));
  }
  return results;
}

function main() {
  const jsonMode = process.argv.slice(2).includes("--json");
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
    process.stdout.write("presentation metadata validation passed\n");
    return;
  }

  if (warnings.length > 0) {
    process.stderr.write(`presentation metadata validation warnings (${warnings.length}):\n`);
    for (const r of warnings) {
      process.stderr.write(`⚠ ${r.path}: ${r.rule}: ${r.message}\n`);
      if (r.fix_hint) process.stderr.write(`    ↳ ${r.fix_hint}\n`);
    }
  }

  if (errors.length > 0) {
    process.stderr.write(`presentation metadata validation failed (${errors.length} error(s)):\n`);
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

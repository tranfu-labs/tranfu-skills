import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEVERITY,
  formatHuman,
  formatJSON,
  hasErrors,
  makeError,
} from "./lib/validator-types.mjs";

const ROOTS = ["meta-skills", "own-skills", "external-skills"];
const BASE_REQUIRED_FIELDS = ["name", "description", "origin"];
const OWN_REQUIRED_FIELDS = ["version", "author", "updated_at"];
const MAX_DESCRIPTION_LENGTH = 1024;
const VALIDATOR = "frontmatter";

export function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { data: {}, error: "missing frontmatter block" };
  }

  const data = {};
  const lines = match[1].split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || /^\s/.test(line)) {
      i++;
      continue;
    }

    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) {
      return { data, error: `invalid frontmatter line: ${line}` };
    }

    const [, key, rawValue] = kv;
    const blockMarker = rawValue.match(/^([>|])([+-]?)$/);
    if (blockMarker) {
      const folded = blockMarker[1] === ">";
      i++;
      const blockLines = [];

      while (i < lines.length) {
        const current = lines[i];
        if (current.trim() === "") {
          blockLines.push("");
          i++;
          continue;
        }
        if (/^\s+/.test(current)) {
          blockLines.push(current.replace(/^\s+/, ""));
          i++;
          continue;
        }
        break;
      }

      data[key] = folded
        ? blockLines.filter((entry) => entry.trim() !== "").join(" ").trim()
        : blockLines.join("\n").trim();
      continue;
    }

    data[key] = stripQuotes(rawValue.trim());
    i++;
  }

  return { data, error: null };
}

export function findSkillFiles(rootDir = process.cwd()) {
  const files = [];
  for (const root of ROOTS) {
    const fullRoot = join(rootDir, root);
    if (!existsSync(fullRoot)) continue;
    for (const dir of readdirSync(fullRoot)) {
      const skillDir = join(fullRoot, dir);
      if (!statSync(skillDir).isDirectory()) continue;
      const skillMd = join(skillDir, "SKILL.md");
      if (existsSync(skillMd)) files.push(skillMd);
    }
  }
  return files.sort();
}

function skillNameFromPath(rel) {
  const parts = rel.split("/");
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return rel;
}

function requiredFieldsForPath(rel) {
  if (rel.split("/")[0] === "external-skills") return BASE_REQUIRED_FIELDS;
  return [...BASE_REQUIRED_FIELDS, ...OWN_REQUIRED_FIELDS];
}

export function validateSkillFile(filePath, rootDir = process.cwd()) {
  const markdown = readFileSync(filePath, "utf8");
  const { data, error } = parseFrontmatter(markdown);
  const rel = relative(rootDir, filePath);
  const skill = skillNameFromPath(rel);
  const results = [];

  if (error) {
    results.push(
      makeError({
        validator: VALIDATOR,
        skill,
        path: rel,
        rule: "frontmatter.parse",
        severity: SEVERITY.ERROR,
        message: error,
        fix_hint: "ensure file starts with `---\\n<yaml>\\n---`",
      }),
    );
    return results;
  }

  for (const field of requiredFieldsForPath(rel)) {
    if (!Object.prototype.hasOwnProperty.call(data, field) || String(data[field]).trim() === "") {
      results.push(
        makeError({
          validator: VALIDATOR,
          skill,
          path: rel,
          rule: "frontmatter.missing-field",
          severity: SEVERITY.ERROR,
          message: `missing frontmatter field "${field}"`,
          fix_hint: `add \`${field}: <value>\` to frontmatter`,
        }),
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "description") &&
    String(data.description).length > MAX_DESCRIPTION_LENGTH
  ) {
    results.push(
      makeError({
        validator: VALIDATOR,
        skill,
        path: rel,
        rule: "frontmatter.description-too-long",
        severity: SEVERITY.ERROR,
        message: `description is ${String(data.description).length} characters; max is ${MAX_DESCRIPTION_LENGTH}`,
        fix_hint: `trim description to ≤ ${MAX_DESCRIPTION_LENGTH} chars`,
      }),
    );
  }

  return results;
}

export function validateRepository(rootDir = process.cwd()) {
  const results = [];
  for (const filePath of findSkillFiles(rootDir)) {
    results.push(...validateSkillFile(filePath, rootDir));
  }
  return results;
}

function stripQuotes(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
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

  if (hasErrors(results)) {
    const errors = results.filter((r) => r.severity === SEVERITY.ERROR);
    process.stderr.write(`frontmatter validation failed (${errors.length} error(s)):\n`);
    for (const r of errors) {
      process.stderr.write(`✗ ${r.path}: ${r.message}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write("frontmatter validation passed\n");
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  main();
}

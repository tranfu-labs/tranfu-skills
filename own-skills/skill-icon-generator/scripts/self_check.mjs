#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const generatorFile = path.join(scriptDir, "generate_icon.mjs");
const iconRoot = path.join(skillRoot, "assets", "lucide");
const curatedSpecsFile = path.join(skillRoot, "assets", "curated-specs.json");
const packageFile = path.join(skillRoot, "package.json");
const lockFile = path.join(skillRoot, "package-lock.json");
const require = createRequire(import.meta.url);
const checks = [];
let tempRoot = "";
let succeeded = false;

function pass(name, detail = "") {
  checks.push({ name, status: "pass", detail });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nodeVersionAtLeast(required) {
  const current = process.versions.node.split(".").map(Number);
  const minimum = required.split(".").map(Number);
  for (let index = 0; index < Math.max(current.length, minimum.length); index += 1) {
    const difference = (current[index] || 0) - (minimum[index] || 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

function runGenerator(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [generatorFile, ...args], {
    cwd: tempRoot,
    encoding: "utf8",
    env: { ...process.env },
  });
  if (result.error) throw result.error;
  assert(
    result.status === expectedStatus,
    `generator exited ${result.status}, expected ${expectedStatus}: ${result.stderr || result.stdout}`,
  );
  return result;
}

function parseSummary(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`generator did not return JSON: ${result.stdout || result.stderr}`);
  }
}

function writeSkill(folderName, name, description, openaiYaml = "") {
  const target = path.join(tempRoot, folderName);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(
    path.join(target, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
  );
  if (openaiYaml) {
    fs.mkdirSync(path.join(target, "agents"), { recursive: true });
    fs.writeFileSync(path.join(target, "agents", "openai.yaml"), openaiYaml);
  }
  return target;
}

function verifyOutput(target, family) {
  const colors = {
    strategy: ["#FFF3E8", "#EA580C"],
    content: ["#F1EAFE", "#6D28D9"],
    engineering: ["#EAF2FF", "#2563EB"],
    operations: ["#EAF8F2", "#15805D"],
  };
  const svgFile = path.join(target, "assets", "icon.svg");
  const pngFile = path.join(target, "assets", "icon.png");
  const yamlFile = path.join(target, "agents", "openai.yaml");
  assert(fs.existsSync(svgFile), `missing ${svgFile}`);
  assert(fs.existsSync(pngFile), `missing ${pngFile}`);
  assert(fs.existsSync(yamlFile), `missing ${yamlFile}`);

  const svg = fs.readFileSync(svgFile, "utf8");
  const [background, stroke] = colors[family];
  for (const expected of [
    'width="48"',
    'height="48"',
    'viewBox="0 0 48 48"',
    `fill="${background}"`,
    `stroke="${stroke}"`,
    'stroke-width="1.6"',
  ]) {
    assert(svg.includes(expected), `SVG is missing ${expected}`);
  }
  for (const forbidden of ["<script", "<text", "<filter", "<linearGradient", "<image"]) {
    assert(!svg.includes(forbidden), `SVG contains forbidden element ${forbidden}`);
  }

  const png = fs.readFileSync(pngFile);
  assert(png.length >= 24, "PNG is too short");
  assert(png.toString("hex", 0, 8) === "89504e470d0a1a0a", "invalid PNG signature");
  assert(png.readUInt32BE(16) === 48 && png.readUInt32BE(20) === 48, "PNG is not 48×48");

  const yaml = fs.readFileSync(yamlFile, "utf8");
  assert(yaml.includes('icon_small: "./assets/icon.svg"'), "openai.yaml is missing icon_small");
  assert(yaml.includes('icon_large: "./assets/icon.png"'), "openai.yaml is missing icon_large");
}

try {
  assert(nodeVersionAtLeast("20.9.0"), `Node.js ${process.versions.node} is too old; require >=20.9.0`);
  pass("node-version", process.versions.node);

  for (const file of [generatorFile, curatedSpecsFile, packageFile, lockFile]) {
    assert(fs.existsSync(file), `required runtime file is missing: ${file}`);
  }
  pass("runtime-files");

  const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  const packageLock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
  assert(packageJson.version === packageLock.packages[""].version, "lockfile root version differs");
  assert(
    packageJson.dependencies.sharp === packageLock.packages[""].dependencies.sharp,
    "Sharp version differs between package.json and package-lock.json",
  );
  pass("package-lock", packageJson.version);

  let sharpFile;
  try {
    sharpFile = require.resolve("sharp");
  } catch {
    throw new Error(
      `Sharp is not installed in the Skill; run npm install --prefix "${skillRoot}" --no-package-lock`,
    );
  }
  const relativeSharp = path.relative(skillRoot, sharpFile);
  assert(
    !relativeSharp.startsWith("..") && !path.isAbsolute(relativeSharp),
    `Sharp resolved outside the Skill: ${sharpFile}; run npm install --prefix "${skillRoot}" --no-package-lock`,
  );
  const sharp = (await import("sharp")).default;
  const probe = await sharp({
    create: { width: 1, height: 1, channels: 4, background: "#00000000" },
  })
    .png()
    .toBuffer();
  assert(probe.toString("hex", 0, 8) === "89504e470d0a1a0a", "Sharp PNG probe failed");
  pass("sharp-local-runtime", sharpFile);

  const icons = fs
    .readdirSync(iconRoot)
    .filter((file) => file.endsWith(".svg"))
    .map((file) => path.basename(file, ".svg"))
    .sort();
  assert(icons.length === 60, `expected 60 bundled icons, found ${icons.length}`);
  const iconSet = new Set(icons);
  pass("bundled-icons", String(icons.length));

  const curatedSpecs = JSON.parse(fs.readFileSync(curatedSpecsFile, "utf8"));
  const families = new Set(["strategy", "content", "engineering", "operations"]);
  const curatedEntries = Object.entries(curatedSpecs);
  assert(curatedEntries.length >= 61, `expected at least 61 curated mappings, found ${curatedEntries.length}`);
  for (const [slug, spec] of curatedEntries) {
    assert(Array.isArray(spec) && spec.length === 3, `${slug} has an invalid curated mapping`);
    assert(families.has(spec[0]), `${slug} has unknown family ${spec[0]}`);
    assert(iconSet.has(spec[1]), `${slug} references missing icon ${spec[1]}`);
    assert(typeof spec[2] === "string" && spec[2].length > 0, `${slug} has no metaphor`);
  }
  pass("curated-mappings", String(curatedEntries.length));

  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-icon-generator-self-check-"));

  const curatedTarget = writeSkill(
    "curated",
    "ai-startup-feasibility-check",
    "检查 AI 创业方向是否可行。",
  );
  const curated = parseSummary(runGenerator([curatedTarget]));
  assert(
    curated.selection_source === "curated" &&
      curated.family === "strategy" &&
      curated.lucide_icon === "rocket",
    `curated scenario changed: ${JSON.stringify(curated)}`,
  );
  verifyOutput(curatedTarget, "strategy");
  pass("scenario-curated", "strategy/rocket");

  const preservedYaml =
    'interface:\n  display_name: "Growth Planner"\n  brand_color: "#123456"\npolicy:\n  allow_implicit_invocation: false\n';
  const keywordTarget = writeSkill(
    "keyword",
    "user-growth-strategy",
    "为产品制定用户增长、获客、拉新与留存策略。",
    preservedYaml,
  );
  const keyword = parseSummary(runGenerator([path.join(keywordTarget, "SKILL.md")]));
  assert(
    keyword.selection_source === "keyword" &&
      keyword.family === "strategy" &&
      keyword.lucide_icon === "chart-no-axes-combined",
    `keyword scenario changed: ${JSON.stringify(keyword)}`,
  );
  verifyOutput(keywordTarget, "strategy");
  const updatedYaml = fs.readFileSync(path.join(keywordTarget, "agents", "openai.yaml"), "utf8");
  for (const preserved of [
    'display_name: "Growth Planner"',
    'brand_color: "#123456"',
    "allow_implicit_invocation: false",
  ]) {
    assert(updatedYaml.includes(preserved), `openai.yaml did not preserve ${preserved}`);
  }
  pass("scenario-keyword-and-yaml-preservation", "strategy/chart-no-axes-combined");

  const fallbackTarget = writeSkill(
    "fallback",
    "quartz-orbit-helper",
    "Organize a novel task with no registered semantic keyword.",
  );
  const fallbackOne = parseSummary(runGenerator([fallbackTarget, "--dry-run"]));
  const fallbackTwo = parseSummary(runGenerator([fallbackTarget, "--dry-run"]));
  assert(fallbackOne.selection_source === "stable-hash", "fallback scenario did not use stable hash");
  assert(
    fallbackOne.family === fallbackTwo.family &&
      fallbackOne.lucide_icon === fallbackTwo.lucide_icon,
    "stable fallback changed between identical runs",
  );
  pass("scenario-stable-fallback", `${fallbackOne.family}/${fallbackOne.lucide_icon}`);

  const manualTarget = writeSkill("manual", "manual-icon-choice", "Create a manually selected icon.");
  const manual = parseSummary(
    runGenerator([
      manualTarget,
      "--family",
      "content",
      "--icon",
      "pen-tool",
      "--metaphor",
      "人工选择",
    ]),
  );
  assert(
    manual.selection_source === "manual" &&
      manual.family === "content" &&
      manual.lucide_icon === "pen-tool",
    `manual scenario changed: ${JSON.stringify(manual)}`,
  );
  verifyOutput(manualTarget, "content");
  pass("scenario-manual", "content/pen-tool");

  const overwrite = runGenerator([keywordTarget], 1);
  assert(overwrite.stderr.includes("already has icon.svg or icon.png"), "overwrite protection did not explain failure");
  const forced = parseSummary(runGenerator([keywordTarget, "--force"]));
  assert(forced.skill === "user-growth-strategy", "forced replacement targeted the wrong Skill");
  verifyOutput(keywordTarget, "strategy");
  pass("scenario-overwrite-protection-and-force");

  const missing = runGenerator([path.join(tempRoot, "missing")], 1);
  assert(missing.stderr.includes("target must be a Skill directory or SKILL.md"), "missing target failure changed");

  const invalidTarget = path.join(tempRoot, "invalid");
  fs.mkdirSync(invalidTarget);
  fs.writeFileSync(path.join(invalidTarget, "SKILL.md"), "---\nname: invalid\n---\n");
  const invalid = runGenerator([invalidTarget], 1);
  assert(invalid.stderr.includes("missing a non-empty description"), "invalid frontmatter failure changed");
  pass("scenario-invalid-inputs");

  succeeded = true;
  console.log("SELF_CHECK_PASS");
  console.log(
    JSON.stringify(
      {
        skill_root: skillRoot,
        node: process.versions.node,
        checks,
        scenarios: 7,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error("SELF_CHECK_FAIL");
  console.error(error instanceof Error ? error.message : String(error));
  if (tempRoot) console.error(`Temporary diagnostics retained at: ${tempRoot}`);
  process.exitCode = 1;
} finally {
  if (succeeded && tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
}

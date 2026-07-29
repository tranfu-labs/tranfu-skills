#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  compareCuratedIcons,
  formatSimilarity,
  MAX_ICON_SIMILARITY,
  perceptualSimilarity,
} from "./icon_similarity.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const generatorFile = path.join(scriptDir, "generate_icon.mjs");
const similarityFile = path.join(scriptDir, "icon_similarity.mjs");
const iconRoot = path.join(skillRoot, "assets", "lucide");
const curatedSpecsFile = path.join(skillRoot, "assets", "curated-specs.json");
const brandRegistryFile = path.join(skillRoot, "assets", "brand-registry.json");
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

function verifyOutput(target, family, markType = "lucide", colorOverride = null) {
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
  const [background, stroke] = colorOverride || colors[family];
  const styleExpectations =
    markType === "brand"
      ? [`fill="${stroke}"`, 'stroke="none"']
      : [`stroke="${stroke}"`, 'stroke-width="1.6"'];
  for (const expected of [
    'width="48"',
    'height="48"',
    'viewBox="0 0 48 48"',
    `fill="${background}"`,
    ...styleExpectations,
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

  for (const file of [
    generatorFile,
    similarityFile,
    curatedSpecsFile,
    brandRegistryFile,
    packageFile,
    lockFile,
  ]) {
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
  assert(icons.length === 73, `expected 73 bundled marks, found ${icons.length}`);
  const iconSet = new Set(icons);
  pass("bundled-icons", String(icons.length));
  const brandIcons = icons.filter((name) => name.startsWith("brand-"));
  for (const icon of brandIcons) {
    const source = fs.readFileSync(path.join(iconRoot, `${icon}.svg`), "utf8");
    assert(/viewBox=["']0 0 24 24["']/.test(source), `${icon} does not use a 24×24 viewBox`);
    assert(source.includes("brand-source:"), `${icon} has no brand-source comment`);
    for (const forbidden of ["<script", "<text", "<filter", "<linearGradient", "<image", "<foreignObject"]) {
      assert(!source.includes(forbidden), `${icon} contains forbidden element ${forbidden}`);
    }
  }
  assert(brandIcons.length === 7, `expected 7 bundled brand marks, found ${brandIcons.length}`);
  pass("brand-masters", String(brandIcons.length));

  const brandRegistry = JSON.parse(fs.readFileSync(brandRegistryFile, "utf8"));
  const brandEntries = Object.entries(brandRegistry);
  assert(brandEntries.length === 7, `expected 7 registered brands, found ${brandEntries.length}`);
  const registeredAliases = new Set();
  for (const [brand, spec] of brandEntries) {
    assert(
      Array.isArray(spec.aliases) && spec.aliases.length > 0,
      `${brand} has no brand aliases`,
    );
    assert(iconSet.has(spec.default_icon), `${brand} references missing ${spec.default_icon}`);
    assert(
      spec.default_icon.startsWith("brand-"),
      `${brand} default icon is not a brand mark`,
    );
    assert(/^#[0-9A-F]{6}$/.test(spec.foreground), `${brand} has invalid foreground`);
    assert(spec.background === "#F0F0F0", `${brand} must use the shared #F0F0F0 background`);
    assert(spec.foreground !== spec.background, `${brand} brand colors have no contrast`);
    for (const alias of spec.aliases) {
      const normalizedAlias = alias.toLowerCase();
      assert(!registeredAliases.has(normalizedAlias), `duplicate brand alias ${alias}`);
      registeredAliases.add(normalizedAlias);
    }
  }
  assert(
    new Set(brandEntries.map(([, spec]) => spec.default_icon)).size === brandIcons.length,
    "each registered brand must have exactly one bundled logo",
  );
  pass("brand-registry", String(brandEntries.length));

  const curatedSpecs = JSON.parse(fs.readFileSync(curatedSpecsFile, "utf8"));
  const families = new Set(["strategy", "content", "engineering", "operations"]);
  const curatedEntries = Object.entries(curatedSpecs);
  assert(curatedEntries.length >= 62, `expected at least 62 curated mappings, found ${curatedEntries.length}`);
  for (const [slug, spec] of curatedEntries) {
    assert(Array.isArray(spec) && spec.length === 3, `${slug} has an invalid curated mapping`);
    assert(families.has(spec[0]), `${slug} has unknown family ${spec[0]}`);
    assert(iconSet.has(spec[1]), `${slug} references missing icon ${spec[1]}`);
    assert(typeof spec[2] === "string" && spec[2].length > 0, `${slug} has no metaphor`);
  }
  pass("curated-mappings", String(curatedEntries.length));
  assert(
    curatedSpecs["format-content"][1] === curatedSpecs["wechat-sketch-cover"][1] &&
      curatedSpecs["github-delivery-check"][1] ===
        curatedSpecs["github-repo-completeness"][1] &&
      curatedSpecs["xiaohongshu-card-publish"][1] ===
        curatedSpecs["xiaohongshu-writing"][1],
    "same-brand Skills do not reuse one canonical brand logo",
  );
  pass("same-brand-logo-reuse");

  const curatedComparisons = await compareCuratedIcons(curatedSpecs, iconRoot, sharp);
  const similarityViolations = curatedComparisons.filter(
    (item) => item.similarity > MAX_ICON_SIMILARITY,
  );
  assert(
    similarityViolations.length === 0,
    `curated icons exceed ${formatSimilarity(MAX_ICON_SIMILARITY)}: ` +
      similarityViolations
        .slice(0, 5)
        .map(
          (item) =>
            `${item.left_slug}/${item.left_icon} <> ${item.right_slug}/${item.right_icon} ` +
            `(${formatSimilarity(item.similarity)})`,
        )
        .join(", "),
  );
  const closestCuratedPair = curatedComparisons[0];
  pass(
    "curated-perceptual-similarity",
    `${formatSimilarity(closestCuratedPair.similarity)} ` +
      `${closestCuratedPair.left_slug}/${closestCuratedPair.left_icon} <> ` +
      `${closestCuratedPair.right_slug}/${closestCuratedPair.right_icon}`,
  );

  const boundaryHashA = Array(64).fill(false);
  const boundaryHashB = Array(64).fill(false);
  for (let index = 0; index < 16; index += 1) boundaryHashB[index] = true;
  assert(
    perceptualSimilarity(boundaryHashA, boundaryHashB) === MAX_ICON_SIMILARITY,
    "50% perceptual similarity boundary changed",
  );
  pass("perceptual-similarity-boundary", "50.0% allowed; >50.0% rejected");

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

  const brandTarget = writeSkill(
    "brand",
    "weibo-notes",
    "Draft and organize short-form notes for Sina Weibo.",
  );
  const brand = parseSummary(runGenerator([brandTarget]));
  assert(
    brand.selection_source === "curated" &&
      brand.family === "content" &&
      brand.mark_type === "brand" &&
      brand.brand_source.includes("Simple Icons 15.7.0") &&
      brand.lucide_icon === "brand-sina-weibo" &&
      brand.foreground_color === "#E6162D" &&
      brand.background_color === "#F0F0F0",
    `brand scenario changed: ${JSON.stringify(brand)}`,
  );
  verifyOutput(
    brandTarget,
    "content",
    "brand",
    [brand.background_color, brand.foreground_color],
  );
  pass("scenario-brand", "content/brand-sina-weibo");

  for (const [brand, spec] of brandEntries) {
    const registeredBrandTarget = writeSkill(
      `registered-brand-${brand}`,
      `${spec.aliases[0]}-integration-helper`,
      "Organize work for one explicitly named product integration.",
    );
    const registeredBrand = parseSummary(runGenerator([registeredBrandTarget]));
    assert(
      registeredBrand.selection_source === "brand-registry" &&
        registeredBrand.family === spec.default_family &&
        registeredBrand.mark_type === "brand" &&
        registeredBrand.lucide_icon === spec.default_icon &&
        registeredBrand.foreground_color === spec.foreground &&
        registeredBrand.background_color === spec.background,
      `registered brand scenario changed for ${brand}: ${JSON.stringify(registeredBrand)}`,
    );
    verifyOutput(
      registeredBrandTarget,
      spec.default_family,
      "brand",
      [spec.background, spec.foreground],
    );
  }
  pass("scenario-brand-registry", `${brandEntries.length} registered brands`);

  const preservedYaml =
    'interface:\n  display_name: "Growth Planner"\n  brand_color: "#123456"\npolicy:\n  allow_implicit_invocation: false\n';
  const keywordTarget = writeSkill(
    "keyword",
    "mcp-docs-connector",
    "Connect to an MCP server that exposes official documentation.",
    preservedYaml,
  );
  const keyword = parseSummary(runGenerator([path.join(keywordTarget, "SKILL.md")]));
  assert(
    keyword.selection_source === "keyword" &&
      keyword.family === "engineering" &&
      keyword.lucide_icon === "server-cog" &&
      keyword.similarity_method === "normalized-phash" &&
      keyword.similarity_limit === MAX_ICON_SIMILARITY,
    `keyword scenario changed: ${JSON.stringify(keyword)}`,
  );
  verifyOutput(keywordTarget, "engineering");
  const updatedYaml = fs.readFileSync(path.join(keywordTarget, "agents", "openai.yaml"), "utf8");
  for (const preserved of [
    'display_name: "Growth Planner"',
    'brand_color: "#123456"',
    "allow_implicit_invocation: false",
  ]) {
    assert(updatedYaml.includes(preserved), `openai.yaml did not preserve ${preserved}`);
  }
  pass("scenario-keyword-and-yaml-preservation", "engineering/server-cog");

  const fallbackTarget = writeSkill(
    "fallback",
    "quartz-orbit-3",
    "Organize a novel task with no registered semantic term.",
  );
  const fallbackOne = parseSummary(runGenerator([fallbackTarget, "--dry-run"]));
  const fallbackTwo = parseSummary(runGenerator([fallbackTarget, "--dry-run"]));
  assert(
    fallbackOne.selection_source === "stable-hash" &&
      fallbackOne.mark_type === "lucide",
    "fallback scenario did not use a non-brand stable hash",
  );
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
      "engineering",
      "--icon",
      "server-cog",
      "--metaphor",
      "人工选择的服务图标",
    ]),
  );
  assert(
    manual.selection_source === "manual" &&
      manual.family === "engineering" &&
      manual.lucide_icon === "server-cog",
    `manual scenario changed: ${JSON.stringify(manual)}`,
  );
  verifyOutput(manualTarget, "engineering");
  pass("scenario-manual", "engineering/server-cog");

  const duplicateTarget = writeSkill(
    "duplicate",
    "duplicate-icon-choice",
    "Try to reuse an already reserved icon.",
  );
  const duplicate = runGenerator(
    [
      duplicateTarget,
      "--family",
      "content",
      "--icon",
      "pen-tool",
      "--metaphor",
      "重复图标",
    ],
    1,
  );
  assert(
    duplicate.stderr.includes("100.0% perceptually similar"),
    "exact duplicate did not fail the perceptual gate",
  );
  assert(!fs.existsSync(path.join(duplicateTarget, "assets")), "duplicate failure wrote partial assets");
  pass("scenario-exact-duplicate-rejected");

  const similarTarget = writeSkill(
    "similar",
    "similar-icon-choice",
    "Try to use an icon that is visually too similar.",
  );
  const similar = runGenerator(
    [
      similarTarget,
      "--family",
      "operations",
      "--icon",
      "key-round",
      "--metaphor",
      "相似图标",
    ],
    1,
  );
  assert(
    similar.stderr.includes("perceptually similar") &&
      similar.stderr.includes("maximum allowed is 50.0%"),
    "high-similarity icon did not fail the perceptual gate",
  );
  assert(!fs.existsSync(path.join(similarTarget, "assets")), "similarity failure wrote partial assets");
  pass("scenario-over-50-percent-rejected");

  const overwrite = runGenerator([keywordTarget], 1);
  assert(overwrite.stderr.includes("already has icon.svg or icon.png"), "overwrite protection did not explain failure");
  const forced = parseSummary(runGenerator([keywordTarget, "--force"]));
  assert(forced.skill === "mcp-docs-connector", "forced replacement targeted the wrong Skill");
  verifyOutput(keywordTarget, "engineering");
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
        scenarios: 11,
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

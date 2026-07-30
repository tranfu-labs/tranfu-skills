#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  MAX_ICON_SIMILARITY,
  compareCandidateToRepository,
  normalizeShapeSvg,
  perceptualHash,
  perceptualSimilarity,
  repositoryIconInventory,
} from "./icon_similarity.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const generator = path.join(scriptDir, "generate_icon.mjs");
const iconRoot = path.join(skillRoot, "assets", "lucide");
const brandRegistryFile = path.join(skillRoot, "assets", "brand-registry.json");
const checks = [];
let tempRoot = "";

function pass(name, detail = "") {
  checks.push({ name, status: "pass", detail });
}

function runGenerator(args, expectedStatus = 0, cwd = tempRoot) {
  const result = spawnSync(process.execPath, [generator, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, TRANFU_SKILLS_REPOSITORY: "" },
  });
  assert.equal(
    result.status,
    expectedStatus,
    `generator status ${result.status}, expected ${expectedStatus}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function parseSummary(result) {
  return JSON.parse(result.stdout);
}

function masterSource(icon) {
  return fs.readFileSync(path.join(iconRoot, `${icon}.svg`), "utf8");
}

function masterChildren(icon) {
  const source = masterSource(icon);
  const match = source.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  assert(match, `invalid master ${icon}`);
  return match[1].trim();
}

function generatedSvg(icon, background = "#F1EAFE", foreground = "#6D28D9") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="${background}"/>
  <g transform="translate(9 9) scale(1.25)" fill="none" stroke="${foreground}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    ${masterChildren(icon)}
  </g>
</svg>
`;
}

function writeSkill(repository, name, description, icon = "") {
  const skillDir = path.join(repository, "own-skills", name);
  fs.mkdirSync(path.join(skillDir, "agents"), { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: >-\n  ${description}\n---\n\n# ${name}\n`,
  );
  fs.writeFileSync(
    path.join(skillDir, "agents", "openai.yaml"),
    `interface:\n  display_name: "${name}"\n  short_description: "test fixture"\n`,
  );
  if (icon) {
    fs.mkdirSync(path.join(skillDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(skillDir, "assets", "icon.svg"), generatedSvg(icon));
  }
  return skillDir;
}

function pngDimensions(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

async function main() {
  const major = Number(process.versions.node.split(".")[0]);
  assert(major >= 20, `Node.js 20+ required, got ${process.versions.node}`);
  pass("node-version", process.versions.node);

  const sharp = (await import("sharp")).default;
  pass("sharp-runtime", path.dirname(import.meta.resolve("sharp")));

  assert.equal(MAX_ICON_SIMILARITY, 0.7);
  const baselineHash = Array(63).fill(false);
  const aboveLimitHash = baselineHash.map((value, index) =>
    index < 9 ? !value : value,
  );
  const belowLimitHash = baselineHash.map((value, index) =>
    index < 10 ? !value : value,
  );
  assert(perceptualSimilarity(baselineHash, aboveLimitHash) > MAX_ICON_SIMILARITY);
  assert(perceptualSimilarity(baselineHash, belowLimitHash) <= MAX_ICON_SIMILARITY);
  pass("duplicate-limit", ">70% rejected; <=70% accepted");

  const icons = fs
    .readdirSync(iconRoot)
    .filter((file) => file.endsWith(".svg"))
    .map((file) => path.basename(file, ".svg"));
  assert(icons.length >= 72, `expected at least 72 marks, found ${icons.length}`);
  for (const required of [
    "images",
    "gallery-thumbnails",
    "panel-left",
    "brand-github",
    "brand-wechat",
  ]) {
    assert(icons.includes(required), `missing bundled mark ${required}`);
  }
  pass("bundled-marks", String(icons.length));

  const brandRegistry = JSON.parse(fs.readFileSync(brandRegistryFile, "utf8"));
  assert(Object.keys(brandRegistry).length >= 7);
  for (const [brand, spec] of Object.entries(brandRegistry)) {
    assert.equal(spec.background, "#F0F0F0", `${brand} background changed`);
    assert(icons.includes(spec.default_icon), `${brand} mark is missing`);
  }
  pass("brand-registry", String(Object.keys(brandRegistry).length));

  const masterHash = await perceptualHash(masterSource("gallery-thumbnails"), sharp);
  const generatedHash = await perceptualHash(generatedSvg("gallery-thumbnails"), sharp);
  assert.equal(perceptualSimilarity(masterHash, generatedHash), 1);
  assert(!normalizeShapeSvg(generatedSvg("gallery-thumbnails")).includes("#F1EAFE"));
  pass("foreground-normalization", "generated background removed; shape remains 100% identical");

  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-icon-generator-check-"));
  const repository = path.join(tempRoot, "tranfu-skills");
  fs.mkdirSync(path.join(repository, "own-skills"), { recursive: true });
  writeSkill(repository, "existing-images", "Existing image generator.", "images");
  const target = writeSkill(
    repository,
    "cover-maker",
    "Generate and visually verify article cover images.",
  );

  const inventory = repositoryIconInventory(repository, "cover-maker");
  assert.equal(inventory.length, 1);
  const directComparison = await compareCandidateToRepository({
    candidateSource: masterSource("images"),
    repositoryRoot: repository,
    targetSkillName: "cover-maker",
    sharp,
  });
  assert.equal(directComparison.comparisons[0].similarity, 1);
  pass("live-repository-inventory", directComparison.comparisons[0].relative_path);

  const retry = parseSummary(
    runGenerator([target, "--repository", repository, "--dry-run"]),
  );
  assert.equal(retry.attempts[0].icon, "images");
  assert.equal(retry.attempts[0].result, "rejected");
  assert.equal(retry.attempts[0].closest_match.similarity, 1);
  assert.equal(retry.attempts[1].result, "accepted");
  assert.equal(retry.lucide_icon, retry.attempts[1].icon);
  assert(retry.closest_match.similarity <= MAX_ICON_SIMILARITY);
  assert.equal(retry.background_color, "#F1EAFE");
  pass(
    "automatic-regeneration",
    `${retry.attempts[0].icon} rejected; ${retry.lucide_icon} accepted`,
  );

  const exhaustedRepository = path.join(tempRoot, "exhausted-repository");
  fs.mkdirSync(path.join(exhaustedRepository, "own-skills"), { recursive: true });
  for (const icon of [
    "images",
    "gallery-thumbnails",
    "panel-top",
    "gallery-vertical-end",
    "image-down",
    "panels-top-left",
  ]) {
    writeSkill(
      exhaustedRepository,
      `existing-${icon}`,
      `Existing ${icon} fixture.`,
      icon,
    );
  }
  const exhaustedTarget = writeSkill(
    exhaustedRepository,
    "practice-cover",
    "Generate article cover images with a fixed visual layout.",
  );
  const newCoverCandidate = parseSummary(
    runGenerator([
      exhaustedTarget,
      "--repository",
      exhaustedRepository,
      "--dry-run",
    ]),
  );
  assert.equal(newCoverCandidate.attempts.length, 7);
  assert(
    newCoverCandidate.attempts
      .slice(0, 6)
      .every((attempt) => attempt.result === "rejected"),
  );
  assert.equal(newCoverCandidate.attempts[6].icon, "panel-left");
  assert.equal(newCoverCandidate.attempts[6].result, "accepted");
  assert.equal(newCoverCandidate.lucide_icon, "panel-left");
  pass(
    "new-cover-candidate",
    "six duplicate cover marks rejected; panel-left accepted",
  );

  writeSkill(
    exhaustedRepository,
    "existing-panel-left",
    "Existing panel-left fixture.",
    "panel-left",
  );
  const fullyExhaustedTarget = writeSkill(
    exhaustedRepository,
    "practice-cover-exhausted",
    "Generate article cover images with a fixed visual layout.",
  );
  const exhausted = runGenerator(
    [fullyExhaustedTarget, "--repository", exhaustedRepository, "--dry-run"],
    1,
  );
  assert(exhausted.stderr.includes("add a new official Lucide master"));
  assert(!exhausted.stderr.includes('"icon": "notebook-pen"'));
  pass("primary-semantics-do-not-fallback", "cover candidates exhausted; writing icon not used");

  const manualDuplicate = runGenerator(
    [
      target,
      "--repository",
      repository,
      "--icon",
      "images",
      "--family",
      "content",
      "--dry-run",
    ],
    1,
  );
  assert(manualDuplicate.stderr.includes("all semantically relevant candidates"));
  assert(!fs.existsSync(path.join(target, "assets")));
  pass("duplicate-rejected-before-background");

  const generated = parseSummary(
    runGenerator([target, "--repository", repository]),
  );
  assert.equal(generated.lucide_icon, retry.lucide_icon);
  const svgFile = path.join(target, "assets", "icon.svg");
  const pngFile = path.join(target, "assets", "icon.png");
  const svg = fs.readFileSync(svgFile, "utf8");
  assert(svg.includes('<rect width="48" height="48" fill="#F1EAFE"/>'));
  assert.deepEqual(pngDimensions(pngFile), [48, 48]);
  const pngStats = await sharp(pngFile).ensureAlpha().stats();
  assert.equal(pngStats.channels[3].min, 255);
  const yaml = fs.readFileSync(path.join(target, "agents", "openai.yaml"), "utf8");
  assert(yaml.includes('icon_small: "./assets/icon.svg"'));
  assert(yaml.includes('icon_large: "./assets/icon.png"'));
  assert(yaml.includes('display_name: "cover-maker"'));
  pass("background-after-acceptance", "#F1EAFE; PNG fully opaque");

  const missingRepositoryTarget = writeSkill(
    tempRoot,
    "plain-helper",
    "Create a generic helper artifact.",
  );
  const missingRepository = runGenerator(
    [
      missingRepositoryTarget,
      "--repository",
      path.join(tempRoot, "not-a-repository"),
      "--dry-run",
    ],
    1,
  );
  assert(missingRepository.stderr.includes("existing Skill repository was not found"));
  pass("missing-repository-fails");

  const noSemanticTarget = writeSkill(
    repository,
    "opaque-helper",
    "Transform an opaque input into an output.",
  );
  const noSemantic = runGenerator(
    [noSemanticTarget, "--repository", repository, "--dry-run"],
    1,
  );
  assert(noSemantic.stderr.includes("no semantically relevant candidate group"));
  assert(!fs.existsSync(path.join(noSemanticTarget, "assets")));
  pass("no-stable-hash-fallback");

  const brandTarget = writeSkill(
    tempRoot,
    "github-release-helper",
    "Prepare GitHub release material.",
  );
  const brand = parseSummary(runGenerator([brandTarget]));
  assert.equal(brand.mark_type, "brand");
  assert.equal(brand.brand_name, "github");
  assert.equal(brand.lucide_icon, "brand-github");
  assert.equal(brand.background_color, "#F0F0F0");
  assert.equal(brand.similarity_method, "skipped-for-brand");
  const brandSvg = fs.readFileSync(path.join(brandTarget, "assets", "icon.svg"), "utf8");
  assert(brandSvg.includes('<rect width="48" height="48" fill="#F0F0F0"/>'));
  pass("brand-direct-logo", "GitHub logo on #F0F0F0");

  const existingTarget = runGenerator([target, "--repository", repository], 1);
  assert(existingTarget.stderr.includes("target already has icon.svg or icon.png"));
  const forced = parseSummary(
    runGenerator([target, "--repository", repository, "--force"]),
  );
  assert.equal(forced.lucide_icon, generated.lucide_icon);
  pass("overwrite-protection-and-force");

  console.log("SELF_CHECK_PASS");
  console.log(
    JSON.stringify(
      {
        skill_root: skillRoot,
        node: process.versions.node,
        checks,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(`SELF_CHECK_FAIL: ${error.stack || error}`);
    process.exitCode = 1;
  })
  .finally(() => {
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

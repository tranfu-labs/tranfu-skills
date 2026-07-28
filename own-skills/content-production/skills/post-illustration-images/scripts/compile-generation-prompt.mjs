#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, posix, relative, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SKILL_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const TEXT_VARIANTS = new Set(["primary", "compact"]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeRelativePath(value) {
  return typeof value === "string" && value.length > 0 && !value.includes("\\")
    && !isAbsolute(value) && !win32.isAbsolute(value) && posix.normalize(value) === value
    && value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

function orderedText(variant) {
  return [variant.headline, ...variant.labels, variant.supporting_copy, variant.footer]
    .filter((value) => value !== null);
}

export function readableTextForVariant(anchor, textVariant) {
  invariant(TEXT_VARIANTS.has(textVariant), "text_variant must be primary or compact");
  const value = anchor?.text_content?.[textVariant];
  invariant(plain(value) && typeof value.headline === "string" && Array.isArray(value.labels),
    `anchor.text_content.${textVariant} is invalid`);
  return orderedText(value);
}

function quote(value) {
  return JSON.stringify(value);
}

export function compileGenerationPrompt({ styleSpec, anchor, textVariant, generationGeometry, brand }) {
  invariant(plain(styleSpec) && typeof styleSpec.generationPrompt === "string"
    && styleSpec.generationPrompt.trim(), "Style Spec generationPrompt is required");
  invariant(styleSpec.textPolicy?.defaultMode === "allowlist"
    && styleSpec.textPolicy?.iconsOnlyAllowed === false, "Style Spec must require allowlist text");
  invariant(plain(anchor) && typeof anchor.core_meaning === "string"
    && typeof anchor.structure === "string" && typeof anchor.visual_metaphor === "string"
    && typeof anchor.main_action === "string" && Array.isArray(anchor.suggested_elements),
  "Approved anchor is invalid");
  invariant(plain(generationGeometry) && typeof generationGeometry.target_aspect_ratio === "string",
    "Approved generation geometry is invalid");
  invariant(plain(brand) && typeof brand.enabled === "boolean", "Approved brand policy is invalid");

  const variant = anchor.text_content?.[textVariant];
  const readableText = readableTextForVariant(anchor, textVariant);
  const [ratioWidth, ratioHeight] = generationGeometry.target_aspect_ratio.split(":").map(Number);
  invariant(ratioWidth > 0 && ratioHeight > 0, "Target aspect ratio is invalid");
  const contentSafeArea = styleSpec.layout?.contentSafeArea;
  invariant(plain(contentSafeArea), "Style Spec content safe area is required");

  const textLines = [
    `- Headline: ${quote(variant.headline)}`,
    ...variant.labels.map((label, index) => `- Label ${index + 1}: ${quote(label)}`),
    ...(variant.supporting_copy === null ? [] : [`- Supporting copy: ${quote(variant.supporting_copy)}`]),
    ...(variant.footer === null ? [] : [`- Footer: ${quote(variant.footer)}`])
  ];
  const brandLine = brand.enabled
    ? "Keep the registered top-right brand slot naturally clear of important content; do not draw or mark the slot."
    : "The brand slot is inactive; do not reserve or mark it.";
  const prompt = [
    "# Illustration Generation Prompt",
    "",
    "Generate exactly one image from this approved contract.",
    "",
    "## Visual System",
    styleSpec.generationPrompt.trim(),
    `Target aspect ratio: ${generationGeometry.target_aspect_ratio} (${Number((ratioWidth / ratioHeight).toFixed(6))}).`,
    `Keep meaningful content within design coordinates x=${contentSafeArea.x}, y=${contentSafeArea.y}, width=${contentSafeArea.width}, height=${contentSafeArea.height}.`,
    brandLine,
    "",
    "## Approved Content",
    `- Core meaning: ${anchor.core_meaning}`,
    `- Structure: ${anchor.structure}`,
    `- Visual metaphor: ${anchor.visual_metaphor}`,
    `- Main action: ${anchor.main_action}`,
    `- Suggested elements: ${anchor.suggested_elements.join(", ")}`,
    "",
    "## Readable Text Allowlist",
    "Render every item below exactly once and add no other readable text:",
    ...textLines,
    "",
    "## Hard Constraints",
    "Do not draw a logo, TF mark, Tranfu text, watermark, model signature, page-number badge, placeholder frame, reserve box, or visible brand-slot marker.",
    "Do not invent, omit, duplicate, paraphrase, or misspell any readable text.",
    "Generate one image only, not a batch or contact sheet.",
    ""
  ].join("\n");
  invariant(readableText.length >= 3, "Readable text allowlist is incomplete");
  invariant(!/(?:\/Users\/|\/home\/|[A-Za-z]:\\\\)/.test(prompt),
    "Compiled prompt must not contain an absolute local path");
  return prompt;
}

async function findRunRoot(requestPath) {
  let current = dirname(requestPath);
  while (true) {
    if (existsSync(resolve(current, "run.json"))) return current;
    const parent = dirname(current);
    if (parent === current) throw new Error("run.json was not found above the request");
    current = parent;
  }
}

async function compileRequest(requestPath) {
  const absoluteRequest = resolve(requestPath);
  const request = JSON.parse(await readFile(absoluteRequest, "utf8"));
  invariant(safeRelativePath(request.style?.style_spec), "style.style_spec must be a safe relative path");
  invariant(safeRelativePath(request.artifacts?.prompt), "artifacts.prompt must be a safe relative path");
  const styleSpec = JSON.parse(await readFile(resolve(SKILL_ROOT, request.style.style_spec), "utf8"));
  invariant(styleSpec.id === request.style.id, "Style Spec does not match the approved style");
  const prompt = compileGenerationPrompt({
    styleSpec,
    anchor: request.anchor,
    textVariant: request.text_variant,
    generationGeometry: request.generation_geometry,
    brand: request.brand
  });
  return { request, runRoot: await findRunRoot(absoluteRequest), prompt };
}

function output(value, code = 0) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exitCode = code;
}

async function main() {
  const [command, requestPath] = process.argv.slice(2);
  if (command === "--help" || command === "-h") {
    process.stdout.write("Usage: compile-generation-prompt.mjs compile|check <child-request.json>\n");
    return;
  }
  if (!["compile", "check"].includes(command) || !requestPath) {
    output({ status: "BLOCKED", issue: "invalid_compiler_command" }, 2);
    return;
  }
  try {
    const compiled = await compileRequest(requestPath);
    const promptPath = resolve(compiled.runRoot, compiled.request.artifacts.prompt);
    invariant(relative(compiled.runRoot, promptPath) !== ".."
      && !relative(compiled.runRoot, promptPath).startsWith(`..${process.platform === "win32" ? "\\" : "/"}`),
    "Prompt path escapes the run root");
    if (command === "compile") {
      await mkdir(dirname(promptPath), { recursive: true });
      await writeFile(promptPath, compiled.prompt, "utf8");
    } else {
      invariant(await readFile(promptPath, "utf8") === compiled.prompt, "Saved prompt differs from deterministic compilation");
    }
    output({
      status: "PASS",
      prompt_path: compiled.request.artifacts.prompt,
      sha256: createHash("sha256").update(compiled.prompt).digest("hex")
    });
  } catch {
    output({ status: "BLOCKED", issue: "illustration_prompt_compile_failed" }, 2);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  main();
}

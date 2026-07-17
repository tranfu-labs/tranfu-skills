#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");

function usage() {
  console.error(`Usage:
  node scripts/resolve-generation-geometry.mjs \\
    --style-spec references/styles/<style>.spec.json \\
    --model gpt-image-2

Options:
  --model-profile <path>  Defaults to references/gpt-image-2-geometry.spec.json
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Invalid argument near: ${key ?? "<end>"}`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function resolvePath(pathValue) {
  if (!pathValue) return null;
  if (pathValue.startsWith("/")) return pathValue;
  const fromCwd = resolve(process.cwd(), pathValue);
  return existsSync(fromCwd) ? fromCwd : resolve(skillRoot, pathValue);
}

function readJson(pathValue, label) {
  const filePath = resolvePath(pathValue);
  if (!filePath || !existsSync(filePath)) {
    throw new Error(`${label} is missing: ${filePath ?? "<unset>"}`);
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function validateRequestSize(size, constraints) {
  const { width, height } = size;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Generation request dimensions must be positive integers");
  }
  if (Math.max(width, height) > constraints.maxEdge) {
    throw new Error(`Generation request exceeds max edge ${constraints.maxEdge}`);
  }
  if (width % constraints.edgeMultiple !== 0 || height % constraints.edgeMultiple !== 0) {
    throw new Error(`Generation request edges must be multiples of ${constraints.edgeMultiple}`);
  }
  if (Math.max(width, height) / Math.min(width, height) > constraints.maxAspectRatio) {
    throw new Error(`Generation request exceeds max aspect ratio ${constraints.maxAspectRatio}:1`);
  }
  const pixels = width * height;
  if (pixels < constraints.minPixels || pixels > constraints.maxPixels) {
    throw new Error(`Generation request pixel count ${pixels} is outside the supported range`);
  }
}

function resolveGeometry({ styleSpec, modelProfile, model }) {
  if (model !== modelProfile.model) {
    throw new Error(`No geometry profile for resolved model ${model}`);
  }

  const canvas = styleSpec.canvas;
  if (!Number.isInteger(canvas?.width) || !Number.isInteger(canvas?.height) || !canvas?.ratio) {
    throw new Error(`Style Spec ${styleSpec.id ?? "<unknown>"} has invalid canvas geometry`);
  }

  const requestSize = modelProfile.requestSizesByRatio?.[canvas.ratio];
  if (!requestSize) {
    throw new Error(`No ${model} request size for ratio ${canvas.ratio}`);
  }
  validateRequestSize(requestSize, modelProfile.constraints);

  const inputHandling = styleSpec.inputHandling;
  if (inputHandling?.preserveNativeOutput !== true) {
    throw new Error(`Style Spec ${styleSpec.id} must preserve native model output`);
  }
  if (inputHandling.outputCanvasRole !== "design-coordinate-system") {
    throw new Error(`Style Spec ${styleSpec.id} must use its canvas as a design coordinate system`);
  }
  if (inputHandling.allowPostGenerationResize !== false) {
    throw new Error(`Style Spec ${styleSpec.id} must forbid post-generation resize`);
  }
  if (!Number.isFinite(inputHandling.ratioTolerance) || inputHandling.ratioTolerance < 0) {
    throw new Error(`Style Spec ${styleSpec.id} has an invalid ratio tolerance`);
  }
  if (inputHandling.minShortEdge !== undefined && (!Number.isInteger(inputHandling.minShortEdge) || inputHandling.minShortEdge <= 0)) {
    throw new Error(`Style Spec ${styleSpec.id} has an invalid minimum short edge`);
  }

  const designRatio = canvas.width / canvas.height;
  const requestRatio = requestSize.width / requestSize.height;
  if (Math.abs(designRatio - requestRatio) > inputHandling.ratioTolerance) {
    throw new Error(`Generation request ratio does not match Style Spec ${styleSpec.id}`);
  }
  if (
    inputHandling.allowCrop !== false ||
    inputHandling.allowPadding !== false ||
    inputHandling.allowRotation !== false ||
    inputHandling.allowWrongRatioStretch !== false
  ) {
    throw new Error(`Style Spec ${styleSpec.id} must reject crop, padding, rotation, and wrong-ratio stretch`);
  }
  if (inputHandling.wrongRatioAction !== "regenerate") {
    throw new Error(`Style Spec ${styleSpec.id} must regenerate wrong-ratio output`);
  }

  return {
    style_id: styleSpec.id,
    geometry_profile: modelProfile.id,
    resolved_model: model,
    output_size_semantics: modelProfile.outputSizeSemantics,
    requested_dimensions: `${requestSize.width}x${requestSize.height}`,
    requested_width: requestSize.width,
    requested_height: requestSize.height,
    target_aspect_ratio: canvas.ratio,
    design_dimensions: `${canvas.width}x${canvas.height}`,
    design_width: canvas.width,
    design_height: canvas.height,
    delivery_dimensions: "source",
    ratio_tolerance: inputHandling.ratioTolerance,
    minimum_short_edge: inputHandling.minShortEdge ?? null,
    native_output_policy: "preserve",
    post_generation_resize: "forbidden"
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args["style-spec"] || !args.model) {
    usage();
    process.exit(1);
  }

  const styleSpec = readJson(args["style-spec"], "Style Spec");
  const modelProfile = readJson(
    args["model-profile"] ?? "references/gpt-image-2-geometry.spec.json",
    "Model geometry profile"
  );
  console.log(JSON.stringify(resolveGeometry({ styleSpec, modelProfile, model: args.model }), null, 2));
} catch (error) {
  console.error(error.message);
  usage();
  process.exit(1);
}

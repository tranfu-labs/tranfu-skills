#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync
} from "node:fs";
import {
  dirname,
  isAbsolute,
  posix,
  relative,
  resolve,
  sep,
  win32
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { renderStyleIndex } from "./generate-style-index.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = resolve(scriptDir, "..");

export const PLATFORM_BASELINES = Object.freeze({
  wechat: Object.freeze({
    specPlatform: "wechat",
    width: 1600,
    height: 1200,
    ratio: "4:3",
    orientation: "horizontal",
    contentSafeArea: Object.freeze({ x: 80, y: 80, width: 1440, height: 1040 }),
    brandReservedArea: Object.freeze({ x: 1320, y: 44, width: 240, height: 100 }),
    brandSlot: Object.freeze({ x: 1350, y: 64, width: 170, height: 46 })
  }),
  xhs: Object.freeze({
    specPlatform: "xiaohongshu",
    width: 1080,
    height: 1440,
    ratio: "3:4",
    orientation: "vertical",
    contentSafeArea: Object.freeze({ x: 80, y: 96, width: 920, height: 1248 }),
    brandReservedArea: Object.freeze({ x: 842, y: 44, width: 208, height: 90 }),
    brandSlot: Object.freeze({ x: 872, y: 64, width: 148, height: 40 })
  }),
  zhihu: Object.freeze({
    specPlatform: "zhihu",
    width: 1600,
    height: 900,
    ratio: "16:9",
    orientation: "horizontal",
    contentSafeArea: Object.freeze({ x: 80, y: 70, width: 1440, height: 760 }),
    brandReservedArea: Object.freeze({ x: 1320, y: 44, width: 240, height: 100 }),
    brandSlot: Object.freeze({ x: 1350, y: 64, width: 170, height: 46 })
  }),
  weibo: Object.freeze({
    specPlatform: "weibo",
    width: 1080,
    height: 1440,
    ratio: "3:4",
    orientation: "vertical",
    contentSafeArea: Object.freeze({ x: 80, y: 96, width: 920, height: 1248 }),
    brandReservedArea: Object.freeze({ x: 842, y: 44, width: 208, height: 90 }),
    brandSlot: Object.freeze({ x: 872, y: 64, width: 148, height: 40 })
  }),
  toutiao: Object.freeze({
    specPlatform: "toutiao",
    width: 1600,
    height: 900,
    ratio: "16:9",
    orientation: "horizontal",
    sizing: "flexible",
    minShortEdge: 900,
    contentSafeArea: Object.freeze({ x: 80, y: 70, width: 1440, height: 760 }),
    brandReservedArea: Object.freeze({ x: 1320, y: 44, width: 240, height: 100 }),
    brandSlot: Object.freeze({ x: 1350, y: 64, width: 170, height: 46 })
  })
});

const requiredRegistryPlatforms = Object.freeze(["wechat", "xhs", "zhihu"]);

const candidateFiles = Object.freeze({
  styleMarkdown: "style.md",
  styleSpec: "style.spec.json",
  provenance: "provenance.json",
  styleReference: "calibration/style-reference.png",
  qa: "qa.json"
});

const calibrationIds = Object.freeze(["concept", "process", "checklist"]);
const scoreDimensions = Object.freeze([
  "color",
  "typography",
  "texture",
  "illustration",
  "spacing",
  "composition",
  "cross_content_adaptability"
]);
const hardGates = Object.freeze([
  "dimensions",
  "aspect_ratio",
  "safe_area",
  "single_core_meaning",
  "identity_leakage",
  "brand_free"
]);
const signalKeys = Object.freeze([
  "color_roles",
  "typography_hierarchy",
  "composition",
  "shape_components",
  "material_texture",
  "illustration_icon_language"
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath, label) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  return parsed;
}

export function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || value.includes("\\")) {
    return false;
  }
  if (isAbsolute(value) || win32.isAbsolute(value) || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return false;
  }
  if (posix.normalize(value) !== value) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function resolveSafePath(basePath, relativePath, label) {
  invariant(isSafeRelativePath(relativePath), `${label} must be a safe relative POSIX path`);
  const target = resolve(basePath, relativePath);
  const back = relative(resolve(basePath), target);
  invariant(back !== ".." && !back.startsWith(`..${sep}`) && !isAbsolute(back), `${label} escapes its root`);
  return target;
}

function requireFile(basePath, relativePath, label) {
  const filePath = resolveSafePath(basePath, relativePath, label);
  invariant(existsSync(filePath), `${label} is missing: ${relativePath}`);
  invariant(lstatSync(filePath).isFile() && !lstatSync(filePath).isSymbolicLink(), `${label} must be a regular file`);

  const realBase = realpathSync(basePath);
  const realFile = realpathSync(filePath);
  const back = relative(realBase, realFile);
  invariant(back !== ".." && !back.startsWith(`..${sep}`) && !isAbsolute(back), `${label} resolves outside its root`);
  return filePath;
}

function requireNonemptyFile(basePath, relativePath, label) {
  const filePath = requireFile(basePath, relativePath, label);
  invariant(statSync(filePath).size > 0, `${label} must not be empty`);
  return filePath;
}

export function readPngSize(filePath, label = filePath) {
  const bytes = readFileSync(filePath);
  invariant(bytes.length >= 24, `${label} is too short to be a PNG`);
  invariant(bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", `${label} is not a PNG`);
  invariant(bytes.subarray(12, 16).toString("ascii") === "IHDR", `${label} has no PNG IHDR header`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  invariant(width > 0 && height > 0, `${label} has invalid PNG dimensions`);
  invariant(width <= 32768 && height <= 32768 && width * height <= 50_000_000, `${label} PNG dimensions exceed the validation limit`);
  let offset = 8;
  let first = true;
  let ended = false;
  let ihdr;
  let paletteLength = null;
  let seenPalette = false;
  let seenIdat = false;
  let idatEnded = false;
  const idat = [];
  while (offset < bytes.length) {
    invariant(offset + 12 <= bytes.length, `${label} contains a truncated PNG chunk`);
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    invariant(end <= bytes.length, `${label} contains a PNG chunk beyond end of file`);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    invariant(crc32(bytes.subarray(offset + 4, offset + 8 + length)) === bytes.readUInt32BE(offset + 8 + length), `${label} ${type} has an invalid CRC`);
    invariant(!first || (type === "IHDR" && length === 13), `${label} IHDR must be the first 13-byte chunk`);
    if (type === "IHDR") {
      invariant(!ihdr, `${label} must contain exactly one IHDR chunk`);
      invariant(data[10] === 0 && data[11] === 0 && [0, 1].includes(data[12]), `${label} has unsupported PNG IHDR fields`);
      ihdr = data;
    }
    if (type === "PLTE") {
      invariant(!seenPalette && !seenIdat, `${label} PLTE must occur at most once before IDAT`);
      seenPalette = true;
      paletteLength = length;
    }
    if (type === "IDAT") {
      invariant(!idatEnded, `${label} IDAT chunks must be consecutive`);
      seenIdat = true;
      idat.push(data);
    } else if (seenIdat) {
      idatEnded = true;
    }
    if (type === "IEND") {
      invariant(length === 0 && end === bytes.length, `${label} IEND must be empty and terminal`);
      ended = true;
    }
    first = false;
    offset = end;
  }
  invariant(ended && idat.length > 0, `${label} must contain IDAT and terminal IEND chunks`);
  const colorType = ihdr[9];
  invariant(colorType !== 3 || (paletteLength && paletteLength % 3 === 0 && paletteLength <= 768), `${label} indexed PNG requires a valid PLTE chunk`);
  const layout = pngScanlineLayout(width, height, ihdr[8], colorType, ihdr[12], label);
  let pixels;
  try {
    pixels = inflateSync(Buffer.concat(idat), { maxOutputLength: layout.expectedLength });
  } catch (error) {
    throw new Error(`${label} IDAT cannot be inflated: ${error.message}`);
  }
  invariant(pixels.length === layout.expectedLength, `${label} IDAT inflates to ${pixels.length} bytes, expected ${layout.expectedLength}`);
  let cursor = 0;
  for (const rowBytes of layout.rows) {
    invariant(pixels[cursor] <= 4, `${label} scanline uses invalid filter type ${pixels[cursor]}`);
    cursor += rowBytes + 1;
  }
  return { width, height };
}

export function readRasterInfo(filePath, label = filePath) {
  const bytes = readFileSync(filePath);
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { format: "png", ...readPngSize(filePath, label), bytes: bytes.length };
  }
  const jpeg = readJpegSize(bytes, label);
  return { format: "jpg", ...jpeg, bytes: bytes.length };
}

function readJpegSize(bytes, label) {
  invariant(bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8, `${label} is not a JPEG`);
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  let frame = null;
  let scans = 0;
  let scanBytes = 0;
  let ended = false;
  while (offset < bytes.length) {
    invariant(bytes[offset] === 0xff, `${label} contains invalid JPEG marker alignment`);
    while (bytes[offset] === 0xff) offset += 1;
    invariant(offset < bytes.length, `${label} contains a truncated JPEG marker`);
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      invariant(offset === bytes.length, `${label} JPEG EOI must be terminal`);
      ended = true;
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    invariant(offset + 2 <= bytes.length, `${label} contains a truncated JPEG segment`);
    const length = bytes.readUInt16BE(offset);
    const end = offset + length;
    invariant(length >= 2 && end <= bytes.length, `${label} contains an invalid JPEG segment`);
    if (frameMarkers.has(marker)) {
      invariant(length >= 8, `${label} contains an invalid JPEG frame`);
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      const components = bytes[offset + 7];
      invariant(width > 0 && height > 0 && components > 0 && length === 8 + 3 * components,
        `${label} contains invalid JPEG frame dimensions`);
      invariant(width <= 32768 && height <= 32768 && width * height <= 50_000_000,
        `${label} JPEG dimensions exceed the validation limit`);
      frame = { width, height };
    }
    offset = end;
    if (marker !== 0xda) continue;
    invariant(frame && length >= 6, `${label} JPEG scan precedes a valid frame`);
    scans += 1;
    const start = offset;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const markerStart = offset;
      while (bytes[offset] === 0xff) offset += 1;
      invariant(offset < bytes.length, `${label} contains a truncated JPEG scan`);
      const next = bytes[offset];
      if (next === 0x00) {
        offset += 1;
        continue;
      }
      if (next >= 0xd0 && next <= 0xd7) {
        offset += 1;
        continue;
      }
      scanBytes += markerStart - start;
      offset = markerStart;
      break;
    }
  }
  invariant(frame && scans > 0 && scanBytes > 0 && ended, `${label} is not a complete decodable JPEG`);
  return frame;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngScanlineLayout(width, height, bitDepth, colorType, interlace, label) {
  invariant(width <= 32768 && height <= 32768 && width * height <= 50_000_000, `${label} PNG dimensions exceed the validation limit`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const validDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }[colorType];
  invariant(channels && validDepths.includes(bitDepth), `${label} has an invalid PNG bit-depth/color-type combination`);
  const passes = interlace === 0
    ? [[0, 0, 1, 1]]
    : [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
  const rows = [];
  for (const [startX, startY, stepX, stepY] of passes) {
    const passWidth = width <= startX ? 0 : Math.ceil((width - startX) / stepX);
    const passHeight = height <= startY ? 0 : Math.ceil((height - startY) / stepY);
    if (passWidth === 0 || passHeight === 0) continue;
    const rowBytes = Math.ceil(passWidth * channels * bitDepth / 8);
    for (let row = 0; row < passHeight; row += 1) rows.push(rowBytes);
  }
  const expectedLength = rows.reduce((sum, rowBytes) => sum + rowBytes + 1, 0);
  invariant(expectedLength <= 256 * 1024 * 1024, `${label} declared pixel data exceeds the 256 MiB validation limit`);
  return { expectedLength, rows };
}

function parseRatio(value, label) {
  invariant(typeof value === "string" && /^\d+:\d+$/.test(value), `${label} must use W:H notation`);
  const [width, height] = value.split(":").map(Number);
  invariant(width > 0 && height > 0, `${label} must be positive`);
  return width / height;
}

function validateRect(rect, label, canvas) {
  invariant(rect && typeof rect === "object", `${label} is required`);
  for (const key of ["x", "y", "width", "height"]) {
    invariant(Number.isFinite(rect[key]), `${label}.${key} must be finite`);
  }
  invariant(rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0, `${label} has invalid geometry`);
  invariant(rect.x + rect.width <= canvas.width, `${label} exceeds canvas width`);
  invariant(rect.y + rect.height <= canvas.height, `${label} exceeds canvas height`);
}

function rectEquals(actual, expected) {
  return ["x", "y", "width", "height"].every((key) => actual?.[key] === expected[key]);
}

function validateBrand(spec, candidatePolicy) {
  const policy = spec.brandPolicy;
  invariant(policy && typeof policy.defaultEnabled === "boolean", "style.spec.json brandPolicy.defaultEnabled must be boolean");
  invariant(policy.userOverrideAllowed === true, "style.spec.json brandPolicy.userOverrideAllowed must be true");
  if (candidatePolicy) {
    invariant(candidatePolicy.defaultEnabled === policy.defaultEnabled, "candidate and spec brand defaults differ");
    invariant(candidatePolicy.userOverrideAllowed === policy.userOverrideAllowed, "candidate and spec brand override policies differ");
  }

  const reserved = spec.layout?.brandReservedArea;
  const slot = spec.fixedComponents?.brandSlot;
  validateRect(reserved, "style.spec.json layout.brandReservedArea", spec.canvas);
  validateRect(slot, "style.spec.json fixedComponents.brandSlot", spec.canvas);
  invariant(slot.enabled === true, "style.spec.json brandSlot.enabled must remain true");
  invariant(slot.anchor === "top-right", "style.spec.json brandSlot.anchor must be top-right");
  invariant(slot.assetFit === "contain", "style.spec.json brandSlot.assetFit must be contain");
  invariant(reserved.x >= spec.canvas.width / 2, "style.spec.json brandReservedArea must be in the right half");
  invariant(reserved.y + reserved.height <= spec.canvas.height / 2, "style.spec.json brandReservedArea must be in the top half");
  invariant(slot.x >= reserved.x && slot.y >= reserved.y, "style.spec.json brandSlot starts outside brandReservedArea");
  invariant(slot.x + slot.width <= reserved.x + reserved.width, "style.spec.json brandSlot exceeds brandReservedArea width");
  invariant(slot.y + slot.height <= reserved.y + reserved.height, "style.spec.json brandSlot exceeds brandReservedArea height");
  invariant(spec.generationConstraints?.forbidModelDrawnBrand === true, "style.spec.json must forbid model-drawn branding");
  invariant(spec.generationConstraints?.keepBrandReservedAreaClear === true, "style.spec.json must keep the brand area clear when active");
}

function validateSpec({ spec, style, baseline, enforceBaselineCanvas }) {
  invariant(spec?.id === style.id, "style.spec.json id must match candidate style.id");
  invariant(spec.platform === baseline.specPlatform, `style.spec.json platform must be ${baseline.specPlatform}`);
  invariant(spec.styleFile === `references/styles/${style.id}.md` || !enforceBaselineCanvas, `style.spec.json styleFile must be references/styles/${style.id}.md`);

  const canvas = spec.canvas;
  invariant(canvas && Number.isInteger(canvas.width) && canvas.width > 0, "style.spec.json canvas.width must be a positive integer");
  invariant(Number.isInteger(canvas.height) && canvas.height > 0, "style.spec.json canvas.height must be a positive integer");
  invariant(canvas.ratio === baseline.ratio, `style.spec.json canvas.ratio must be ${baseline.ratio}`);
  invariant(canvas.orientation === baseline.orientation, `style.spec.json canvas.orientation must be ${baseline.orientation}`);
  const numericRatio = canvas.width / canvas.height;
  invariant(Math.abs(numericRatio - parseRatio(canvas.ratio, "style.spec.json canvas.ratio")) <= 0.002, "style.spec.json canvas dimensions do not match its ratio");
  if (enforceBaselineCanvas) {
    invariant(canvas.width === baseline.width && canvas.height === baseline.height, `style.spec.json canvas must be ${baseline.width}x${baseline.height}`);
  }

  invariant(spec.layout && typeof spec.layout === "object", "style.spec.json layout is required");
  invariant(spec.layout.contentSafeArea, "style.spec.json layout.contentSafeArea is required");
  for (const [name, rect] of Object.entries(spec.layout)) {
    validateRect(rect, `style.spec.json layout.${name}`, canvas);
  }
  validateBrand(spec, style.brandPolicy);
  if (enforceBaselineCanvas) {
    invariant(rectEquals(spec.layout.contentSafeArea, baseline.contentSafeArea), "style.spec.json layout.contentSafeArea must match the platform baseline");
    invariant(rectEquals(spec.layout.brandReservedArea, baseline.brandReservedArea), "style.spec.json layout.brandReservedArea must match the platform baseline");
    invariant(rectEquals(spec.fixedComponents.brandSlot, baseline.brandSlot), "style.spec.json fixedComponents.brandSlot must match the platform baseline");
  }

  const handling = spec.inputHandling;
  invariant(handling && typeof handling === "object", "style.spec.json inputHandling is required");
  invariant(handling.preserveNativeOutput === true, "style.spec.json inputHandling.preserveNativeOutput must be true");
  invariant(handling.ratioTolerance === 0.002, "style.spec.json inputHandling.ratioTolerance must be 0.002");
  invariant(handling.outputCanvasRole === "design-coordinate-system", "style.spec.json inputHandling.outputCanvasRole must be design-coordinate-system");
  invariant(handling.allowPostGenerationResize === false, "style.spec.json inputHandling.allowPostGenerationResize must be false");
  if (baseline.minShortEdge) {
    invariant(handling.minShortEdge === baseline.minShortEdge, `style.spec.json inputHandling.minShortEdge must be ${baseline.minShortEdge}`);
  }
  invariant(handling.allowCrop === false, "style.spec.json inputHandling.allowCrop must be false");
  invariant(handling.allowPadding === false, "style.spec.json inputHandling.allowPadding must be false");
  invariant(handling.allowRotation === false, "style.spec.json inputHandling.allowRotation must be false");
  invariant(handling.allowWrongRatioStretch === false, "style.spec.json inputHandling.allowWrongRatioStretch must be false");
  invariant(handling.wrongRatioAction === "regenerate", "style.spec.json inputHandling.wrongRatioAction must be regenerate");

  const expectedReference = `assets/style-references/${style.id}.png`;
  invariant(spec.styleReference?.image === expectedReference || !enforceBaselineCanvas, `style.spec.json styleReference.image must be ${expectedReference}`);
  invariant(spec.styleReference?.isGenerationInput === false, "style.spec.json styleReference.isGenerationInput must be false");
  invariant(typeof spec.styleReference?.usage === "string" && spec.styleReference.usage.trim(), "style.spec.json styleReference.usage is required");
  invariant(typeof spec.styleReference?.contentPolicy === "string" && spec.styleReference.contentPolicy.trim(), "style.spec.json styleReference.contentPolicy is required");
}

function validateGates(gates, label) {
  invariant(gates && typeof gates === "object", `${label} is required`);
  for (const gate of hardGates) {
    invariant(gates[gate] === true, `${label}.${gate} must be true`);
  }
}

function validateScores(scores, label) {
  invariant(scores && typeof scores === "object", `${label} is required`);
  for (const dimension of scoreDimensions) {
    invariant(Number.isFinite(scores[dimension]) && scores[dimension] >= 75 && scores[dimension] <= 100, `${label}.${dimension} must be between 75 and 100`);
  }
}

function nearlyEqual(left, right, tolerance = 0.05) {
  return Math.abs(left - right) <= tolerance;
}

function validateReviews(reviews, provenance) {
  invariant(reviews && typeof reviews === "object", "qa.json reviews are required");
  const style = reviews.style;
  const originality = reviews.originality;
  for (const [name, review] of [["style", style], ["originality", originality]]) {
    invariant(review && typeof review === "object", `qa.json reviews.${name} is required`);
    for (const key of ["reviewer", "run_id", "backend", "model"]) {
      invariant(typeof review[key] === "string" && review[key].trim(), `qa.json reviews.${name}.${key} is required`);
    }
    invariant(typeof review.reviewed_at === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(review.reviewed_at) && Number.isFinite(Date.parse(review.reviewed_at)), `qa.json reviews.${name}.reviewed_at must be a UTC ISO timestamp`);
    invariant(review.conclusion === "pass", `qa.json reviews.${name}.conclusion must be pass`);
  }
  invariant(style.run_id !== originality.run_id, "qa.json style and originality review run IDs must differ");
  invariant(style.input_scope === "style-contract-and-all-calibration-images", "qa.json style review input_scope is invalid");
  invariant(style.source_visible === false && style.originality_review_visible === false, "qa.json style review must record source-blind inputs");
  invariant(originality.source_mode === provenance.extraction_mode, "qa.json originality source_mode must match provenance");
  const imageMode = provenance.extraction_mode === "image";
  const expectedScope = imageMode ? "source-and-all-calibration-images" : "visual-dna-and-all-calibration-images";
  invariant(originality.input_scope === expectedScope, "qa.json originality input_scope is invalid");
  invariant(originality.source_pixels_visible === imageMode, "qa.json originality source_pixels_visible is invalid");
  invariant(originality.style_scores_visible === false, "qa.json originality style_scores_visible must be false");
  invariant(originality.limitation === (imageMode ? null : "source-pixels-unavailable"), "qa.json originality limitation is invalid");
}

function validateQa({ qa, bundleDir, canvas, ratioTolerance, minShortEdge, styleReferencePath, provenance }) {
  invariant(qa?.schemaVersion === 1, "qa.json schemaVersion must be 1");
  validateReviews(qa.reviews, provenance);
  validateGates(qa.hard_gates, "qa.json hard_gates");
  validateScores(qa.dimension_averages, "qa.json dimension_averages");
  invariant(Array.isArray(qa.calibration_images) && qa.calibration_images.length === 3, "qa.json must contain exactly three calibration_images");

  const byId = new Map();
  for (const image of qa.calibration_images) {
    invariant(calibrationIds.includes(image?.id), `qa.json has unknown calibration image id ${image?.id ?? "<missing>"}`);
    invariant(!byId.has(image.id), `qa.json repeats calibration image ${image.id}`);
    const expectedImage = `calibration/${image.id}.png`;
    const expectedPrompt = `prompts/${image.id}.md`;
    invariant(image.file === expectedImage, `qa.json ${image.id}.file must be ${expectedImage}`);
    invariant(image.prompt_file === expectedPrompt, `qa.json ${image.id}.prompt_file must be ${expectedPrompt}`);
    const imagePath = requireFile(bundleDir, image.file, `calibration image ${image.id}`);
    requireNonemptyFile(bundleDir, image.prompt_file, `calibration prompt ${image.id}`);
    const size = readPngSize(imagePath, `calibration image ${image.id}`);
    invariant(Math.abs(size.width / size.height - canvas.width / canvas.height) <= ratioTolerance, `calibration image ${image.id} aspect ratio is outside tolerance`);
    if (minShortEdge) invariant(Math.min(size.width, size.height) >= minShortEdge, `calibration image ${image.id} short edge must be at least ${minShortEdge}px`);
    invariant(Number.isFinite(image.total_score) && image.total_score >= 85 && image.total_score <= 100, `qa.json ${image.id}.total_score must be between 85 and 100`);
    validateScores(image.scores, `qa.json ${image.id}.scores`);
    const dimensionMean = scoreDimensions.reduce((sum, dimension) => sum + image.scores[dimension], 0) / scoreDimensions.length;
    invariant(image.total_score <= dimensionMean + 0.005, `qa.json ${image.id}.total_score must not exceed its dimension mean`);
    validateGates(image.hard_gates, `qa.json ${image.id}.hard_gates`);
    invariant(typeof image.generation?.backend === "string" && image.generation.backend.trim(), `qa.json ${image.id} generation.backend is required`);
    invariant(typeof image.generation?.model === "string" && image.generation.model.trim(), `qa.json ${image.id} generation.model is required`);
    invariant(image.generation.width === size.width && image.generation.height === size.height, `qa.json ${image.id} generation dimensions must match the actual PNG`);
    byId.set(image.id, { image, imagePath });
  }
  invariant(calibrationIds.every((id) => byId.has(id)), "qa.json must include concept, process, and checklist images");

  const computedAverage = [...byId.values()].reduce((sum, item) => sum + item.image.total_score, 0) / 3;
  invariant(Number.isFinite(qa.average_score) && qa.average_score >= 88, "qa.json average_score must be at least 88");
  invariant(nearlyEqual(qa.average_score, computedAverage), "qa.json average_score does not match calibration totals");
  for (const dimension of scoreDimensions) {
    const computed = [...byId.values()].reduce((sum, item) => sum + item.image.scores[dimension], 0) / 3;
    invariant(nearlyEqual(qa.dimension_averages[dimension], computed), `qa.json dimension_averages.${dimension} does not match calibration scores`);
  }

  const selection = qa.selected_reference;
  invariant(selection && byId.has(selection.image_id), "qa.json selected_reference.image_id must select a calibration image");
  const selected = byId.get(selection.image_id);
  invariant(selection.source_image === selected.image.file, "qa.json selected_reference.source_image does not match the selected image");
  invariant(selection.path === candidateFiles.styleReference, `qa.json selected_reference.path must be ${candidateFiles.styleReference}`);
  invariant(selection.unbranded === true, "qa.json selected_reference.unbranded must be true");
  const ranked = calibrationIds
    .map((id, order) => ({ id, order, score: byId.get(id).image.total_score }))
    .sort((left, right) => right.score - left.score || left.order - right.order);
  invariant(selection.image_id === ranked[0].id, `qa.json selected_reference.image_id must select highest-scoring image ${ranked[0].id}`);
  invariant(readFileSync(styleReferencePath).equals(readFileSync(selected.imagePath)), "calibration/style-reference.png must be byte-identical to the selected calibration image");
  invariant(qa.contact_sheet === "calibration/contact-sheet.png", "qa.json contact_sheet must be calibration/contact-sheet.png");
  const contactSheetPath = requireFile(bundleDir, qa.contact_sheet, "calibration contact sheet");
  readPngSize(contactSheetPath, "calibration/contact-sheet.png");
}

function validateProvenance(provenance) {
  invariant(provenance?.schema_version === 1, "provenance.json schema_version must be 1");
  invariant(provenance.original_retained === false, "provenance.json original_retained must be false");
  invariant(provenance.used_as_generation_reference === false, "provenance.json used_as_generation_reference must be false");
  invariant(provenance.extraction_mode === "image" || provenance.extraction_mode === "visual-dna", "provenance.json extraction_mode is invalid");

  if (provenance.extraction_mode === "image") {
    const source = provenance.source;
    invariant(source && /^[a-f0-9]{64}$/.test(source.sha256), "provenance.json source.sha256 must be lowercase SHA-256");
    invariant(Number.isInteger(source.width) && source.width > 0, "provenance.json source.width must be a positive integer");
    invariant(Number.isInteger(source.height) && source.height > 0, "provenance.json source.height must be a positive integer");
    invariant(source.short_edge === Math.min(source.width, source.height), "provenance.json source.short_edge must match source dimensions");
    invariant(source.short_edge >= 512, "provenance.json source.short_edge must be at least 512");
    invariant(Number.isFinite(provenance.confidence) && provenance.confidence >= 0 && provenance.confidence <= 1, "provenance.json confidence must be between 0 and 1");
  } else {
    invariant(provenance.source?.kind === "provided-visual-dna", "provenance.json DNA source.kind must be provided-visual-dna");
    invariant(provenance.confidence === null || (Number.isFinite(provenance.confidence) && provenance.confidence >= 0 && provenance.confidence <= 1), "provenance.json confidence must be null or between 0 and 1");
  }
}

function validateVisualDnaForInstall(visualDna) {
  invariant(visualDna?.schema_version === 1, "visual-dna.json schema_version must be 1");
  invariant(visualDna.visual_dna_system && typeof visualDna.visual_dna_system === "object", "visual-dna.json must contain visual_dna_system");
  const signal = visualDna.design_signal;
  invariant(signal && typeof signal.observable === "object", "visual-dna.json design_signal is required");
  const observed = signalKeys.filter((key) => signal.observable[key] === true).length;
  invariant(signalKeys.every((key) => typeof signal.observable[key] === "boolean"), "visual-dna.json must record all six signal flags");
  invariant(signal.observable_count === observed, "visual-dna.json observable_count is invalid");
  invariant(observed >= 4 && signal.identity_dominates === false && signal.decision === "pass", "visual-dna.json design-signal gate must pass");
  invariant(signal.evidence_complete === true, "visual-dna.json evidence must be complete before installation");
  invariant(Array.isArray(signal.missing_evidence) && signal.missing_evidence.length === 0, "visual-dna.json missing_evidence must be empty before installation");
}

function listFiles(rootPath, prefix = "") {
  const files = [];
  for (const entry of readdirSync(resolve(rootPath, prefix), { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Bundle must not contain symlinks: ${relativePath}`);
    if (entry.isDirectory()) files.push(...listFiles(rootPath, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

function validateAliases(aliases, label) {
  invariant(Array.isArray(aliases), `${label} must be an array`);
  const normalized = aliases.map((alias) => {
    invariant(typeof alias === "string" && alias.trim() === alias && alias.length > 0, `${label} must contain trimmed non-empty strings`);
    return alias.toLocaleLowerCase("en-US");
  });
  invariant(new Set(normalized).size === normalized.length, `${label} must not contain duplicates`);
  return normalized;
}

function validateRegistryShape(registry) {
  invariant(registry?.schemaVersion === 1, "style-registry.json schemaVersion must be 1");
  invariant(Array.isArray(registry.platforms), "style-registry.json platforms must be an array");
  invariant(Array.isArray(registry.styles), "style-registry.json styles must be an array");
  invariant(isSafeRelativePath(registry.indexFile), "style-registry.json indexFile must be a safe relative path");
  const platformIds = registry.platforms.map((platform) => platform.id);
  invariant(new Set(platformIds).size === platformIds.length, "style-registry.json platform IDs must be unique");
  invariant(requiredRegistryPlatforms.every((id) => platformIds.includes(id)), "style-registry.json must define wechat, xhs, and zhihu platforms");
  for (const platform of registry.platforms) {
    const baseline = PLATFORM_BASELINES[platform.id];
    invariant(baseline, `style-registry.json has unknown platform ${platform.id}`);
    invariant(platform.specPlatform === baseline.specPlatform, `style-registry.json ${platform.id} specPlatform is invalid`);
    invariant(platform.canvas?.width === baseline.width && platform.canvas?.height === baseline.height, `style-registry.json ${platform.id} baseline canvas is invalid`);
    invariant(platform.canvas?.ratio === baseline.ratio && platform.canvas?.orientation === baseline.orientation, `style-registry.json ${platform.id} baseline ratio is invalid`);
    if (baseline.sizing) invariant(platform.canvas?.sizing === baseline.sizing, `style-registry.json ${platform.id} baseline sizing is invalid`);
    if (baseline.minShortEdge) invariant(platform.canvas?.minShortEdge === baseline.minShortEdge, `style-registry.json ${platform.id} baseline short edge is invalid`);
  }
  const styleIds = registry.styles.map((style) => style.id);
  invariant(styleIds.every((id) => typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)), "style-registry.json has an invalid style ID");
  invariant(new Set(styleIds).size === styleIds.length, "style-registry.json style IDs must be unique");
  const occupiedNames = new Set();
  const occupiedPaths = new Set([registry.indexFile]);
  for (const style of registry.styles) {
    invariant(platformIds.includes(style.platform), `style-registry.json style ${style.id} uses unregistered platform ${style.platform}`);
    invariant(typeof style.displayName === "string" && style.displayName.trim(), `style-registry.json style ${style.id} displayName is required`);
    invariant(typeof style.defaultUse === "string" && style.defaultUse.trim(), `style-registry.json style ${style.id} defaultUse is required`);
    for (const key of ["styleFile", "specFile", "styleReference"]) {
      invariant(isSafeRelativePath(style[key]), `style-registry.json style ${style.id} ${key} must be a safe relative path`);
      invariant(!occupiedPaths.has(style[key]), `style-registry.json path is duplicated or collides with indexFile: ${style[key]}`);
      occupiedPaths.add(style[key]);
    }
    invariant(style.provenanceFile === null || isSafeRelativePath(style.provenanceFile), `style-registry.json style ${style.id} provenanceFile must be null or a safe relative path`);
    if (style.provenanceFile) {
      invariant(!occupiedPaths.has(style.provenanceFile), `style-registry.json path is duplicated or collides with indexFile: ${style.provenanceFile}`);
      occupiedPaths.add(style.provenanceFile);
    }
    const names = [style.id.toLocaleLowerCase("en-US"), ...validateAliases(style.aliases, `registry aliases for ${style.id}`)];
    for (const name of names) {
      invariant(!occupiedNames.has(name), `style-registry.json name is duplicated: ${name}`);
      occupiedNames.add(name);
    }
  }
  for (const platform of registry.platforms) {
    const selected = registry.styles.find((style) => style.id === platform.defaultStyleId);
    invariant(selected?.platform === platform.id, `style-registry.json ${platform.id} defaultStyleId is invalid`);
  }
}

function validateCandidateAgainstRegistry(candidate, registry) {
  const style = candidate.style;
  invariant(!registry.styles.some((entry) => entry.id === style.id), `Style ID already exists: ${style.id}`);
  const occupiedPaths = new Set(registry.styles.flatMap((entry) => [entry.styleFile, entry.specFile, entry.styleReference, entry.provenanceFile].filter(Boolean)));
  const destinations = [
    `references/styles/${style.id}.md`,
    `references/styles/${style.id}.spec.json`,
    `assets/style-references/${style.id}.png`,
    `references/styles/${style.id}.provenance.json`
  ];
  invariant(!destinations.includes(registry.indexFile), `Registry indexFile collides with a destination for ${style.id}`);
  invariant(destinations.every((path) => !occupiedPaths.has(path)), `A registry path for ${style.id} already exists`);

  const candidateAliases = validateAliases(style.aliases, "candidate style.aliases");
  const occupiedNames = new Set();
  for (const entry of registry.styles) {
    occupiedNames.add(entry.id.toLocaleLowerCase("en-US"));
    for (const alias of validateAliases(entry.aliases, `registry aliases for ${entry.id}`)) occupiedNames.add(alias);
  }
  invariant(!occupiedNames.has(style.id.toLocaleLowerCase("en-US")), `Style ID collides with a registered alias: ${style.id}`);
  for (const alias of candidateAliases) {
    invariant(alias !== style.id.toLocaleLowerCase("en-US"), `Alias duplicates style ID: ${alias}`);
    invariant(!occupiedNames.has(alias), `Alias already exists in registry: ${alias}`);
  }
}

function validateCandidate(candidate) {
  invariant(candidate?.schemaVersion === 1, "candidate.json schemaVersion must be 1");
  invariant(candidate.status === "approved", "candidate.json status must be approved");
  invariant(candidate.template_ready === true, "candidate.json template_ready must be true");
  invariant(candidate.humanApproval?.status === "approved", "candidate.json humanApproval.status must be approved");
  invariant(typeof candidate.humanApproval?.approvedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(candidate.humanApproval.approvedAt) && !Number.isNaN(Date.parse(candidate.humanApproval.approvedAt)), "candidate.json humanApproval.approvedAt must be an ISO timestamp");

  const style = candidate.style;
  invariant(style && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(style.id), "candidate.json style.id is invalid");
  invariant(typeof style.displayName === "string" && style.displayName.trim(), "candidate.json style.displayName is required");
  invariant(typeof style.defaultUse === "string" && style.defaultUse.trim(), "candidate.json style.defaultUse is required");
  invariant(PLATFORM_BASELINES[style.platform], "candidate.json style.platform is unsupported");
  invariant(style.makeDefault === undefined || typeof style.makeDefault === "boolean", "candidate.json style.makeDefault must be boolean when present");
  validateAliases(style.aliases, "candidate style.aliases");
  invariant(style.brandPolicy && typeof style.brandPolicy.defaultEnabled === "boolean", "candidate.json style.brandPolicy.defaultEnabled must be boolean");
  invariant(style.brandPolicy.userOverrideAllowed === true, "candidate.json style.brandPolicy.userOverrideAllowed must be true");

  invariant(candidate.files && typeof candidate.files === "object", "candidate.json files is required");
  for (const [key, expected] of Object.entries(candidateFiles)) {
    invariant(candidate.files[key] === expected, `candidate.json files.${key} must be ${expected}`);
  }
}

export function validateStyleBundle({ bundleDir, skillRoot = defaultSkillRoot, registryPath } = {}) {
  invariant(bundleDir, "bundleDir is required");
  const resolvedBundle = resolve(bundleDir);
  const resolvedSkillRoot = resolve(skillRoot);
  invariant(existsSync(resolvedBundle) && statSync(resolvedBundle).isDirectory(), `Bundle directory is missing: ${resolvedBundle}`);

  const candidatePath = requireFile(resolvedBundle, "candidate.json", "candidate.json");
  const candidate = readJson(candidatePath, "candidate.json");
  validateCandidate(candidate);
  const baseline = PLATFORM_BASELINES[candidate.style.platform];

  for (const [key, relativePath] of Object.entries(candidate.files)) {
    requireNonemptyFile(resolvedBundle, relativePath, `candidate files.${key}`);
  }
  requireNonemptyFile(resolvedBundle, "visual-dna.md", "visual-dna.md");
  const visualDnaPath = requireNonemptyFile(resolvedBundle, "visual-dna.json", "visual-dna.json");
  const visualDna = readJson(visualDnaPath, "visual-dna.json");
  validateVisualDnaForInstall(visualDna);

  const registryFile = resolve(registryPath ?? resolve(resolvedSkillRoot, "references/style-registry.json"));
  const registry = readJson(registryFile, "style-registry.json");
  validateRegistryShape(registry);
  validateCandidateAgainstRegistry(candidate, registry);

  const specPath = resolveSafePath(resolvedBundle, candidate.files.styleSpec, "candidate files.styleSpec");
  const spec = readJson(specPath, "style.spec.json");
  validateSpec({ spec, style: candidate.style, baseline, enforceBaselineCanvas: true });

  const provenancePath = resolveSafePath(resolvedBundle, candidate.files.provenance, "candidate files.provenance");
  const provenance = readJson(provenancePath, "provenance.json");
  validateProvenance(provenance);

  const referencePath = resolveSafePath(resolvedBundle, candidate.files.styleReference, "candidate files.styleReference");
  const referenceSize = readPngSize(referencePath, "calibration/style-reference.png");
  invariant(Math.abs(referenceSize.width / referenceSize.height - spec.canvas.width / spec.canvas.height) <= spec.inputHandling.ratioTolerance, "calibration/style-reference.png aspect ratio is outside tolerance");
  if (spec.inputHandling.minShortEdge) invariant(Math.min(referenceSize.width, referenceSize.height) >= spec.inputHandling.minShortEdge, `calibration/style-reference.png short edge must be at least ${spec.inputHandling.minShortEdge}px`);

  const qaPath = resolveSafePath(resolvedBundle, candidate.files.qa, "candidate files.qa");
  validateQa({
    qa: readJson(qaPath, "qa.json"),
    bundleDir: resolvedBundle,
    canvas: spec.canvas,
    ratioTolerance: spec.inputHandling.ratioTolerance,
    minShortEdge: spec.inputHandling.minShortEdge,
    styleReferencePath: referencePath,
    provenance
  });

  const allowedPngs = new Set([
    candidate.files.styleReference,
    "calibration/contact-sheet.png",
    ...calibrationIds.map((id) => `calibration/${id}.png`)
  ]);
  const imageExtensions = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i;
  const actualImages = listFiles(resolvedBundle).filter((path) => imageExtensions.test(path));
  invariant(actualImages.every((path) => allowedPngs.has(path)) && actualImages.length === allowedPngs.size, "Bundle must contain only the five canonical calibration PNGs and no source image");

  return {
    bundleDir: resolvedBundle,
    skillRoot: resolvedSkillRoot,
    registryPath: registryFile,
    candidatePath,
    candidate,
    spec,
    registry,
    destinations: {
      styleFile: spec.styleFile,
      specFile: `references/styles/${candidate.style.id}.spec.json`,
      styleReference: spec.styleReference.image,
      provenanceFile: `references/styles/${candidate.style.id}.provenance.json`
    }
  };
}

export function validateInstalledRegistry({ skillRoot = defaultSkillRoot, registryPath } = {}) {
  const resolvedSkillRoot = resolve(skillRoot);
  const registryFile = resolve(registryPath ?? resolve(resolvedSkillRoot, "references/style-registry.json"));
  const registry = readJson(registryFile, "style-registry.json");
  validateRegistryShape(registry);
  const indexPath = requireNonemptyFile(resolvedSkillRoot, registry.indexFile, "Registry generated style index");
  invariant(readFileSync(indexPath, "utf8") === renderStyleIndex(registry), "Generated style index does not match style-registry.json");
  const seenPaths = new Set();

  for (const entry of registry.styles) {
    const baseline = PLATFORM_BASELINES[entry.platform];
    invariant(baseline, `Registry style ${entry.id} has unknown platform ${entry.platform}`);
    for (const key of ["styleFile", "specFile", "styleReference", ...(entry.provenanceFile ? ["provenanceFile"] : [])]) {
      invariant(!seenPaths.has(entry[key]), `Registry path is duplicated: ${entry[key]}`);
      seenPaths.add(entry[key]);
      requireNonemptyFile(resolvedSkillRoot, entry[key], `Registry ${entry.id} ${key}`);
    }
    validateAliases(entry.aliases, `registry aliases for ${entry.id}`);

    if (entry.provenanceFile) {
      const provenance = readJson(resolveSafePath(resolvedSkillRoot, entry.provenanceFile, `Registry ${entry.id} provenanceFile`), `Provenance for ${entry.id}`);
      validateProvenance(provenance);
    }

    const spec = readJson(resolveSafePath(resolvedSkillRoot, entry.specFile, `Registry ${entry.id} specFile`), `Spec for ${entry.id}`);
    const style = {
      id: entry.id,
      brandPolicy: spec.brandPolicy
    };
    validateSpec({ spec, style, baseline, enforceBaselineCanvas: false });
    invariant(spec.styleFile === entry.styleFile, `Registry ${entry.id} styleFile differs from its spec`);
    invariant(spec.styleReference.image === entry.styleReference, `Registry ${entry.id} styleReference differs from its spec`);
    const size = readPngSize(resolveSafePath(resolvedSkillRoot, entry.styleReference, `Registry ${entry.id} styleReference`), `Style reference for ${entry.id}`);
    invariant(Math.abs(size.width / size.height - spec.canvas.width / spec.canvas.height) <= 0.002, `Style reference for ${entry.id} has the wrong aspect ratio`);
    if (spec.inputHandling.minShortEdge) invariant(Math.min(size.width, size.height) >= spec.inputHandling.minShortEdge, `Style reference for ${entry.id} has a short edge below ${spec.inputHandling.minShortEdge}px`);
  }

  return { registryPath: registryFile, styles: registry.styles.length };
}

function parseArgs(argv) {
  const args = { installed: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--installed") {
      args.installed = true;
      continue;
    }
    if (argument !== "--bundle" && argument !== "--skill-root" && argument !== "--registry") {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    args[argument.slice(2)] = value;
    index += 1;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    skillRoot: args["skill-root"] ? resolve(args["skill-root"]) : defaultSkillRoot,
    registryPath: args.registry ? resolve(args.registry) : undefined
  };
  if (args.installed) {
    const result = validateInstalledRegistry(options);
    console.log(JSON.stringify({ valid: true, registered_styles: result.styles }, null, 2));
    return;
  }
  invariant(args.bundle, "--bundle is required unless --installed is used");
  const result = validateStyleBundle({ ...options, bundleDir: resolve(args.bundle) });
  console.log(JSON.stringify({ valid: true, style_id: result.candidate.style.id }, null, 2));
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

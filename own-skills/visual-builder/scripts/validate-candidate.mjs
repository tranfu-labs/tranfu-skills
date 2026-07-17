#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

export const PLATFORMS = Object.freeze({
  wechat: {
    specPlatform: "wechat",
    canvas: { width: 1600, height: 1200, ratio: "4:3", orientation: "horizontal" },
    safeArea: { x: 80, y: 80, width: 1440, height: 1040 },
    reservedArea: { x: 1320, y: 44, width: 240, height: 100 },
    brandSlot: { x: 1350, y: 64, width: 170, height: 46 },
  },
  xhs: {
    specPlatform: "xiaohongshu",
    canvas: { width: 1080, height: 1440, ratio: "3:4", orientation: "vertical" },
    safeArea: { x: 80, y: 96, width: 920, height: 1248 },
    reservedArea: { x: 842, y: 44, width: 208, height: 90 },
    brandSlot: { x: 872, y: 64, width: 148, height: 40 },
  },
  zhihu: {
    specPlatform: "zhihu",
    canvas: { width: 1600, height: 900, ratio: "16:9", orientation: "horizontal" },
    safeArea: { x: 80, y: 70, width: 1440, height: 760 },
    reservedArea: { x: 1320, y: 44, width: 240, height: 100 },
    brandSlot: { x: 1350, y: 64, width: 170, height: 46 },
  },
  weibo: {
    specPlatform: "weibo",
    canvas: { width: 1080, height: 1440, ratio: "3:4", orientation: "vertical" },
    safeArea: { x: 80, y: 96, width: 920, height: 1248 },
    reservedArea: { x: 842, y: 44, width: 208, height: 90 },
    brandSlot: { x: 872, y: 64, width: 148, height: 40 },
  },
  toutiao: {
    specPlatform: "toutiao",
    canvas: { width: 1600, height: 900, ratio: "16:9", orientation: "horizontal" },
    safeArea: { x: 80, y: 70, width: 1440, height: 760 },
    reservedArea: { x: 1320, y: 44, width: 240, height: 100 },
    brandSlot: { x: 1350, y: 64, width: 170, height: 46 },
    minShortEdge: 900,
  },
});

export const CALIBRATION_IDS = Object.freeze(["concept", "process", "checklist"]);
export const SCORE_KEYS = Object.freeze([
  "color",
  "typography",
  "texture",
  "illustration",
  "spacing",
  "composition",
  "cross_content_adaptability",
]);
export const HARD_GATE_KEYS = Object.freeze([
  "dimensions",
  "aspect_ratio",
  "safe_area",
  "single_core_meaning",
  "identity_leakage",
  "brand_free",
]);
export const SIGNAL_KEYS = Object.freeze([
  "color_roles",
  "typography_hierarchy",
  "composition",
  "shape_components",
  "material_texture",
  "illustration_icon_language",
]);
const EVIDENCE_KEYS = new Set([...SIGNAL_KEYS, "identity_analysis", "source_scope"]);

const STATUSES = new Set(["draft", "ready_for_review", "approved", "installed", "blocked"]);
const FILE_MANIFEST = Object.freeze({
  styleMarkdown: "style.md",
  styleSpec: "style.spec.json",
  provenance: "provenance.json",
  styleReference: "calibration/style-reference.png",
  qa: "qa.json",
});
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".heic", ".tif", ".tiff"]);
const ALLOWED_IMAGES = new Set([
  "calibration/concept.png",
  "calibration/process.png",
  "calibration/checklist.png",
  "calibration/style-reference.png",
  "calibration/contact-sheet.png",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function mean(values) {
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sameObject(actual, expected) {
  return isObject(actual) && Object.keys(expected).every((key) => actual[key] === expected[key]);
}

function rectInside(inner, outer) {
  return isObject(inner)
    && ["x", "y", "width", "height"].every((key) => Number.isInteger(inner[key]))
    && inner.x >= outer.x
    && inner.y >= outer.y
    && inner.width > 0
    && inner.height > 0
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function validIsoInstant(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function issue(errors, field, message, code = "invalid") {
  errors.push({ code, field, message });
}

function safeBundlePath(root, relative, field, errors) {
  if (!isNonEmptyString(relative) || path.isAbsolute(relative) || relative.includes("\\")) {
    issue(errors, field, "must be a non-empty POSIX relative path", "unsafe-path");
    return null;
  }
  const normalized = path.posix.normalize(relative);
  if (normalized !== relative || normalized === ".." || normalized.startsWith("../")) {
    issue(errors, field, "must stay inside the candidate bundle without normalization", "unsafe-path");
    return null;
  }
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    issue(errors, field, "resolves outside the candidate bundle", "unsafe-path");
    return null;
  }
  return resolved;
}

async function inspectFile(root, relative, field, errors, kind = "file") {
  const resolved = safeBundlePath(root, relative, field, errors);
  if (!resolved) return null;
  try {
    const stats = await lstat(resolved);
    if (stats.isSymbolicLink()) {
      issue(errors, field, "must not be a symbolic link", "symlink-forbidden");
      return null;
    }
    if (kind === "file" && !stats.isFile()) {
      issue(errors, field, "must be a regular file", "wrong-file-type");
      return null;
    }
    if (kind === "directory" && !stats.isDirectory()) {
      issue(errors, field, "must be a directory", "wrong-file-type");
      return null;
    }
    return resolved;
  } catch (error) {
    if (error?.code === "ENOENT") {
      issue(errors, field, `missing required ${kind}: ${relative}`, "missing-file");
      return null;
    }
    issue(errors, field, `cannot inspect ${relative}: ${error.message}`, "io-error");
    return null;
  }
}

async function loadJson(root, relative, field, errors) {
  const resolved = await inspectFile(root, relative, field, errors);
  if (!resolved) return null;
  try {
    return JSON.parse(await readFile(resolved, "utf8"));
  } catch (error) {
    issue(errors, field, `must contain valid JSON: ${error.message}`, "invalid-json");
    return null;
  }
}

async function requireNonEmptyText(root, relative, field, errors) {
  const resolved = await inspectFile(root, relative, field, errors);
  if (!resolved) return;
  const value = await readFile(resolved, "utf8");
  if (!value.trim()) issue(errors, field, "must not be empty", "empty-file");
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngScanlineLayout(width, height, bitDepth, colorType, interlace) {
  if (width > 32768 || height > 32768 || width * height > 50_000_000) throw new Error("declared PNG dimensions exceed the validation limit");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const validDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }[colorType];
  if (!channels || !validDepths.includes(bitDepth)) throw new Error("IHDR has an invalid bit-depth/color-type combination");
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
  if (expectedLength > 256 * 1024 * 1024) throw new Error("declared PNG pixel data exceeds the 256 MiB validation limit");
  return { expectedLength, rows };
}

function validatePngChunks(buffer) {
  let offset = 8;
  let first = true;
  let ended = false;
  let ihdr;
  let paletteLength = null;
  let seenPalette = false;
  let seenIdat = false;
  let idatEnded = false;
  const idat = [];
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new Error("contains a truncated chunk");
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new Error("contains a chunk beyond end of file");
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
    if (crc32(buffer.subarray(offset + 4, offset + 8 + length)) !== expectedCrc) throw new Error(`${type} has an invalid CRC`);
    if (first && (type !== "IHDR" || length !== 13)) throw new Error("IHDR must be the first 13-byte chunk");
    if (type === "IHDR") {
      if (ihdr) throw new Error("must contain exactly one IHDR chunk");
      if (data[10] !== 0 || data[11] !== 0 || ![0, 1].includes(data[12])) throw new Error("IHDR uses unsupported compression, filtering, or interlace fields");
      ihdr = data;
    }
    if (type === "PLTE") {
      if (seenPalette || seenIdat) throw new Error("PLTE must occur at most once before IDAT");
      seenPalette = true;
      paletteLength = length;
    }
    if (type === "IDAT") {
      if (idatEnded) throw new Error("IDAT chunks must be consecutive");
      seenIdat = true;
      idat.push(data);
    } else if (seenIdat) {
      idatEnded = true;
    }
    if (type === "IEND") {
      if (length !== 0 || end !== buffer.length) throw new Error("IEND must be empty and terminal");
      ended = true;
    }
    first = false;
    offset = end;
  }
  if (!ended || idat.length === 0) throw new Error("must contain IDAT and terminal IEND chunks");
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const colorType = ihdr[9];
  if (colorType === 3 && (!paletteLength || paletteLength % 3 !== 0 || paletteLength > 768)) throw new Error("indexed PNG requires a valid PLTE chunk");
  const layout = pngScanlineLayout(width, height, ihdr[8], colorType, ihdr[12]);
  const pixels = inflateSync(Buffer.concat(idat), { maxOutputLength: layout.expectedLength });
  if (pixels.length !== layout.expectedLength) throw new Error(`IDAT inflates to ${pixels.length} bytes, expected ${layout.expectedLength}`);
  let cursor = 0;
  for (const rowBytes of layout.rows) {
    if (pixels[cursor] > 4) throw new Error(`scanline uses invalid filter type ${pixels[cursor]}`);
    cursor += rowBytes + 1;
  }
}

async function readPngDimensions(root, relative, field, errors) {
  const resolved = await inspectFile(root, relative, field, errors);
  if (!resolved) return null;
  const buffer = await readFile(resolved);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature) || buffer.toString("ascii", 12, 16) !== "IHDR") {
    issue(errors, field, "must be a PNG containing an IHDR header", "invalid-png");
    return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1 || height < 1) {
    issue(errors, field, "PNG dimensions must be positive", "invalid-png");
    return null;
  }
  if (width > 32768 || height > 32768 || width * height > 50_000_000) {
    issue(errors, field, "PNG dimensions exceed the validation limit", "invalid-png");
    return null;
  }
  try {
    validatePngChunks(buffer);
  } catch (error) {
    issue(errors, field, `PNG structure must be decodable: ${error.message}`, "invalid-png");
    return null;
  }
  return { width, height, buffer };
}

async function walkFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      files.push({ absolute, symlink: true });
    } else if (entry.isDirectory()) {
      files.push(...await walkFiles(root, absolute));
    } else if (entry.isFile()) {
      files.push({ absolute, symlink: false });
    }
  }
  return files;
}

function validateCandidateManifest(candidate, errors, requireInstallable) {
  if (!isObject(candidate)) {
    issue(errors, "candidate.json", "must contain a JSON object");
    return null;
  }
  if (candidate.schemaVersion !== 1) issue(errors, "candidate.schemaVersion", "must equal 1");
  if (!STATUSES.has(candidate.status)) issue(errors, "candidate.status", "is not an allowed status");
  if (typeof candidate.template_ready !== "boolean") issue(errors, "candidate.template_ready", "must be a boolean");

  const style = candidate.style;
  if (!isObject(style)) {
    issue(errors, "candidate.style", "must be an object");
  } else {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(style.id ?? "") || style.id.length < 2 || style.id.length > 63) {
      issue(errors, "candidate.style.id", "must be a 2-63 character lowercase hyphen-case ID");
    }
    if (!isNonEmptyString(style.displayName)) issue(errors, "candidate.style.displayName", "must be a non-empty string");
    if (!Object.hasOwn(PLATFORMS, style.platform)) issue(errors, "candidate.style.platform", "must be wechat, xhs, zhihu, weibo, or toutiao");
    if (!isNonEmptyString(style.defaultUse)) issue(errors, "candidate.style.defaultUse", "must be a non-empty string");
    if (Object.hasOwn(style, "makeDefault") && typeof style.makeDefault !== "boolean") {
      issue(errors, "candidate.style.makeDefault", "must be a boolean when present");
    }
    if (!Array.isArray(style.aliases)) {
      issue(errors, "candidate.style.aliases", "must be an array");
    } else {
      const seen = new Set();
      const styleId = style.id?.toLocaleLowerCase("en-US");
      for (const [index, alias] of style.aliases.entries()) {
        const valid = isNonEmptyString(alias) && alias.trim() === alias && !/[\0\r\n|]/.test(alias);
        if (!valid) {
          issue(errors, `candidate.style.aliases[${index}]`, "must be a trimmed non-empty natural-language string without control or table-delimiter characters");
          continue;
        }
        const normalized = alias.toLocaleLowerCase("en-US");
        if (normalized === styleId || seen.has(normalized)) issue(errors, `candidate.style.aliases[${index}]`, "must be unique case-insensitively and differ from style.id");
        seen.add(normalized);
      }
    }
    const policy = style.brandPolicy;
    if (!isObject(policy) || typeof policy.defaultEnabled !== "boolean" || policy.userOverrideAllowed !== true) {
      issue(errors, "candidate.style.brandPolicy", "must contain boolean defaultEnabled and userOverrideAllowed: true");
    }
  }

  if (!isObject(candidate.files)) {
    issue(errors, "candidate.files", "must be an object");
  } else {
    for (const [key, expected] of Object.entries(FILE_MANIFEST)) {
      if (candidate.files[key] !== expected) issue(errors, `candidate.files.${key}`, `must equal ${expected}`);
    }
  }

  const approval = candidate.humanApproval;
  if (!isObject(approval) || !["pending", "approved", "rejected"].includes(approval.status)) {
    issue(errors, "candidate.humanApproval.status", "must be pending, approved, or rejected");
  } else {
    if (approval.status === "approved") {
      if (!validIsoInstant(approval.approvedAt)) issue(errors, "candidate.humanApproval.approvedAt", "must be an ISO timestamp when approved");
    } else if (approval.approvedAt !== null) {
      issue(errors, "candidate.humanApproval.approvedAt", "must be null unless approved");
    }
    if (approval.note !== null && !isNonEmptyString(approval.note)) issue(errors, "candidate.humanApproval.note", "must be null or a non-empty string");
  }

  if (["approved", "installed"].includes(candidate.status)) {
    if (candidate.template_ready !== true) issue(errors, "candidate.template_ready", "must be true for approved or installed status");
    if (approval?.status !== "approved") issue(errors, "candidate.humanApproval.status", "must be approved for approved or installed status");
  } else if (candidate.template_ready !== false) {
    issue(errors, "candidate.template_ready", "must be false before approval");
  }
  if (candidate.status === "ready_for_review" && approval?.status !== "pending") {
    issue(errors, "candidate.humanApproval.status", "must be pending while ready_for_review");
  }
  if (["draft", "blocked"].includes(candidate.status) && !["pending", "rejected"].includes(approval?.status)) {
    issue(errors, "candidate.humanApproval.status", `must be pending or rejected while ${candidate.status}`);
  }
  if (requireInstallable && (candidate.status !== "approved" || candidate.template_ready !== true || approval?.status !== "approved")) {
    issue(errors, "candidate", "must be explicitly approved and template_ready before installation", "not-installable");
  }
  return style ?? null;
}

function validateVisualDna(dna, candidate, provenance, errors) {
  if (!isObject(dna)) return;
  if (dna.schema_version !== 1) issue(errors, "visual-dna.schema_version", "must equal 1");
  if (!isObject(dna.visual_dna_system) || Object.keys(dna.visual_dna_system).length === 0) {
    issue(errors, "visual-dna.visual_dna_system", "must be a non-empty object");
  }
  const signal = dna.design_signal;
  if (!isObject(signal) || !isObject(signal.observable)) {
    issue(errors, "visual-dna.design_signal", "must contain observable signal flags");
    return;
  }
  let observed = 0;
  for (const key of SIGNAL_KEYS) {
    if (typeof signal.observable[key] !== "boolean") issue(errors, `visual-dna.design_signal.observable.${key}`, "must be a boolean");
    if (signal.observable[key] === true) observed += 1;
  }
  if (signal.observable_count !== observed) issue(errors, "visual-dna.design_signal.observable_count", `must equal observed signal count ${observed}`);
  if (typeof signal.identity_dominates !== "boolean") issue(errors, "visual-dna.design_signal.identity_dominates", "must be a boolean");
  if (typeof signal.evidence_complete !== "boolean") issue(errors, "visual-dna.design_signal.evidence_complete", "must be a boolean");
  if (!Array.isArray(signal.missing_evidence)) {
    issue(errors, "visual-dna.design_signal.missing_evidence", "must be an array");
  } else {
    const seen = new Set();
    for (const [index, name] of signal.missing_evidence.entries()) {
      if (!EVIDENCE_KEYS.has(name) || seen.has(name)) issue(errors, `visual-dna.design_signal.missing_evidence[${index}]`, "must be a unique supported evidence key");
      seen.add(name);
    }
    if (signal.evidence_complete === true && signal.missing_evidence.length > 0) issue(errors, "visual-dna.design_signal.missing_evidence", "must be empty when evidence_complete is true");
    if (signal.evidence_complete === false && signal.missing_evidence.length === 0) issue(errors, "visual-dna.design_signal.missing_evidence", "must list at least one gap when evidence_complete is false");
  }
  const sourceTooSmall = provenance?.extraction_mode === "image" && provenance.source?.short_edge < 512;
  const passes = observed >= 4 && signal.identity_dominates === false && !sourceTooSmall;
  if (passes && signal.decision !== "pass") issue(errors, "visual-dna.design_signal.decision", "must be pass when the signal gate passes");
  if (!passes && signal.decision !== "blocked") issue(errors, "visual-dna.design_signal.decision", "must be blocked when the signal gate fails");
  if (!passes && signal.reason !== "insufficient-design-signal") issue(errors, "visual-dna.design_signal.reason", "must be insufficient-design-signal when blocked");
  if (passes && candidate?.status === "blocked") issue(errors, "candidate.status", "cannot be blocked when the recorded design-signal gate passes");
  if (!passes && candidate?.status !== "blocked") issue(errors, "candidate.status", "must be blocked when the design-signal gate fails");
  if (sourceTooSmall && candidate?.status !== "blocked") issue(errors, "provenance.source.short_edge", "must be at least 512 or produce a blocked audit", "insufficient-design-signal");
  if (provenance?.extraction_mode === "image" && signal.evidence_complete !== true) issue(errors, "visual-dna.design_signal.evidence_complete", "must be true for image extraction");
  if (provenance?.extraction_mode === "visual-dna" && passes && signal.evidence_complete === false && candidate?.status !== "draft") {
    issue(errors, "candidate.status", "must remain draft while supplied Visual DNA has evidence gaps", "incomplete-dna-evidence");
  }
  if (["ready_for_review", "approved", "installed"].includes(candidate?.status) && signal.evidence_complete !== true) {
    issue(errors, "visual-dna.design_signal.evidence_complete", "must be true before review, approval, or installation", "incomplete-dna-evidence");
  }
}

function validateProvenance(provenance, errors) {
  if (!isObject(provenance)) return;
  if (provenance.schema_version !== 1) issue(errors, "provenance.schema_version", "must equal 1");
  if (!["image", "visual-dna"].includes(provenance.extraction_mode)) issue(errors, "provenance.extraction_mode", "must be image or visual-dna");
  if (provenance.original_retained !== false) issue(errors, "provenance.original_retained", "must be false");
  if (provenance.used_as_generation_reference !== false) issue(errors, "provenance.used_as_generation_reference", "must be false");
  const confidenceValid = provenance.confidence === null || (isFiniteNumber(provenance.confidence) && provenance.confidence >= 0 && provenance.confidence <= 1);
  if (!confidenceValid) issue(errors, "provenance.confidence", "must be null or a number from 0 through 1");

  if (provenance.extraction_mode === "image") {
    if (!isObject(provenance.source)) {
      issue(errors, "provenance.source", "must contain image facts");
      return;
    }
    if (!/^[a-f0-9]{64}$/.test(provenance.source.sha256 ?? "")) issue(errors, "provenance.source.sha256", "must be a lowercase SHA-256 digest");
    if (!Number.isInteger(provenance.source.width) || provenance.source.width < 1) issue(errors, "provenance.source.width", "must be a positive integer");
    if (!Number.isInteger(provenance.source.height) || provenance.source.height < 1) issue(errors, "provenance.source.height", "must be a positive integer");
    const expectedShortEdge = Math.min(provenance.source.width, provenance.source.height);
    if (provenance.source.short_edge !== expectedShortEdge) issue(errors, "provenance.source.short_edge", `must equal ${expectedShortEdge}`);
    if (!isFiniteNumber(provenance.confidence)) issue(errors, "provenance.confidence", "must be numeric for image extraction");
  } else if (!isObject(provenance.source) || provenance.source.kind !== "provided-visual-dna") {
    issue(errors, "provenance.source", "must equal { kind: provided-visual-dna } for Visual DNA mode");
  }
}

function validateStyleSpec(spec, style, errors) {
  if (!isObject(spec) || !style || !Object.hasOwn(PLATFORMS, style.platform)) return;
  const baseline = PLATFORMS[style.platform];
  if (spec.id !== style.id) issue(errors, "style.spec.id", "must equal candidate.style.id");
  if (spec.styleFile !== `references/styles/${style.id}.md`) issue(errors, "style.spec.styleFile", `must equal references/styles/${style.id}.md`);
  if (spec.platform !== baseline.specPlatform) issue(errors, "style.spec.platform", `must equal ${baseline.specPlatform}`);
  if (!sameObject(spec.canvas, baseline.canvas)) issue(errors, "style.spec.canvas", `must match the ${style.platform} platform baseline`);
  if (!isObject(spec.colors) || Object.keys(spec.colors).length === 0) issue(errors, "style.spec.colors", "must contain compiled semantic color roles");

  const canvasRect = { x: 0, y: 0, width: baseline.canvas.width, height: baseline.canvas.height };
  const safe = spec.layout?.contentSafeArea;
  const reserved = spec.layout?.brandReservedArea;
  if (!sameObject(safe, baseline.safeArea) || !rectInside(safe, canvasRect)) issue(errors, "style.spec.layout.contentSafeArea", "must match the platform baseline inside the canvas");
  if (!sameObject(reserved, baseline.reservedArea) || !rectInside(reserved, canvasRect)) issue(errors, "style.spec.layout.brandReservedArea", "must match the platform baseline inside the canvas");

  const slot = spec.fixedComponents?.brandSlot;
  if (!sameObject(slot, baseline.brandSlot) || slot?.enabled !== true || slot?.anchor !== "top-right" || slot?.assetFit !== "contain") {
    issue(errors, "style.spec.fixedComponents.brandSlot", "must match the enabled platform baseline brand slot");
  } else if (!rectInside(slot, reserved)) {
    issue(errors, "style.spec.fixedComponents.brandSlot", "must remain inside layout.brandReservedArea");
  }
  if (!isObject(spec.brandPolicy)
    || spec.brandPolicy.defaultEnabled !== style.brandPolicy?.defaultEnabled
    || spec.brandPolicy.userOverrideAllowed !== true) {
    issue(errors, "style.spec.brandPolicy", "must equal candidate.style.brandPolicy");
  }
  const handling = spec.inputHandling;
  if (!isObject(handling)
    || handling.preserveNativeOutput !== true
    || handling.ratioTolerance !== 0.002
    || handling.outputCanvasRole !== "design-coordinate-system"
    || handling.allowPostGenerationResize !== false
    || handling.allowCrop !== false
    || handling.allowPadding !== false
    || handling.allowRotation !== false
    || handling.allowWrongRatioStretch !== false
    || handling.wrongRatioAction !== "regenerate") {
    issue(errors, "style.spec.inputHandling", "must preserve native output and match the wrong-ratio policy");
  }
  if (baseline.minShortEdge && handling?.minShortEdge !== baseline.minShortEdge) {
    issue(errors, "style.spec.inputHandling.minShortEdge", `must equal ${baseline.minShortEdge}`);
  }
  if (spec.generationConstraints?.forbidModelDrawnBrand !== true || spec.generationConstraints?.keepBrandReservedAreaClear !== true) {
    issue(errors, "style.spec.generationConstraints", "must forbid model-drawn brand and keep the brand area clear");
  }
  const reference = spec.styleReference;
  if (reference?.image !== `assets/style-references/${style.id}.png`) issue(errors, "style.spec.styleReference.image", "must target the installed style reference path");
  if (reference?.isGenerationInput !== false) issue(errors, "style.spec.styleReference.isGenerationInput", "must be false");
  if (!isNonEmptyString(reference?.contentPolicy) || !/semantic|identity|brand/i.test(reference.contentPolicy)) {
    issue(errors, "style.spec.styleReference.contentPolicy", "must explicitly exclude semantic or identity copying");
  }
}

function validateScores(scores, field, errors) {
  if (!isObject(scores)) {
    issue(errors, field, "must be an object");
    return null;
  }
  const values = [];
  for (const key of SCORE_KEYS) {
    const value = scores[key];
    if (!isFiniteNumber(value) || value < 0 || value > 100) {
      issue(errors, `${field}.${key}`, "must be a score from 0 through 100");
    } else {
      if (value < 75) issue(errors, `${field}.${key}`, "must be at least 75", "qa-threshold");
      values.push(value);
    }
  }
  return values.length === SCORE_KEYS.length ? values : null;
}

function validateHardGates(gates, field, errors) {
  if (!isObject(gates)) {
    issue(errors, field, "must be an object");
    return;
  }
  for (const key of HARD_GATE_KEYS) {
    if (gates[key] !== true) issue(errors, `${field}.${key}`, "must be true (the gate must pass)", "qa-hard-gate");
  }
}

function validateReviewEvidence(reviews, provenance, errors) {
  if (!isObject(reviews)) {
    issue(errors, "qa.reviews", "must record independent style and originality reviews");
    return;
  }
  const styleReview = reviews.style;
  const originalityReview = reviews.originality;
  const runIds = new Set();
  const validateCommon = (review, field) => {
    for (const key of ["reviewer", "run_id", "backend", "model"]) {
      if (!isNonEmptyString(review[key])) issue(errors, `${field}.${key}`, "must be a non-empty string");
    }
    if (!validIsoInstant(review.reviewed_at)) issue(errors, `${field}.reviewed_at`, "must be an ISO timestamp");
    if (review.conclusion !== "pass") issue(errors, `${field}.conclusion`, "must be pass");
    if (isNonEmptyString(review.run_id)) {
      if (runIds.has(review.run_id)) issue(errors, `${field}.run_id`, "must be unique across all review runs");
      runIds.add(review.run_id);
    }
  };
  if (!isObject(styleReview)) {
    issue(errors, "qa.reviews.style", "must be an object");
  } else {
    validateCommon(styleReview, "qa.reviews.style");
    if (styleReview.input_scope !== "style-contract-and-all-calibration-images") issue(errors, "qa.reviews.style.input_scope", "must record source-blind set-level style review");
    if (styleReview.source_visible !== false) issue(errors, "qa.reviews.style.source_visible", "must be false");
    if (styleReview.originality_review_visible !== false) issue(errors, "qa.reviews.style.originality_review_visible", "must be false");
  }
  if (isObject(originalityReview)) {
    validateCommon(originalityReview, "qa.reviews.originality");
    const mode = provenance?.extraction_mode;
    if (originalityReview.source_mode !== mode) issue(errors, "qa.reviews.originality.source_mode", "must match provenance.extraction_mode");
    const expectedScope = mode === "image" ? "source-and-all-calibration-images" : "visual-dna-and-all-calibration-images";
    if (originalityReview.input_scope !== expectedScope) issue(errors, "qa.reviews.originality.input_scope", `must equal ${expectedScope}`);
    if (originalityReview.style_scores_visible !== false) issue(errors, "qa.reviews.originality.style_scores_visible", "must be false");
    if (originalityReview.source_pixels_visible !== (mode === "image")) issue(errors, "qa.reviews.originality.source_pixels_visible", `must be ${mode === "image"}`);
    const expectedLimitation = mode === "visual-dna" ? "source-pixels-unavailable" : null;
    if (originalityReview.limitation !== expectedLimitation) issue(errors, "qa.reviews.originality.limitation", `must be ${expectedLimitation ?? "null"}`);
  } else {
    issue(errors, "qa.reviews.originality", "must be an object");
  }
}

async function validateQa(root, qa, style, provenance, errors) {
  if (!isObject(qa) || !style || !Object.hasOwn(PLATFORMS, style.platform)) return;
  if (qa.schemaVersion !== 1) issue(errors, "qa.schemaVersion", "must equal 1");
  validateReviewEvidence(qa.reviews, provenance, errors);
  validateHardGates(qa.hard_gates, "qa.hard_gates", errors);
  if (!Array.isArray(qa.calibration_images) || qa.calibration_images.length !== 3) {
    issue(errors, "qa.calibration_images", "must contain exactly three images");
    return;
  }

  const byId = new Map();
  const totals = [];
  const dimensions = Object.fromEntries(SCORE_KEYS.map((key) => [key, []]));
  const baseline = PLATFORMS[style.platform];
  for (const [index, image] of qa.calibration_images.entries()) {
    const field = `qa.calibration_images[${index}]`;
    if (!isObject(image) || !CALIBRATION_IDS.includes(image.id) || byId.has(image.id)) {
      issue(errors, `${field}.id`, "must be one unique concept, process, or checklist ID");
      continue;
    }
    byId.set(image.id, image);
    const expectedImage = `calibration/${image.id}.png`;
    const expectedPrompt = `prompts/${image.id}.md`;
    if (image.file !== expectedImage) issue(errors, `${field}.file`, `must equal ${expectedImage}`);
    if (image.prompt_file !== expectedPrompt) issue(errors, `${field}.prompt_file`, `must equal ${expectedPrompt}`);
    const scoreValues = validateScores(image.scores, `${field}.scores`, errors);
    if (scoreValues) {
      SCORE_KEYS.forEach((key) => dimensions[key].push(image.scores[key]));
      const scoreMean = mean(scoreValues);
      if (!isFiniteNumber(image.total_score) || image.total_score < 0 || image.total_score > 100) {
        issue(errors, `${field}.total_score`, "must be a score from 0 through 100");
      } else {
        if (image.total_score < 85) issue(errors, `${field}.total_score`, "must be at least 85", "qa-threshold");
        if (image.total_score > scoreMean) issue(errors, `${field}.total_score`, `must not exceed its dimension mean ${scoreMean}`);
        totals.push(image.total_score);
      }
    }
    validateHardGates(image.hard_gates, `${field}.hard_gates`, errors);
    if (!isObject(image.generation) || !isNonEmptyString(image.generation.backend) || !isNonEmptyString(image.generation.model)) {
      issue(errors, `${field}.generation`, "must record non-empty backend and model");
    }
    const png = await readPngDimensions(root, expectedImage, `${field}.file`, errors);
    if (png) {
      if (image.generation?.width !== png.width || image.generation?.height !== png.height) {
        issue(errors, `${field}.generation`, "must match the actual PNG dimensions");
      }
      if (Math.abs(png.width / png.height - baseline.canvas.width / baseline.canvas.height) > 0.002) {
        issue(errors, `${field}.file`, "PNG aspect ratio is outside the platform tolerance", "wrong-dimensions");
      }
      if (baseline.minShortEdge && Math.min(png.width, png.height) < baseline.minShortEdge) {
        issue(errors, `${field}.file`, `PNG short edge must be at least ${baseline.minShortEdge}px`, "wrong-dimensions");
      }
    }
  }

  for (const id of CALIBRATION_IDS) {
    if (!byId.has(id)) issue(errors, "qa.calibration_images", `missing ${id} image`);
  }
  if (totals.length === 3) {
    const expectedAverage = mean(totals);
    if (qa.average_score !== expectedAverage) issue(errors, "qa.average_score", `must equal ${expectedAverage}`);
    if (!isFiniteNumber(qa.average_score) || qa.average_score < 88) issue(errors, "qa.average_score", "must be at least 88", "qa-threshold");
  }
  if (!isObject(qa.dimension_averages)) {
    issue(errors, "qa.dimension_averages", "must be an object");
  } else {
    for (const key of SCORE_KEYS) {
      if (dimensions[key].length === 3) {
        const expected = mean(dimensions[key]);
        if (qa.dimension_averages[key] !== expected) issue(errors, `qa.dimension_averages.${key}`, `must equal ${expected}`);
      }
    }
  }

  const selected = qa.selected_reference;
  if (!isObject(selected) || !CALIBRATION_IDS.includes(selected.image_id)) {
    issue(errors, "qa.selected_reference", "must identify a calibration image");
    return;
  }
  const selectedImage = byId.get(selected.image_id);
  if (selected.source_image !== `calibration/${selected.image_id}.png`) issue(errors, "qa.selected_reference.source_image", "must identify the selected calibration PNG");
  if (selected.path !== FILE_MANIFEST.styleReference) issue(errors, "qa.selected_reference.path", `must equal ${FILE_MANIFEST.styleReference}`);
  if (selected.unbranded !== true) issue(errors, "qa.selected_reference.unbranded", "must be true");
  if (totals.length === 3) {
    const ranked = CALIBRATION_IDS
      .map((id, order) => ({ id, order, score: byId.get(id)?.total_score }))
      .sort((a, b) => b.score - a.score || a.order - b.order);
    if (selected.image_id !== ranked[0].id) issue(errors, "qa.selected_reference.image_id", `must select highest-scoring image ${ranked[0].id}`);
  }

  const sourcePng = await readPngDimensions(root, selected.source_image, "qa.selected_reference.source_image", errors);
  const referencePng = await readPngDimensions(root, FILE_MANIFEST.styleReference, "qa.selected_reference.path", errors);
  if (sourcePng && referencePng) {
    if (Math.abs(referencePng.width / referencePng.height - baseline.canvas.width / baseline.canvas.height) > 0.002) {
      issue(errors, "qa.selected_reference.path", "reference PNG aspect ratio is outside the platform tolerance", "wrong-dimensions");
    }
    if (baseline.minShortEdge && Math.min(referencePng.width, referencePng.height) < baseline.minShortEdge) {
      issue(errors, "qa.selected_reference.path", `reference PNG short edge must be at least ${baseline.minShortEdge}px`, "wrong-dimensions");
    }
    if (sha256(sourcePng.buffer) !== sha256(referencePng.buffer)) {
      issue(errors, "qa.selected_reference.path", "must be byte-identical to selected_reference.source_image", "wrong-reference");
    }
  }
  if (qa.contact_sheet !== "calibration/contact-sheet.png") {
    issue(errors, "qa.contact_sheet", "must equal calibration/contact-sheet.png");
  } else {
    await readPngDimensions(root, qa.contact_sheet, "qa.contact_sheet", errors);
  }
  if (!selectedImage) issue(errors, "qa.selected_reference.image_id", "must refer to an existing calibration image");
}

function registryEntries(registry) {
  if (Array.isArray(registry)) return registry.map((entry) => ({ entry }));
  if (!isObject(registry)) return [];
  if (Array.isArray(registry.styles)) return registry.styles.map((entry) => ({ entry }));
  if (isObject(registry.styles)) return Object.entries(registry.styles).map(([key, entry]) => ({ key, entry }));
  return Object.entries(registry).map(([key, entry]) => ({ key, entry }));
}

function entryIdentity(item) {
  const entry = isObject(item.entry) ? item.entry : {};
  const id = entry.id ?? entry.style_id ?? entry.styleId ?? item.key;
  const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
  return { id, aliases };
}

async function validateRegistry(registryPath, candidate, errors) {
  let registry;
  try {
    registry = JSON.parse(await readFile(path.resolve(registryPath), "utf8"));
  } catch (error) {
    issue(errors, "registry", `cannot read valid registry JSON: ${error.message}`, "invalid-registry");
    return;
  }
  const normalize = (value) => typeof value === "string" ? value.toLocaleLowerCase("en-US") : value;
  const candidateNames = new Set([candidate.style.id, ...(candidate.style.aliases ?? [])].map(normalize));
  const matches = registryEntries(registry).filter((item) => {
    const identity = entryIdentity(item);
    return [identity.id, ...identity.aliases].some((name) => candidateNames.has(normalize(name)));
  });
  if (candidate.status === "installed") {
    const exactMatches = matches.filter((item) => normalize(entryIdentity(item).id) === normalize(candidate.style.id));
    if (exactMatches.length !== 1) issue(errors, "registry", "installed candidate must have exactly one registry entry with its style ID", "registry-mismatch");
  } else if (matches.length > 0) {
    issue(errors, "candidate.style.id", "style ID or alias conflicts with the target registry", "duplicate-style-id");
  }
}

async function validateBundleImages(root, errors, blocked) {
  let files;
  try {
    files = await walkFiles(root);
  } catch (error) {
    issue(errors, "candidate", `cannot enumerate bundle: ${error.message}`, "io-error");
    return;
  }
  for (const file of files) {
    const relative = path.relative(root, file.absolute).split(path.sep).join("/");
    if (file.symlink) issue(errors, relative, "symbolic links are forbidden in candidate bundles", "symlink-forbidden");
    if (IMAGE_EXTENSIONS.has(path.extname(relative).toLowerCase())) {
      if (blocked || !ALLOWED_IMAGES.has(relative)) issue(errors, relative, "raw or undeclared image files are forbidden in candidate bundles", "raw-image-forbidden");
    }
  }
}

export async function validateCandidate(candidateDirectory, options = {}) {
  const errors = [];
  const warnings = [];
  const root = path.resolve(candidateDirectory);
  try {
    const stats = await lstat(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      issue(errors, "candidate", "candidate path must be a real directory", "wrong-file-type");
      return { valid: false, errors, warnings, summary: { candidateDirectory: root } };
    }
  } catch (error) {
    issue(errors, "candidate", `cannot access candidate directory: ${error.message}`, "io-error");
    return { valid: false, errors, warnings, summary: { candidateDirectory: root } };
  }

  const candidate = await loadJson(root, "candidate.json", "candidate.json", errors);
  const style = validateCandidateManifest(candidate, errors, options.requireInstallable === true);
  await requireNonEmptyText(root, "visual-dna.md", "visual-dna.md", errors);
  const dna = await loadJson(root, "visual-dna.json", "visual-dna.json", errors);
  const provenance = await loadJson(root, "provenance.json", "provenance.json", errors);
  validateProvenance(provenance, errors);
  validateVisualDna(dna, candidate, provenance, errors);

  const blocked = candidate?.status === "blocked";
  await validateBundleImages(root, errors, blocked);
  if (blocked) {
    for (const relative of ["style.md", "style.spec.json", "qa.json", "prompts", "calibration"]) {
      try {
        await lstat(path.join(root, relative));
        issue(errors, relative, "must be omitted after a hard design-signal block", "blocked-artifact");
      } catch (error) {
        if (error?.code !== "ENOENT") issue(errors, relative, `cannot inspect blocked artifact: ${error.message}`, "io-error");
      }
    }
  } else {
    await requireNonEmptyText(root, "style.md", "style.md", errors);
    for (const id of CALIBRATION_IDS) await requireNonEmptyText(root, `prompts/${id}.md`, `prompts/${id}.md`, errors);
    const spec = await loadJson(root, "style.spec.json", "style.spec.json", errors);
    validateStyleSpec(spec, style, errors);
    const qa = await loadJson(root, "qa.json", "qa.json", errors);
    await validateQa(root, qa, style, provenance, errors);
  }
  if (options.registryPath && candidate && style) await validateRegistry(options.registryPath, candidate, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      candidateDirectory: root,
      styleId: style?.id ?? null,
      platform: style?.platform ?? null,
      makeDefault: style?.makeDefault === true,
      status: candidate?.status ?? null,
      installable: candidate?.status === "approved" && candidate?.template_ready === true && candidate?.humanApproval?.status === "approved",
    },
  };
}

function usage() {
  return "Usage: node scripts/validate-candidate.mjs <candidate-dir> [--registry <style-registry.json>] [--require-installable] [--json]";
}

function parseArguments(argv) {
  const options = { json: false, requireInstallable: false, registryPath: null, candidateDirectory: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--require-installable") options.requireInstallable = true;
    else if (argument === "--registry") options.registryPath = argv[++index];
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    else if (options.candidateDirectory) throw new Error("Only one candidate directory is allowed");
    else options.candidateDirectory = argument;
  }
  if (options.registryPath === undefined) throw new Error("--registry requires a path");
  return options;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.candidateDirectory) {
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  const result = await validateCandidate(options.candidateDirectory, options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.valid) {
    console.log(`Valid candidate: ${result.summary.styleId} (${result.summary.status})`);
  } else {
    console.error(`Invalid candidate: ${result.errors.length} error(s)`);
    for (const error of result.errors) console.error(`- [${error.code}] ${error.field}: ${error.message}`);
  }
  if (!result.valid) process.exitCode = 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) await main();

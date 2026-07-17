#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");
const require = createRequire(import.meta.url);

const resvgVersion = "2.6.2";
const vendorIndexPath = resolve(skillRoot, "vendor/resvg-wasm/index.js");
const vendorWasmPath = resolve(skillRoot, "vendor/resvg-wasm/index_bg.wasm");
const vendorHashes = Object.freeze({
  [vendorIndexPath]: "0c1cd17c478a10ad891b147808c4f27b1023216f7726c49528c22c310c83ee6c",
  [vendorWasmPath]: "22bf6e9f9a100d972da0411a69c5ba504367fc1fa87b3b64e3f35e53926d2d70"
});

const defaultStyleSpec = "references/styles/xhs-style-explainer-notebook.spec.json";
const defaultBrandSvg = "assets/brand/tranfu-logo-reference.svg";
const maxInputBytes = 30 * 1024 * 1024;
const maxRasterEdge = 4096;
const maxRasterPixels = 10_000_000;
const maxBrandBytes = 256 * 1024;

const valueOptions = new Set([
  "input",
  "output",
  "input-dir",
  "output-dir",
  "style-spec",
  "brand-svg"
]);
const booleanOptions = new Set(["self-test"]);

let wasmInitialization;
let Resvg;

function usage() {
  console.error(`Usage:
  node scripts/apply-brand-overlay.mjs --input image.png --output image-branded.png
  node scripts/apply-brand-overlay.mjs --input-dir unbranded --output-dir branded
  node scripts/apply-brand-overlay.mjs --self-test

Options:
  --style-spec <path>   Defaults to ${defaultStyleSpec}
  --brand-svg <path>    Defaults to ${defaultBrandSvg}
`);
}

function ensureSupportedNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isInteger(major) || major < 22) {
    throw new Error(`Node.js 22 or newer is required; found ${process.versions.node}`);
  }
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (Object.hasOwn(args, key)) {
      throw new Error(`Duplicate option: --${key}`);
    }

    if (booleanOptions.has(key)) {
      args[key] = true;
      continue;
    }

    if (!valueOptions.has(key)) {
      throw new Error(`Unknown option: --${key}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }

  return args;
}

function resolveInputPath(pathValue) {
  if (!pathValue) return null;
  if (isAbsolute(pathValue)) return pathValue;

  const fromCwd = resolve(process.cwd(), pathValue);
  if (existsSync(fromCwd) || pathValue.startsWith(".")) {
    return fromCwd;
  }
  return resolve(skillRoot, pathValue);
}

function resolveOutputPath(pathValue) {
  if (!pathValue) return null;
  return isAbsolute(pathValue) ? pathValue : resolve(process.cwd(), pathValue);
}

function defaultPath(relativePath) {
  return resolve(skillRoot, relativePath);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function ensureResvg() {
  if (!wasmInitialization) {
    wasmInitialization = (async () => {
      let indexBytes;
      let wasmBytes;
      try {
        [indexBytes, wasmBytes] = await Promise.all([
          readFile(vendorIndexPath),
          readFile(vendorWasmPath)
        ]);
      } catch (error) {
        throw new Error(`Vendored resvg WASM files are missing: ${error.message}`);
      }

      for (const [filePath, bytes] of [
        [vendorIndexPath, indexBytes],
        [vendorWasmPath, wasmBytes]
      ]) {
        if (sha256(bytes) !== vendorHashes[filePath]) {
          throw new Error(`Vendored resvg WASM checksum mismatch: ${filePath}`);
        }
      }

      let binding;
      try {
        binding = require(vendorIndexPath);
      } catch (error) {
        throw new Error(`Unable to load vendored resvg WASM JavaScript: ${error.message}`);
      }

      if (typeof binding.Resvg !== "function" || typeof binding.initWasm !== "function") {
        throw new Error("Vendored resvg WASM exports are invalid");
      }

      try {
        await binding.initWasm(wasmBytes);
      } catch (error) {
        throw new Error(`Unable to initialize vendored resvg WASM: ${error.message}`);
      }
      Resvg = binding.Resvg;
    })();
  }

  await wasmInitialization;
  return Resvg;
}

function validateRasterDimensions(width, height, label) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`${label} has invalid dimensions`);
  }
  if (width > maxRasterEdge || height > maxRasterEdge || width * height > maxRasterPixels) {
    throw new Error(`${label} exceeds the ${maxRasterEdge}px edge or ${maxRasterPixels.toLocaleString()} pixel safety limit`);
  }
}

function parsePngSize(buffer, label) {
  if (buffer.length < 33) {
    throw new Error(`${label} is too small to be a valid PNG`);
  }
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${label} is not a PNG file`);
  }
  if (buffer.readUInt32BE(8) !== 13 || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error(`${label} has no valid PNG IHDR header`);
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  validateRasterDimensions(width, height, label);
  return { width, height };
}

async function readInputPng(filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`${filePath} is not a regular file`);
  }
  if (info.size > maxInputBytes) {
    throw new Error(`${filePath} exceeds the ${maxInputBytes / 1024 / 1024} MB safety limit`);
  }

  const buffer = await readFile(filePath);
  return { buffer, size: parsePngSize(buffer, filePath) };
}

async function listPngs(inputDir) {
  const entries = await readdir(inputDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => join(inputDir, entry.name))
    .sort();
}

async function identifyPath(filePath, allowMissing = false) {
  try {
    const info = await stat(filePath);
    return {
      exists: true,
      realPath: await realpath(filePath),
      device: info.dev,
      inode: info.ino
    };
  } catch (error) {
    if (!allowMissing || error?.code !== "ENOENT") throw error;
    await mkdir(dirname(filePath), { recursive: true });
    return {
      exists: false,
      realPath: join(await realpath(dirname(filePath)), basename(filePath))
    };
  }
}

async function ensureDistinctFiles(input, output) {
  let outputEntry;
  try {
    outputEntry = await lstat(output);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (outputEntry && !outputEntry.isFile()) {
    throw new Error(`Output path must be a regular file: ${output}`);
  }

  const [inputIdentity, outputIdentity] = await Promise.all([
    identifyPath(input),
    identifyPath(output, true)
  ]);
  const sameInode =
    outputIdentity.exists &&
    inputIdentity.device === outputIdentity.device &&
    inputIdentity.inode === outputIdentity.inode;
  if (sameInode || inputIdentity.realPath === outputIdentity.realPath) {
    throw new Error("--input and --output must be different paths so the source PNG is preserved");
  }
}

function validateCanvasGeometry(spec, specPath) {
  if (!spec || typeof spec !== "object") {
    throw new Error(`${specPath} does not contain a JSON object`);
  }

  const canvas = spec.canvas;
  if (!canvas || !Number.isInteger(canvas.width) || !Number.isInteger(canvas.height)) {
    throw new Error(`Style Spec ${spec.id ?? specPath} has invalid canvas dimensions`);
  }
  validateRasterDimensions(canvas.width, canvas.height, `Style Spec ${spec.id ?? specPath} canvas`);
  return canvas;
}

function validateRect(rect, label, canvas) {
  if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) {
    throw new Error(`Style Spec ${label} has invalid geometry`);
  }
  if (rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0) {
    throw new Error(`Style Spec ${label} has invalid geometry`);
  }
  if (rect.x + rect.width > canvas.width || rect.y + rect.height > canvas.height) {
    throw new Error(`Style Spec ${label} must stay inside the canvas`);
  }
}

function validateBrandGeometry(spec, specPath) {
  const canvas = validateCanvasGeometry(spec, specPath);
  const reserved = spec.layout?.brandReservedArea;
  const slot = spec.fixedComponents?.brandSlot;
  const id = spec.id ?? specPath;

  if (!slot?.enabled) {
    throw new Error(`Style Spec ${id} has no enabled brandSlot`);
  }
  if (slot.anchor !== "top-right") {
    throw new Error(`Style Spec ${id} brandSlot must use the top-right anchor`);
  }
  if (slot.assetFit !== "contain") {
    throw new Error(`Style Spec ${id} brandSlot.assetFit must be contain`);
  }
  if (spec.generationConstraints?.keepBrandReservedAreaClear !== true) {
    throw new Error(`Style Spec ${id} must keep its brandReservedArea clear`);
  }

  validateRect(reserved, `${id} brandReservedArea`, canvas);
  validateRect(slot, `${id} brandSlot`, canvas);

  if (
    slot.x < reserved.x ||
    slot.y < reserved.y ||
    slot.x + slot.width > reserved.x + reserved.width ||
    slot.y + slot.height > reserved.y + reserved.height
  ) {
    throw new Error(`Style Spec ${id} brandSlot must stay inside brandReservedArea`);
  }
  if (reserved.x < canvas.width / 2 || reserved.y + reserved.height > canvas.height / 2) {
    throw new Error(`Style Spec ${id} brandReservedArea must be in the top-right quadrant`);
  }

  return { canvas, slot };
}

function parseBrandSvg(svgText, svgPath) {
  if (Buffer.byteLength(svgText, "utf8") > maxBrandBytes) {
    throw new Error(`${svgPath} exceeds the ${maxBrandBytes / 1024} KB brand asset limit`);
  }
  if (/<!doctype\b|<\?xml|<!--|<!\[cdata\[/i.test(svgText)) {
    throw new Error(`${svgPath} contains unsupported XML declarations or markup`);
  }
  if (/\b(?:href|xlink:href|style|on[a-z]+)\s*=|\burl\s*\(|\bvar\s*\(/i.test(svgText)) {
    throw new Error(`${svgPath} must not contain styles, variables, events, or resource references`);
  }

  const root = svgText.match(/^\s*<svg\b([^>]*)>([\s\S]*?)<\/svg>\s*$/i);
  if (!root) {
    throw new Error(`${svgPath} does not contain one complete SVG root`);
  }

  const attributes = root[1];
  const body = root[2];
  const viewBoxMatch = attributes.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (!viewBoxMatch) {
    throw new Error(`${svgPath} must define a viewBox`);
  }

  const viewBox = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value)) || viewBox[2] <= 0 || viewBox[3] <= 0) {
    throw new Error(`${svgPath} has an invalid viewBox`);
  }

  const tags = [...body.matchAll(/<\/?\s*([a-z][a-z0-9:-]*)\b/gi)].map((match) => match[1].toLowerCase());
  if (tags.length === 0 || tags.some((tag) => tag !== "g" && tag !== "path")) {
    throw new Error(`${svgPath} must contain only group and path elements`);
  }

  const paths = [...body.matchAll(/<path\b([^>]*)\/?\s*>/gi)];
  if (paths.length === 0) {
    throw new Error(`${svgPath} contains no path elements`);
  }
  for (const path of paths) {
    if (!/\bfill\s*=\s*["']#E63A46["']/i.test(path[1])) {
      throw new Error(`${svgPath} paths must use the fixed #E63A46 brand color`);
    }
  }

  return { viewBox: viewBox.join(" "), body };
}

function aspectRatioMatches(size, canvas, tolerance) {
  return Math.abs(size.width / size.height - canvas.width / canvas.height) <= tolerance;
}

function scaleRect(rect, canvas, sourceSize) {
  const scaleX = sourceSize.width / canvas.width;
  const scaleY = sourceSize.height / canvas.height;
  return {
    x: rect.x * scaleX,
    y: rect.y * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY
  };
}

function buildWrapperSvg({ inputPng, sourceSize, spec, brand }) {
  const { canvas } = spec;
  const imageHref = `data:image/png;base64,${inputPng.toString("base64")}`;
  let brandElement = "";

  if (brand) {
    const slot = scaleRect(spec.fixedComponents.brandSlot, canvas, sourceSize);
    brandElement = `
  <svg
    x="${slot.x}"
    y="${slot.y}"
    width="${slot.width}"
    height="${slot.height}"
    viewBox="${brand.viewBox}"
    preserveAspectRatio="xMidYMid meet"
    overflow="hidden"
  >
    ${brand.body}
  </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg"
  width="${sourceSize.width}"
  height="${sourceSize.height}"
  viewBox="0 0 ${sourceSize.width} ${sourceSize.height}">
  <image
    href="${imageHref}"
    x="0"
    y="0"
    width="${sourceSize.width}"
    height="${sourceSize.height}"
    preserveAspectRatio="xMidYMid meet"
  />${brandElement}
</svg>`;
}

function renderSvg(Renderer, svg, capturePixels = false) {
  let renderer;
  let rendered;
  try {
    renderer = new Renderer(svg, { font: { loadSystemFonts: false } });
    rendered = renderer.render();
    return {
      png: Buffer.from(rendered.asPng()),
      pixels: capturePixels ? Buffer.from(rendered.pixels) : null
    };
  } finally {
    rendered?.free();
    renderer?.free();
  }
}

async function replaceOutput(temporaryOutput, output) {
  try {
    await rename(temporaryOutput, output);
    return;
  } catch (error) {
    const replaceConflict = process.platform === "win32" && ["EACCES", "EEXIST", "EPERM"].includes(error.code);
    if (!replaceConflict) throw error;
  }

  const backup = join(dirname(output), `.${basename(output)}.${randomUUID()}.bak`);
  let hasBackup = false;
  try {
    await rename(output, backup);
    hasBackup = true;
    await rename(temporaryOutput, output);
    await rm(backup, { force: true });
    hasBackup = false;
  } catch (error) {
    if (hasBackup) {
      try {
        await rename(backup, output);
        hasBackup = false;
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `Unable to replace ${output}; the previous output remains at ${backup}`
        );
      }
    }
    throw error;
  }
}

async function writeOutputAtomically(output, buffer) {
  await mkdir(dirname(output), { recursive: true });
  const temporaryOutput = join(dirname(output), `.${basename(output)}.${randomUUID()}.tmp`);

  try {
    await writeFile(temporaryOutput, buffer, { flag: "wx" });
    await replaceOutput(temporaryOutput, output);
  } finally {
    await rm(temporaryOutput, { force: true });
  }
}

async function renderOne({ input, output, spec, specPath, brand, capturePixels = false }) {
  await ensureDistinctFiles(input, output);

  const { canvas } = validateBrandGeometry(spec, specPath);
  const { buffer: inputPng, size } = await readInputPng(input);

  const handling = spec.inputHandling;
  const tolerance = handling?.ratioTolerance;
  const validMinimumShortEdge = handling?.minShortEdge === undefined ||
    (Number.isInteger(handling.minShortEdge) && handling.minShortEdge > 0);
  const preservesNativeOutput =
    handling?.preserveNativeOutput === true &&
    handling?.outputCanvasRole === "design-coordinate-system" &&
    handling?.allowPostGenerationResize === false &&
    Number.isFinite(tolerance) &&
    tolerance >= 0 &&
    validMinimumShortEdge;
  if (!preservesNativeOutput) {
    throw new Error(`Style Spec ${spec.id ?? specPath} has incompatible native-output handling`);
  }
  if (!aspectRatioMatches(size, canvas, tolerance)) {
    throw new Error(
      `${basename(input)} is ${size.width}x${size.height}; its ratio is outside tolerance for ${canvas.ratio ?? `${canvas.width}:${canvas.height}`}`
    );
  }
  if (handling.minShortEdge && Math.min(size.width, size.height) < handling.minShortEdge) {
    throw new Error(`${basename(input)} short edge ${Math.min(size.width, size.height)}px must be at least ${handling.minShortEdge}px`);
  }

  const Renderer = await ensureResvg();
  const wrapperSvg = buildWrapperSvg({ inputPng, sourceSize: size, spec, brand });
  const { png, pixels } = renderSvg(Renderer, wrapperSvg, capturePixels);
  const outputSize = parsePngSize(png, output);

  if (outputSize.width !== size.width || outputSize.height !== size.height) {
    throw new Error(
      `Renderer returned ${outputSize.width}x${outputSize.height}; expected native source size ${size.width}x${size.height}`
    );
  }

  await writeOutputAtomically(output, png);
  return { outputSize, pixels };
}

function countSelfTestPixels(branded, plain, canvas, slot) {
  let changedInside = 0;
  let changedOutside = 0;
  let exactBrandRed = 0;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      if (branded.subarray(offset, offset + 4).equals(plain.subarray(offset, offset + 4))) continue;

      const inside = x >= slot.x && x < slot.x + slot.width && y >= slot.y && y < slot.y + slot.height;
      if (inside) changedInside += 1;
      else changedOutside += 1;

      if (
        branded[offset] === 0xe6 &&
        branded[offset + 1] === 0x3a &&
        branded[offset + 2] === 0x46 &&
        branded[offset + 3] === 0xff
      ) {
        exactBrandRed += 1;
      }
    }
  }

  return { changedInside, changedOutside, exactBrandRed };
}

async function runSelfTest(brandSvgPath) {
  const Renderer = await ensureResvg();
  const tempDir = await mkdtemp(join(tmpdir(), "brand-overlay-self-test-"));
  const input = join(tempDir, "input.png");
  const plainOutput = join(tempDir, "plain.png");
  const brandedOutput = join(tempDir, "branded.png");
  const spec = {
    id: "self-test",
    canvas: { width: 256, height: 128 },
    layout: {
      brandReservedArea: { x: 128, y: 12, width: 116, height: 52 }
    },
    fixedComponents: {
      brandSlot: {
        enabled: true,
        anchor: "top-right",
        x: 136,
        y: 20,
        width: 100,
        height: 28,
        assetFit: "contain"
      }
    },
    generationConstraints: { keepBrandReservedAreaClear: true },
    inputHandling: {
      preserveNativeOutput: true,
      ratioTolerance: 0.002,
      outputCanvasRole: "design-coordinate-system",
      allowPostGenerationResize: false
    }
  };

  try {
    const background = renderSvg(
      Renderer,
      `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="128"><rect width="256" height="128" fill="#197183"/></svg>`
    ).png;
    await writeFile(input, background);

    const brand = parseBrandSvg(await readFile(brandSvgPath, "utf8"), brandSvgPath);
    const plain = await renderOne({
      input,
      output: plainOutput,
      spec,
      specPath: "internal:self-test",
      brand: null,
      capturePixels: true
    });
    const branded = await renderOne({
      input,
      output: brandedOutput,
      spec,
      specPath: "internal:self-test",
      brand,
      capturePixels: true
    });

    const counts = countSelfTestPixels(
      branded.pixels,
      plain.pixels,
      spec.canvas,
      spec.fixedComponents.brandSlot
    );
    if (counts.changedInside < 20 || counts.exactBrandRed < 10 || counts.changedOutside !== 0) {
      throw new Error(
        `Self-test Logo pixel check failed: ${JSON.stringify(counts)}`
      );
    }

    console.log(
      `Brand overlay self-test passed: vendored resvg WASM ${resvgVersion} produced a visible fixed-color Logo.`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function readStyleSpec(styleSpecPath) {
  try {
    return JSON.parse(await readFile(styleSpecPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read Style Spec ${styleSpecPath}: ${error.message}`);
  }
}

async function main() {
  ensureSupportedNode();
  const args = parseArgs(process.argv.slice(2));
  const styleSpecPath = args["style-spec"]
    ? resolveInputPath(args["style-spec"])
    : defaultPath(defaultStyleSpec);
  const brandSvgPath = args["brand-svg"]
    ? resolveInputPath(args["brand-svg"])
    : defaultPath(defaultBrandSvg);

  if (args["self-test"]) {
    if (args.input || args.output || args["input-dir"] || args["output-dir"]) {
      throw new Error("--self-test cannot be combined with input or output options");
    }
    await runSelfTest(brandSvgPath);
    return;
  }

  const hasFileMode = args.input || args.output;
  const hasDirectoryMode = args["input-dir"] || args["output-dir"];
  if (hasFileMode && hasDirectoryMode) {
    throw new Error("Choose either --input/--output or --input-dir/--output-dir");
  }
  if (!hasFileMode && !hasDirectoryMode) {
    usage();
    process.exitCode = 1;
    return;
  }

  const spec = await readStyleSpec(styleSpecPath);
  const brand = parseBrandSvg(await readFile(brandSvgPath, "utf8"), brandSvgPath);

  if (hasFileMode) {
    if (!args.input || !args.output) {
      throw new Error("--input and --output must be provided together");
    }
    await renderOne({
      input: resolveInputPath(args.input),
      output: resolveOutputPath(args.output),
      spec,
      specPath: styleSpecPath,
      brand
    });
    return;
  }

  if (!args["input-dir"] || !args["output-dir"]) {
    throw new Error("--input-dir and --output-dir must be provided together");
  }

  const inputDir = resolveInputPath(args["input-dir"]);
  const outputDir = resolveOutputPath(args["output-dir"]);
  await mkdir(outputDir, { recursive: true });
  const [inputDirectory, outputDirectory] = await Promise.all([
    realpath(inputDir),
    realpath(outputDir)
  ]);
  if (inputDirectory === outputDirectory) {
    throw new Error("--input-dir and --output-dir must be different so source PNGs are preserved");
  }

  const inputs = await listPngs(inputDir);
  if (inputs.length === 0) {
    throw new Error(`No PNG files found in ${inputDir}`);
  }

  for (const input of inputs) {
    await renderOne({
      input,
      output: join(outputDir, basename(input)),
      spec,
      specPath: styleSpecPath,
      brand
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

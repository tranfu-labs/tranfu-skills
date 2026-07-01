#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");

function usage() {
  console.error(`Usage:
  node scripts/apply-brand-overlay.mjs --input image.png --output image-branded.png
  node scripts/apply-brand-overlay.mjs --input-dir unbranded --output-dir branded

Options:
  --style-spec <path>   Defaults to references/styles/xhs-style-explainer-notebook.spec.json
  --brand-svg <path>    Defaults to assets/brand/tranfu-logo-reference.svg
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) {
      throw new Error(`Unexpected argument: ${key}`);
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

function resolvePath(pathValue) {
  if (!pathValue) return null;
  const fromCwd = resolve(process.cwd(), pathValue);
  if (existsSync(fromCwd) || pathValue.startsWith("/") || pathValue.startsWith(".")) {
    return fromCwd;
  }
  return resolve(skillRoot, pathValue);
}

function defaultPath(relativePath) {
  return resolve(skillRoot, relativePath);
}

function readPngSize(filePath) {
  const buffer = readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error(`${filePath} is not a PNG file`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function listPngs(inputDir) {
  const output = execFileSync("find", [inputDir, "-maxdepth", "1", "-type", "f", "-name", "*.png", "-print"], {
    encoding: "utf8"
  });
  return output.split("\n").filter(Boolean).sort();
}

function dependencyInstallHint() {
  try {
    execFileSync("sh", ["-lc", "command -v brew"], { stdio: "ignore" });
    return "Install it with: brew install librsvg";
  } catch {
    try {
      execFileSync("sh", ["-lc", "command -v apt-get"], { stdio: "ignore" });
      return "Install it with: sudo apt-get update && sudo apt-get install -y librsvg2-bin";
    } catch {
      return "Install librsvg with your system package manager, then make sure rsvg-convert is on PATH.";
    }
  }
}

function ensureRsvgConvert() {
  try {
    execFileSync("sh", ["-lc", "command -v rsvg-convert"], { stdio: "ignore" });
  } catch {
    throw new Error(`rsvg-convert is required for brand overlay but is not installed. ${dependencyInstallHint()}`);
  }
}

function aspectRatioMatches(size, canvas, tolerance) {
  return Math.abs(size.width / size.height - canvas.width / canvas.height) <= tolerance;
}

function renderOne({ input, output, spec, brandSvg }) {
  const canvas = spec.canvas;
  const slot = spec.fixedComponents?.brandSlot;
  if (!slot?.enabled) {
    throw new Error(`Style Spec ${spec.id} has no enabled brandSlot`);
  }

  ensureRsvgConvert();

  const size = readPngSize(input);
  if (size.width !== canvas.width || size.height !== canvas.height) {
    const canResize = spec.inputHandling?.allowSameAspectRatioResize === true;
    const tolerance = spec.inputHandling?.ratioTolerance ?? 0.001;
    if (!canResize || !aspectRatioMatches(size, canvas, tolerance)) {
      throw new Error(
        `${basename(input)} is ${size.width}x${size.height}, expected ${canvas.width}x${canvas.height} from Style Spec ${spec.id}`
      );
    }
  }

  mkdirSync(dirname(output), { recursive: true });

  const tempDir = mkdtempSync(join(tmpdir(), "brand-overlay-"));
  const wrapperPath = join(tempDir, "wrapper.svg");
  const imageData = readFileSync(input).toString("base64");
  const brandData = Buffer.from(readFileSync(brandSvg, "utf8"), "utf8").toString("base64");
  const imageHref = `data:image/png;base64,${imageData}`;
  const brandHref = `data:image/svg+xml;base64,${brandData}`;

  const wrapper = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <image href="${imageHref}" x="0" y="0" width="${canvas.width}" height="${canvas.height}" preserveAspectRatio="none"/>
  <image href="${brandHref}" x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;

  try {
    writeFileSync(wrapperPath, wrapper);
    execFileSync("rsvg-convert", ["-f", "png", "-o", output, wrapperPath], { stdio: "pipe" });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const styleSpecPath = args["style-spec"]
    ? resolvePath(args["style-spec"])
    : defaultPath("references/styles/xhs-style-explainer-notebook.spec.json");
  const brandSvgPath = args["brand-svg"]
    ? resolvePath(args["brand-svg"])
    : defaultPath("assets/brand/tranfu-logo-reference.svg");

  const spec = JSON.parse(readFileSync(styleSpecPath, "utf8"));

  if (args.input || args.output) {
    if (!args.input || !args.output) {
      throw new Error("--input and --output must be provided together");
    }
    renderOne({
      input: resolvePath(args.input),
      output: resolve(process.cwd(), args.output),
      spec,
      brandSvg: brandSvgPath
    });
    return;
  }

  if (args["input-dir"] || args["output-dir"]) {
    if (!args["input-dir"] || !args["output-dir"]) {
      throw new Error("--input-dir and --output-dir must be provided together");
    }
    const inputDir = resolvePath(args["input-dir"]);
    const outputDir = resolve(process.cwd(), args["output-dir"]);
    for (const input of listPngs(inputDir)) {
      renderOne({
        input,
        output: join(outputDir, basename(input)),
        spec,
        brandSvg: brandSvgPath
      });
    }
    return;
  }

  usage();
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error.message);
  usage();
  process.exit(1);
}

#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import {
  access,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  unlink,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  join,
  resolve,
} from "node:path";

const SHARP_VERSION = "0.34.5";
const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const SUPPORTED_FORMATS = new Set(["png", "jpeg", "webp"]);

class CliError extends Error {}

function printHelp() {
  process.stdout.write(`Usage: node main.mjs <input> [options]

Options:
  -o, --output <path>   Output path for one file
  -f, --format <fmt>    webp or png (default: webp)
  -q, --quality <n>     WebP quality 1-100 (default: 80)
  -r, --recursive       Include subdirectories
      --replace         Replace source files after successful compression
      --json            Print a JSON report to stdout
  -h, --help            Show help
`);
}

function parseArgs(args) {
  const options = {
    input: "",
    output: undefined,
    format: "webp",
    quality: 80,
    qualityProvided: false,
    recursive: false,
    replace: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "-h" || argument === "--help") {
      options.help = true;
    } else if (argument === "-o" || argument === "--output") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) throw new CliError(`${argument} requires a path`);
      options.output = value;
      index += 1;
    } else if (argument === "-f" || argument === "--format") {
      const value = args[index + 1]?.toLowerCase();
      if (!value || !["webp", "png"].includes(value)) {
        throw new CliError("--format must be webp or png");
      }
      options.format = value;
      index += 1;
    } else if (argument === "-q" || argument === "--quality") {
      const raw = args[index + 1];
      const value = Number(raw);
      if (!raw || !Number.isInteger(value) || value < 1 || value > 100) {
        throw new CliError("--quality must be an integer from 1 to 100");
      }
      options.quality = value;
      options.qualityProvided = true;
      index += 1;
    } else if (argument === "-r" || argument === "--recursive") {
      options.recursive = true;
    } else if (argument === "--replace") {
      options.replace = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument.startsWith("-")) {
      throw new CliError(`Unknown option: ${argument}`);
    } else if (options.input) {
      throw new CliError("Exactly one input file or directory is required");
    } else {
      options.input = argument;
    }
  }

  if (!options.help && !options.input) {
    throw new CliError("An input file or directory is required");
  }
  if (options.format === "png" && options.qualityProvided) {
    throw new CliError("--quality is only valid with WebP output; PNG output is lossless");
  }
  if (options.output && options.replace) {
    throw new CliError("--output and --replace cannot be used together");
  }
  return options;
}

function assertNodeVersion() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 18 || (major === 18 && minor < 17)) {
    throw new CliError(`Node.js 18.17 or newer is required; found ${process.versions.node}`);
  }
}

function runtimeRoot() {
  const base = process.env.XDG_CACHE_HOME
    || (process.platform === "win32" ? process.env.LOCALAPPDATA : undefined)
    || join(homedir(), ".cache");
  return join(base, "compress-image", `sharp-${SHARP_VERSION}`);
}

function loadPinnedSharp(requireFrom, packagePath) {
  try {
    const packageJson = requireFrom(packagePath);
    if (packageJson.version !== SHARP_VERSION) return null;
    return requireFrom("sharp");
  } catch {
    return null;
  }
}

function installSharp(root) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = [
    "install",
    "--prefix",
    root,
    "--include=optional",
    "--no-save",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    `sharp@${SHARP_VERSION}`,
  ];

  process.stderr.write(`[compress-image] Installing Sharp ${SHARP_VERSION} in ${root}\n`);
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(npm, args, { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => process.stderr.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("error", (error) => rejectPromise(new CliError(`Unable to run npm: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new CliError(
        `Sharp installation failed with exit code ${code}. Retry: npm install --prefix "${root}" --include=optional --no-save sharp@${SHARP_VERSION}`,
      ));
    });
  });
}

async function ensureSharp() {
  const localRequire = createRequire(import.meta.url);
  const localSharp = loadPinnedSharp(localRequire, "sharp/package.json");
  if (localSharp) return localSharp;

  const root = runtimeRoot();
  const cachedRequire = createRequire(join(root, "package.json"));
  const cachedPackage = join(root, "node_modules", "sharp", "package.json");
  const cachedSharp = loadPinnedSharp(cachedRequire, cachedPackage);
  if (cachedSharp) return cachedSharp;

  await mkdir(root, { recursive: true });
  await installSharp(root);
  const installedSharp = loadPinnedSharp(cachedRequire, cachedPackage);
  if (!installedSharp) {
    throw new CliError(
      `Sharp ${SHARP_VERSION} was installed but could not be loaded. Retry: npm install --prefix "${root}" --include=optional --no-save sharp@${SHARP_VERSION}`,
    );
  }
  return installedSharp;
}

function extensionFormat(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "jpeg";
  if (extension === ".png") return "png";
  if (extension === ".webp") return "webp";
  return null;
}

function outputExtension(format) {
  return format === "png" ? ".png" : ".webp";
}

function isGeneratedName(path) {
  return /-compressed\.(?:png|jpe?g|webp)$/i.test(basename(path));
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function retryBusy(operation) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!["EBUSY", "EPERM", "EACCES"].includes(error.code) || attempt === 5) throw error;
      await delay(attempt * 25);
    }
  }
}

async function collectFiles(directory, recursive) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...await collectFiles(fullPath, recursive));
    } else if (
      entry.isFile()
      && SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())
      && !isGeneratedName(entry.name)
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function resolveOutput(input, sourceFormat, options) {
  if (options.output) return resolve(options.output);

  const directory = dirname(input);
  const stem = basename(input, extname(input));
  const extension = outputExtension(options.format);
  if (options.replace) {
    return sourceFormat === options.format ? input : join(directory, `${stem}${extension}`);
  }
  return join(directory, `${stem}-compressed${extension}`);
}

function makeResult(input, output, inputBytes, outputBytes, format) {
  const savedBytes = inputBytes - outputBytes;
  return {
    input,
    output,
    inputBytes,
    outputBytes,
    savedBytes,
    savedPercent: Math.round((savedBytes / inputBytes) * 10000) / 100,
    format,
  };
}

async function processFile(sharp, inputPath, options) {
  const input = resolve(inputPath);
  const inputStats = await stat(input);
  if (!inputStats.isFile()) throw new CliError("Input is not a regular file");

  const declaredFormat = extensionFormat(input);
  if (!declaredFormat) throw new CliError("Supported input formats are PNG, JPEG, and WebP");

  let metadata;
  const probe = sharp(input, { animated: true });
  try {
    metadata = await probe.metadata();
  } catch (error) {
    throw new CliError(`Unreadable or corrupt image: ${error.message}`);
  } finally {
    probe.destroy();
  }
  if (!SUPPORTED_FORMATS.has(metadata.format)) {
    throw new CliError(`Unsupported image content: ${metadata.format || "unknown"}`);
  }
  if (metadata.format !== declaredFormat) {
    throw new CliError(`File extension does not match ${metadata.format} image content`);
  }
  if ((metadata.pages || 1) > 1) {
    throw new CliError("Animated or multi-page images are not supported");
  }

  const output = resolveOutput(input, metadata.format, options);
  const outputParent = dirname(output);
  const outputParentStats = await stat(outputParent).catch(() => null);
  if (!outputParentStats?.isDirectory()) {
    throw new CliError(`Output directory does not exist: ${outputParent}`);
  }
  if (options.output && extname(output).toLowerCase() !== outputExtension(options.format)) {
    throw new CliError(`Output path must end with ${outputExtension(options.format)}`);
  }
  if (output !== input && await pathExists(output)) {
    throw new CliError(`Destination already exists: ${output}`);
  }

  const temporary = join(
    outputParent,
    `.${basename(output)}.compress-image-${process.pid}-${randomUUID()}.tmp`,
  );
  let outputFinalized = false;

  try {
    let pipeline = sharp(input).autoOrient();
    pipeline = options.format === "webp"
      ? pipeline.webp({ quality: options.quality })
      : pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    let outputInfo;
    try {
      outputInfo = await pipeline.toFile(temporary);
    } finally {
      pipeline.destroy();
    }

    if (outputInfo.format !== options.format) {
      throw new CliError("Compressed output failed format verification");
    }
    const outputStats = await stat(temporary);
    if (outputStats.size === 0) throw new CliError("Compressed output is empty");

    await retryBusy(() => rename(temporary, output));
    outputFinalized = true;

    if (options.replace && output !== input) {
      try {
        await retryBusy(() => unlink(input));
      } catch (error) {
        await retryBusy(() => rm(output, { force: true }));
        outputFinalized = false;
        throw new CliError(`Could not remove source after conversion: ${error.message}`);
      }
    }

    return makeResult(input, output, inputStats.size, outputStats.size, options.format);
  } finally {
    if (!outputFinalized) await retryBusy(() => rm(temporary, { force: true })).catch(() => {});
  }
}

function buildReport(files, failures) {
  return {
    files,
    failures,
    summary: {
      succeeded: files.length,
      failed: failures.length,
      inputBytes: files.reduce((sum, file) => sum + file.inputBytes, 0),
      outputBytes: files.reduce((sum, file) => sum + file.outputBytes, 0),
    },
  };
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function printReport(report, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  for (const file of report.files) {
    process.stdout.write(
      `${file.input} → ${file.output} (${formatSize(file.inputBytes)} → ${formatSize(file.outputBytes)}, ${file.savedPercent}% saved)\n`,
    );
  }
  for (const failure of report.failures) {
    process.stderr.write(`Error processing ${failure.input}: ${failure.error}\n`);
  }
  process.stdout.write(
    `Processed ${report.summary.succeeded} file(s); ${report.summary.failed} failed\n`,
  );
}

async function run() {
  assertNodeVersion();
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const input = resolve(options.input);
  const inputStats = await stat(input).catch(() => null);
  if (!inputStats) throw new CliError(`Input not found: ${input}`);
  if (!inputStats.isFile() && !inputStats.isDirectory()) {
    throw new CliError("Input must be a regular file or directory");
  }
  if (inputStats.isDirectory() && options.output) {
    throw new CliError("--output is only valid for a single file");
  }
  if (inputStats.isFile() && options.recursive) {
    throw new CliError("--recursive is only valid for a directory");
  }
  if (inputStats.isFile() && !SUPPORTED_EXTENSIONS.has(extname(input).toLowerCase())) {
    throw new CliError("Supported input formats are PNG, JPEG, and WebP");
  }

  const inputs = inputStats.isDirectory()
    ? await collectFiles(input, options.recursive)
    : [input];
  if (inputs.length === 0) throw new CliError("No supported images found");

  const sharp = await ensureSharp();
  sharp.cache({ files: 0 });
  const files = [];
  const failures = [];
  for (const file of inputs) {
    try {
      files.push(await processFile(sharp, file, options));
    } catch (error) {
      failures.push({ input: resolve(file), error: error.message });
    }
  }

  const report = buildReport(files, failures);
  printReport(report, options.json);
  if (failures.length > 0) process.exitCode = 1;
}

run().catch((error) => {
  const json = process.argv.includes("--json");
  const inputIndex = process.argv.findIndex((argument, index) => index > 1 && !argument.startsWith("-"));
  const input = inputIndex >= 0 ? resolve(process.argv[inputIndex]) : "";
  if (json) {
    printReport(buildReport([], [{ input, error: error.message }]), true);
  } else {
    process.stderr.write(`Error: ${error.message}\n`);
  }
  process.exitCode = 1;
});

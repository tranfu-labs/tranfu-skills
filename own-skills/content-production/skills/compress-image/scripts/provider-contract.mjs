#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAIN = join(SKILL_ROOT, "scripts", "main.mjs");
const execFileAsync = promisify(execFile);
const CONTRACT = "content-production-provider/v1";
const PROVIDER = "image-compression-v1";
const PLATFORMS = new Set(["wechat", "xiaohongshu", "zhihu", "weibo", "toutiao"]);
const RUN_MODES = new Set(["autonomous", "reviewed"]);
const SOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const REQUEST_KEYS = keys("schema_version contract task_id capability provider_contract run_dir run_mode mode attempt platform variant asset_id asset_kind inputs output_dir expected_artifacts options interaction_policy");
const INPUT_KEYS = keys("role path sha256");
const OPTION_KEYS = keys("format quality lossless preserve_source preserve_display_dimensions selection_policy");
const RESULT_KEYS = keys("schema_version contract provider_contract task_id request_sha256 status artifacts checks compression issues warnings");
const CHECK_KEYS = keys("request_valid mode");
const COMPRESSION_KEYS = keys("source candidate source_unchanged dimensions_preserved saved_bytes saved_percent recommended_selection");
const IMAGE_KEYS = keys("path sha256 bytes format width height");
const ARTIFACT_KEYS = keys("role path sha256");

function keys(value) {
  return value.split(" ");
}

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameKeys(value, expected) {
  return plain(value) && Object.keys(value).length === expected.length
    && expected.every((key) => Object.hasOwn(value, key));
}

function nonempty(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".."
    && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`));
}

function runRelative(runDir, path) {
  return relative(runDir, path).replaceAll("\\", "/");
}

function add(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: "package", ...extra });
}

function emit(value, code = 0) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exitCode = code;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function pathPresent(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function hasSymlinkComponent(root, path, includeLeaf = true) {
  if (!inside(root, path)) return true;
  let current = root;
  const parts = relative(root, path).split(/[\\/]/).filter(Boolean);
  const count = includeLeaf ? parts.length : Math.max(0, parts.length - 1);
  for (const part of parts.slice(0, count)) {
    current = join(current, part);
    if (existsSync(current) && (await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

function expectedPaths(request) {
  const version = request.attempt === 1 ? "" : `/v${String(request.attempt).padStart(3, "0")}`;
  const base = `08-publish-pack/_compression${version}/${request.platform}/${request.asset_id}`;
  const extension = request.asset_kind === "wechat_cover" ? "png" : "webp";
  return {
    base,
    request: `${base}/compression.request.json`,
    result: `${base}/compression.result.json`,
    candidate: `${base}/candidate.${extension}`,
  };
}

function validTaskId(request) {
  const parts = nonempty(request.task_id) ? request.task_id.split(":") : [];
  return parts.length === 6
    && parts[0] === "image-compression"
    && nonempty(parts[1])
    && parts[2] === request.platform
    && parts[3] === request.variant
    && parts[4] === request.asset_id
    && parts[5] === `package-${String(request.attempt).padStart(3, "0")}`;
}

function validOptions(request) {
  if (!sameKeys(request.options, OPTION_KEYS)) return false;
  const common = request.options.preserve_source === true
    && request.options.preserve_display_dimensions === true
    && request.options.selection_policy === "strictly-smaller-else-source";
  if (request.asset_kind === "body_image") {
    return common && request.options.format === "webp" && request.options.quality === 80
      && request.options.lossless === false;
  }
  return common && request.options.format === "png" && request.options.quality === null
    && request.options.lossless === true;
}

function resultEnvelope(context, status, artifacts, compression, issues, warnings = []) {
  const { request } = context;
  const result = {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER,
    task_id: request.task_id,
    request_sha256: context.requestSha256,
    status,
    artifacts,
    checks: { request_valid: true, mode: request.mode },
    compression,
    issues,
    warnings,
  };
  if (!sameKeys(result, RESULT_KEYS) || !sameKeys(result.checks, CHECK_KEYS)) {
    throw new Error("Internal provider result schema mismatch.");
  }
  if (compression && (!sameKeys(compression, COMPRESSION_KEYS)
    || !sameKeys(compression.source, IMAGE_KEYS) || !sameKeys(compression.candidate, IMAGE_KEYS))) {
    throw new Error("Internal compression schema mismatch.");
  }
  if (!artifacts.every((item) => sameKeys(item, ARTIFACT_KEYS))) {
    throw new Error("Internal artifact schema mismatch.");
  }
  return result;
}

async function writeResult(context, result) {
  await writeFile(context.resultPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  return { ...result, result_path: context.spec.result };
}

async function validateRequest(input) {
  const context = {
    issues: [],
    request: null,
    requestSha256: null,
    requestPath: resolve(input || ""),
    runDir: null,
    runRealDir: null,
    outputDir: null,
    outputRealDir: null,
    sourcePath: null,
    candidatePath: null,
    resultPath: null,
    spec: null,
  };

  if (!input || !existsSync(context.requestPath)) {
    add(context.issues, "missing_image_compression_request", `Missing request: ${context.requestPath}.`);
    return context;
  }
  try {
    const requestStat = await lstat(context.requestPath);
    if (requestStat.isSymbolicLink() || !requestStat.isFile()) throw new Error("Request must be a real file.");
    context.request = JSON.parse(await readFile(context.requestPath, "utf8"));
    context.requestSha256 = await sha256(context.requestPath);
  } catch (error) {
    add(context.issues, "invalid_image_compression_request", error.message);
    return context;
  }

  const request = context.request;
  if (!sameKeys(request, REQUEST_KEYS) || request.schema_version !== 1
    || request.contract !== CONTRACT || request.capability !== "image_compression"
    || request.provider_contract !== PROVIDER || request.mode !== "compress_one") {
    add(context.issues, "invalid_image_compression_request", "Request envelope does not match image-compression-v1.");
  }
  if (!RUN_MODES.has(request.run_mode) || !Number.isInteger(request.attempt) || request.attempt < 1
    || !PLATFORMS.has(request.platform) || !["A", "B"].includes(request.variant)
    || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(request.asset_id || "")
    || !["body_image", "wechat_cover"].includes(request.asset_kind)
    || request.interaction_policy !== "return_to_orchestrator") {
    add(context.issues, "invalid_image_compression_request", "Request identity, attempt, platform, variant, asset, or interaction policy is invalid.");
  }
  if (request.asset_kind === "wechat_cover"
    && (request.platform !== "wechat" || request.asset_id !== "wechat-cover")) {
    add(context.issues, "invalid_wechat_cover_compression_request", "WeChat cover compression requires platform=wechat and asset_id=wechat-cover.");
  }
  if (!validTaskId(request)) {
    add(context.issues, "invalid_image_compression_task_id", "task_id does not bind the request fields and attempt.");
  }
  if (!validOptions(request)) {
    add(context.issues, "invalid_image_compression_options", "Compression options do not match the fixed body or WeChat cover policy.");
  }
  if (!Array.isArray(request.inputs) || request.inputs.length !== 1
    || !sameKeys(request.inputs[0], INPUT_KEYS) || request.inputs[0].role !== "source_image"
    || !nonempty(request.inputs[0].path) || isAbsolute(request.inputs[0].path)
    || !/^[a-f0-9]{64}$/.test(request.inputs[0].sha256 || "")) {
    add(context.issues, "invalid_image_compression_input", "Request must bind exactly one relative source_image path and SHA-256.");
  }

  if (!isAbsolute(request.run_dir || "")) {
    add(context.issues, "invalid_compression_run_dir", "run_dir must be absolute.");
    return context;
  }
  context.runDir = resolve(request.run_dir);
  try {
    const runStat = await lstat(context.runDir);
    if (runStat.isSymbolicLink() || !runStat.isDirectory()) throw new Error("run_dir must be a real directory");
    context.runRealDir = await realpath(context.runDir);
    if (!inside(context.runDir, context.requestPath)
      || await hasSymlinkComponent(context.runDir, context.requestPath)
      || !inside(context.runRealDir, await realpath(context.requestPath))) {
      throw new Error("request must be a real file inside run_dir");
    }
  } catch (error) {
    add(context.issues, "invalid_compression_run_dir", error.message);
    return context;
  }

  if (!Number.isInteger(request.attempt) || request.attempt < 1
    || !PLATFORMS.has(request.platform)
    || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(request.asset_id || "")
    || !["body_image", "wechat_cover"].includes(request.asset_kind)) {
    return context;
  }
  context.spec = expectedPaths(request);
  if (runRelative(context.runDir, context.requestPath) !== context.spec.request) {
    add(context.issues, "invalid_image_compression_request_path", `Request must be ${context.spec.request}.`);
  }
  if (request.output_dir !== context.spec.base
    || !Array.isArray(request.expected_artifacts) || request.expected_artifacts.length !== 1
    || request.expected_artifacts[0] !== context.spec.candidate) {
    add(context.issues, "invalid_compression_output_dir", "output_dir or expected candidate path does not match the current attempt.");
  }

  context.outputDir = resolve(context.runDir, context.spec.base);
  context.candidatePath = resolve(context.runDir, context.spec.candidate);
  context.resultPath = resolve(context.runDir, context.spec.result);
  try {
    const outputStat = await lstat(context.outputDir);
    if (outputStat.isSymbolicLink() || !outputStat.isDirectory()
      || await hasSymlinkComponent(context.runDir, context.outputDir)) {
      throw new Error("output_dir must be a real directory without symbolic links");
    }
    context.outputRealDir = await realpath(context.outputDir);
    if (!inside(context.runRealDir, context.outputRealDir)) throw new Error("output_dir escapes run_dir");
  } catch (error) {
    add(context.issues, "invalid_compression_output_dir", error.message);
  }
  if (await pathPresent(context.candidatePath)) {
    add(context.issues, "compression_candidate_exists", `Candidate already exists: ${context.spec.candidate}.`);
  }
  if (await pathPresent(context.resultPath)) {
    add(context.issues, "compression_result_exists", `Result already exists: ${context.spec.result}.`);
  }

  const sourceBinding = request.inputs?.[0];
  if (sourceBinding && nonempty(sourceBinding.path) && !isAbsolute(sourceBinding.path)) {
    context.sourcePath = resolve(context.runDir, sourceBinding.path);
    try {
      const sourceStat = await lstat(context.sourcePath);
      const sourceRealPath = await realpath(context.sourcePath);
      if (sourceStat.isSymbolicLink() || !sourceStat.isFile()
        || await hasSymlinkComponent(context.runDir, context.sourcePath)
        || !inside(context.runRealDir, sourceRealPath)
        || !SOURCE_EXTENSIONS.has(extname(context.sourcePath).toLowerCase())) {
        throw new Error("source must be a supported real image file inside run_dir");
      }
      if (context.sourcePath === context.candidatePath) throw new Error("source and candidate paths must differ");
      if (await sha256(context.sourcePath) !== sourceBinding.sha256) throw new Error("source SHA-256 is stale");
      if (request.asset_kind === "wechat_cover" && extname(context.sourcePath).toLowerCase() !== ".png") {
        throw new Error("WeChat cover source must be PNG");
      }
    } catch (error) {
      add(context.issues, "unsafe_compression_source", error.message, { path: sourceBinding.path });
    }
  }

  return context;
}

function parseMainReport(stdout) {
  const report = JSON.parse(stdout);
  if (!plain(report) || !Array.isArray(report.files) || report.files.length !== 1
    || !Array.isArray(report.failures) || report.failures.length !== 0) {
    throw new Error("Compression CLI did not return exactly one successful file.");
  }
  return { report, row: report.files[0] };
}

async function execute(context) {
  const request = context.request;
  const input = request.inputs[0];
  const sourceHashBefore = await sha256(context.sourcePath);
  const args = [
    MAIN,
    context.sourcePath,
    "--output", context.candidatePath,
    "--format", request.options.format,
  ];
  if (request.options.format === "webp") args.push("--quality", String(request.options.quality));
  args.push("--json");

  let stdout;
  try {
    ({ stdout } = await execFileAsync(process.execPath, args, {
      cwd: SKILL_ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    }));
  } catch (error) {
    let detail = error.message;
    try {
      const report = JSON.parse(error.stdout || "");
      detail = report.failures?.map((item) => item.error).filter(Boolean).join("; ") || detail;
    } catch {}
    const issues = [];
    add(issues, "image_compression_execution_failed", detail);
    const result = resultEnvelope(context, "FAILED", [], null, issues);
    return writeResult(context, result);
  }

  const issues = [];
  let row;
  try {
    ({ row } = parseMainReport(stdout));
  } catch (error) {
    add(issues, "invalid_compression_cli_report", error.message);
    const result = resultEnvelope(context, "FAILED", [], null, issues);
    return writeResult(context, result);
  }

  let compression = null;
  let artifacts = [];
  const warnings = [];
  try {
    const candidateStat = await lstat(context.candidatePath);
    const candidateRealPath = await realpath(context.candidatePath);
    if (candidateStat.isSymbolicLink() || !candidateStat.isFile()
      || await hasSymlinkComponent(context.runDir, context.candidatePath)
      || !inside(context.outputRealDir, candidateRealPath)) {
      throw new Error("candidate is symbolic, non-regular, or outside output_dir");
    }
    const sourceHashAfter = await sha256(context.sourcePath);
    const candidateHash = await sha256(context.candidatePath);
    const sourceStat = await stat(context.sourcePath);
    const sourceUnchanged = sourceHashBefore === input.sha256 && sourceHashAfter === input.sha256;
    const dimensionsPreserved = row.inputWidth === row.outputWidth && row.inputHeight === row.outputHeight;
    const source = {
      path: input.path,
      sha256: sourceHashAfter,
      bytes: sourceStat.size,
      format: row.inputFormat,
      width: row.inputWidth,
      height: row.inputHeight,
    };
    const candidate = {
      path: context.spec.candidate,
      sha256: candidateHash,
      bytes: candidateStat.size,
      format: row.format,
      width: row.outputWidth,
      height: row.outputHeight,
    };
    if (row.input !== context.sourcePath || row.output !== context.candidatePath
      || row.inputBytes !== source.bytes || row.outputBytes !== candidate.bytes
      || source.format !== row.inputFormat || candidate.format !== request.options.format
      || ![source.width, source.height, candidate.width, candidate.height].every(Number.isInteger)) {
      add(issues, "compression_lineage_mismatch", "Compression CLI report does not bind the requested source and candidate.");
    }
    if (!sourceUnchanged) add(issues, "compression_source_changed", "Compression modified the source image.");
    if (!dimensionsPreserved) add(issues, "compression_dimensions_changed", "Compression changed normalized display dimensions.");
    if (request.asset_kind === "wechat_cover"
      && (source.format !== "png" || candidate.format !== "png"
        || source.width !== 1923 || source.height !== 818
        || candidate.width !== 1923 || candidate.height !== 818)) {
      add(issues, "invalid_wechat_cover_dimensions", "WeChat cover source and candidate must be 1923x818 PNG.");
    }
    const savedBytes = source.bytes - candidate.bytes;
    const savedPercent = Math.round((savedBytes / source.bytes) * 10000) / 100;
    const recommendedSelection = candidate.bytes < source.bytes ? "candidate" : "source";
    if (recommendedSelection === "source") {
      warnings.push({
        code: "compression_candidate_not_smaller",
        message: "The candidate is not smaller; publish the unchanged source instead.",
      });
    }
    compression = {
      source,
      candidate,
      source_unchanged: sourceUnchanged,
      dimensions_preserved: dimensionsPreserved,
      saved_bytes: savedBytes,
      saved_percent: savedPercent,
      recommended_selection: recommendedSelection,
    };
    artifacts = [{ role: "compressed_candidate", path: context.spec.candidate, sha256: candidateHash }];
  } catch (error) {
    add(issues, "invalid_compression_candidate", error.message);
  }

  const status = issues.length ? "FAILED" : "PASS";
  const result = resultEnvelope(context, status, artifacts, compression, issues, warnings);
  return writeResult(context, result);
}

async function main() {
  const [command, requestInput, ...detailParts] = process.argv.slice(2);
  if (!["validate-request", "execute", "block"].includes(command) || !requestInput
    || command === "block" && !nonempty(detailParts.join(" "))) {
    emit({
      status: "BLOCKED",
      issues: [{
        code: "invalid_provider_command",
        message: "Usage: provider-contract.mjs validate-request|execute <request.json> | block <request.json> <reason>",
        resume_from: "package",
      }],
    }, 2);
    return;
  }

  const context = await validateRequest(requestInput);
  if (context.issues.length) {
    emit({ status: "BLOCKED", issues: context.issues }, 2);
    return;
  }
  if (command === "validate-request") {
    emit({
      status: "PASS",
      task_id: context.request.task_id,
      mode: context.request.mode,
      source: context.request.inputs[0],
      candidate: context.spec.candidate,
      issues: [],
    });
    return;
  }
  if (command === "execute") {
    const output = await execute(context);
    emit(output, output.status === "PASS" ? 0 : 2);
    return;
  }

  const issues = [];
  add(issues, "image_compression_blocked", detailParts.join(" ").trim());
  const result = resultEnvelope(context, "BLOCKED", [], null, issues);
  const output = await writeResult(context, result);
  emit(output, 2);
}

main().catch((error) => emit({
  status: "FAILED",
  issues: [{ code: "image_compression_provider_failed", message: error.message, resume_from: "package" }],
}, 2));

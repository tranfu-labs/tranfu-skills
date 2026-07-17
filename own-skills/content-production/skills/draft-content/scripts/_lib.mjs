import { createHash, randomBytes } from "node:crypto";
import { lstat, readFile, mkdir, readdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const SCHEMA_VERSION = 1;
export const PLATFORMS = ["wechat", "xiaohongshu", "zhihu", "weibo", "toutiao"];
export const BRANCHES = ["A", "B"];
export const MANIFEST_STATUSES = new Set([
  "AWAITING_OUTLINE_APPROVAL",
  "DRAFTING",
  "READY_FOR_PROOFREAD",
  "BLOCKED",
]);

export function parseArgs(argv, { values = [], repeatable = [], booleans = [] } = {}) {
  const valueSet = new Set(values);
  const repeatSet = new Set(repeatable);
  const booleanSet = new Set(["help", ...booleans]);
  const result = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      result._.push(token);
      continue;
    }

    const name = token.slice(2);
    if (booleanSet.has(name)) {
      result[name] = true;
      continue;
    }
    if (!valueSet.has(name) && !repeatSet.has(name)) {
      throw new Error(`Unknown option: --${name}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    index += 1;
    if (repeatSet.has(name)) {
      result[name] ??= [];
      result[name].push(value);
    } else {
      result[name] = value;
    }
  }

  return result;
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function failJson(error, { status = "BLOCKED", exitCode = 1, details } = {}) {
  printJson({ ok: false, status, error: error instanceof Error ? error.message : String(error), ...(details ? { details } : {}) });
  process.exitCode = exitCode;
}

export async function sha256File(filePath) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

export function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export async function atomicWriteJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}

export async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

export async function readManifest(runDir) {
  const absoluteRunDir = path.resolve(runDir);
  const manifestPath = path.join(absoluteRunDir, "manifest.json");
  const manifest = await readJson(manifestPath);
  validateManifest(manifest, manifestPath);
  return { runDir: absoluteRunDir, manifestPath, manifest };
}

export function validateManifest(manifest, manifestPath = "manifest.json") {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`${manifestPath} must contain a JSON object`);
  }
  if (manifest.schema_version !== SCHEMA_VERSION || manifest.skill !== "draft-content") {
    throw new Error(`${manifestPath} is not a supported draft-content manifest`);
  }
  if (typeof manifest.run_id !== "string" || !manifest.run_id) {
    throw new Error(`${manifestPath} is missing run_id`);
  }
  if (!MANIFEST_STATUSES.has(manifest.status)) {
    throw new Error(`${manifestPath} has an invalid status: ${manifest.status}`);
  }
  if (!manifest.inputs || !manifest.inputs.style_b || typeof manifest.inputs.style_b.sha256 !== "string") {
    throw new Error(`${manifestPath} is missing the B style snapshot binding`);
  }
  if (!manifest.outline_gate || typeof manifest.outline_gate !== "object") {
    throw new Error(`${manifestPath} is missing outline_gate`);
  }
  if (!manifest.artifacts || typeof manifest.artifacts !== "object") {
    throw new Error(`${manifestPath} is missing artifacts`);
  }
}

export function toRunRelative(runDir, filePath) {
  const relative = path.relative(runDir, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    if (!relative) return ".";
    throw new Error(`Path must be inside the run directory: ${filePath}`);
  }
  return relative.split(path.sep).join("/");
}

export function resolveRunPath(runDir, storedPath) {
  if (typeof storedPath !== "string" || storedPath.length === 0) {
    throw new Error("Manifest path is missing");
  }
  const resolved = path.resolve(runDir, storedPath);
  const relative = path.relative(runDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Manifest path escapes the run directory: ${storedPath}`);
  }
  return resolved;
}

function pathIsInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function safeRunFile(runDir, storedPath) {
  const resolved = resolveRunPath(runDir, storedPath);
  const metadata = await lstat(resolved);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("Snapshot must be a regular non-symlink file");
  }
  const [realRunDir, realFile] = await Promise.all([realpath(runDir), realpath(resolved)]);
  if (!pathIsInside(realRunDir, realFile)) {
    throw new Error("Snapshot resolves outside the run directory");
  }
  return resolved;
}

export function inputSnapshotEntries(manifest) {
  const entries = [];
  const add = (label, entry, kind = "input") => {
    if (entry) entries.push({ label, entry, kind });
  };
  add("topic_plan", manifest.inputs?.topic_plan);
  for (const [index, entry] of (manifest.inputs?.research?.files ?? []).entries()) {
    add(`research.files[${index}]`, entry);
  }
  for (const [index, entry] of (manifest.inputs?.materials ?? []).entries()) {
    add(`materials[${index}]`, entry);
  }
  add("supplied_outline", manifest.inputs?.supplied_outline);
  add("style_b", manifest.inputs?.style_b, "style");
  return entries;
}

export async function checkInputSnapshots(runDir, manifest) {
  const issues = [];
  const entries = inputSnapshotEntries(manifest);
  const addBindingIssue = (label, message) => issues.push({
    code: "input_snapshot_binding_invalid",
    label,
    message,
  });

  if (manifest.input_mode === "standard") {
    if (!manifest.inputs?.topic_plan) addBindingIssue("topic_plan", "Standard mode is missing its topic-plan snapshot binding");
    if (!Array.isArray(manifest.inputs?.research?.files) || manifest.inputs.research.files.length !== 3) {
      addBindingIssue("research", "Standard mode must bind exactly three research snapshot files");
    }
  } else if (manifest.input_mode === "equivalent" && (!Array.isArray(manifest.inputs?.materials) || manifest.inputs.materials.length === 0)) {
    addBindingIssue("materials", "Equivalent mode requires at least one material snapshot binding");
  }

  for (const { label, entry, kind } of entries) {
    const prefix = kind === "style" ? "style_snapshot" : "input_snapshot";
    if (typeof entry.snapshot_path !== "string" || typeof entry.sha256 !== "string") {
      issues.push({ code: `${prefix}_binding_invalid`, label, message: `${label} has an invalid snapshot binding` });
      continue;
    }
    try {
      const filePath = await safeRunFile(runDir, entry.snapshot_path);
      const actualSha256 = await sha256File(filePath);
      if (actualSha256 !== entry.sha256) {
        issues.push({
          code: `${prefix}_drift`,
          label,
          path: entry.snapshot_path,
          expected_sha256: entry.sha256,
          actual_sha256: actualSha256,
          message: `${label} snapshot hash no longer matches the manifest`,
        });
      }
    } catch (error) {
      issues.push({
        code: `${prefix}_missing`,
        label,
        path: entry.snapshot_path,
        message: `${label} snapshot is unavailable or unsafe: ${error.message}`,
      });
    }
  }
  return issues;
}

export async function collectMarkdown(directory) {
  if (!(await isDirectory(directory))) return [];
  const result = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile() && entry.name.toLocaleLowerCase().endsWith(".md")) result.push(entryPath);
    }
  }
  await visit(directory);
  return result.sort();
}

export async function captureArtifactBaseline(runDir) {
  const expected = expectedArtifactPaths();
  const paths = [
    ...Object.values(expected.masters),
    ...PLATFORMS.flatMap((platform) => BRANCHES.map((branch) => expected.platforms[platform][branch])),
  ];
  const baseline = {};
  for (const storedPath of paths) {
    try {
      baseline[storedPath] = await sha256File(await safeRunFile(runDir, storedPath));
    } catch {
      // Missing artifacts do not need an invalidation baseline.
    }
  }
  return baseline;
}

export async function checkRegisteredArtifacts(runDir, manifest) {
  const issues = [];
  if (manifest.artifacts?.valid !== true) {
    issues.push({ code: "artifact_registration_invalid", message: "READY manifest does not have a valid artifact registration" });
  }
  const expected = expectedArtifactPaths();
  const masterMarkdown = await collectMarkdown(path.join(runDir, "02-masters"));
  const platformMarkdown = await collectMarkdown(path.join(runDir, "03-platforms"));
  const expectedMasterSet = new Set(Object.values(expected.masters).map((value) => path.resolve(runDir, value)));
  const expectedPlatformSet = new Set(
    PLATFORMS.flatMap((platform) => BRANCHES.map((branch) => path.resolve(runDir, expected.platforms[platform][branch]))),
  );
  if (masterMarkdown.length !== 2 || masterMarkdown.some((filePath) => !expectedMasterSet.has(path.resolve(filePath)))) {
    issues.push({ code: "master_count", message: "02-masters no longer contains exactly the two registered Markdown files" });
  }
  if (platformMarkdown.length !== 10 || platformMarkdown.some((filePath) => !expectedPlatformSet.has(path.resolve(filePath)))) {
    issues.push({ code: "platform_count", message: "03-platforms no longer contains exactly the ten registered Markdown files" });
  }

  const actualHashes = {};
  for (const storedPath of [...Object.values(expected.masters), ...PLATFORMS.flatMap((platform) => BRANCHES.map((branch) => expected.platforms[platform][branch]))]) {
    try {
      actualHashes[storedPath] = await sha256File(await safeRunFile(runDir, storedPath));
    } catch (error) {
      issues.push({ code: "artifact_missing", path: storedPath, message: error.message });
    }
  }

  for (const branch of BRANCHES) {
    const storedPath = expected.masters[branch];
    const record = manifest.artifacts?.masters?.[branch];
    const expectedStyle = branch === "A" ? null : manifest.inputs.style_b.sha256;
    if (!record || record.path !== storedPath || record.sha256 !== actualHashes[storedPath]) {
      issues.push({ code: "artifact_hash_drift", path: storedPath, message: "Master no longer matches its registered path and hash" });
      continue;
    }
    if (record.outline_sha256 !== manifest.outline_gate.sha256 || record.style_sha256 !== expectedStyle) {
      issues.push({ code: "artifact_binding_drift", path: storedPath, message: "Master binding no longer matches the approved run inputs" });
    }
  }
  for (const platform of PLATFORMS) {
    for (const branch of BRANCHES) {
      const storedPath = expected.platforms[platform][branch];
      const masterPath = expected.masters[branch];
      const record = manifest.artifacts?.platforms?.[platform]?.[branch];
      const expectedStyle = branch === "A" ? null : manifest.inputs.style_b.sha256;
      if (!record || record.path !== storedPath || record.sha256 !== actualHashes[storedPath]) {
        issues.push({ code: "artifact_hash_drift", path: storedPath, message: "Platform draft no longer matches its registered path and hash" });
        continue;
      }
      if (
        record.outline_sha256 !== manifest.outline_gate.sha256 ||
        record.source_master !== branch ||
        record.source_master_path !== masterPath ||
        record.source_master_sha256 !== actualHashes[masterPath] ||
        record.style_sha256 !== expectedStyle
      ) {
        issues.push({ code: "artifact_binding_drift", path: storedPath, message: "Platform draft binding no longer matches the current branch inputs" });
      }
    }
  }
  return issues;
}

export function localRunTimestamp(date = new Date()) {
  const two = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(value) {
  const slug = String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || "content";
}

export async function isRegularFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export async function isDirectory(directoryPath) {
  try {
    return (await stat(directoryPath)).isDirectory();
  } catch {
    return false;
  }
}

export function outlineVersion(filePath) {
  const match = /^shared-outline\.v(\d{3})\.md$/.exec(path.basename(filePath));
  if (!match) {
    throw new Error("Outline filename must match shared-outline.vNNN.md");
  }
  return Number(match[1]);
}

export function appendEvent(manifest, type, details = {}) {
  manifest.events ??= [];
  manifest.events.push({ at: nowIso(), type, ...details });
}

export function invalidateArtifacts(manifest, reason) {
  manifest.artifacts.valid = false;
  manifest.artifacts.invalidated_at = nowIso();
  manifest.artifacts.reason = reason;
}

export async function detectOutlineDrift(runDir, manifest) {
  const gate = manifest.outline_gate;
  if (gate.state !== "approved") {
    return { drifted: gate.state === "drifted", reason: gate.state === "drifted" ? "outline_hash_drift" : null };
  }

  let actualHash = null;
  let reason = null;
  try {
    actualHash = await sha256File(await safeRunFile(runDir, gate.path));
    if (actualHash !== gate.sha256) reason = "outline_hash_drift";
  } catch {
    reason = "approved_outline_missing";
  }

  if (!reason) return { drifted: false, actualHash };

  gate.state = "drifted";
  gate.drifted_at = nowIso();
  gate.actual_sha256 = actualHash;
  manifest.status = "BLOCKED";
  invalidateArtifacts(manifest, reason);
  const alreadyRecorded = manifest.events?.some((event) => event.type === "outline_drift" && event.expected_sha256 === gate.sha256 && event.actual_sha256 === actualHash);
  if (!alreadyRecorded) {
    appendEvent(manifest, "outline_drift", {
      path: gate.path,
      expected_sha256: gate.sha256,
      actual_sha256: actualHash,
      reason,
    });
  }
  return { drifted: true, actualHash, reason };
}

export function nextStage(manifest) {
  if (manifest.status === "READY_FOR_PROOFREAD") return "handoff_to_proofread";
  if (manifest.outline_gate.state === "drifted") return "create_new_outline_version";
  if (manifest.status === "BLOCKED") return "resolve_blocked_run";
  if (manifest.outline_gate.state === "unbound") return "create_or_optimize_outline";
  if (manifest.outline_gate.state === "awaiting_approval") return "request_outline_approval";
  if (manifest.outline_gate.state === "approved") return "draft_ab_masters_and_platforms";
  return "inspect_manifest";
}

export function expectedArtifactPaths() {
  const masters = {
    A: "02-masters/A-master.md",
    B: "02-masters/B-master.md",
  };
  const platforms = {};
  for (const platform of PLATFORMS) {
    platforms[platform] = {
      A: `03-platforms/${platform}/A-${platform}.md`,
      B: `03-platforms/${platform}/B-${platform}.md`,
    };
  }
  return { masters, platforms };
}

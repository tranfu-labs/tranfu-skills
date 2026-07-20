import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const platforms = ['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'];
export const variants = ['A', 'B'];
export const gateOrder = ['topic', 'outline', 'titles', 'visual', 'final'];
export const stageOrder = ['init', 'discovery', 'research', 'outline', 'masters', 'platforms', 'editing', 'titles', 'visual', 'package', 'final_qa'];
export const gateInvalidatesFrom = { topic: 'research', outline: 'masters', titles: 'visual', visual: 'package', final: null };
export const titleCounts = { wechat: 3, xiaohongshu: 5, zhihu: 3, weibo: 2, toutiao: 4 };
export const capabilityDefinitions = {
  topic_planning: { required: true, contract: 'topic-planning-v1' },
  source_research: { required: true, contract: 'source-research-v1' },
  drafting: { required: true, contract: 'drafting-v1' },
  proofreading: { required: true, contract: 'proofreading-v1', profile: 'markdown-alignment' },
  title_generation: { required: true, contract: 'title-generation-v1' },
  illustration: { required: true, contract: 'illustration-v1' },
  wechat_cover: { required: true, contract: 'wechat-cover-v1' },
  image_compression: { required: true, contract: 'image-compression-v1' },
  wechat_layout: { required: true, contract: 'wechat-layout-v1' }
};
export const allCapabilities = Object.keys(capabilityDefinitions);
export const requiredCapabilities = allCapabilities.filter((id) => capabilityDefinitions[id].required);

export function parseArgs(argv) {
  const values = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      values._.push(arg);
      continue;
    }
    const key = arg.slice(2).replaceAll('-', '_');
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values[key] = true;
      continue;
    }
    index += 1;
    if (['material', 'artifact'].includes(key)) {
      values[key] = [...(values[key] || []), next];
    } else {
      values[key] = next;
    }
  }
  return values;
}

export function expandPath(input, base = process.cwd()) {
  if (!input) return null;
  const expanded = input === '~' || input.startsWith('~/')
    ? join(homedir(), input.slice(2))
    : input;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(base, expanded);
}

export function fileExists(path) {
  return Boolean(path) && existsSync(path);
}

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

export async function readText(path) {
  return readFile(path, 'utf8');
}

export async function readJson(path) {
  return JSON.parse(await readText(path));
}

export async function fileSha256(path) {
  return sha256(await readFile(path));
}

export async function pngDimensions(path) {
  const buffer = await readFile(path);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (buffer.length < 24 || signature.some((value, index) => buffer[index] !== value) || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export async function writeText(path, value) {
  await ensureDir(dirname(path));
  await writeFile(path, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

export async function writeJson(path, value) {
  await ensureDir(dirname(path));
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, path);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function slugify(input) {
  return String(input || 'content-run')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'content-run';
}

export function todayStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function uniqueRunDir(root, baseName) {
  let candidate = join(root, baseName);
  let suffix = 2;
  while (fileExists(candidate)) {
    candidate = join(root, `${baseName}-${suffix}`);
    suffix += 1;
  }
  return candidate;
}

export function hasPlaceholder(text, { allowUncertaintyLanguage = false } = {}) {
  return /\b(?:TODO|TBD|PLACEHOLDER|FIXME)\b|待补|待填写|在此填写|\{\{[^{}]+\}\}/i.test(text)
    || (!allowUncertaintyLanguage && /待确认/i.test(text));
}

export function markdownImageRefs(text) {
  const refs = [];
  const pattern = /!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of text.matchAll(pattern)) refs.push(match[1]);
  return refs;
}

export function htmlImageRefs(text) {
  const refs = [];
  const pattern = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  for (const match of text.matchAll(pattern)) refs.push(match[1]);
  return refs;
}

export function isLocalRef(ref) {
  return !/^(?:https?:|data:|\/\/|#)/i.test(ref);
}

export function relativeTo(root, path) {
  return relative(root, path).replaceAll('\\', '/');
}

export async function artifactBinding(runDir, input) {
  const path = expandPath(input, runDir);
  if (!fileExists(path)) throw new Error(`Cannot bind missing artifact: ${path}`);
  return { path: relativeTo(runDir, path), sha256: await fileSha256(path) };
}

export async function gateIntegrity(runDir, state) {
  const issues = [];
  const runRealDir = await realpath(runDir);
  const insideRun = (path) => {
    const rel = relative(runDir, path);
    return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
  };
  const insideRealRun = (path) => {
    const rel = relative(runRealDir, path);
    return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
  };
  for (const [gate, value] of Object.entries(state.gates || {})) {
    if (value.status !== 'approved') continue;
    for (const binding of value.bound_artifacts || []) {
      const path = expandPath(binding.path, runDir);
      if (!insideRun(path)) {
        issues.push({ code: 'approved_artifact_escape', gate, path: binding.path });
        continue;
      }
      if (!fileExists(path)) {
        issues.push({ code: 'approved_artifact_missing', gate, path: binding.path });
        continue;
      }
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        issues.push({ code: 'approved_artifact_symlink', gate, path: binding.path });
        continue;
      }
      const real = await realpath(path);
      if (!insideRealRun(real)) {
        issues.push({ code: 'approved_artifact_escape', gate, path: binding.path });
        continue;
      }
      const actual = await fileSha256(path);
      if (actual !== binding.sha256) {
        issues.push({ code: 'approved_artifact_drift', gate, path: binding.path, expected_sha256: binding.sha256, actual_sha256: actual });
      }
    }
    const decision = value.decision_ref;
    if (decision?.path) {
      const path = expandPath(decision.path, runDir);
      if (!insideRun(path)) {
        issues.push({ code: 'approved_decision_escape', gate, path: decision.path });
        continue;
      }
      if (!fileExists(path)) {
        issues.push({ code: 'approved_decision_missing', gate, path: decision.path });
      } else {
        const stat = await lstat(path);
        if (stat.isSymbolicLink() || !stat.isFile()) {
          issues.push({ code: 'approved_decision_symlink', gate, path: decision.path });
          continue;
        }
        const real = await realpath(path);
        if (!insideRealRun(real)) {
          issues.push({ code: 'approved_decision_escape', gate, path: decision.path });
          continue;
        }
        const actual = await fileSha256(path);
        if (actual !== decision.sha256) {
          issues.push({ code: 'approved_decision_drift', gate, path: decision.path, expected_sha256: decision.sha256, actual_sha256: actual });
        }
      }
    }
  }
  return issues;
}

export async function filesUnder(root, current = root) {
  if (!fileExists(root)) return [];
  const results = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) results.push(...await filesUnder(root, path));
    else results.push(relativeTo(root, path));
  }
  return results.sort();
}

export async function verifyQaFingerprints(runDir, qa) {
  const issues = [];
  const bindings = Array.isArray(qa?.artifact_fingerprints) ? qa.artifact_fingerprints : [];
  if (!bindings.length) return [{ code: 'missing_qa_fingerprints', message: 'QA report has no artifact fingerprints.' }];
  const expected = new Map(bindings.map((binding) => [binding.path, binding.sha256]));
  const current = (await filesUnder(runDir)).filter((path) => path !== 'run.json' && !path.startsWith('09-qa/'));
  const runRealDir = await realpath(runDir);
  const inside = (root, path) => {
    const rel = relative(root, path);
    return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
  };
  for (const [path, hash] of expected) {
    const absolute = join(runDir, path);
    if (!inside(runDir, absolute) || !fileExists(absolute)) {
      issues.push({ code: 'completed_artifact_missing', path, message: `QA-bound artifact is missing: ${path}` });
      continue;
    }
    const stat = await lstat(absolute);
    const real = await realpath(absolute);
    let symlinkComponent = stat.isSymbolicLink();
    let currentPath = runDir;
    for (const part of relative(runDir, absolute).split(/[\\/]/).filter(Boolean)) {
      currentPath = join(currentPath, part);
      if ((await lstat(currentPath)).isSymbolicLink()) symlinkComponent = true;
    }
    if (symlinkComponent || !stat.isFile() || !inside(runRealDir, real)) {
      issues.push({ code: 'completed_artifact_symlink', path, message: `QA-bound artifact must be a real file inside run_dir: ${path}` });
    } else if (await fileSha256(absolute) !== hash) {
      issues.push({ code: 'completed_artifact_drift', path, message: `QA-bound artifact changed: ${path}` });
    }
  }
  for (const path of current) {
    if (!expected.has(path)) issues.push({ code: 'untracked_post_qa_artifact', path, message: `Artifact was added after QA: ${path}` });
  }
  return issues;
}

export async function inspectCapabilities(configPath) {
  const report = { status: 'PASS', config_path: configPath, capabilities: [], blockers: [], warnings: [] };
  if (!fileExists(configPath)) {
    report.status = 'BLOCKED';
    report.blockers.push({ code: 'missing_capabilities_config', message: `Missing capabilities config: ${configPath}` });
    return report;
  }

  let config;
  try {
    config = JSON.parse(await readText(configPath));
  } catch (error) {
    report.status = 'BLOCKED';
    report.blockers.push({ code: 'invalid_capabilities_config', message: `capabilities.yaml must use JSON-compatible YAML: ${error.message}` });
    return report;
  }

  if (config.version !== 2) {
    report.status = 'BLOCKED';
    report.blockers.push({ code: 'unsupported_capabilities_version', message: `Expected capabilities version 2, found ${config.version ?? 'missing'}.` });
    return report;
  }

  for (const id of allCapabilities) {
    const definition = capabilityDefinitions[id];
    const entry = config.capabilities?.[id];
    if (!entry?.skill_path) {
      const issue = { code: 'missing_capability_mapping', capability: id, message: `No skill_path configured for ${id}` };
      (definition.required ? report.blockers : report.warnings).push(issue);
      continue;
    }
    const path = expandPath(entry.skill_path, dirname(configPath));
    const item = {
      id,
      required: definition.required,
      contract: definition.contract,
      profile: entry.profile || null,
      skill_path: path,
      skill_sha256: null,
      status: 'PASS',
      missing_markers: []
    };
    const fail = (issue) => {
      item.status = definition.required ? 'BLOCKED' : 'UNAVAILABLE';
      (definition.required ? report.blockers : report.warnings).push(issue);
    };
    if (entry.required !== definition.required) {
      fail({ code: 'capability_required_flag_mismatch', capability: id, message: `${id} required flag must be ${definition.required}.` });
    }
    if (entry.contract !== definition.contract) {
      fail({ code: 'capability_contract_version_mismatch', capability: id, message: `${id} must declare contract ${definition.contract}.` });
    }
    if (definition.profile && entry.profile !== definition.profile) {
      fail({ code: 'capability_profile_mismatch', capability: id, message: `${id} must declare profile ${definition.profile}.` });
    }
    if (!fileExists(path)) {
      fail({ code: 'missing_capability_skill', capability: id, message: `Missing skill file: ${path}` });
    } else {
      const content = await readText(path);
      item.skill_sha256 = sha256(content);
      item.missing_markers = (entry.required_markers || []).filter((marker) => !content.includes(marker));
      if (item.missing_markers.length) {
        fail({
          code: 'capability_contract_mismatch',
          capability: id,
          message: `${id} is missing required markers: ${item.missing_markers.join(', ')}`
        });
      }
    }
    report.capabilities.push(item);
  }

  if (report.blockers.length) report.status = 'BLOCKED';
  return report;
}

export function emitJson(value, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exitCode = exitCode;
}

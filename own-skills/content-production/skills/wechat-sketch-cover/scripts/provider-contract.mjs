#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { lstat, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
const CONTRACT = 'content-production-provider/v1';
const PROVIDER = 'wechat-cover-v1';
const BASE = '07-visual/wechat-cover';
const BACKEND_HINTS = new Set(['runtime-native', 'configured-api', 'programmatic', 'unknown']);
const ATTEMPT_STATUSES = new Set(['PASS', 'RETRY', 'RETRY_NO_CANDIDATE', 'SELECT']);
const LIMITATION = 'No deterministic OCR was performed; title exactness is a provider visual observation bound to this artifact hash.';
const REQUEST_KEYS = keys('schema_version contract task_id capability provider_contract run_dir run_mode mode attempt platform variant selection inputs output_dir expected_artifacts options interaction_policy');
const INPUT_KEYS = keys('role path sha256');
const SELECTION_KEYS = keys('platform variant title_id title topic_phrase draft_path draft_sha256 decision_rule');
const OPTION_KEYS = keys('width height format style_id exact_title_required best_effort_allowed max_attempts backend_hint execution_strategy');
const RESULT_KEYS = keys('schema_version contract provider_contract task_id request_sha256 status artifacts checks issues warnings');
const METADATA_KEYS = keys('schema_version contract task_id status attempt platform variant request selection inputs style source backend generation cover residual_risk');
const BINDING_KEYS = keys('path sha256');
const STYLE_KEYS = keys('id skill_file style_spec style_reference normalizer');
const BACKEND_KEYS = keys('hint method model');
const ATTEMPT_BACKEND_KEYS = keys('method model');
const GENERATION_KEYS = keys('max_attempts attempt_count selected_attempt attempts selected_qa');
const ATTEMPT_KEYS = keys('attempt prompt candidate backend status failed_gates absolute_failures visible_title_defects');
const CANDIDATE_KEYS = keys('path sha256 format width height');
const SELECTED_QA_KEYS = keys('inspection title_evidence gates failed_gates absolute_failures visible_title_defects verification_limitations');
const INSPECTION_KEYS = keys('method artifact_path artifact_sha256 reviewer reviewed_at');
const TITLE_EVIDENCE_KEYS = keys('claim expected_title observed_title comparison evidence_class ocr_status readable position line_count extra_readable_text');
const GATE_KEYS = keys('title_accuracy additional_text composition safe_margin underline_accents spacing visual_style semantic_fidelity forbidden_elements dimensions');
const COVER_KEYS = keys('path sha256 format width height selected_candidate_path selected_candidate_sha256 byte_identical');
const CHECK_KEYS = keys('request_valid mode attempt platform title_status visual_qa_status file_verification_status');
const RESOURCE_PATHS = {
  skill_file: 'SKILL.md',
  style_spec: 'references/style-spec.md',
  style_reference: 'assets/style-reference.png',
  normalizer: 'scripts/normalize_cover.py'
};

function keys(value) {
  return value.split(' ');
}

function emit(value, code = 0) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exitCode = code;
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameKeys(value, expected) {
  return plain(value) && Object.keys(value).length === expected.length
    && expected.every((key) => Object.hasOwn(value, key));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameItems(left, right) {
  return Array.isArray(left) && left.length === right.length
    && new Set(left).size === right.length && right.every((item) => left.includes(item));
}

function nonempty(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function stringArray(value) {
  return Array.isArray(value) && value.every(nonempty);
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..'
    && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function runRelative(runDir, path) {
  return relative(runDir, path).replaceAll('\\', '/');
}

function add(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: 'visual', ...extra });
}

function paths(attempt) {
  const version = `v${String(attempt).padStart(3, '0')}`;
  const suffix = attempt === 1 ? '' : `.${version}`;
  const versionDir = attempt === 1 ? '' : `/${version}`;
  return {
    base: BASE,
    request: `${BASE}/wechat-cover${suffix}.request.json`,
    result: `${BASE}/wechat-cover${suffix}.result.json`,
    cover: `${BASE}/cover${suffix}.png`,
    metadata: `${BASE}/cover${suffix}.json`,
    source: `${BASE}/source${suffix}.md`,
    promptDir: `${BASE}/prompts${versionDir}`,
    candidateDir: `${BASE}/candidates${versionDir}`
  };
}

function validTitle(title) {
  const count = typeof title === 'string' ? [...title.replace(/\s/gu, '')].length : 0;
  return nonempty(title) && title === title.trim() && /[\u3400-\u9fff]/u.test(title)
    && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(title)
    && count >= 2 && count <= 35;
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
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

async function safeFile(context, relativePath, issues, code, root = context.runDir) {
  if (!nonempty(relativePath) || isAbsolute(relativePath)) {
    add(issues, code, `Invalid file path: ${relativePath || '(missing)'}.`, { path: relativePath || null });
    return null;
  }
  const path = resolve(context.runDir, relativePath);
  if (!inside(context.runDir, path) || !inside(root, path) || !existsSync(path)) {
    add(issues, code, `Missing or escaping file: ${relativePath}.`, { path: relativePath });
    return null;
  }
  try {
    const stat = await lstat(path);
    const real = await realpath(path);
    if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(context.runDir, path)
      || !inside(context.runRealDir, real)) {
      throw new Error('file is symbolic, non-regular, or outside run_dir');
    }
    if (context.outputRealDir && inside(context.outputDir, path) && !inside(context.outputRealDir, real)) {
      throw new Error('file resolves outside output_dir');
    }
    return path;
  } catch (error) {
    add(issues, code, `Unsafe file ${relativePath}: ${error.message}.`, { path: relativePath });
    return null;
  }
}

function checks(context, overrides = {}) {
  return {
    request_valid: true,
    mode: context.request?.mode || null,
    attempt: context.request?.attempt || null,
    platform: context.request?.platform || null,
    title_status: 'unavailable',
    visual_qa_status: 'not_run',
    file_verification_status: 'not_run',
    ...overrides
  };
}

function resultEnvelope(context, status, artifacts, issues, resultChecks) {
  const result = {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER,
    task_id: context.request?.task_id || 'unknown',
    request_sha256: context.requestSha256,
    status,
    artifacts,
    checks: resultChecks,
    issues,
    warnings: []
  };
  if (!sameKeys(result, RESULT_KEYS) || !sameKeys(result.checks, CHECK_KEYS)) {
    throw new Error('Internal provider result schema mismatch.');
  }
  return result;
}

async function validateRequest(input) {
  const context = {
    issues: [], request: null, requestPath: resolve(input || ''), requestSha256: null,
    runDir: null, runRealDir: null, outputDir: null, outputRealDir: null,
    state: null, spec: null
  };
  if (!input || !existsSync(context.requestPath)) {
    add(context.issues, 'missing_provider_request', `Missing request: ${context.requestPath}.`);
    return context;
  }
  try {
    const stat = await lstat(context.requestPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Request must be a real file.');
    context.request = JSON.parse(await readFile(context.requestPath, 'utf8'));
    context.requestSha256 = await sha256(context.requestPath);
  } catch (error) {
    add(context.issues, 'invalid_provider_request', error.message);
    return context;
  }

  const request = context.request;
  context.runDir = isAbsolute(request.run_dir || '') ? resolve(request.run_dir) : null;
  try {
    if (!context.runDir) throw new Error('run_dir must be absolute.');
    const stat = await lstat(context.runDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('run_dir must be a real directory.');
    context.runRealDir = await realpath(context.runDir);
    if (!inside(context.runDir, context.requestPath)
      || await hasSymlinkComponent(context.runDir, context.requestPath)) {
      throw new Error('Request must remain a real file inside run_dir.');
    }
  } catch (error) {
    add(context.issues, 'invalid_provider_run_dir', error.message);
    return context;
  }

  const statePath = resolve(context.runDir, 'run.json');
  try {
    const stateStat = await lstat(statePath);
    if (stateStat.isSymbolicLink() || !stateStat.isFile()
      || await hasSymlinkComponent(context.runDir, statePath)) throw new Error('run.json is unsafe.');
    context.state = JSON.parse(await readFile(statePath, 'utf8'));
  } catch (error) {
    add(context.issues, 'invalid_provider_state', error.message);
  }

  const visual = context.state?.stages?.visual;
  const currentAttempt = Number.isInteger(visual?.attempt) && visual.attempt > 0 ? visual.attempt : null;
  if (currentAttempt) context.spec = paths(currentAttempt);
  if (context.state?.schema_version !== 2 || context.state?.status !== 'running'
    || context.state?.current_stage !== 'visual' || visual?.status !== 'running'
    || request.attempt !== currentAttempt) {
    add(context.issues, 'provider_attempt_mismatch', 'Request must target the current running visual attempt.');
  }
  if (context.state?.gates?.titles?.status !== 'approved'
    || context.state?.gates?.visual?.status !== 'approved') {
    add(context.issues, 'provider_gate_mismatch', 'Current titles and visual gates must be approved.');
  }
  const capability = context.state?.capabilities?.providers?.wechat_cover;
  if (capability?.status !== 'PASS' || capability?.contract !== PROVIDER) {
    add(context.issues, 'provider_capability_mismatch', 'wechat_cover provider snapshot is unavailable.');
  }

  if (context.spec) {
    context.outputDir = resolve(context.runDir, context.spec.base);
    try {
      const stat = await lstat(context.outputDir);
      context.outputRealDir = await realpath(context.outputDir);
      if (stat.isSymbolicLink() || !stat.isDirectory()
        || await hasSymlinkComponent(context.runDir, context.outputDir)
        || !inside(context.runRealDir, context.outputRealDir)) {
        throw new Error('output_dir must be a real directory inside run_dir.');
      }
    } catch (error) {
      add(context.issues, 'invalid_provider_output_dir', error.message);
    }
  }

  const expectedTask = currentAttempt
    ? `wechat-cover:${context.state.run_id}:wechat:${request.variant}:attempt-${String(currentAttempt).padStart(3, '0')}`
    : null;
  const validOptions = sameKeys(request.options, OPTION_KEYS)
    && request.options.width === 1923 && request.options.height === 818
    && request.options.format === 'png'
    && request.options.style_id === 'warm-hand-drawn-notebook-v1'
    && request.options.exact_title_required === true
    && request.options.best_effort_allowed === false
    && request.options.max_attempts === 3
    && BACKEND_HINTS.has(request.options.backend_hint)
    && request.options.execution_strategy === 'one_candidate_at_a_time';
  if (!sameKeys(request, REQUEST_KEYS) || request.schema_version !== 1
    || request.contract !== CONTRACT || request.capability !== 'wechat_cover'
    || request.provider_contract !== PROVIDER || request.mode !== 'generate_cover'
    || !['autonomous', 'reviewed'].includes(request.run_mode)
    || request.platform !== 'wechat' || !['A', 'B'].includes(request.variant)
    || request.task_id !== expectedTask || request.output_dir !== context.spec?.base
    || request.interaction_policy !== 'return_to_orchestrator'
    || request.run_dir !== context.runDir || !validOptions
    || context.spec && context.requestPath !== resolve(context.runDir, context.spec.request)
    || context.spec && !sameJson(request.expected_artifacts, [context.spec.cover, context.spec.metadata])
    || !sameKeys(request.selection, SELECTION_KEYS)) {
    add(context.issues, 'invalid_provider_request', 'Request does not match wechat-cover-v1.');
  }

  if (!Array.isArray(request.inputs) || request.inputs.length !== 2
    || request.inputs.some((item) => !sameKeys(item, INPUT_KEYS))
    || request.inputs[0]?.role !== 'final_draft'
    || request.inputs[1]?.role !== 'title_selection') {
    add(context.issues, 'invalid_provider_inputs', 'Inputs must be exactly final_draft then title_selection.');
  }

  const decisionBinding = context.state?.gates?.titles?.decision_ref;
  const titleInput = request.inputs?.[1];
  let decision = null;
  if (!decisionBinding?.path || !/^[a-f0-9]{64}$/.test(decisionBinding?.sha256 || '')
    || !sameJson(titleInput, { role: 'title_selection', path: decisionBinding?.path, sha256: decisionBinding?.sha256 })) {
    add(context.issues, 'title_selection_lineage_mismatch', 'Title input must match the approved titles decision.');
  } else {
    const path = await safeFile(context, decisionBinding.path, context.issues, 'provider_input_symlink');
    if (path) {
      if (await sha256(path) !== decisionBinding.sha256) {
        add(context.issues, 'provider_input_drift', 'Title decision hash is stale.', { path: decisionBinding.path });
      } else {
        try { decision = JSON.parse(await readFile(path, 'utf8')); } catch (error) {
          add(context.issues, 'invalid_title_selection', error.message);
        }
      }
    }
  }
  const selections = Array.isArray(decision?.selections) ? decision.selections : [];
  const platforms = selections.map((item) => item?.platform);
  const approved = selections.find((item) => item?.platform === 'wechat');
  if (selections.length !== 5 || new Set(platforms).size !== 5
    || !['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'].every((item) => platforms.includes(item))
    || !sameJson(request.selection, approved)) {
    add(context.issues, 'title_selection_lineage_mismatch', 'Selection must equal the approved WeChat winner.');
  }
  if (!validTitle(request.selection?.title)) {
    add(context.issues, 'invalid_wechat_cover_title', 'Selected title must contain Han text and 2-35 clean non-whitespace characters.');
  }
  const draftInput = request.inputs?.[0];
  const expectedDraft = request.selection
    ? { role: 'final_draft', path: request.selection.draft_path, sha256: request.selection.draft_sha256 }
    : null;
  if (!sameJson(draftInput, expectedDraft)
    || request.selection?.draft_path !== `05-platforms/wechat/${request.variant}/final.md`) {
    add(context.issues, 'invalid_provider_inputs', 'Final draft must exactly match selection lineage.');
  } else {
    const path = await safeFile(context, draftInput.path, context.issues, 'provider_input_symlink');
    if (path && await sha256(path) !== draftInput.sha256) {
      add(context.issues, 'provider_input_drift', 'Final draft hash is stale.', { path: draftInput.path });
    }
  }
  return context;
}

async function safeResultTarget(context) {
  if (!context.spec || !context.outputDir || !context.outputRealDir) return null;
  const path = resolve(context.runDir, context.spec.result);
  if (!inside(context.outputDir, path) || await hasSymlinkComponent(context.runDir, path, false)) return null;
  if (existsSync(path)) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || !stat.isFile() || !inside(context.outputRealDir, await realpath(path))) return null;
  }
  return path;
}

async function writeResult(context, status, artifacts, issues, resultChecks) {
  const path = await safeResultTarget(context);
  const value = resultEnvelope(context, status, artifacts, issues, resultChecks);
  if (!path) return { value, path: null };
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return { value, path };
}

async function requestFailure(context) {
  const resultChecks = checks(context, { request_valid: false });
  const output = await writeResult(context, 'BLOCKED', [], context.issues, resultChecks);
  emit({ ...output.value, ...(output.path ? { result_path: runRelative(context.runDir, output.path) } : {}) }, 2);
}

async function scanDynamicDirectory(context, kind, issues, optional = false) {
  const directoryRelative = kind === 'prompt' ? context.spec.promptDir : context.spec.candidateDir;
  const directory = resolve(context.runDir, directoryRelative);
  if (!existsSync(directory)) {
    if (!optional) add(issues, 'missing_cover_dynamic_directory', `Missing ${kind} directory: ${directoryRelative}.`);
    return [];
  }
  try {
    const stat = await lstat(directory);
    const real = await realpath(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory() || await hasSymlinkComponent(context.runDir, directory)
      || !inside(context.outputRealDir, real)) throw new Error('directory is unsafe');
  } catch (error) {
    add(issues, 'provider_artifact_symlink', `Unsafe ${kind} directory: ${directoryRelative}.`);
    return [];
  }
  const pattern = kind === 'prompt' ? /^attempt-(0[1-3])\.md$/ : /^attempt-(0[1-3])\.png$/;
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && context.request.attempt === 1 && /^v\d{3}$/.test(entry.name)) continue;
    if (!entry.isFile() || !pattern.test(entry.name)) {
      add(issues, 'unexpected_cover_dynamic_artifact', `Unexpected current-attempt ${kind} artifact: ${directoryRelative}/${entry.name}.`);
      continue;
    }
    const relativePath = `${directoryRelative}/${entry.name}`;
    const path = await safeFile(context, relativePath, issues, 'provider_artifact_symlink', context.outputDir);
    if (path) files.push({ relativePath, path, attempt: Number(entry.name.match(pattern)[1]) });
  }
  return files.sort((left, right) => left.attempt - right.attempt);
}

async function pngInfo(path) {
  const buffer = await readFile(path);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (buffer.length < 24 || signature.some((value, index) => buffer[index] !== value)
    || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  const headerWidth = buffer.readUInt32BE(16);
  const headerHeight = buffer.readUInt32BE(20);
  try {
    const script = [
      'import json, sys',
      'from PIL import Image',
      'path = sys.argv[1]',
      'with Image.open(path) as image: image.verify()',
      'with Image.open(path) as image:',
      '    image.load()',
      '    result = {"format": image.format, "width": image.width, "height": image.height}',
      'print(json.dumps(result))'
    ].join('\n');
    const { stdout } = await execFileAsync('python3', ['-c', script, path], {
      encoding: 'utf8', maxBuffer: 1024 * 1024
    });
    const decoded = JSON.parse(stdout);
    if (decoded.format !== 'PNG' || decoded.width !== headerWidth || decoded.height !== headerHeight) return null;
    return { width: decoded.width, height: decoded.height, buffer };
  } catch (error) {
    return null;
  }
}

async function validateResource(binding, key, issues) {
  const expected = RESOURCE_PATHS[key];
  if (!sameKeys(binding, BINDING_KEYS) || binding.path !== expected
    || !/^[a-f0-9]{64}$/.test(binding.sha256 || '')) {
    add(issues, 'invalid_cover_style_binding', `Invalid ${key} binding.`);
    return;
  }
  const path = resolve(SKILL_ROOT, expected);
  try {
    const stat = await lstat(path);
    const real = await realpath(path);
    if (stat.isSymbolicLink() || !stat.isFile() || !inside(SKILL_ROOT, real)
      || await sha256(path) !== binding.sha256) throw new Error('resource hash or path mismatch');
  } catch (error) {
    add(issues, 'invalid_cover_style_binding', `${key}: ${error.message}.`);
  }
}

function validBackend(value, includeHint) {
  const expected = includeHint ? BACKEND_KEYS : ATTEMPT_BACKEND_KEYS;
  return sameKeys(value, expected)
    && (!includeHint || BACKEND_HINTS.has(value.hint))
    && nonempty(value.method)
    && (value.model === null || nonempty(value.model));
}

function validIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

async function validateBundle(context) {
  const issues = [];
  const artifactMap = new Map();
  const keep = async (role, relativePath, code = 'provider_artifact_symlink') => {
    const path = await safeFile(context, relativePath, issues, code, context.outputDir);
    if (!path) return null;
    artifactMap.set(relativePath, { role, path: relativePath, sha256: await sha256(path) });
    return path;
  };
  const coverPath = await keep('cover', context.spec.cover);
  const metadataPath = await keep('cover_metadata', context.spec.metadata);
  let metadata = null;
  if (metadataPath) {
    try { metadata = JSON.parse(await readFile(metadataPath, 'utf8')); } catch (error) {
      add(issues, 'invalid_wechat_cover_metadata', error.message);
    }
  }
  if (!metadata || !sameKeys(metadata, METADATA_KEYS)
    || metadata.schema_version !== 1 || metadata.contract !== PROVIDER
    || metadata.task_id !== context.request.task_id || metadata.status !== 'PASS'
    || metadata.attempt !== context.request.attempt || metadata.platform !== 'wechat'
    || metadata.variant !== context.request.variant
    || !sameJson(metadata.selection, context.request.selection)
    || !sameJson(metadata.inputs, context.request.inputs)
    || metadata.residual_risk !== 'none') {
    add(issues, 'invalid_wechat_cover_metadata', 'cover.json does not match the current PASS task and exact schema.');
  }
  if (!metadata) return { issues, artifacts: [...artifactMap.values()] };

  if (!sameKeys(metadata.request, BINDING_KEYS) || metadata.request.path !== context.spec.request
    || metadata.request.sha256 !== context.requestSha256) {
    add(issues, 'wechat_cover_request_binding_mismatch', 'cover.json request binding is stale.');
  }
  if (!sameKeys(metadata.style, STYLE_KEYS) || metadata.style.id !== 'warm-hand-drawn-notebook-v1') {
    add(issues, 'invalid_cover_style_binding', 'Cover style schema or ID is invalid.');
  } else {
    for (const key of Object.keys(RESOURCE_PATHS)) await validateResource(metadata.style[key], key, issues);
  }

  const sourcePath = metadata.source?.path === context.spec.source
    ? await keep('source', context.spec.source) : null;
  if (!sameKeys(metadata.source, BINDING_KEYS) || metadata.source.path !== context.spec.source
    || !sourcePath || metadata.source.sha256 !== (sourcePath ? await sha256(sourcePath) : null)) {
    add(issues, 'invalid_cover_source', 'Current source snapshot is missing, unsafe, or stale.');
  } else {
    const sourceText = await readFile(sourcePath, 'utf8');
    if (!sourceText.trim() || !sourceText.includes(context.request.selection.title)) {
      add(issues, 'invalid_cover_source', 'Source snapshot must record the exact selected title.');
    }
  }

  if (!validBackend(metadata.backend, true)
    || metadata.backend.hint !== context.request.options.backend_hint) {
    add(issues, 'invalid_cover_backend', 'Selected backend metadata is invalid.');
  }
  const generation = metadata.generation;
  const attempts = Array.isArray(generation?.attempts) ? generation.attempts : [];
  if (!sameKeys(generation, GENERATION_KEYS) || generation.max_attempts !== 3
    || !Number.isInteger(generation.attempt_count) || generation.attempt_count < 1
    || generation.attempt_count > 3 || generation.attempt_count !== attempts.length
    || generation.selected_attempt !== generation.attempt_count) {
    add(issues, 'invalid_cover_generation', 'Generation attempts must be contiguous, selected, and within 1..3.');
  }

  const declaredPrompts = [];
  const declaredCandidates = [];
  let selectedCandidate = null;
  let selectedBackend = null;
  for (let index = 0; index < attempts.length; index += 1) {
    const row = attempts[index];
    const number = index + 1;
    const expectedPrompt = `${context.spec.promptDir}/attempt-${String(number).padStart(2, '0')}.md`;
    const expectedCandidate = `${context.spec.candidateDir}/attempt-${String(number).padStart(2, '0')}.png`;
    if (!sameKeys(row, ATTEMPT_KEYS) || row.attempt !== number || !ATTEMPT_STATUSES.has(row.status)
      || !sameKeys(row.prompt, BINDING_KEYS) || row.prompt.path !== expectedPrompt
      || !validBackend(row.backend, false)
      || !stringArray(row.failed_gates) || !stringArray(row.absolute_failures)
      || !stringArray(row.visible_title_defects)) {
      add(issues, 'invalid_cover_attempt', `Invalid attempt row ${number}.`);
      continue;
    }
    const promptPath = await keep('prompt', expectedPrompt);
    declaredPrompts.push(expectedPrompt);
    if (!promptPath || row.prompt.sha256 !== (promptPath ? await sha256(promptPath) : null)
      || !((await readFile(promptPath || context.requestPath, 'utf8')).includes(context.request.selection.title))) {
      add(issues, 'invalid_cover_prompt', `Attempt ${number} prompt is missing, stale, or omits the exact title.`);
    }
    if (row.status === 'RETRY_NO_CANDIDATE') {
      if (row.candidate !== null || number === attempts.length) {
        add(issues, 'invalid_cover_attempt', `RETRY_NO_CANDIDATE is invalid for attempt ${number}.`);
      }
    } else {
      if (!sameKeys(row.candidate, CANDIDATE_KEYS) || row.candidate.path !== expectedCandidate
        || row.candidate.format !== 'png' || row.candidate.width !== 1923 || row.candidate.height !== 818) {
        add(issues, 'invalid_cover_candidate', `Candidate metadata is invalid for attempt ${number}.`);
      } else {
        const candidatePath = await keep('candidate', expectedCandidate);
        declaredCandidates.push(expectedCandidate);
        const info = candidatePath ? await pngInfo(candidatePath) : null;
        if (!candidatePath || row.candidate.sha256 !== (candidatePath ? await sha256(candidatePath) : null)
          || info?.width !== 1923 || info?.height !== 818) {
          add(issues, 'invalid_cover_candidate', `Candidate ${number} is not a verified 1923x818 PNG.`);
        }
        if (number === generation.selected_attempt) {
          selectedCandidate = { row, path: candidatePath, info };
          selectedBackend = row.backend;
        }
      }
    }
    if (number < attempts.length && !['RETRY', 'RETRY_NO_CANDIDATE'].includes(row.status)) {
      add(issues, 'invalid_cover_attempt', `Attempt ${number} must lead to a retry.`);
    }
    if (number === attempts.length && (row.status !== 'PASS'
      || row.failed_gates.length || row.absolute_failures.length || row.visible_title_defects.length)) {
      add(issues, 'invalid_cover_attempt', 'Selected attempt must be an exact, defect-free PASS.');
    }
  }
  if (!sameJson(metadata.backend, { hint: context.request.options.backend_hint, ...selectedBackend })) {
    add(issues, 'invalid_cover_backend', 'Top-level backend must match the selected candidate backend.');
  }

  const actualPrompts = await scanDynamicDirectory(context, 'prompt', issues);
  const actualCandidates = await scanDynamicDirectory(context, 'candidate', issues);
  if (!sameItems(declaredPrompts, actualPrompts.map((item) => item.relativePath))
    || !sameItems(declaredCandidates, actualCandidates.map((item) => item.relativePath))) {
    add(issues, 'unexpected_cover_dynamic_artifact', 'Current source, prompts, and candidates must exactly match cover.json.');
  }

  const qa = generation?.selected_qa;
  const inspection = qa?.inspection;
  const evidence = qa?.title_evidence;
  if (!sameKeys(qa, SELECTED_QA_KEYS)
    || !sameKeys(inspection, INSPECTION_KEYS)
    || inspection.method !== 'model_visual_inspection'
    || inspection.artifact_path !== context.spec.cover
    || inspection.artifact_sha256 !== metadata.cover?.sha256
    || !nonempty(inspection.reviewer) || !validIsoDate(inspection.reviewed_at)
    || !sameKeys(evidence, TITLE_EVIDENCE_KEYS)
    || evidence.claim !== 'provider_observed_exact'
    || evidence.expected_title !== context.request.selection.title
    || evidence.observed_title !== context.request.selection.title
    || evidence.comparison !== 'exact'
    || evidence.evidence_class !== 'provider_visual_observation'
    || evidence.ocr_status !== 'not_performed' || evidence.readable !== true
    || evidence.position !== 'left' || ![2, 3].includes(evidence.line_count)
    || evidence.extra_readable_text !== false
    || !sameKeys(qa.gates, GATE_KEYS) || !GATE_KEYS.every((key) => qa.gates[key] === 'PASS')
    || !Array.isArray(qa.failed_gates) || qa.failed_gates.length
    || !Array.isArray(qa.absolute_failures) || qa.absolute_failures.length
    || !Array.isArray(qa.visible_title_defects) || qa.visible_title_defects.length
    || !sameJson(qa.verification_limitations, [LIMITATION])) {
    add(issues, 'wechat_cover_visual_qa_failed', 'Selected visual QA does not attest an exact, defect-free title and all ten gates.');
  }

  const cover = metadata.cover;
  const coverInfo = coverPath ? await pngInfo(coverPath) : null;
  const coverHash = coverPath ? await sha256(coverPath) : null;
  const selectedHash = selectedCandidate?.path ? await sha256(selectedCandidate.path) : null;
  if (!sameKeys(cover, COVER_KEYS) || cover.path !== context.spec.cover
    || cover.sha256 !== coverHash || cover.format !== 'png'
    || cover.width !== 1923 || cover.height !== 818
    || coverInfo?.width !== 1923 || coverInfo?.height !== 818
    || cover.selected_candidate_path !== selectedCandidate?.row?.candidate?.path
    || cover.selected_candidate_sha256 !== selectedHash
    || cover.sha256 !== selectedHash || cover.byte_identical !== true
    || !coverInfo?.buffer.equals(selectedCandidate?.info?.buffer)) {
    add(issues, 'invalid_wechat_cover_file', 'Cover must be a verified 1923x818 PNG byte-identical to the selected candidate.');
  }
  return { issues, artifacts: [...artifactMap.values()] };
}

async function diagnosticArtifacts(context, issues) {
  const artifacts = [];
  const source = existsSync(resolve(context.runDir, context.spec.source))
    ? await safeFile(context, context.spec.source, issues, 'provider_artifact_symlink', context.outputDir) : null;
  if (source) artifacts.push({ role: 'source', path: context.spec.source, sha256: await sha256(source) });
  for (const kind of ['prompt', 'candidate']) {
    const files = await scanDynamicDirectory(context, kind, issues, true);
    for (const item of files) {
      if (kind === 'candidate') {
        const info = await pngInfo(item.path);
        if (info?.width !== 1923 || info?.height !== 818) {
          add(issues, 'invalid_cover_candidate', `Diagnostic candidate is not 1923x818: ${item.relativePath}.`);
          continue;
        }
      }
      artifacts.push({ role: kind, path: item.relativePath, sha256: await sha256(item.path) });
    }
  }
  return artifacts;
}

async function main() {
  const [command, requestInput, detail] = process.argv.slice(2);
  if (!['validate-request', 'finalize', 'block', 'block-best-effort'].includes(command)
    || !requestInput || ['block', 'block-best-effort'].includes(command) && !nonempty(detail)) {
    emit({ status: 'BLOCKED', issues: [{
      code: 'invalid_provider_command',
      message: 'Usage: provider-contract.mjs validate-request|finalize <request.json> | block|block-best-effort <request.json> <reason>',
      resume_from: 'visual'
    }] }, 2);
    return;
  }
  const context = await validateRequest(requestInput);
  if (context.issues.length) {
    await requestFailure(context);
    return;
  }
  if (command === 'validate-request') {
    emit({
      status: 'PASS', task_id: context.request.task_id, attempt: context.request.attempt,
      title: context.request.selection.title, output_dir: context.spec.base,
      inputs: context.request.inputs, issues: []
    });
    return;
  }
  if (command === 'finalize') {
    const validation = await validateBundle(context);
    const status = validation.issues.length ? 'FAILED' : 'PASS';
    const resultChecks = status === 'PASS'
      ? checks(context, {
        title_status: 'provider_observed_exact', visual_qa_status: 'PASS', file_verification_status: 'PASS'
      })
      : checks(context, { visual_qa_status: 'FAILED', file_verification_status: 'FAILED' });
    const output = await writeResult(context, status, validation.artifacts, validation.issues, resultChecks);
    emit({ ...output.value, ...(output.path ? { result_path: runRelative(context.runDir, output.path) } : {}) }, status === 'PASS' ? 0 : 2);
    return;
  }

  const issues = [];
  if (existsSync(resolve(context.runDir, context.spec.cover))
    || existsSync(resolve(context.runDir, context.spec.metadata))) {
    add(issues, 'unexpected_cover_core_artifact', 'A blocked provider run must not create current core cover artifacts.');
  }
  const artifacts = await diagnosticArtifacts(context, issues);
  if (command === 'block-best-effort') {
    add(issues, 'wechat_cover_best_effort_rejected', `BEST_EFFORT is not deliverable: ${detail.trim()}.`, {
      title_status: 'best_effort', visible_title_defects: detail.trim()
    });
  } else {
    add(issues, 'wechat_cover_generation_blocked', detail.trim());
  }
  const unsafe = issues.some((item) => ['provider_artifact_symlink', 'unexpected_cover_dynamic_artifact', 'invalid_cover_candidate', 'unexpected_cover_core_artifact'].includes(item.code));
  const status = unsafe ? 'FAILED' : 'BLOCKED';
  const resultChecks = checks(context, {
    title_status: command === 'block-best-effort' ? 'best_effort' : 'unavailable',
    visual_qa_status: command === 'block-best-effort' ? 'BEST_EFFORT' : 'not_run',
    file_verification_status: unsafe ? 'FAILED' : 'not_deliverable'
  });
  const output = await writeResult(context, status, artifacts, issues, resultChecks);
  emit({ ...output.value, ...(output.path ? { result_path: runRelative(context.runDir, output.path) } : {}) }, 2);
}

main().catch((error) => emit({
  status: 'FAILED',
  issues: [{ code: 'wechat_cover_provider_failed', message: error.message, resume_from: 'visual' }]
}, 2));

#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

const CONTRACT = 'content-production-provider/v1';
const PROVIDER = 'title-generation-v1';
const PLATFORMS = new Set(['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao']);
const VARIANTS = new Set(['A', 'B']);
const COUNTS = { wechat: 3, xiaohongshu: 5, zhihu: 3, weibo: 2, toutiao: 4 };
const STRATEGIES = new Set([
  'ENTITY_CHANGE', 'IMPACT_SCOPE', 'PROBLEM_ANSWER', 'VALUE_FIRST', 'MECHANISM',
  'CONTRAST', 'EVIDENCE_LED', 'DECISION_GUIDE', 'STRUCTURED_LIST', 'TENSION_GAP',
  'PERSPECTIVE', 'BOUNDARY_CLARITY', 'SEARCH_EXACT', 'UNCERTAINTY_EXPLAINER'
]);
const RISKS = new Set(['none', 'low', 'medium', 'high']);
const STRATEGIES_MODES = new Set(['parallel_subagents', 'sequential_fallback']);
const RESULT_KEYS = [
  'schema_version', 'task_id', 'status', 'platform', 'variant', 'source',
  'target_count', 'recommendation_count', 'candidates'
];
const CANDIDATE_KEYS = [
  'id', 'title', 'rank', 'strategy_id', 'recommended', 'promise_map',
  'promise_status', 'risk', 'topic_phrase'
];

function emit(value, code = 0) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exitCode = code;
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameItems(left, right) {
  return Array.isArray(left) && left.length === right.length
    && new Set(left).size === right.length && right.every((item) => left.includes(item));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..'
    && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function runRelative(runDir, path) {
  return relative(runDir, path).replaceAll('\\', '/');
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

function add(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: 'titles', ...extra });
}

function definition(platform, variant) {
  const base = `06-selection/providers/${platform}/${variant}`;
  return {
    base,
    request: `${base}/title-generation.request.json`,
    result: `${base}/title-generation.result.json`,
    candidate: `${base}/candidates.json`
  };
}

async function safeRealFile(runDir, runRealDir, path, issues, code) {
  if (!path || !inside(runDir, path) || !existsSync(path)) {
    add(issues, code, `Missing or unsafe file: ${path || '(missing)'}.`);
    return null;
  }
  try {
    const stat = await lstat(path);
    const real = await realpath(path);
    if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(runDir, path)
      || !inside(runRealDir, real)) {
      add(issues, code, `File must be real and remain inside run_dir: ${runRelative(runDir, path)}.`);
      return null;
    }
    return path;
  } catch (error) {
    add(issues, code, error.message);
    return null;
  }
}

async function validateRequest(input) {
  const issues = [];
  const requestPath = resolve(input || '');
  let request = null;
  let requestSha256 = null;
  let runDir = null;
  let runRealDir = null;
  let outputDir = null;
  let outputRealDir = null;
  let spec = null;

  if (!input || !existsSync(requestPath)) {
    add(issues, 'missing_provider_request', `Missing request: ${requestPath}.`);
    return { issues, requestPath, request, requestSha256, runDir, runRealDir, outputDir, outputRealDir, spec };
  }
  try {
    const stat = await lstat(requestPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Request must be a real file.');
    request = JSON.parse(await readFile(requestPath, 'utf8'));
    requestSha256 = await sha256(requestPath);
  } catch (error) {
    add(issues, 'invalid_provider_request', error.message);
    return { issues, requestPath, request, requestSha256, runDir, runRealDir, outputDir, outputRealDir, spec };
  }

  runDir = resolve(request.run_dir || '');
  try {
    const stat = await lstat(runDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('run_dir must be a real directory.');
    runRealDir = await realpath(runDir);
    if (!inside(runDir, requestPath) || await hasSymlinkComponent(runDir, requestPath)) {
      throw new Error('Request must remain inside run_dir.');
    }
  } catch (error) {
    add(issues, 'invalid_provider_run_dir', error.message);
  }

  if (!PLATFORMS.has(request.platform) || !VARIANTS.has(request.variant)) {
    add(issues, 'invalid_provider_target', 'Unsupported title platform or variant.');
  } else {
    spec = definition(request.platform, request.variant);
  }

  if (spec) {
    outputDir = resolve(runDir, spec.base);
    try {
      const stat = await lstat(outputDir);
      outputRealDir = await realpath(outputDir);
      if (stat.isSymbolicLink() || !stat.isDirectory() || await hasSymlinkComponent(runDir, outputDir)
        || !inside(runRealDir, outputRealDir)) {
        throw new Error('output_dir must be a real directory inside run_dir.');
      }
    } catch (error) {
      add(issues, 'invalid_provider_output_dir', error.message);
    }
  }

  const options = request.options;
  const validOptions = plainObject(options)
    && sameItems(Object.keys(options), [
      'count', 'language', 'titles_only', 'old_title', 'brand_reference',
      'verification_scope', 'execution_strategy', 'model', 'parameters'
    ])
    && options.count === COUNTS[request.platform]
    && options.language === 'zh-CN' && options.titles_only === true
    && options.old_title === null && options.brand_reference === null
    && options.verification_scope === 'none'
    && STRATEGIES_MODES.has(options.execution_strategy)
    && typeof options.model === 'string' && Boolean(options.model.trim())
    && plainObject(options.parameters);
  const requestKeys = [
    'schema_version', 'contract', 'task_id', 'capability', 'provider_contract', 'run_dir',
    'run_mode', 'mode', 'platform', 'variant', 'inputs', 'output_dir', 'expected_artifacts',
    'options', 'interaction_policy'
  ];
  if (!plainObject(request) || !sameItems(Object.keys(request), requestKeys)
    || request.schema_version !== 1 || request.contract !== CONTRACT
    || request.capability !== 'title_generation' || request.provider_contract !== PROVIDER
    || request.mode !== 'generate_titles' || !['autonomous', 'reviewed'].includes(request.run_mode)
    || request.output_dir !== spec?.base || request.interaction_policy !== 'return_to_orchestrator'
    || typeof request.task_id !== 'string'
    || !new RegExp(`^title:[^:]+:${request.platform}:${request.variant}:attempt-\\d{3}$`).test(request.task_id)
    || !sameItems(request.expected_artifacts, spec ? [spec.candidate] : []) || !validOptions
    || !isAbsolute(request.run_dir || '') || resolve(request.run_dir || '') !== runDir
    || (spec && requestPath !== resolve(runDir, spec.request))) {
    add(issues, 'invalid_provider_request', 'Request does not match title-generation-v1.');
  }

  const expectedSource = spec ? `05-platforms/${request.platform}/${request.variant}/final.md` : null;
  if (!Array.isArray(request.inputs) || request.inputs.length !== 1
    || request.inputs[0]?.role !== 'final_draft' || request.inputs[0]?.path !== expectedSource
    || !/^[a-f0-9]{64}$/.test(request.inputs[0]?.sha256 || '')) {
    add(issues, 'invalid_provider_inputs', 'Title request must authorize exactly its canonical final draft.');
  } else if (runRealDir) {
    const sourcePath = resolve(runDir, request.inputs[0].path);
    const safe = await safeRealFile(runDir, runRealDir, sourcePath, issues, 'invalid_provider_input');
    if (safe && request.inputs[0].sha256 !== await sha256(safe)) {
      add(issues, 'provider_input_drift', 'Final draft hash no longer matches request.', { path: request.inputs[0].path });
    }
  }

  return { issues, requestPath, request, requestSha256, runDir, runRealDir, outputDir, outputRealDir, spec };
}

function validTopicPhrase(value) {
  const match = typeof value === 'string' ? value.match(/^#([^#\r\n]+)#$/u) : null;
  const length = match ? [...match[1].replace(/\s/g, '')].length : 0;
  return Boolean(match) && length >= 4 && length <= 32;
}

async function collectArtifact(context, issues) {
  const path = resolve(context.runDir, context.spec.candidate);
  const safe = await safeRealFile(context.runDir, context.runRealDir, path, issues, 'provider_artifact_symlink');
  if (!safe || !inside(context.outputDir, path) || !inside(context.outputRealDir, await realpath(path))) return [];
  return [{ role: 'title_candidates', path: context.spec.candidate, sha256: await sha256(path) }];
}

async function validateArtifact(context) {
  const issues = [];
  const artifacts = await collectArtifact(context, issues);
  if (!artifacts.length) return { issues, artifacts };
  const sourcePath = resolve(context.runDir, context.request.inputs[0].path);
  const source = await readFile(sourcePath, 'utf8');
  let result = null;
  try {
    result = JSON.parse(await readFile(resolve(context.runDir, context.spec.candidate), 'utf8'));
  } catch (error) {
    add(issues, 'invalid_title_candidates', error.message, { path: context.spec.candidate });
    return { issues, artifacts };
  }

  if (!plainObject(result) || !sameItems(Object.keys(result), RESULT_KEYS)
    || result.schema_version !== 1 || result.task_id !== context.request.task_id
    || result.status !== 'PASS' || result.platform !== context.request.platform
    || result.variant !== context.request.variant || !sameJson(result.source, context.request.inputs[0])
    || result.target_count !== context.request.options.count
    || result.recommendation_count !== Math.min(3, context.request.options.count)
    || !Array.isArray(result.candidates)) {
    add(issues, 'invalid_title_candidates', 'Candidate result does not match the task, source, target, or exact schema.');
  }

  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  if (candidates.length !== context.request.options.count) {
    add(issues, 'invalid_title_candidate_count', `Expected ${context.request.options.count} candidates, found ${candidates.length}.`);
  }
  const titles = new Set();
  let recommendationCount = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const expectedRank = index + 1;
    if (!plainObject(candidate) || !sameItems(Object.keys(candidate), CANDIDATE_KEYS)
      || candidate.id !== `${context.request.platform}-${context.request.variant}-${expectedRank}`
      || candidate.rank !== expectedRank || typeof candidate.title !== 'string'
      || !candidate.title.trim() || candidate.title !== candidate.title.trim()
      || /[\r\n]/.test(candidate.title) || !STRATEGIES.has(candidate.strategy_id)
      || typeof candidate.recommended !== 'boolean' || candidate.promise_status !== 'PASS'
      || !RISKS.has(candidate.risk) || !Array.isArray(candidate.promise_map)
      || !candidate.promise_map.length) {
      add(issues, 'invalid_title_candidate', `Candidate ${expectedRank} has an invalid schema or value.`);
      continue;
    }
    if (titles.has(candidate.title)) add(issues, 'duplicate_title_candidate', `Duplicate title: ${candidate.title}`);
    titles.add(candidate.title);
    if (candidate.recommended) recommendationCount += 1;
    const anchors = new Set();
    for (const anchor of candidate.promise_map) {
      if (typeof anchor !== 'string' || !anchor.trim() || anchor !== anchor.trim()
        || anchors.has(anchor) || !source.includes(anchor)) {
        add(issues, 'unsupported_title_promise', `Candidate ${candidate.id} has a promise anchor absent from the source.`);
      }
      anchors.add(anchor);
    }
    if (context.request.platform === 'weibo') {
      if (!validTopicPhrase(candidate.topic_phrase) || candidate.title.includes('#')) {
        add(issues, 'invalid_weibo_title_structure', `Candidate ${candidate.id} must contain a single-line hook and separate 4-32 character topic phrase.`);
      }
    } else if (candidate.topic_phrase !== null) {
      add(issues, 'invalid_title_candidate', `Non-Weibo candidate ${candidate.id} must use topic_phrase=null.`);
    }
    if (context.request.platform === 'wechat') {
      const length = [...candidate.title.replace(/\s/g, '')].length;
      if (!/[\u3400-\u9fff]/u.test(candidate.title) || length < 2 || length > 35) {
        add(issues, 'invalid_wechat_title', `Candidate ${candidate.id} cannot be used by the WeChat cover contract.`);
      }
    }
  }
  if (recommendationCount !== Math.min(3, context.request.options.count)) {
    add(issues, 'invalid_title_recommendation_count', 'Recommendation count must equal min(3, target_count).');
  }
  return { issues, artifacts };
}

function makeResult(context, status, artifacts, issues, requestValid = true) {
  return {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER,
    task_id: context.request?.task_id || 'unknown',
    request_sha256: context.requestSha256,
    status,
    artifacts,
    checks: { request_valid: requestValid, mode: context.request?.mode || null },
    issues,
    warnings: []
  };
}

function resultPath(context) {
  return context.spec && context.runDir ? resolve(context.runDir, context.spec.result) : null;
}

async function safeResultTarget(context) {
  const path = resultPath(context);
  if (!path || !context.outputDir || !inside(context.outputDir, path)
    || await hasSymlinkComponent(context.runDir, path, false)) return false;
  if (!existsSync(path)) return true;
  const stat = await lstat(path);
  return !stat.isSymbolicLink() && stat.isFile() && inside(context.outputRealDir, await realpath(path));
}

async function writeResult(context, status, artifacts, issues, requestValid = true) {
  if (!await safeResultTarget(context)) throw new Error('Unsafe canonical title result target.');
  const value = makeResult(context, status, artifacts, issues, requestValid);
  await writeFile(resultPath(context), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return value;
}

async function requestFailure(context) {
  if (context.request && await safeResultTarget(context)) {
    const value = await writeResult(context, 'BLOCKED', [], context.issues, false);
    emit({ ...value, result_path: runRelative(context.runDir, resultPath(context)) }, 2);
  } else {
    emit(makeResult(context, 'BLOCKED', [], context.issues, false), 2);
  }
}

async function main() {
  const [command, requestInput, detail] = process.argv.slice(2);
  const validBlock = command !== 'block' || typeof detail === 'string' && Boolean(detail.trim());
  if (!['validate-request', 'finalize', 'block'].includes(command) || !requestInput || !validBlock) {
    emit({ status: 'BLOCKED', issues: [{
      code: 'invalid_provider_command',
      message: 'Usage: provider-contract.mjs validate-request <request.json> | finalize <request.json> | block <request.json> <reason>',
      resume_from: 'titles'
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
      status: 'PASS', task_id: context.request.task_id, run_dir: context.runDir,
      output_dir: context.spec.base, inputs: { final_draft: context.request.inputs[0].path }, issues: []
    });
    return;
  }
  if (command === 'block') {
    const issues = [];
    add(issues, 'title_source_insufficient', detail.trim());
    const value = await writeResult(context, 'BLOCKED', [], issues);
    emit({ ...value, result_path: runRelative(context.runDir, resultPath(context)) }, 2);
    return;
  }
  const validation = await validateArtifact(context);
  const status = validation.issues.length ? 'FAILED' : 'PASS';
  const value = await writeResult(context, status, validation.artifacts, validation.issues);
  emit({ ...value, result_path: runRelative(context.runDir, resultPath(context)) }, status === 'PASS' ? 0 : 2);
}

main().catch((error) => emit({
  status: 'FAILED',
  issues: [{ code: 'title_provider_failed', message: error.message, resume_from: 'titles' }]
}, 2));

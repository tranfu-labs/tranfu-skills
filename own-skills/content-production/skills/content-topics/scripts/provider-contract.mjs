#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const CONTRACT = 'content-production-provider/v1';
const PROVIDER_CONTRACT = 'topic-planning-v1';
const OUTPUT_DIR = '01-discovery';
const EXPECTED_ARTIFACTS = [
  '01-discovery/discovery.md',
  '01-discovery/topic-candidates.md',
  '01-discovery/topic-candidates.json'
];
const CANONICAL_INPUTS = {
  brief: '00-intake/brief.md',
  materials: '00-intake/materials.json',
  core_audience: '00-intake/core-audience.md',
  platform_profiles: '00-intake/platform-profiles.json',
  topic_history: '00-intake/topic-history.md'
};
const PLATFORMS = ['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'];
const REQUIRED_CANDIDATE_FIELDS = [
  'id',
  'topic',
  'reader_problem',
  'core_promise',
  'material_fit',
  'timeliness',
  'differentiation',
  'evidence_availability',
  'risk'
];
const LEVELS = new Set(['high', 'medium', 'low']);
const RISKS = new Set(['none', 'low', 'medium', 'high']);
const FORBIDDEN_SCORE_KEYS = /^(score|scores|weighted_score|internal_score|points|rating)$/i;

function addIssue(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: 'discovery', ...extra });
}

function emit(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = exitCode;
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function runRelative(runDir, path) {
  return relative(runDir, path).split('\\').join('/');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function sameItems(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && new Set(actual).size === expected.length
    && expected.every((item) => actual.includes(item));
}

function containsForbiddenScoreKey(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenScoreKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_SCORE_KEYS.test(key) || containsForbiddenScoreKey(child));
}

async function validateRequest(requestInput) {
  const issues = [];
  const requestPath = resolve(requestInput);
  let request;

  if (!existsSync(requestPath)) {
    addIssue(issues, 'missing_provider_request', `Request file does not exist: ${requestPath}`);
    return { issues, requestPath, request: null, runDir: null, outputDir: null, inputs: new Map() };
  }

  try {
    request = await readJson(requestPath);
  } catch (error) {
    addIssue(issues, 'invalid_provider_request_json', error.message);
    return { issues, requestPath, request: null, runDir: null, outputDir: null, inputs: new Map() };
  }

  if (request.schema_version !== 1 || request.contract !== CONTRACT) {
    addIssue(issues, 'invalid_provider_request', `Request must use ${CONTRACT} schema 1.`);
  }
  if (!request.task_id || request.capability !== 'topic_planning' || request.provider_contract !== PROVIDER_CONTRACT) {
    addIssue(issues, 'provider_contract_mismatch', `Request must target topic_planning with ${PROVIDER_CONTRACT}.`);
  }
  if (request.mode !== 'plan') addIssue(issues, 'invalid_provider_mode', 'Topic planning request mode must be plan.');
  if (!['autonomous', 'reviewed'].includes(request.run_mode)) {
    addIssue(issues, 'invalid_run_mode', 'run_mode must be autonomous or reviewed.');
  }
  if (request.interaction_policy !== 'return_to_orchestrator') {
    addIssue(issues, 'invalid_interaction_policy', 'interaction_policy must be return_to_orchestrator.');
  }
  if (!request.options || typeof request.options !== 'object' || Array.isArray(request.options)) {
    addIssue(issues, 'invalid_provider_options', 'options must be an object.');
  }

  const runDir = typeof request.run_dir === 'string' && isAbsolute(request.run_dir)
    ? resolve(request.run_dir)
    : null;
  let runRealDir = null;
  if (!runDir || !existsSync(runDir)) {
    addIssue(issues, 'invalid_run_dir', 'run_dir must be an existing absolute directory.');
  } else {
    const stat = await lstat(runDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) addIssue(issues, 'invalid_run_dir', 'run_dir must be a real directory, not a symlink.');
    else runRealDir = await realpath(runDir);
  }

  const canonicalOutputDir = runDir ? join(runDir, OUTPUT_DIR) : null;
  let canonicalOutputSafe = false;
  if (runRealDir && canonicalOutputDir && existsSync(canonicalOutputDir)) {
    const stat = await lstat(canonicalOutputDir);
    if (!stat.isSymbolicLink() && stat.isDirectory()) {
      const real = await realpath(canonicalOutputDir);
      canonicalOutputSafe = inside(runRealDir, real);
    }
  }

  const outputDir = runDir && typeof request.output_dir === 'string'
    ? resolve(runDir, request.output_dir)
    : null;
  let outputRealDir = null;
  let outputSafe = false;
  if (!outputDir || !inside(runDir, outputDir)) {
    addIssue(issues, 'provider_output_escape', 'Authorized output_dir must stay inside run_dir.');
  } else if (runRelative(runDir, outputDir) !== OUTPUT_DIR) {
    addIssue(issues, 'invalid_provider_output_dir', `output_dir must be ${OUTPUT_DIR}.`);
  } else if (!existsSync(outputDir)) {
    addIssue(issues, 'missing_provider_output_dir', `output_dir must already exist: ${OUTPUT_DIR}.`);
  } else {
    const stat = await lstat(outputDir);
    if (stat.isSymbolicLink()) {
      addIssue(issues, 'provider_output_symlink', 'output_dir must not be a symbolic link.');
    } else if (!stat.isDirectory()) {
      addIssue(issues, 'invalid_provider_output_dir', 'output_dir must be a directory.');
    } else {
      outputRealDir = await realpath(outputDir);
      if (!runRealDir || !inside(runRealDir, outputRealDir)) addIssue(issues, 'provider_output_escape', 'Resolved output_dir escapes run_dir.');
      else outputSafe = true;
    }
  }

  if (!sameItems(request.expected_artifacts, EXPECTED_ARTIFACTS)) {
    addIssue(issues, 'invalid_expected_artifacts', `expected_artifacts must be exactly: ${EXPECTED_ARTIFACTS.join(', ')}.`);
  }

  const inputs = new Map();
  if (!Array.isArray(request.inputs)) {
    addIssue(issues, 'invalid_provider_inputs', 'inputs must be an array.');
  } else if (runDir) {
    for (const input of request.inputs) {
      if (!input?.role || !input?.path || !/^[a-f0-9]{64}$/.test(input?.sha256 || '')) {
        addIssue(issues, 'invalid_provider_input', 'Every input needs role, path, and SHA-256.');
        continue;
      }
      if (inputs.has(input.role)) {
        addIssue(issues, 'duplicate_provider_input', `Duplicate input role: ${input.role}.`, { role: input.role });
        continue;
      }
      const path = resolve(runDir, input.path);
      if (!inside(runDir, path)) {
        addIssue(issues, 'provider_input_escape', `Input escapes run_dir: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      if (!existsSync(path)) {
        addIssue(issues, 'missing_provider_input', `Input does not exist: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) {
        addIssue(issues, 'provider_input_symlink', `Input must not be a symbolic link: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      const real = await realpath(path);
      if (!runRealDir || !inside(runRealDir, real)) {
        addIssue(issues, 'provider_input_escape', `Resolved input escapes run_dir: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      if (await sha256(path) !== input.sha256) {
        addIssue(issues, 'provider_input_drift', `Input hash is stale: ${input.path}.`, { role: input.role, path: input.path });
      }
      inputs.set(input.role, { ...input, absolutePath: path });
    }
  }

  for (const [role, canonicalPath] of Object.entries(CANONICAL_INPUTS)) {
    const input = inputs.get(role);
    if (!input) {
      addIssue(issues, 'missing_required_input', `Missing required input role: ${role}.`, { role });
    } else if (runRelative(runDir, input.absolutePath) !== canonicalPath) {
      addIssue(issues, 'noncanonical_input_path', `${role} must use ${canonicalPath}.`, { role, path: input.path });
    }
  }

  if (inputs.has('brief') && !(await readFile(inputs.get('brief').absolutePath, 'utf8')).trim()) {
    addIssue(issues, 'empty_brief', 'brief input must not be empty.');
  }
  if (inputs.has('core_audience') && !(await readFile(inputs.get('core_audience').absolutePath, 'utf8')).trim()) {
    addIssue(issues, 'empty_core_audience', 'core_audience input must not be empty.');
  }
  let materialsManifest = null;
  if (inputs.has('materials')) {
    try {
      materialsManifest = await readJson(inputs.get('materials').absolutePath);
      if (!Array.isArray(materialsManifest.items)) addIssue(issues, 'invalid_materials_manifest', 'materials input must contain an items array.');
    } catch (error) {
      addIssue(issues, 'invalid_materials_manifest', error.message);
    }
  }
  if (inputs.has('platform_profiles')) {
    try {
      const profiles = await readJson(inputs.get('platform_profiles').absolutePath);
      const missing = PLATFORMS.filter((platform) => !profiles.platforms?.[platform]);
      if (missing.length) addIssue(issues, 'incomplete_platform_profiles', `Missing platform profiles: ${missing.join(', ')}.`);
    } catch (error) {
      addIssue(issues, 'invalid_platform_profiles', error.message);
    }
  }

  if (inputs.has('article_audience')) {
    const input = inputs.get('article_audience');
    if (runRelative(runDir, input.absolutePath) !== '00-intake/article-audience.md') {
      addIssue(issues, 'noncanonical_input_path', 'article_audience must use 00-intake/article-audience.md.', { role: 'article_audience', path: input.path });
    }
  }

  const materialRoles = new Set();
  if (Array.isArray(materialsManifest?.items)) {
    const manifestDir = dirname(inputs.get('materials').absolutePath);
    for (const item of materialsManifest.items) {
      if (!item?.id || !item?.snapshot_path || !/^[a-f0-9]{64}$/.test(item?.sha256 || '')) {
        addIssue(issues, 'invalid_material_manifest_item', 'Each material item needs id, snapshot_path, and SHA-256.');
        continue;
      }
      const role = `material:${item.id}`;
      materialRoles.add(role);
      const input = inputs.get(role);
      if (!input) {
        addIssue(issues, 'missing_material_snapshot_input', `Material ${item.id} must be authorized as input role ${role}.`, { role });
        continue;
      }
      const expectedPath = resolve(manifestDir, item.snapshot_path);
      if (!inside(manifestDir, expectedPath) || input.absolutePath !== expectedPath) {
        addIssue(issues, 'material_snapshot_path_mismatch', `Input ${role} must match snapshot_path ${item.snapshot_path}.`, { role, path: input.path });
      }
      if (input.sha256 !== item.sha256) {
        addIssue(issues, 'material_snapshot_hash_mismatch', `Input ${role} must match the material manifest SHA-256.`, { role, path: input.path });
      }
    }
  }

  const allowedRoles = new Set([...Object.keys(CANONICAL_INPUTS), 'article_audience', ...materialRoles]);
  for (const role of inputs.keys()) {
    if (!allowedRoles.has(role)) addIssue(issues, 'unauthorized_provider_input_role', `Unsupported input role: ${role}.`, { role });
  }

  return { issues, requestPath, request, runDir, runRealDir, outputDir, outputRealDir, outputSafe, canonicalOutputSafe, inputs };
}

function validateMarkdown(content, artifact, headings, issues, path) {
  if (!new RegExp(`^artifact:\\s*${artifact}\\s*$`, 'm').test(content)) {
    addIssue(issues, 'invalid_markdown_artifact', `${path} must declare artifact: ${artifact}.`, { path });
  }
  for (const heading of headings) {
    if (!content.includes(heading)) addIssue(issues, 'missing_markdown_section', `${path} is missing ${heading}.`, { path });
  }
  if (/(?:^|\n)\s*(?:TODO|TBD|FIXME)\b|\[(?:待填写|占位|列出|填写|补充|替换|TODO|TBD)[^\]]*\]/i.test(content)) {
    addIssue(issues, 'placeholder_in_provider_artifact', `${path} contains unresolved placeholders.`, { path });
  }
  if (/(内部(?:数字)?评分|加权总分|weighted[_ -]?score|internal[_ -]?score|(?:^|\n)\s*(?:score|points|rating)\s*[:：])/i.test(content)) {
    addIssue(issues, 'hidden_score_exposed', `${path} exposes an internal score.`, { path });
  }
}

function discoveryStatus(content) {
  return content.match(/^status:\s*(PASS|NEEDS_EVIDENCE|BLOCKED)\s*$/m)?.[1] || null;
}

function validateCandidateMarkdown(markdown, candidate, issues) {
  const heading = `## ${candidate.rank}. ${candidate.id}`;
  const start = markdown.indexOf(heading);
  if (start < 0) {
    addIssue(issues, 'candidate_markdown_mismatch', `Markdown omits candidate heading: ${candidate.id}.`);
    return;
  }
  const next = markdown.indexOf('\n## ', start + heading.length);
  const section = markdown.slice(start, next < 0 ? markdown.length : next);
  const fields = [
    ['选题', candidate.topic],
    ['读者问题', candidate.reader_problem],
    ['核心承诺', candidate.core_promise],
    ['素材匹配', candidate.material_fit],
    ['时效', candidate.timeliness],
    ['差异化', candidate.differentiation],
    ['证据可得性', candidate.evidence_availability],
    ['风险', candidate.risk],
    ['排序', String(candidate.rank)],
    ['推荐', candidate.recommended ? '是' : '否']
  ];
  const missing = fields
    .filter(([label, value]) => !section.includes(`- ${label}：${value}`))
    .map(([label]) => label);
  if (missing.length) {
    addIssue(issues, 'incomplete_candidate_markdown', `Markdown candidate ${candidate.id} is missing or mismatches: ${missing.join(', ')}.`, { id: candidate.id, missing });
  }
}

async function collectArtifact(path, role, runDir, outputDir, outputRealDir, artifacts, issues) {
  if (!inside(outputDir, path)) {
    addIssue(issues, 'provider_artifact_escape', `Artifact escapes output_dir: ${runRelative(runDir, path)}.`);
    return false;
  }
  if (!existsSync(path)) return false;
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) {
    addIssue(issues, 'provider_artifact_symlink', `Artifact must not be a symbolic link: ${runRelative(runDir, path)}.`);
    return false;
  }
  const real = await realpath(path);
  if (!outputRealDir || !inside(outputRealDir, real)) {
    addIssue(issues, 'provider_artifact_escape', `Resolved artifact escapes output_dir: ${runRelative(runDir, path)}.`);
    return false;
  }
  artifacts.push({ role, path: runRelative(runDir, path), sha256: await sha256(path) });
  return true;
}

async function validateArtifacts(context) {
  const { runDir, outputDir, outputRealDir } = context;
  const issues = [];
  const artifacts = [];
  const checks = {
    request_valid: true,
    candidate_count: 0,
    recommended_id: null,
    hidden_scores_exposed: false
  };
  const discoveryPath = join(outputDir, 'discovery.md');
  const markdownPath = join(outputDir, 'topic-candidates.md');
  const jsonPath = join(outputDir, 'topic-candidates.json');

  if (!await collectArtifact(discoveryPath, 'discovery', runDir, outputDir, outputRealDir, artifacts, issues)) {
    addIssue(issues, 'missing_provider_artifact', 'Missing 01-discovery/discovery.md.', { path: EXPECTED_ARTIFACTS[0] });
    return { issues, artifacts, checks, failureStatus: 'FAILED' };
  }

  const discovery = await readFile(discoveryPath, 'utf8');
  validateMarkdown(discovery, 'TopicDiscovery', ['# 选题发现'], issues, EXPECTED_ARTIFACTS[0]);
  const status = discoveryStatus(discovery);
  if (!status) {
    addIssue(issues, 'invalid_discovery_status', 'discovery.md must declare PASS, NEEDS_EVIDENCE, or BLOCKED.');
    return { issues, artifacts, checks, failureStatus: 'FAILED' };
  }
  if (status === 'NEEDS_EVIDENCE') {
    const diagnosticIsValid = issues.length === 0 && discovery.includes('恢复条件');
    if (!discovery.includes('恢复条件')) addIssue(issues, 'missing_recovery_condition', 'NEEDS_EVIDENCE discovery must state 恢复条件.');
    addIssue(issues, 'topic_evidence_insufficient', 'No topic candidate passed the evidence gate.');
    return { issues, artifacts, checks, failureStatus: diagnosticIsValid ? 'BLOCKED' : 'FAILED' };
  }
  if (status === 'BLOCKED') {
    const diagnosticIsValid = issues.length === 0 && discovery.includes('恢复条件');
    if (!discovery.includes('恢复条件')) addIssue(issues, 'missing_recovery_condition', 'BLOCKED discovery must state 恢复条件.');
    addIssue(issues, 'topic_planning_blocked', 'Topic planning could not complete with the authorized inputs.');
    return { issues, artifacts, checks, failureStatus: diagnosticIsValid ? 'BLOCKED' : 'FAILED' };
  }

  validateMarkdown(
    discovery,
    'TopicDiscovery',
    ['## 输入与扫描范围', '## 证据信号', '## 排除项'],
    issues,
    EXPECTED_ARTIFACTS[0]
  );

  if (!await collectArtifact(markdownPath, 'topic_candidates_markdown', runDir, outputDir, outputRealDir, artifacts, issues)) {
    addIssue(issues, 'missing_provider_artifact', `Missing ${EXPECTED_ARTIFACTS[1]}.`, { path: EXPECTED_ARTIFACTS[1] });
  }
  if (!await collectArtifact(jsonPath, 'topic_candidates_json', runDir, outputDir, outputRealDir, artifacts, issues)) {
    addIssue(issues, 'missing_provider_artifact', `Missing ${EXPECTED_ARTIFACTS[2]}.`, { path: EXPECTED_ARTIFACTS[2] });
  }
  if (!existsSync(markdownPath) || !existsSync(jsonPath)) return { issues, artifacts, checks, failureStatus: 'FAILED' };

  const markdown = await readFile(markdownPath, 'utf8');
  validateMarkdown(markdown, 'TopicCandidates', ['# 五个选题候选'], issues, EXPECTED_ARTIFACTS[1]);

  let data;
  try {
    data = await readJson(jsonPath);
  } catch (error) {
    addIssue(issues, 'invalid_topic_candidates_json', error.message, { path: EXPECTED_ARTIFACTS[2] });
    return { issues, artifacts, checks, failureStatus: 'FAILED' };
  }
  if (containsForbiddenScoreKey(data)) addIssue(issues, 'hidden_score_exposed', 'topic-candidates.json exposes a forbidden score field.', { path: EXPECTED_ARTIFACTS[2] });
  if (data.schema_version !== 1 || data.status !== 'PASS' || !Array.isArray(data.candidates)) {
    addIssue(issues, 'invalid_topic_candidates_root', 'topic-candidates.json must use schema_version 1, status PASS, and a candidates array.');
    return { issues, artifacts, checks, failureStatus: 'FAILED' };
  }

  const candidates = data.candidates;
  checks.candidate_count = candidates.length;
  if (candidates.length !== 5) addIssue(issues, 'incorrect_topic_count', `Expected exactly 5 candidates, found ${candidates.length}.`);
  const ids = new Set();
  const topics = new Set();
  const ranks = new Set();
  const recommendations = [];

  for (const candidate of candidates) {
    const label = candidate?.id || '(missing id)';
    const missing = REQUIRED_CANDIDATE_FIELDS.filter((field) => typeof candidate?.[field] !== 'string' || !candidate[field].trim());
    if (missing.length || !Number.isInteger(candidate?.rank) || typeof candidate?.recommended !== 'boolean') {
      addIssue(issues, 'incomplete_topic_candidate', `Candidate ${label} is incomplete.`, { id: candidate?.id || null, missing });
    }
    if (!LEVELS.has(candidate?.material_fit) || !LEVELS.has(candidate?.timeliness) || !LEVELS.has(candidate?.evidence_availability)) {
      addIssue(issues, 'invalid_topic_level', `Candidate ${label} has an invalid level enum.`, { id: candidate?.id || null });
    }
    if (!RISKS.has(candidate?.risk)) addIssue(issues, 'invalid_topic_risk', `Candidate ${label} has an invalid risk enum.`, { id: candidate?.id || null });
    if (ids.has(candidate?.id)) addIssue(issues, 'duplicate_topic_id', `Duplicate topic id: ${candidate.id}.`);
    if (topics.has(candidate?.topic)) addIssue(issues, 'duplicate_topic_text', `Duplicate topic text: ${candidate.topic}.`);
    if (ranks.has(candidate?.rank)) addIssue(issues, 'duplicate_topic_rank', `Duplicate topic rank: ${candidate.rank}.`);
    ids.add(candidate?.id);
    topics.add(candidate?.topic);
    ranks.add(candidate?.rank);
    if (candidate?.recommended) recommendations.push(candidate);
    if (candidate?.id && candidate?.topic && Number.isInteger(candidate?.rank) && typeof candidate?.recommended === 'boolean') {
      validateCandidateMarkdown(markdown, candidate, issues);
    }
  }

  if ([1, 2, 3, 4, 5].some((rank) => !ranks.has(rank))) addIssue(issues, 'invalid_topic_ranks', 'Candidate ranks must be exactly 1 through 5.');
  if (recommendations.length !== 1) {
    addIssue(issues, 'invalid_topic_recommendation_count', `Expected exactly one recommended candidate, found ${recommendations.length}.`);
  } else {
    checks.recommended_id = recommendations[0].id;
    if (recommendations[0].rank !== 1) addIssue(issues, 'recommended_topic_rank_mismatch', 'The recommended candidate must have rank 1.');
    if (recommendations[0].evidence_availability === 'low') {
      addIssue(issues, 'recommended_topic_evidence_insufficient', 'The recommended candidate must not have low evidence availability.');
    }
  }
  checks.hidden_scores_exposed = issues.some((item) => item.code === 'hidden_score_exposed');
  return { issues, artifacts, checks, failureStatus: 'FAILED' };
}

function makeResult(context, status, artifacts, checks, issues, warnings = []) {
  return {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER_CONTRACT,
    task_id: context.request?.task_id || 'unknown',
    status,
    artifacts,
    checks,
    issues,
    warnings
  };
}

async function writeResult(path, context, status, artifacts, checks, issues, warnings = []) {
  if (!await resultTargetIsSafe(context, path)) throw new Error('Unsafe provider result target.');
  const result = makeResult(context, status, artifacts, checks, issues, warnings);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

function canonicalResultPath(context) {
  return context.runDir && context.canonicalOutputSafe ? join(context.runDir, OUTPUT_DIR, 'provider-result.json') : null;
}

async function resultTargetIsSafe(context, path) {
  if (!path || !context.runDir || !context.canonicalOutputSafe) return false;
  if (dirname(path) !== join(context.runDir, OUTPUT_DIR)) return false;
  if (!existsSync(path)) return true;
  const stat = await lstat(path);
  return !stat.isSymbolicLink() && stat.isFile();
}

async function emitRequestFailure(context) {
  const checks = { request_valid: false, candidate_count: 0, recommended_id: null, hidden_scores_exposed: false };
  const path = canonicalResultPath(context);
  if (path && context.request && await resultTargetIsSafe(context, path)) {
    const result = await writeResult(path, context, 'BLOCKED', [], checks, context.issues);
    emit({ ...result, result_path: runRelative(context.runDir, path) }, 2);
    return;
  }
  emit(makeResult(context, 'BLOCKED', [], checks, context.issues), 2);
}

async function finalize(context, resultInput) {
  const requestedPath = resultInput
    ? (isAbsolute(resultInput) ? resolve(resultInput) : resolve(context.runDir, resultInput))
    : join(context.outputDir, 'provider-result.json');
  const canonicalPath = canonicalResultPath(context);
  const resultIsSymlink = existsSync(requestedPath) && (await lstat(requestedPath)).isSymbolicLink();
  const requestedTargetIsSafe = await resultTargetIsSafe(context, requestedPath);
  if (!inside(context.outputDir, requestedPath)
    || !requestedTargetIsSafe
    || EXPECTED_ARTIFACTS.includes(runRelative(context.runDir, requestedPath))) {
    const issues = [];
    addIssue(
      issues,
      resultIsSymlink ? 'provider_result_symlink' : 'provider_result_escape',
      'result.json must be a real direct child file of output_dir.'
    );
    const checks = { request_valid: true, candidate_count: 0, recommended_id: null, hidden_scores_exposed: false };
    if (canonicalPath && canonicalPath !== requestedPath && await resultTargetIsSafe(context, canonicalPath)) {
      const result = await writeResult(canonicalPath, context, 'FAILED', [], checks, issues);
      emit({ ...result, result_path: runRelative(context.runDir, canonicalPath) }, 2);
    } else {
      emit(makeResult(context, 'FAILED', [], checks, issues), 2);
    }
    return;
  }

  try {
    const validation = await validateArtifacts(context);
    const status = validation.issues.length ? validation.failureStatus : 'PASS';
    const result = await writeResult(
      requestedPath,
      context,
      status,
      validation.artifacts,
      validation.checks,
      validation.issues
    );
    emit({ status, task_id: context.request.task_id, result_path: runRelative(context.runDir, requestedPath), issues: result.issues }, status === 'PASS' ? 0 : 2);
  } catch (error) {
    const issues = [];
    addIssue(issues, 'topic_provider_failed', error.message);
    const checks = { request_valid: true, candidate_count: 0, recommended_id: null, hidden_scores_exposed: false };
    if (canonicalPath && canonicalPath !== requestedPath && await resultTargetIsSafe(context, canonicalPath)) {
      const result = await writeResult(canonicalPath, context, 'FAILED', [], checks, issues);
      emit({ ...result, result_path: runRelative(context.runDir, canonicalPath) }, 2);
    } else {
      emit(makeResult(context, 'FAILED', [], checks, issues), 2);
    }
  }
}

async function main() {
  const [command, requestInput, resultInput] = process.argv.slice(2);
  if (!['validate-request', 'finalize'].includes(command) || !requestInput) {
    emit({
      status: 'BLOCKED',
      issues: [{
        code: 'invalid_provider_command',
        message: 'Usage: provider-contract.mjs validate-request <request.json> | finalize <request.json> [result.json]',
        resume_from: 'discovery'
      }]
    }, 2);
    return;
  }

  const context = await validateRequest(requestInput);
  if (context.issues.length) {
    await emitRequestFailure(context);
    return;
  }
  if (command === 'validate-request') {
    emit({
      status: 'PASS',
      task_id: context.request.task_id,
      run_dir: context.runDir,
      output_dir: runRelative(context.runDir, context.outputDir),
      inputs: Object.fromEntries([...context.inputs].map(([role, input]) => [role, runRelative(context.runDir, input.absolutePath)])),
      issues: []
    });
    return;
  }
  await finalize(context, resultInput);
}

main().catch((error) => {
  emit({
    status: 'FAILED',
    issues: [{ code: 'topic_provider_failed', message: error.message, resume_from: 'discovery' }]
  }, 2);
});

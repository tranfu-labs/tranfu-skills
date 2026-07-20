#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const CONTRACT = 'content-production-provider/v1';
const PROVIDER = 'illustration-v1';
const REQUEST_KEYS = [
  'schema_version', 'contract', 'provider_contract', 'capability', 'task_id', 'run_dir',
  'run_mode', 'mode', 'visual_attempt', 'round', 'platform', 'provider_platform',
  'variant', 'parent_task_id', 'inputs', 'output_dir', 'review_path',
  'expected_artifacts', 'interaction_policy'
];
const REVIEW_KEYS = [
  'schema_version', 'status', 'checks', 'failed_image_ids', 'reasons',
  'blocking_reason', 'reviewer', 'reviewed_at'
];
const CHECK_KEYS = [
  'style_consistency', 'color', 'visual_density', 'composition_duplication',
  'narrative_order'
];

function emit(value, code = 0) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exitCode = code;
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return plain(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function inside(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..'
    && !value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function issue(code, message, extra = {}) {
  return { code, message, resume_from: 'visual', ...extra };
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function safeFile(context, path, issues, code) {
  if (!path || !inside(context.runDir, path) || !existsSync(path)) {
    issues.push(issue(code, `Missing or unsafe file: ${path || '(missing)'}.`));
    return null;
  }
  try {
    const stat = await lstat(path);
    const real = await realpath(path);
    if (stat.isSymbolicLink() || !stat.isFile() || !inside(context.runReal, real)) {
      throw new Error('file must be real and remain inside run_dir');
    }
    return path;
  } catch (error) {
    issues.push(issue(code, `${path}: ${error.message}`));
    return null;
  }
}

async function validateRequest(input) {
  const context = {
    issues: [], requestPath: resolve(input || ''), request: null, requestSha256: null,
    runDir: null, runReal: null, resultPath: null
  };
  if (!input || !existsSync(context.requestPath)) {
    context.issues.push(issue('missing_illustration_set_qa_request', `Missing request: ${context.requestPath}.`));
    return context;
  }
  try {
    const stat = await lstat(context.requestPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Request must be a real file.');
    context.request = JSON.parse(await readFile(context.requestPath, 'utf8'));
    context.requestSha256 = await sha256(context.requestPath);
  } catch (error) {
    context.issues.push(issue('invalid_illustration_set_qa_request', error.message));
    return context;
  }
  const request = context.request;
  context.runDir = resolve(request.run_dir || '');
  try {
    const stat = await lstat(context.runDir);
    context.runReal = await realpath(context.runDir);
    if (!isAbsolute(request.run_dir || '') || stat.isSymbolicLink() || !stat.isDirectory()
      || !inside(context.runDir, context.requestPath)) throw new Error('run_dir or request path is unsafe.');
  } catch (error) {
    context.issues.push(issue('invalid_illustration_set_qa_run', error.message));
    return context;
  }
  let state = null;
  try { state = JSON.parse(await readFile(resolve(context.runDir, 'run.json'), 'utf8')); } catch (error) {
    context.issues.push(issue('invalid_illustration_set_qa_state', error.message));
  }
  const expectedProvider = request.platform === 'xiaohongshu' ? 'xhs' : request.platform;
  const expectedTask = `illustration:${state?.run_id || ''}:${request.platform}:${request.variant}:set-qa:round-${String(request.round).padStart(2, '0')}:visual-${String(request.visual_attempt).padStart(3, '0')}`;
  const visualVersion = request.visual_attempt === 1 ? '' : `/v${String(request.visual_attempt).padStart(3, '0')}`;
  const control = `07-visual/${request.platform}/set-qa${visualVersion}/round-${String(request.round).padStart(2, '0')}`;
  const requestRelative = relative(context.runDir, context.requestPath).replaceAll('\\', '/');
  const parentSuffix = request.visual_attempt === 1 ? '' : `.v${String(request.visual_attempt).padStart(3, '0')}`;
  const parentPath = resolve(context.runDir, `07-visual/${request.platform}/illustration-generate${parentSuffix}.request.json`);
  let parent = null;
  let plan = null;
  try {
    const parentSafe = await safeFile(context, parentPath, context.issues, 'illustration_set_qa_parent_invalid');
    if (!parentSafe) throw new Error('Canonical parent request is unavailable.');
    parent = JSON.parse(await readFile(parentSafe, 'utf8'));
    const planBinding = parent.inputs.find((item) => item.role === 'illustration_plan');
    const planPath = resolve(context.runDir, planBinding.path);
    const planSafe = await safeFile(context, planPath, context.issues, 'illustration_set_qa_parent_invalid');
    if (!planSafe || planBinding.sha256 !== await sha256(planSafe)) throw new Error('Approved plan binding is stale.');
    plan = JSON.parse(await readFile(planSafe, 'utf8'));
  } catch (error) {
    context.issues.push(issue('illustration_set_qa_parent_invalid', error.message));
  }
  if (!exactKeys(request, REQUEST_KEYS) || request.schema_version !== 1 || request.contract !== CONTRACT
    || request.provider_contract !== PROVIDER || request.capability !== 'illustration'
    || request.mode !== 'set_qa' || request.interaction_policy !== 'return_to_orchestrator'
    || !['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'].includes(request.platform)
    || request.provider_platform !== expectedProvider || !['A', 'B'].includes(request.variant)
    || !Number.isInteger(request.visual_attempt) || !Number.isInteger(request.round) || request.round < 1
    || request.task_id !== expectedTask || request.parent_task_id !== parent?.task_id
    || !Array.isArray(request.inputs) || !request.inputs.length
    || request.output_dir !== `07-visual/${request.platform}`
    || requestRelative !== `${control}/request.json` || request.review_path !== `${control}/review.json`
    || JSON.stringify(request.expected_artifacts) !== JSON.stringify([request.review_path])) {
    context.issues.push(issue('invalid_illustration_set_qa_request', 'Request does not match the bounded illustration set QA contract.'));
  }
  if (state?.schema_version !== 2 || state?.status !== 'running' || state?.current_stage !== 'visual'
    || state?.stages?.visual?.status !== 'running' || state?.stages?.visual?.attempt !== request.visual_attempt
    || state?.gates?.visual?.status !== 'approved'
    || state?.capabilities?.providers?.illustration?.profile !== 'bounded-per-image') {
    context.issues.push(issue('illustration_set_qa_stage_mismatch', 'Set QA must target the approved current bounded visual attempt.'));
  }
  const ids = [];
  for (const inputRow of request.inputs || []) {
    const path = resolve(context.runDir, inputRow?.path || '');
    const safe = await safeFile(context, path, context.issues, 'illustration_set_qa_input_unsafe');
    let child = null;
    let childRequest = null;
    const childRequestPath = resolve(dirname(path), 'request.json');
    const childRequestSafe = safe
      ? await safeFile(context, childRequestPath, context.issues, 'illustration_set_qa_input_unsafe') : null;
    try { if (safe) child = JSON.parse(await readFile(path, 'utf8')); } catch (error) {
      context.issues.push(issue('illustration_set_qa_input_invalid', error.message));
    }
    try {
      if (childRequestSafe) childRequest = JSON.parse(await readFile(childRequestSafe, 'utf8'));
    } catch (error) {
      context.issues.push(issue('illustration_set_qa_input_invalid', error.message));
    }
    if (!exactKeys(inputRow, ['role', 'image_id', 'path', 'sha256'])
      || inputRow.role !== 'illustration_child_result' || !safe
      || inputRow.sha256 !== await sha256(path) || child?.status !== 'PASS'
      || child?.image?.image_id !== inputRow.image_id
      || child?.request_sha256 !== (childRequestSafe ? await sha256(childRequestSafe) : null)
      || childRequest?.parent_task_id !== request.parent_task_id
      || childRequest?.platform !== request.platform || childRequest?.variant !== request.variant
      || childRequest?.anchor?.image_id !== inputRow.image_id
      || !inputRow.path.startsWith(`07-visual/${request.platform}/children${visualVersion}/${inputRow.image_id}/attempt-`)
      || !inputRow.path.endsWith('/result.json')) {
      context.issues.push(issue('illustration_set_qa_input_invalid', `Invalid child result input: ${inputRow?.path || '(missing)'}.`));
    }
    ids.push(inputRow?.image_id);
  }
  const approvedIds = plan?.anchors?.map((anchor) => anchor.image_id);
  if (new Set(ids).size !== ids.length || JSON.stringify(ids) !== JSON.stringify(approvedIds)) {
    context.issues.push(issue('illustration_set_qa_input_invalid', 'Set QA inputs must contain every approved image exactly once in plan order.'));
  }
  context.resultPath = resolve(dirname(context.requestPath), 'result.json');
  return context;
}

async function finalize(context) {
  const issues = [];
  const reviewPath = resolve(context.runDir, context.request.review_path);
  const safe = await safeFile(context, reviewPath, issues, 'illustration_set_qa_review_missing');
  let review = null;
  try { if (safe) review = JSON.parse(await readFile(reviewPath, 'utf8')); } catch (error) {
    issues.push(issue('illustration_set_qa_review_invalid', error.message));
  }
  const allowedIds = new Set(context.request.inputs.map((item) => item.image_id));
  const failedIds = Array.isArray(review?.failed_image_ids) ? review.failed_image_ids : [];
  const reasons = Array.isArray(review?.reasons) ? review.reasons : [];
  const validReview = exactKeys(review, REVIEW_KEYS) && review.schema_version === 1
    && ['PASS', 'FAILED', 'BLOCKED'].includes(review.status)
    && exactKeys(review.checks, CHECK_KEYS)
    && Object.values(review.checks).every((value) => ['PASS', 'FAILED', 'BLOCKED'].includes(value))
    && Array.isArray(review.failed_image_ids) && new Set(failedIds).size === failedIds.length
    && failedIds.every((imageId) => allowedIds.has(imageId))
    && Array.isArray(review.reasons)
    && reasons.every((row) => exactKeys(row, ['image_id', 'reason'])
      && failedIds.includes(row.image_id) && typeof row.reason === 'string' && row.reason.trim())
    && new Set(reasons.map((row) => row.image_id)).size === reasons.length
    && typeof review.reviewer === 'string' && review.reviewer.trim()
    && Number.isFinite(Date.parse(review.reviewed_at || ''));
  const statusValid = review?.status === 'PASS'
    ? failedIds.length === 0 && reasons.length === 0 && review.blocking_reason === null
      && Object.values(review.checks).every((value) => value === 'PASS')
    : review?.status === 'FAILED'
      ? failedIds.length > 0 && reasons.length === failedIds.length && review.blocking_reason === null
      : review?.status === 'BLOCKED' && failedIds.length === 0 && reasons.length === 0
        && typeof review.blocking_reason === 'string' && review.blocking_reason.trim();
  if (!validReview || !statusValid) {
    issues.push(issue('illustration_set_qa_review_invalid', 'Set QA review must localize every failure to approved image IDs or explicitly block.'));
  }
  const status = issues.length ? 'BLOCKED' : review.status;
  const result = {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER,
    task_id: context.request.task_id,
    request_sha256: context.requestSha256,
    status,
    artifacts: safe ? [{ role: 'set_qa_review', path: context.request.review_path, sha256: await sha256(reviewPath) }] : [],
    checks: { request_valid: true, mode: 'set_qa', platform: context.request.platform, round: context.request.round },
    set_qa: review && !issues.length ? {
      status: review.status,
      failed_image_ids: failedIds,
      reasons,
      review: { path: context.request.review_path, sha256: await sha256(reviewPath) }
    } : null,
    issues: issues.length ? issues : review.status === 'FAILED'
      ? [issue('illustration_set_qa_failed', 'Set QA rejected named images.', { failed_image_ids: failedIds })]
      : review.status === 'BLOCKED'
        ? [issue('illustration_set_qa_blocked', review.blocking_reason)] : [],
    warnings: []
  };
  await writeFile(context.resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

async function block(context, reason) {
  const result = {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER,
    task_id: context.request.task_id,
    request_sha256: context.requestSha256,
    status: 'BLOCKED',
    artifacts: [],
    checks: { request_valid: true, mode: 'set_qa', platform: context.request.platform, round: context.request.round },
    set_qa: null,
    issues: [issue('illustration_set_qa_blocked', reason)],
    warnings: []
  };
  await writeFile(context.resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

async function main() {
  const [command, requestInput, detail] = process.argv.slice(2);
  if (!['validate-request', 'finalize', 'block'].includes(command) || !requestInput
    || command === 'block' && !(detail || '').trim()) {
    emit({ status: 'BLOCKED', issues: [issue(
      'invalid_illustration_set_qa_command',
      'Usage: set-qa-contract.mjs validate-request|finalize <request.json> | block <request.json> <reason>'
    )] }, 2);
    return;
  }
  const context = await validateRequest(requestInput);
  if (context.issues.length) {
    emit({ status: 'BLOCKED', issues: context.issues }, 2);
    return;
  }
  if (command === 'validate-request') {
    emit({ status: 'PASS', task_id: context.request.task_id, issues: [] });
    return;
  }
  const result = command === 'block' ? await block(context, detail.trim()) : await finalize(context);
  emit(result, result.status === 'PASS' ? 0 : 2);
}

main().catch((error) => emit({
  status: 'FAILED',
  issues: [issue('illustration_set_qa_failed', error.message)]
}, 2));

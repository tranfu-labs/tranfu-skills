#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { readRasterInfo } from './validate-style-bundle.mjs';

const CONTRACT = 'content-production-provider/v1';
const PROVIDER = 'illustration-v1';
const PLATFORMS = new Set(['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao']);
const REQUEST_KEYS = [
  'schema_version', 'contract', 'provider_contract', 'capability', 'task_id', 'run_dir',
  'run_mode', 'mode', 'visual_attempt', 'candidate_attempt', 'platform', 'provider_platform',
  'variant', 'parent_task_id', 'selection', 'inputs', 'anchor', 'style', 'brand',
  'generation_backend', 'generation_geometry', 'output_dir', 'artifacts',
  'expected_artifacts', 'interaction_policy'
];
const QA_KEYS = [
  'schema_version', 'status', 'content_qa_status', 'style_qa_status', 'brand_qa_status',
  'failed_gates', 'readable_text', 'residual_risk', 'reviewer', 'reviewed_at'
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

function add(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: 'visual', ...extra });
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function safeFile(context, path, issues, code, { required = true } = {}) {
  if (!path || !inside(context.runDir, path) || required && !existsSync(path)) {
    if (required) add(issues, code, `Missing or unsafe file: ${path || '(missing)'}.`);
    return null;
  }
  if (!existsSync(path)) return path;
  try {
    const stat = await lstat(path);
    const real = await realpath(path);
    if (stat.isSymbolicLink() || !stat.isFile() || !inside(context.runReal, real)) {
      throw new Error('not a real file inside run_dir');
    }
    return path;
  } catch (error) {
    add(issues, code, `${path}: ${error.message}`);
    return null;
  }
}

async function validateRequest(input) {
  const context = {
    issues: [], requestPath: resolve(input || ''), request: null, requestSha256: null,
    runDir: null, runReal: null, resultPath: null
  };
  if (!input || !existsSync(context.requestPath)) {
    add(context.issues, 'missing_illustration_child_request', `Missing request: ${context.requestPath}.`);
    return context;
  }
  try {
    const stat = await lstat(context.requestPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Request must be a real file.');
    context.request = JSON.parse(await readFile(context.requestPath, 'utf8'));
    context.requestSha256 = await sha256(context.requestPath);
  } catch (error) {
    add(context.issues, 'invalid_illustration_child_request', error.message);
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
    add(context.issues, 'invalid_illustration_child_run', error.message);
    return context;
  }
  let state = null;
  try { state = JSON.parse(await readFile(resolve(context.runDir, 'run.json'), 'utf8')); } catch (error) {
    add(context.issues, 'invalid_illustration_child_state', error.message);
  }
  const expectedProvider = request.platform === 'xiaohongshu' ? 'xhs' : request.platform;
  const taskPattern = new RegExp(`^illustration:${state?.run_id || ''}:${request.platform}:${request.variant}:${request.anchor?.image_id}:candidate-${String(request.candidate_attempt).padStart(2, '0')}:visual-${String(request.visual_attempt).padStart(3, '0')}$`);
  if (!exactKeys(request, REQUEST_KEYS) || request.schema_version !== 1 || request.contract !== CONTRACT
    || request.provider_contract !== PROVIDER || request.capability !== 'illustration'
    || request.mode !== 'generate_image' || request.interaction_policy !== 'return_to_orchestrator'
    || !PLATFORMS.has(request.platform) || request.provider_platform !== expectedProvider
    || !['A', 'B'].includes(request.variant) || !Number.isInteger(request.visual_attempt)
    || !Number.isInteger(request.candidate_attempt) || request.candidate_attempt < 1 || request.candidate_attempt > 3
    || !taskPattern.test(request.task_id || '') || !plain(request.anchor)
    || !plain(request.style) || !plain(request.brand) || !plain(request.generation_backend)
    || !plain(request.generation_geometry) || !plain(request.artifacts)
    || !Array.isArray(request.inputs) || !Array.isArray(request.expected_artifacts)
    || request.output_dir !== `07-visual/${request.platform}`) {
    add(context.issues, 'invalid_illustration_child_request', 'Request does not match the bounded illustration child contract.');
  }
  if (state?.schema_version !== 2 || state?.status !== 'running' || state?.current_stage !== 'visual'
    || state?.stages?.visual?.status !== 'running' || state?.stages?.visual?.attempt !== request.visual_attempt
    || state?.gates?.visual?.status !== 'approved'
    || state?.capabilities?.providers?.illustration?.profile !== 'bounded-per-image') {
    add(context.issues, 'illustration_child_stage_mismatch', 'Child must target the approved current bounded visual attempt.');
  }
  const visualVersion = request.visual_attempt === 1 ? '' : `/v${String(request.visual_attempt).padStart(3, '0')}`;
  const attemptNumber = String(request.candidate_attempt).padStart(2, '0');
  const extension = request.generation_backend?.artifact_format === 'png' ? 'png' : 'jpg';
  const control = `07-visual/${request.platform}/children${visualVersion}/${request.anchor?.image_id}/attempt-${attemptNumber}`;
  const expectedArtifacts = {
    prompt: `07-visual/${request.platform}/prompts${visualVersion}/${request.anchor?.image_id}/attempt-${attemptNumber}.md`,
    candidate: request.brand?.enabled
      ? `07-visual/${request.platform}/images/unbranded${visualVersion}/${request.anchor?.image_id}/attempt-${attemptNumber}.${extension}`
      : `07-visual/${request.platform}/images${visualVersion}/${request.anchor?.image_id}/attempt-${attemptNumber}.${extension}`,
    delivery: request.brand?.enabled
      ? `07-visual/${request.platform}/images/branded${visualVersion}/${request.anchor?.image_id}/attempt-${attemptNumber}.${extension}`
      : `07-visual/${request.platform}/images${visualVersion}/${request.anchor?.image_id}/attempt-${attemptNumber}.${extension}`,
    qa: `${control}/qa.json`
  };
  const requestRelative = relative(context.runDir, context.requestPath).replaceAll('\\', '/');
  if (requestRelative !== `${control}/request.json`
    || JSON.stringify(request.artifacts) !== JSON.stringify(expectedArtifacts)
    || JSON.stringify(request.expected_artifacts) !== JSON.stringify([...new Set(Object.values(expectedArtifacts))])) {
    add(context.issues, 'invalid_illustration_child_artifacts', 'Child artifact authorization is not exact.');
  }
  const parentBinding = request.inputs.find((item) => item.role === 'parent_request');
  const safeInputs = new Map();
  for (const item of request.inputs) {
    const path = resolve(context.runDir, item?.path || '');
    const safe = await safeFile(context, path, context.issues, 'illustration_child_input_unsafe');
    if (!safe || !/^[a-f0-9]{64}$/.test(item?.sha256 || '') || item.sha256 !== await sha256(path)) {
      add(context.issues, 'illustration_child_input_drift', `Child input is stale: ${item?.path || '(missing)'}.`);
    } else {
      safeInputs.set(item.role, path);
    }
  }
  const inputRoles = request.inputs.map((item) => item?.role);
  if (JSON.stringify(inputRoles) !== JSON.stringify([
    'final_draft', 'title_selection', 'illustration_plan', 'shot_list', 'parent_request'
  ])) {
    add(context.issues, 'illustration_child_input_drift', 'Child inputs must exactly extend its parent inputs.');
  }
  let parent = null;
  let plan = null;
  try {
    if (safeInputs.has('parent_request')) {
      parent = JSON.parse(await readFile(safeInputs.get('parent_request'), 'utf8'));
    }
    if (safeInputs.has('illustration_plan')) {
      plan = JSON.parse(await readFile(safeInputs.get('illustration_plan'), 'utf8'));
    }
  } catch (error) {
    add(context.issues, 'illustration_child_parent_mismatch', error.message);
  }
  const anchor = plan?.anchors?.find((item) => item.image_id === request.anchor?.image_id);
  if (!parentBinding || parent?.mode !== 'generate' || request.parent_task_id !== parent?.task_id
    || parent?.platform !== request.platform || parent?.variant !== request.variant
    || JSON.stringify(request.selection) !== JSON.stringify(parent?.selection)
    || JSON.stringify(request.anchor) !== JSON.stringify(anchor)
    || JSON.stringify(request.style) !== JSON.stringify(plan?.style)
    || JSON.stringify(request.brand) !== JSON.stringify(plan?.brand)
    || JSON.stringify(request.generation_backend) !== JSON.stringify(plan?.generation_backend)
    || JSON.stringify(request.generation_geometry) !== JSON.stringify(plan?.generation_geometry)) {
    add(context.issues, 'illustration_child_parent_mismatch', 'Child does not bind its parent task.');
  }
  context.resultPath = resolve(dirname(context.requestPath), 'result.json');
  if (!inside(resolve(context.runDir, `07-visual/${request.platform}`), context.requestPath)
    || !inside(resolve(context.runDir, `07-visual/${request.platform}`), context.resultPath)) {
    add(context.issues, 'illustration_child_output_escape', 'Child control path escapes its platform output.');
  }
  return context;
}

function quotedText(prompt) {
  const values = [];
  for (const match of prompt.matchAll(/“([^”\n]+)”|"([^"\n]+)"/g)) values.push((match[1] || match[2]).trim());
  return values;
}

function declaredText(prompt) {
  const values = quotedText(prompt);
  const pattern = /(?:label|footer|caption|title(?:\s+bar)?|heading|conclusion(?:\s+bar)?|标签|页脚|图注|标题条?|结论条)\s*(?::|：|=|\bis\b)\s*([^\n.;。；]+)/gi;
  for (const match of prompt.matchAll(pattern)) {
    const value = match[1].trim().replace(/^[“”"']+|[“”"']+$/g, '');
    if (value && !/^(?:none|no\s+(?:text|label)|empty|无|不要文字|不使用文字)$/i.test(value)) values.push(value);
  }
  const command = /(?:render|write|show|display|include|add|put|写上|显示|添加|加入)\s+(?:the\s+)?(?:words?|text|copy|phrase|caption|label|title|文字|文案|短语|图注|标签|标题)\s+([^\n.;。；]+)/gi;
  for (const match of prompt.matchAll(command)) {
    const value = match[1].trim()
      .replace(/^[“”"']+|[“”"']+$/g, '')
      .replace(/\s+(?:in|on)\s+the\s+image.*$/i, '')
      .trim();
    if (value) values.push(value);
  }
  return [...new Set(values)];
}

async function promptPreflight(context) {
  const issues = [];
  const request = context.request;
  const promptPath = resolve(context.runDir, request.artifacts.prompt);
  const safe = await safeFile(context, promptPath, issues, 'illustration_prompt_missing');
  if (!safe) return { issues, prompt: null, promptPath };
  const prompt = await readFile(promptPath, 'utf8');
  if (!prompt.trim()) add(issues, 'illustration_prompt_empty', 'Prompt must not be empty.');
  const labels = request.anchor.short_labels;
  const readable = declaredText(prompt);
  if (request.anchor.text_mode === 'icons_only') {
    const asksForText = /(?:add|include|render|show|display|use|添加|加入|显示|使用).{0,24}(?:text|label|footer|caption|title|文字|标签|页脚|图注|标题)/i.test(prompt)
      && !/(?:no|without|禁止|不要|不使用).{0,12}(?:readable\s+)?(?:text|文字)/i.test(prompt);
    if (!/icons-only/i.test(prompt) || readable.length || asksForText) {
      add(issues, 'illustration_prompt_text_not_allowed', 'icons_only prompts must require icons-only and contain no quoted readable text.');
    }
  } else if (/icons-only|(?:no|without)\s+readable\s+text/i.test(prompt)
    || readable.some((value) => !labels.includes(value))) {
    add(issues, 'illustration_prompt_text_not_allowed', 'Prompt conflicts with text_mode or contains readable text outside anchor.short_labels.', { readable });
  }
  const ratio = request.generation_geometry.target_aspect_ratio;
  if (ratio === '3:4') {
    if (!/\b0\.75\b/.test(prompt)) add(issues, 'illustration_prompt_aspect_missing', '3:4 prompt must state aspect ratio 0.75.');
    if (/(?:use|target|render|aspect(?:\s+ratio)?(?:\s+is)?|size)\s*(?:at|as|:|=)?\s*(?:2\s*:\s*3|1024\s*[x×]\s*1536)/i.test(prompt)) {
      add(issues, 'illustration_prompt_aspect_conflict', '3:4 prompt must not request 2:3 or 1024x1536.');
    }
  }
  if (request.generation_backend.aspect_control === 'hard_parameter') {
    if (JSON.stringify(request.generation_backend.structured_size)
      !== JSON.stringify(request.generation_geometry.requested_dimensions)) {
      add(issues, 'illustration_hard_aspect_missing', 'Hard backend size must match requested_dimensions.');
    }
  } else if (request.generation_backend.aspect_control === 'prompt_only') {
    const escaped = ratio.replace(':', '\\s*:\\s*');
    if (!new RegExp(escaped).test(prompt)) {
      add(issues, 'illustration_prompt_aspect_missing', `prompt_only backend must state target aspect ratio ${ratio}.`);
    }
  } else {
    add(issues, 'illustration_aspect_control_invalid', 'Backend aspect_control must be hard_parameter or prompt_only.');
  }
  return { issues, prompt, promptPath };
}

async function rasterInfo(path) {
  try { return readRasterInfo(path); } catch { return null; }
}

async function readQa(context, issues) {
  const path = resolve(context.runDir, context.request.artifacts.qa);
  const safe = await safeFile(context, path, issues, 'illustration_candidate_qa');
  if (!safe) return null;
  let qa = null;
  try { qa = JSON.parse(await readFile(path, 'utf8')); } catch (error) {
    add(issues, 'illustration_candidate_qa', error.message);
    return null;
  }
  const disabled = context.request.brand.disabled_reason;
  const expectedBrand = context.request.brand.enabled ? 'pass' : disabled;
  if (!exactKeys(qa, QA_KEYS) || qa.schema_version !== 1 || !['PASS', 'FAILED'].includes(qa.status)
    || qa.content_qa_status !== 'pass' || qa.style_qa_status !== 'pass'
    || qa.brand_qa_status !== expectedBrand || !Array.isArray(qa.failed_gates)
    || !Array.isArray(qa.readable_text) || qa.readable_text.some((value) => !context.request.anchor.short_labels.includes(value))
    || qa.residual_risk !== 'none' || typeof qa.reviewer !== 'string' || !qa.reviewer.trim()
    || !Number.isFinite(Date.parse(qa.reviewed_at || ''))) {
    add(issues, 'illustration_candidate_qa', 'Candidate QA is incomplete, failed, or outside the text allowlist.');
  }
  if (qa.status !== 'PASS' || qa.failed_gates.length) {
    add(issues, 'illustration_candidate_qa', 'Candidate failed content, style, or brand QA.', { failed_gates: qa.failed_gates });
  }
  return qa;
}

async function collectArtifacts(context, issues) {
  const artifacts = [];
  const seen = new Set();
  for (const path of context.request.expected_artifacts) {
    if (seen.has(path)) continue;
    seen.add(path);
    const absolute = resolve(context.runDir, path);
    const safe = await safeFile(context, absolute, issues, 'illustration_child_artifact_missing');
    if (safe) {
      const role = path === context.request.artifacts.prompt ? 'prompt'
        : path === context.request.artifacts.qa ? 'qa'
          : path === context.request.artifacts.delivery && path === context.request.artifacts.candidate
            ? 'source_delivery' : path === context.request.artifacts.delivery ? 'delivery' : 'source';
      artifacts.push({ role, path, sha256: await sha256(absolute) });
    }
  }
  return artifacts;
}

async function finalize(context) {
  const issues = [];
  const preflight = await promptPreflight(context);
  issues.push(...preflight.issues);
  const candidatePath = resolve(context.runDir, context.request.artifacts.candidate);
  const deliveryPath = resolve(context.runDir, context.request.artifacts.delivery);
  const candidateSafe = await safeFile(context, candidatePath, issues, 'illustration_candidate_geometry');
  const deliverySafe = context.request.artifacts.delivery === context.request.artifacts.candidate
    ? candidateSafe : await safeFile(context, deliveryPath, issues, 'illustration_candidate_geometry');
  const source = candidateSafe ? await rasterInfo(candidatePath) : null;
  const delivery = deliverySafe ? await rasterInfo(deliveryPath) : null;
  const [ratioWidth, ratioHeight] = context.request.generation_geometry.target_aspect_ratio.split(':').map(Number);
  const targetRatio = ratioWidth / ratioHeight;
  const actualRatio = source?.width / source?.height;
  const geometryPass = source && delivery && source.format === delivery.format
    && source.width === delivery.width && source.height === delivery.height
    && Math.abs(actualRatio - targetRatio) <= context.request.generation_geometry.ratio_tolerance
    && (context.request.generation_geometry.minimum_short_edge === null
      || Math.min(source.width, source.height) >= context.request.generation_geometry.minimum_short_edge);
  if (!geometryPass) add(issues, 'illustration_candidate_geometry', 'Candidate must be a native decodable raster at the approved ratio and minimum edge.', {
    source_dimensions: source ? { width: source.width, height: source.height } : null
  });
  const qa = await readQa(context, issues);
  if (context.request.brand.enabled && candidateSafe && deliverySafe
    && await sha256(candidatePath) === await sha256(deliveryPath)) {
    add(issues, 'illustration_candidate_qa', 'Brand-enabled delivery must differ from its native source.');
  }
  const artifacts = await collectArtifacts(context, issues);
  const status = issues.length ? 'FAILED' : 'PASS';
  const image = status === 'PASS' ? {
    image_id: context.request.anchor.image_id,
    selected_attempt: context.request.candidate_attempt,
    prompt: { path: context.request.artifacts.prompt, sha256: await sha256(preflight.promptPath) },
    source: {
      path: context.request.artifacts.candidate,
      sha256: await sha256(candidatePath),
      format: source.format,
      width: source.width,
      height: source.height,
      bytes: source.bytes,
      aspect_ratio: actualRatio
    },
    delivery: {
      path: context.request.artifacts.delivery,
      sha256: await sha256(deliveryPath),
      format: delivery.format,
      width: delivery.width,
      height: delivery.height,
      bytes: delivery.bytes
    },
    qa
  } : null;
  const result = {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER,
    task_id: context.request.task_id,
    request_sha256: context.requestSha256,
    status,
    artifacts,
    checks: {
      request_valid: true,
      mode: 'generate_image',
      platform: context.request.platform,
      image_id: context.request.anchor.image_id,
      candidate_attempt: context.request.candidate_attempt,
      prompt_preflight: preflight.issues.length ? 'BLOCKED' : 'PASS',
      geometry: geometryPass ? 'PASS' : 'FAILED',
      source_dimensions: source ? { width: source.width, height: source.height } : null
    },
    image,
    issues,
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
    checks: { request_valid: true, mode: 'generate_image' },
    image: null,
    issues: [{ code: 'illustration_child_blocked', message: reason, resume_from: 'visual' }],
    warnings: []
  };
  await writeFile(context.resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

async function main() {
  const [command, requestInput, detail] = process.argv.slice(2);
  if (!['validate-request', 'preflight', 'finalize', 'block'].includes(command) || !requestInput
    || command === 'block' && !(detail || '').trim()) {
    emit({ status: 'BLOCKED', issues: [{
      code: 'invalid_illustration_child_command',
      message: 'Usage: child-contract.mjs validate-request|preflight|finalize <request.json> | block <request.json> <reason>',
      resume_from: 'visual'
    }] }, 2);
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
  if (command === 'preflight') {
    const preflight = await promptPreflight(context);
    emit({ status: preflight.issues.length ? 'BLOCKED' : 'PASS', task_id: context.request.task_id, issues: preflight.issues }, preflight.issues.length ? 2 : 0);
    return;
  }
  const result = command === 'block' ? await block(context, detail.trim()) : await finalize(context);
  emit(result, result.status === 'PASS' ? 0 : 2);
}

main().catch((error) => emit({
  status: 'FAILED',
  issues: [{ code: 'illustration_child_failed', message: error.message, resume_from: 'visual' }]
}, 2));

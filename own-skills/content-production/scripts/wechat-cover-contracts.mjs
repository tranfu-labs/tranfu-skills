import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, dirname, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  fileExists,
  fileSha256,
  filesUnder,
  platforms,
  pngDimensions,
  readJson,
  readText
} from './lib.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const BACKEND_HINTS = new Set(['runtime-native', 'configured-api', 'programmatic', 'unknown']);
const LIMITATION = 'No deterministic OCR was performed; title exactness is a provider visual observation bound to this artifact hash.';
const GATES = [
  'title_accuracy',
  'additional_text',
  'composition',
  'safe_margin',
  'underline_accents',
  'spacing',
  'visual_style',
  'semantic_fidelity',
  'forbidden_elements',
  'dimensions'
];

const requestKeys = [
  'schema_version', 'contract', 'task_id', 'capability', 'provider_contract',
  'run_dir', 'run_mode', 'mode', 'attempt', 'platform', 'variant', 'selection',
  'inputs', 'output_dir', 'expected_artifacts', 'options', 'interaction_policy'
];
const selectionKeys = [
  'platform', 'variant', 'title_id', 'title', 'topic_phrase', 'draft_path',
  'draft_sha256', 'decision_rule'
];
const optionKeys = [
  'width', 'height', 'format', 'style_id', 'exact_title_required',
  'best_effort_allowed', 'max_attempts', 'backend_hint', 'execution_strategy'
];
const resultKeys = [
  'schema_version', 'contract', 'provider_contract', 'task_id', 'request_sha256',
  'status', 'artifacts', 'checks', 'issues', 'warnings'
];
const checkKeys = [
  'request_valid', 'mode', 'attempt', 'platform', 'title_status',
  'visual_qa_status', 'file_verification_status'
];
const metadataKeys = [
  'schema_version', 'contract', 'task_id', 'status', 'attempt', 'platform',
  'variant', 'request', 'selection', 'inputs', 'style', 'source', 'backend',
  'generation', 'cover', 'residual_risk'
];
const selectedQaKeys = [
  'inspection', 'title_evidence', 'gates', 'failed_gates', 'absolute_failures',
  'visible_title_defects', 'verification_limitations'
];
const titleEvidenceKeys = [
  'claim', 'expected_title', 'observed_title', 'comparison', 'evidence_class',
  'ocr_status', 'readable', 'position', 'line_count', 'extra_readable_text'
];

function issue(code, message, extra = {}) {
  return { code, message, resume_from: 'visual', ...extra };
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function nonempty(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function stringArray(value) {
  return Array.isArray(value) && value.every(nonempty);
}

function validIsoDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function inside(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..'
    && !value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function validTitle(title) {
  const count = typeof title === 'string' ? [...title.replace(/\s/gu, '')].length : 0;
  return typeof title === 'string' && title === title.trim() && Boolean(title)
    && /[\u3400-\u9fff]/u.test(title)
    && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(title)
    && count >= 2 && count <= 35;
}

function binding(value) {
  return exactKeys(value, ['path', 'sha256']) && nonempty(value.path) && SHA256.test(value.sha256);
}

async function safeFile(root, rootReal, relativePath, issues, code) {
  if (!nonempty(relativePath) || isAbsolute(relativePath) || relativePath.includes('\\')) {
    issues.push(issue(code, `Unsafe file path: ${relativePath || '(missing)'}.`, { path: relativePath || null }));
    return null;
  }
  const absolute = resolve(root, relativePath);
  if (!inside(root, absolute) || !fileExists(absolute)) {
    issues.push(issue(code, `Missing or escaping file: ${relativePath}.`, { path: relativePath }));
    return null;
  }
  let current = root;
  try {
    for (const part of relative(root, absolute).split(/[\\/]/).filter(Boolean)) {
      current = join(current, part);
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw new Error('symbolic links are forbidden');
    }
    const stat = await lstat(absolute);
    const actual = await realpath(absolute);
    if (!stat.isFile() || !inside(rootReal, actual)) throw new Error('path is not a real file inside its owner root');
  } catch (error) {
    issues.push(issue(code, `Unsafe file ${relativePath}: ${error.message}.`, { path: relativePath }));
    return null;
  }
  return absolute;
}

async function safeJson(root, rootReal, path, issues, code) {
  const absolute = await safeFile(root, rootReal, path, issues, code);
  if (!absolute) return { absolute: null, value: null };
  try {
    return { absolute, value: await readJson(absolute) };
  } catch (error) {
    issues.push(issue(code, `Invalid JSON at ${path}: ${error.message}.`, { path }));
    return { absolute, value: null };
  }
}

export function coverPaths(state) {
  const attempt = Number.isInteger(state?.stages?.visual?.attempt) && state.stages.visual.attempt > 0
    ? state.stages.visual.attempt : 1;
  const version = `v${String(attempt).padStart(3, '0')}`;
  const suffix = attempt === 1 ? '' : `.${version}`;
  const versionDir = attempt === 1 ? '' : `/${version}`;
  const base = '07-visual/wechat-cover';
  return {
    attempt,
    version,
    base,
    request: `${base}/wechat-cover${suffix}.request.json`,
    result: `${base}/wechat-cover${suffix}.result.json`,
    cover: `${base}/cover${suffix}.png`,
    metadata: `${base}/cover${suffix}.json`,
    source: `${base}/source${suffix}.md`,
    promptDir: `${base}/prompts${versionDir}`,
    candidateDir: `${base}/candidates${versionDir}`
  };
}

export function expectedWechatCoverStageArtifacts(state) {
  const paths = coverPaths(state);
  return [paths.cover, paths.metadata];
}

async function loadContext(runDir, state, issues) {
  const root = resolve(runDir);
  let runReal;
  try {
    const stat = await lstat(root);
    runReal = await realpath(root);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('run_dir must be a real directory');
    }
  } catch (error) {
    issues.push(issue('invalid_wechat_cover_run_dir', error.message));
    return null;
  }

  const visual = state?.stages?.visual;
  if (state?.schema_version !== 2 || !['running', 'completed'].includes(visual?.status)
    || !Number.isInteger(visual?.attempt) || visual.attempt < 1
    || visual.status === 'running' && state.current_stage !== 'visual') {
    issues.push(issue('wechat_cover_stage_mismatch', 'WeChat cover requires the current positive visual attempt to be running or completed.'));
  }
  if (state?.gates?.titles?.status !== 'approved') {
    issues.push(issue('wechat_cover_titles_gate_missing', 'WeChat cover requires the approved titles gate.'));
  }
  if (state?.gates?.visual?.status !== 'approved') {
    issues.push(issue('wechat_cover_visual_gate_missing', 'WeChat cover requires the current visual plan gate to be approved.'));
  }

  const provider = state?.capabilities?.providers?.wechat_cover;
  if (provider?.status !== 'PASS' || provider?.contract !== 'wechat-cover-v1'
    || !nonempty(provider?.skill_path) || !SHA256.test(provider?.skill_sha256 || '')) {
    issues.push(issue('wechat_cover_provider_unavailable', 'The WeChat cover provider snapshot is not PASS, hashed, and registered for wechat-cover-v1.'));
    return { root, runReal, provider: null };
  }
  const skillPath = resolve(provider.skill_path);
  const skillRoot = dirname(skillPath);
  let skillReal;
  try {
    const rootStat = await lstat(skillRoot);
    const skillStat = await lstat(skillPath);
    skillReal = await realpath(skillRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory() || skillStat.isSymbolicLink()
      || !skillStat.isFile() || !inside(skillReal, await realpath(skillPath))) {
      throw new Error('provider SKILL.md is unsafe');
    }
    const actualHash = await fileSha256(skillPath);
    if (actualHash !== provider.skill_sha256) throw new Error('provider SKILL.md changed after capability preflight');
  } catch (error) {
    issues.push(issue('wechat_cover_provider_unavailable', error.message));
    return { root, runReal, provider: null };
  }
  return { root, runReal, provider: { ...provider, skillRoot, skillReal } };
}

async function approvedWinner(context, state, issues) {
  const decisionBinding = state?.gates?.titles?.decision_ref;
  if (!binding(decisionBinding)) {
    issues.push(issue('invalid_wechat_cover_selection_decision', 'Titles gate must bind one real selection decision.'));
    return { decisionBinding, selection: null };
  }
  const decisionFile = await safeJson(
    context.root, context.runReal, decisionBinding.path, issues,
    'invalid_wechat_cover_selection_decision'
  );
  if (!decisionFile.absolute) return { decisionBinding, selection: null };
  if (await fileSha256(decisionFile.absolute) !== decisionBinding.sha256) {
    issues.push(issue('invalid_wechat_cover_selection_decision', 'Approved title decision hash is stale.', { path: decisionBinding.path }));
  }
  const selections = Array.isArray(decisionFile.value?.selections) ? decisionFile.value.selections : [];
  const ids = selections.map((item) => item?.platform);
  if (selections.length !== platforms.length || new Set(ids).size !== platforms.length
    || !platforms.every((platform) => ids.includes(platform))) {
    issues.push(issue('invalid_wechat_cover_selections', 'Approved title decision must contain exactly one winner for every platform.'));
  }
  const selection = selections.find((item) => item?.platform === 'wechat') || null;
  const validSelection = exactKeys(selection, selectionKeys) && selection.platform === 'wechat'
    && ['A', 'B'].includes(selection.variant) && nonempty(selection.title_id)
    && validTitle(selection.title) && selection.topic_phrase === null
    && selection.draft_path === `05-platforms/wechat/${selection.variant}/final.md`
    && SHA256.test(selection.draft_sha256 || '') && nonempty(selection.decision_rule);
  if (!validSelection) {
    issues.push(issue('invalid_wechat_cover_selection', 'Approved WeChat winner violates the exact cover selection contract.'));
    return { decisionBinding, selection };
  }
  const draft = await safeFile(
    context.root, context.runReal, selection.draft_path, issues, 'wechat_cover_selection_drift'
  );
  if (draft && await fileSha256(draft) !== selection.draft_sha256) {
    issues.push(issue('wechat_cover_selection_drift', 'Approved WeChat draft hash is stale.', { path: selection.draft_path }));
  }
  return { decisionBinding, selection };
}

function expectedOptions(hint) {
  return {
    width: 1923,
    height: 818,
    format: 'png',
    style_id: 'warm-hand-drawn-notebook-v1',
    exact_title_required: true,
    best_effort_allowed: false,
    max_attempts: 3,
    backend_hint: hint,
    execution_strategy: 'one_candidate_at_a_time'
  };
}

function validateRequest(request, context, state, paths, winner, issues) {
  const selection = winner.selection;
  const expectedInputs = selection ? [
    { role: 'final_draft', path: selection.draft_path, sha256: selection.draft_sha256 },
    { role: 'title_selection', path: winner.decisionBinding.path, sha256: winner.decisionBinding.sha256 }
  ] : [];
  const valid = exactKeys(request, requestKeys)
    && request.schema_version === 1 && request.contract === 'content-production-provider/v1'
    && request.task_id === `wechat-cover:${state.run_id}:wechat:${selection?.variant}:attempt-${String(paths.attempt).padStart(3, '0')}`
    && request.capability === 'wechat_cover' && request.provider_contract === 'wechat-cover-v1'
    && nonempty(request.run_dir) && resolve(request.run_dir) === context.root
    && request.run_mode === state.run_mode
    && request.mode === 'generate_cover' && request.attempt === paths.attempt
    && request.platform === 'wechat' && request.variant === selection?.variant
    && isDeepStrictEqual(request.selection, selection)
    && isDeepStrictEqual(request.inputs, expectedInputs)
    && request.output_dir === paths.base
    && isDeepStrictEqual(request.expected_artifacts, [paths.cover, paths.metadata])
    && exactKeys(request.options, optionKeys) && BACKEND_HINTS.has(request.options.backend_hint)
    && isDeepStrictEqual(request.options, expectedOptions(request.options.backend_hint))
    && request.interaction_policy === 'return_to_orchestrator';
  if (!valid) issues.push(issue('invalid_wechat_cover_request', 'Current WeChat cover request does not exactly match the builder and approved winner.'));
}

async function validateStyle(style, provider, issues) {
  const expected = {
    id: 'warm-hand-drawn-notebook-v1',
    skill_file: 'SKILL.md',
    style_spec: 'references/style-spec.md',
    style_reference: 'assets/style-reference.png',
    normalizer: 'scripts/normalize_cover.py'
  };
  if (!exactKeys(style, Object.keys(expected)) || style?.id !== expected.id || !provider) {
    issues.push(issue('invalid_wechat_cover_style', 'Cover style bindings are incomplete or the provider is unavailable.'));
    return;
  }
  for (const key of ['skill_file', 'style_spec', 'style_reference', 'normalizer']) {
    const value = style[key];
    if (!binding(value) || value.path !== expected[key]) {
      issues.push(issue('invalid_wechat_cover_style', `Invalid ${key} binding.`));
      continue;
    }
    const path = await safeFile(provider.skillRoot, provider.skillReal, value.path, issues, 'invalid_wechat_cover_style');
    if (path && await fileSha256(path) !== value.sha256) {
      issues.push(issue('wechat_cover_style_drift', `Provider resource changed: ${value.path}.`, { path: value.path }));
    }
    if (key === 'skill_file' && value.sha256 !== provider.skill_sha256) {
      issues.push(issue('wechat_cover_style_drift', 'cover.json does not bind the capability-preflight SKILL.md hash.'));
    }
  }
}

async function validateBindingFile(context, value, expectedPath, issues, code) {
  if (!binding(value) || value.path !== expectedPath) {
    issues.push(issue(code, `Invalid file binding for ${expectedPath}.`, { path: value?.path || null }));
    return null;
  }
  const path = await safeFile(context.root, context.runReal, value.path, issues, code);
  if (path && await fileSha256(path) !== value.sha256) {
    issues.push(issue(code, `File hash is stale: ${value.path}.`, { path: value.path }));
  }
  return path;
}

function validBackend(value, withHint = false) {
  const keys = withHint ? ['hint', 'method', 'model'] : ['method', 'model'];
  return exactKeys(value, keys) && (!withHint || BACKEND_HINTS.has(value.hint))
    && nonempty(value.method) && (value.model === null || nonempty(value.model));
}

async function validateCandidate(context, candidate, expectedPath, issues) {
  if (!exactKeys(candidate, ['path', 'sha256', 'format', 'width', 'height'])
    || candidate.path !== expectedPath || !SHA256.test(candidate.sha256 || '')
    || candidate.format !== 'png' || candidate.width !== 1923 || candidate.height !== 818) {
    issues.push(issue('invalid_wechat_cover_candidate', `Invalid normalized candidate record: ${expectedPath}.`, { path: expectedPath }));
    return null;
  }
  const path = await safeFile(context.root, context.runReal, candidate.path, issues, 'invalid_wechat_cover_candidate');
  if (!path) return null;
  const dimensions = await pngDimensions(path);
  if (candidate.sha256 !== await fileSha256(path) || dimensions?.width !== 1923 || dimensions?.height !== 818) {
    issues.push(issue('invalid_wechat_cover_candidate', `Candidate is stale or is not a 1923x818 PNG: ${candidate.path}.`, { path: candidate.path }));
  }
  return path;
}

function validateSelectedQa(qa, selection, paths, coverHash, issues) {
  const inspection = qa?.inspection;
  const evidence = qa?.title_evidence;
  const validInspection = exactKeys(inspection, ['method', 'artifact_path', 'artifact_sha256', 'reviewer', 'reviewed_at'])
    && inspection.method === 'model_visual_inspection' && inspection.artifact_path === paths.cover
    && inspection.artifact_sha256 === coverHash && nonempty(inspection.reviewer)
    && validIsoDate(inspection.reviewed_at);
  const validEvidence = exactKeys(evidence, titleEvidenceKeys)
    && evidence.claim === 'provider_observed_exact'
    && evidence.expected_title === selection?.title && evidence.observed_title === selection?.title
    && evidence.comparison === 'exact' && evidence.evidence_class === 'provider_visual_observation'
    && evidence.ocr_status === 'not_performed' && evidence.readable === true
    && evidence.position === 'left' && [2, 3].includes(evidence.line_count)
    && evidence.extra_readable_text === false;
  const validGates = exactKeys(qa?.gates, GATES) && GATES.every((gate) => qa.gates[gate] === 'PASS');
  const valid = exactKeys(qa, selectedQaKeys) && validInspection && validGates
    && isDeepStrictEqual(qa.failed_gates, []) && isDeepStrictEqual(qa.absolute_failures, [])
    && isDeepStrictEqual(qa.visible_title_defects, [])
    && isDeepStrictEqual(qa.verification_limitations, [LIMITATION]);
  if (!validEvidence) {
    issues.push(issue('wechat_cover_title_evidence_invalid', 'Selected cover title evidence must be a provider-observed exact match with OCR explicitly not performed.'));
  }
  if (!valid) {
    issues.push(issue('invalid_wechat_cover_visual_qa', 'Selected cover lacks exact provider-observed title evidence or one of the ten canonical visual gates.'));
  }
}

async function currentFiles(runDir, relativeDir, attempt) {
  const root = join(runDir, relativeDir);
  const values = await filesUnder(root);
  return attempt === 1 ? values.filter((path) => !/^v\d{3}\//.test(path)) : values;
}

async function validateMetadata(metadata, request, context, state, paths, winner, requestHash, issues) {
  const selection = winner.selection;
  const validTop = exactKeys(metadata, metadataKeys) && metadata.schema_version === 1
    && metadata.contract === 'wechat-cover-v1' && metadata.task_id === request?.task_id
    && metadata.status === 'PASS' && metadata.attempt === paths.attempt
    && metadata.platform === 'wechat' && metadata.variant === selection?.variant
    && exactKeys(metadata.request, ['path', 'sha256'])
    && metadata.request.path === paths.request && metadata.request.sha256 === requestHash
    && isDeepStrictEqual(metadata.selection, selection)
    && isDeepStrictEqual(metadata.inputs, request?.inputs)
    && metadata.residual_risk === 'none';
  if (!validTop) issues.push(issue('invalid_wechat_cover_metadata', 'cover.json does not exactly bind the current request and selected WeChat winner.'));

  await validateStyle(metadata?.style, context.provider, issues);
  const sourcePath = await validateBindingFile(
    context, metadata?.source, paths.source, issues, 'invalid_wechat_cover_source'
  );
  if (sourcePath) {
    const source = await readText(sourcePath);
    if (!source.trim() || !source.includes(selection?.title || '')) {
      issues.push(issue('invalid_wechat_cover_source', 'Cover source record is empty or omits the exact selected title.', { path: paths.source }));
    }
  }
  if (!validBackend(metadata?.backend, true) || metadata.backend.hint !== request?.options?.backend_hint) {
    issues.push(issue('invalid_wechat_cover_backend', 'Cover backend record is invalid or does not bind the request hint.'));
  }

  const generation = metadata?.generation;
  const attempts = Array.isArray(generation?.attempts) ? generation.attempts : [];
  const generationShape = exactKeys(generation, [
    'max_attempts', 'attempt_count', 'selected_attempt', 'attempts', 'selected_qa'
  ]) && generation.max_attempts === 3 && Number.isInteger(generation.attempt_count)
    && generation.attempt_count >= 1 && generation.attempt_count <= 3
    && generation.attempt_count === attempts.length
    && generation.selected_attempt === generation.attempt_count;
  if (!generationShape) {
    issues.push(issue('invalid_wechat_cover_generation', 'Cover generation attempts must be contiguous, current, and limited to three.'));
  }

  const promptPaths = [];
  const candidatePaths = [];
  let selectedCandidate = null;
  let selectedBackend = null;
  for (let index = 0; index < attempts.length; index += 1) {
    const number = index + 1;
    const row = attempts[index];
    const promptPath = `${paths.promptDir}/attempt-${String(number).padStart(2, '0')}.md`;
    const candidatePath = `${paths.candidateDir}/attempt-${String(number).padStart(2, '0')}.png`;
    const rowShape = exactKeys(row, [
      'attempt', 'prompt', 'candidate', 'backend', 'status', 'failed_gates',
      'absolute_failures', 'visible_title_defects'
    ]) && row.attempt === number && binding(row.prompt) && row.prompt.path === promptPath
      && validBackend(row.backend) && ['PASS', 'RETRY', 'RETRY_NO_CANDIDATE', 'SELECT'].includes(row.status)
      && stringArray(row.failed_gates) && stringArray(row.absolute_failures)
      && stringArray(row.visible_title_defects)
      && (row.status === 'RETRY_NO_CANDIDATE') === (row.candidate === null);
    if (!rowShape) issues.push(issue('invalid_wechat_cover_attempt', `Invalid generation attempt ${number}.`));
    const prompt = await validateBindingFile(context, row?.prompt, promptPath, issues, 'invalid_wechat_cover_prompt');
    if (prompt) {
      const promptText = await readText(prompt);
      if (!promptText.trim() || !promptText.includes(selection?.title || '')) {
        issues.push(issue('invalid_wechat_cover_prompt', `Prompt is empty or omits the exact title: ${promptPath}.`, { path: promptPath }));
      }
    }
    promptPaths.push(promptPath);
    if (row?.candidate !== null) {
      const candidate = await validateCandidate(context, row?.candidate, candidatePath, issues);
      candidatePaths.push(candidatePath);
      if (number === generation?.selected_attempt) {
        selectedCandidate = { row, path: candidate };
        selectedBackend = row.backend;
      }
    }
    const selected = number === generation?.selected_attempt;
    if (selected && (row?.status !== 'PASS' || row.failed_gates?.length
      || row.absolute_failures?.length || row.visible_title_defects?.length)) {
      issues.push(issue('wechat_cover_best_effort_rejected', 'Selected cover attempt must be an exact PASS without failed gates, absolute failures, or title defects.'));
    }
    if (!selected && row?.status === 'PASS') {
      issues.push(issue('invalid_wechat_cover_attempt', 'Generation must stop at the first PASS attempt.'));
    }
    if (!selected && !['RETRY', 'RETRY_NO_CANDIDATE'].includes(row?.status)) {
      issues.push(issue('invalid_wechat_cover_attempt', `Attempt ${number} must lead to a retry.`));
    }
    if (row?.status === 'RETRY_NO_CANDIDATE' && number === attempts.length) {
      issues.push(issue('invalid_wechat_cover_attempt', 'The final attempt cannot end without a candidate.'));
    }
  }
  if (!isDeepStrictEqual(metadata?.backend, {
    hint: request?.options?.backend_hint,
    ...(selectedBackend || {})
  })) {
    issues.push(issue('invalid_wechat_cover_backend', 'Top-level backend must exactly match the selected candidate backend.'));
  }

  const actualPrompts = await currentFiles(context.root, paths.promptDir, paths.attempt);
  const actualCandidates = await currentFiles(context.root, paths.candidateDir, paths.attempt);
  const expectedPromptNames = promptPaths.map((path) => path.slice(paths.promptDir.length + 1)).sort();
  const expectedCandidateNames = candidatePaths.map((path) => path.slice(paths.candidateDir.length + 1)).sort();
  if (!isDeepStrictEqual(actualPrompts, expectedPromptNames)
    || !isDeepStrictEqual(actualCandidates, expectedCandidateNames)) {
    issues.push(issue('wechat_cover_dynamic_artifact_mismatch', 'Current-attempt prompt and candidate files must exactly match cover.json.'));
  }

  const cover = metadata?.cover;
  const coverShape = exactKeys(cover, [
    'path', 'sha256', 'format', 'width', 'height', 'selected_candidate_path',
    'selected_candidate_sha256', 'byte_identical'
  ]) && cover.path === paths.cover && SHA256.test(cover.sha256 || '')
    && cover.format === 'png' && cover.width === 1923 && cover.height === 818
    && cover.selected_candidate_path === selectedCandidate?.row?.candidate?.path
    && cover.selected_candidate_sha256 === selectedCandidate?.row?.candidate?.sha256
    && cover.byte_identical === true;
  if (!coverShape) issues.push(issue('invalid_wechat_cover_file', 'Final cover record is incomplete or does not bind the selected candidate.'));
  const coverPath = await safeFile(context.root, context.runReal, paths.cover, issues, 'invalid_wechat_cover_file');
  let coverHash = null;
  if (coverPath) {
    coverHash = await fileSha256(coverPath);
    const dimensions = await pngDimensions(coverPath);
    if (coverHash !== cover?.sha256 || dimensions?.width !== 1923 || dimensions?.height !== 818) {
      issues.push(issue('invalid_wechat_cover_dimensions', 'Final cover must be the declared 1923x818 PNG.', { path: paths.cover }));
    }
  }
  if (coverPath && selectedCandidate?.path) {
    const [coverBytes, candidateBytes] = await Promise.all([readFile(coverPath), readFile(selectedCandidate.path)]);
    if (!coverBytes.equals(candidateBytes) || cover?.sha256 !== selectedCandidate.row.candidate.sha256) {
      issues.push(issue('wechat_cover_candidate_mismatch', 'Final cover must be byte-identical to the selected normalized candidate.'));
    }
  }
  validateSelectedQa(generation?.selected_qa, selection, paths, coverHash, issues);
  return { promptPaths, candidatePaths };
}

async function validateResult(result, request, context, paths, requestHash, dynamic, issues) {
  const checks = result?.checks;
  const validChecks = exactKeys(checks, checkKeys) && checks.request_valid === true
    && checks.mode === 'generate_cover' && checks.attempt === paths.attempt
    && checks.platform === 'wechat' && checks.title_status === 'provider_observed_exact'
    && checks.visual_qa_status === 'PASS' && checks.file_verification_status === 'PASS';
  const validTop = exactKeys(result, resultKeys) && result.schema_version === 1
    && result.contract === 'content-production-provider/v1'
    && result.provider_contract === 'wechat-cover-v1' && result.task_id === request?.task_id
    && result.request_sha256 === requestHash && result.status === 'PASS'
    && Array.isArray(result.artifacts) && validChecks
    && isDeepStrictEqual(result.issues, []) && isDeepStrictEqual(result.warnings, []);
  if (!validTop) issues.push(issue('invalid_wechat_cover_result', 'Provider result is not an exact PASS bound to the current request.'));

  const expected = [
    { role: 'cover', path: paths.cover },
    { role: 'cover_metadata', path: paths.metadata },
    { role: 'source', path: paths.source }
  ];
  for (let index = 0; index < dynamic.promptPaths.length; index += 1) {
    expected.push({ role: 'prompt', path: dynamic.promptPaths[index] });
    const candidate = dynamic.candidatePaths.find((path) => path.endsWith(`/attempt-${String(index + 1).padStart(2, '0')}.png`));
    if (candidate) expected.push({ role: 'candidate', path: candidate });
  }
  if (!Array.isArray(result?.artifacts) || result.artifacts.length !== expected.length) {
    issues.push(issue('wechat_cover_result_artifact_mismatch', 'Provider result must list the exact current core and diagnostic artifact set.'));
    return;
  }
  for (const [index, expectedArtifact] of expected.entries()) {
    const artifact = result.artifacts[index];
    if (!exactKeys(artifact, ['role', 'path', 'sha256']) || artifact.role !== expectedArtifact.role
      || artifact.path !== expectedArtifact.path || !SHA256.test(artifact.sha256 || '')) {
      issues.push(issue('wechat_cover_result_artifact_mismatch', `Invalid result artifact at index ${index}.`));
      continue;
    }
    const path = await safeFile(context.root, context.runReal, artifact.path, issues, 'wechat_cover_result_artifact_unsafe');
    if (path && await fileSha256(path) !== artifact.sha256) {
      issues.push(issue('wechat_cover_result_artifact_drift', `Result artifact hash is stale: ${artifact.path}.`, { path: artifact.path }));
    }
  }
}

async function validateCompletedBinding(context, state, paths, issues) {
  if (state?.stages?.visual?.status !== 'completed') return;
  const expected = expectedWechatCoverStageArtifacts(state);
  const bindings = (state.stages.visual.artifacts || []).filter((item) =>
    item?.path === paths.cover || item?.path === paths.metadata);
  if (bindings.length !== expected.length || !expected.every((path) => bindings.some((item) => item.path === path))) {
    issues.push(issue('invalid_wechat_cover_stage_binding', 'Completed visual stage must bind the current cover PNG and cover metadata alongside illustration artifacts.'));
    return;
  }
  for (const value of bindings) {
    const path = await validateBindingFile(context, value, value.path, issues, 'invalid_wechat_cover_stage_binding');
    if (!path) continue;
  }
}

export async function validateWechatCover(runDir, state) {
  const issues = [];
  const context = await loadContext(runDir, state, issues);
  if (!context) return { issues, request: null, result: null, metadata: null };
  const paths = coverPaths(state);
  const winner = await approvedWinner(context, state, issues);
  const requestFile = await safeJson(context.root, context.runReal, paths.request, issues, 'invalid_wechat_cover_request');
  const request = requestFile.value;
  validateRequest(request, context, state, paths, winner, issues);
  const requestHash = requestFile.absolute ? await fileSha256(requestFile.absolute) : null;
  const metadataFile = await safeJson(context.root, context.runReal, paths.metadata, issues, 'invalid_wechat_cover_metadata');
  const dynamic = await validateMetadata(
    metadataFile.value, request, context, state, paths, winner, requestHash, issues
  );
  const resultFile = await safeJson(context.root, context.runReal, paths.result, issues, 'invalid_wechat_cover_result');
  await validateResult(resultFile.value, request, context, paths, requestHash, dynamic, issues);
  await validateCompletedBinding(context, state, paths, issues);
  return { issues, request, result: resultFile.value, metadata: metadataFile.value };
}

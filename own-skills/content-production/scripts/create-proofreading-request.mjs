#!/usr/bin/env node

import { lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { expectedDraftingStageArtifacts, validateDraftingPlatformsStage } from './contracts.mjs';
import {
  emitJson,
  ensureDir,
  expandPath,
  fileExists,
  fileSha256,
  gateIntegrity,
  parseArgs,
  platforms,
  readJson,
  relativeTo,
  variants,
  writeJson
} from './lib.mjs';

const strategies = new Set(['parallel_subagents', 'sequential_fallback']);

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

async function hasSymlinkComponent(root, path, includeLeaf = true) {
  if (!inside(root, path)) return true;
  let current = root;
  const parts = relative(root, path).split(/[\\/]/).filter(Boolean);
  const count = includeLeaf ? parts.length : Math.max(0, parts.length - 1);
  for (const part of parts.slice(0, count)) {
    current = join(current, part);
    if (fileExists(current) && (await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

function add(blockers, code, message, extra = {}) {
  blockers.push({ code, message, resume_from: 'editing', ...extra });
}

function definition(platform, variant) {
  const base = `05-platforms/${platform}/${variant}`;
  return {
    base,
    request: `${base}/reviews/proofreading.request.json`,
    result: `${base}/reviews/proofreading.result.json`,
    expected: [
      `${base}/logic-final.md`, `${base}/humanized.md`, `${base}/final.md`,
      `${base}/reviews/logic.md`, `${base}/reviews/humanize.md`, `${base}/reviews/detail.md`,
      `${base}/reviews/proofread-result.json`
    ]
  };
}

const args = parseArgs(process.argv.slice(2));
const [runInput, ...extraPositionals] = args._;
const blockers = [];

try {
  const allowedOptions = new Set(['_', 'platform', 'variant', 'model', 'parameters_json', 'execution_strategy']);
  const unknownOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
  if (!runInput || extraPositionals.length || unknownOptions.length) {
    throw new Error('Usage: create-proofreading-request.mjs <run-dir> --platform <id> --variant <A|B> [--model id] [--parameters-json json] [--execution-strategy parallel_subagents|sequential_fallback]');
  }
  if (!platforms.includes(args.platform) || !variants.includes(args.variant)) {
    throw new Error('Proofreading requires --platform wechat|xiaohongshu|zhihu|weibo|toutiao and --variant A|B.');
  }
  const executionStrategy = args.execution_strategy || 'parallel_subagents';
  if (!strategies.has(executionStrategy)) throw new Error('Invalid --execution-strategy.');
  const model = typeof args.model === 'string' && args.model.trim() ? args.model.trim() : 'default';
  let parameters = {};
  if (args.parameters_json !== undefined) {
    parameters = JSON.parse(args.parameters_json);
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error('--parameters-json must be a JSON object.');
  }

  const runDir = expandPath(runInput);
  const runStat = await lstat(runDir);
  if (runStat.isSymbolicLink() || !runStat.isDirectory()) throw new Error('run-dir must be a real directory.');
  const runRealDir = await realpath(runDir);
  const statePath = join(runDir, 'run.json');
  if (!fileExists(statePath) || (await lstat(statePath)).isSymbolicLink()
    || await hasSymlinkComponent(runDir, statePath) || !inside(runRealDir, await realpath(statePath))) {
    throw new Error('run.json must be a real file inside run-dir.');
  }
  const state = await readJson(statePath);
  const editing = state.stages?.editing;
  if (state.schema_version !== 2 || state.status !== 'running' || state.current_stage !== 'editing'
    || editing?.status !== 'running' || !Number.isInteger(editing?.attempt) || editing.attempt < 1) {
    add(blockers, 'proofreading_request_stage_mismatch', 'Run editing stage must be running with a positive attempt.', {
      current_stage: state.current_stage,
      stage_status: editing?.status || null,
      stage_attempt: editing?.attempt ?? null
    });
  }
  if (state.capabilities?.providers?.proofreading?.status !== 'PASS'
    || state.capabilities?.providers?.proofreading?.contract !== 'proofreading-v1') {
    add(blockers, 'proofreading_provider_unavailable', 'The proofreading provider snapshot is not PASS for proofreading-v1.');
  }
  if (state.stages?.platforms?.status !== 'completed') {
    add(blockers, 'proofreading_prerequisite_missing', 'Proofreading requires the completed platforms stage.');
  }
  for (const issue of await gateIntegrity(runDir, state)) add(blockers, issue.code, 'An approved artifact changed or disappeared.', issue);

  const platformValidation = await validateDraftingPlatformsStage(runDir, state);
  for (const issue of platformValidation.issues) add(blockers, issue.code, issue.message, issue);
  const expectedPlatformArtifacts = expectedDraftingStageArtifacts('platforms', state);
  const bindings = state.stages?.platforms?.artifacts || [];
  const bindingPaths = bindings.map((item) => item?.path);
  if (bindings.length !== expectedPlatformArtifacts.length || new Set(bindingPaths).size !== expectedPlatformArtifacts.length
    || !expectedPlatformArtifacts.every((path) => bindingPaths.includes(path))) {
    add(blockers, 'invalid_proofreading_platform_binding', 'Completed platforms stage must bind the exact canonical 40-file package.');
  }

  const spec = definition(args.platform, args.variant);
  const draftRelative = `${spec.base}/draft.md`;
  const draftPath = join(runDir, draftRelative);
  const draftBinding = bindings.find((item) => item.path === draftRelative);
  if (!draftBinding || !fileExists(draftPath)) {
    add(blockers, 'missing_proofreading_draft', `Missing bound draft: ${draftRelative}.`, { path: draftRelative });
  } else {
    const stat = await lstat(draftPath);
    const actual = !stat.isSymbolicLink() && stat.isFile() && !await hasSymlinkComponent(runDir, draftPath)
      && inside(runRealDir, await realpath(draftPath)) ? await fileSha256(draftPath) : null;
    if (!actual || actual !== draftBinding.sha256) {
      add(blockers, 'proofreading_draft_binding_drift', `Draft no longer matches the completed platforms binding: ${draftRelative}.`, { path: draftRelative });
    }
  }

  const outputDir = join(runDir, spec.base);
  if (!inside(runDir, outputDir) || (await lstat(outputDir)).isSymbolicLink()
    || await hasSymlinkComponent(runDir, outputDir) || !inside(runRealDir, await realpath(outputDir))) {
    add(blockers, 'proofreading_output_escape', `Output directory is unsafe: ${spec.base}.`);
  }
  const reviewsDir = join(outputDir, 'reviews');
  if (fileExists(reviewsDir) && ((await lstat(reviewsDir)).isSymbolicLink() || await hasSymlinkComponent(runDir, reviewsDir))) {
    add(blockers, 'proofreading_output_symlink', 'Proofreading reviews directory must not be a symlink.');
  }
  const requestPath = join(runDir, spec.request);
  const resultPath = join(runDir, spec.result);
  let unsafeControl = dirname(requestPath) !== reviewsDir || dirname(resultPath) !== reviewsDir;
  for (const path of [requestPath, resultPath]) {
    if (fileExists(path) && (await lstat(path)).isSymbolicLink()) unsafeControl = true;
  }
  if (unsafeControl) {
    add(blockers, 'proofreading_request_path_unsafe', 'Canonical proofreading control path is unsafe.');
  }
  for (const relativePath of spec.expected) {
    const path = join(runDir, relativePath);
    if (!inside(outputDir, path) || fileExists(path) && ((await lstat(path)).isSymbolicLink() || await hasSymlinkComponent(runDir, path))) {
      add(blockers, 'proofreading_artifact_path_unsafe', `Expected artifact path is unsafe: ${relativePath}.`, { path: relativePath });
    }
  }

  if (blockers.length) {
    emitJson({ status: 'BLOCKED', run_dir: runDir, blockers }, 2);
  } else {
    await ensureDir(reviewsDir);
    const input = { role: 'draft', path: draftRelative, sha256: await fileSha256(draftPath) };
    const request = {
      schema_version: 1,
      contract: 'content-production-provider/v1',
      task_id: `proofread:${state.run_id}:${args.platform}:${args.variant}:attempt-${String(editing.attempt).padStart(3, '0')}`,
      capability: 'proofreading',
      provider_contract: 'proofreading-v1',
      run_dir: runDir,
      run_mode: state.run_mode,
      mode: 'proofread',
      platform: args.platform,
      variant: args.variant,
      inputs: [input],
      output_dir: spec.base,
      expected_artifacts: spec.expected,
      options: { execution_strategy: executionStrategy, model, parameters },
      interaction_policy: 'return_to_orchestrator'
    };
    await writeJson(requestPath, request);
    emitJson({ status: 'PASS', task_id: request.task_id, request_path: requestPath, input_count: 1 });
  }
} catch (error) {
  emitJson({ status: 'BLOCKED', blockers: [{ code: 'proofreading_request_build_failed', message: error.message, resume_from: 'editing' }] }, 2);
}

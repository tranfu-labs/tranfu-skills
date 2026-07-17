#!/usr/bin/env node

import { lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { expectedProofreadingStageArtifacts, validateProofreadingStage } from './contracts.mjs';
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
  titleCounts,
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
  blockers.push({ code, message, resume_from: 'titles', ...extra });
}

function definition(platform, variant) {
  const base = `06-selection/providers/${platform}/${variant}`;
  return {
    base,
    request: `${base}/title-generation.request.json`,
    result: `${base}/title-generation.result.json`,
    expected: [`${base}/candidates.json`]
  };
}

const args = parseArgs(process.argv.slice(2));
const [runInput, ...extraPositionals] = args._;
const blockers = [];

try {
  const allowedOptions = new Set(['_', 'platform', 'variant', 'model', 'parameters_json', 'execution_strategy']);
  const unknownOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
  if (!runInput || extraPositionals.length || unknownOptions.length) {
    throw new Error('Usage: create-title-request.mjs <run-dir> --platform <id> --variant <A|B> [--model id] [--parameters-json json] [--execution-strategy parallel_subagents|sequential_fallback]');
  }
  if (!platforms.includes(args.platform) || !variants.includes(args.variant)) {
    throw new Error('Title generation requires --platform wechat|xiaohongshu|zhihu|weibo|toutiao and --variant A|B.');
  }
  const executionStrategy = args.execution_strategy || 'parallel_subagents';
  if (!strategies.has(executionStrategy)) throw new Error('Invalid --execution-strategy.');
  const model = typeof args.model === 'string' && args.model.trim() ? args.model.trim() : 'default';
  let parameters = {};
  if (args.parameters_json !== undefined) {
    parameters = JSON.parse(args.parameters_json);
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
      throw new Error('--parameters-json must be a JSON object.');
    }
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
  const titles = state.stages?.titles;
  if (state.schema_version !== 2 || state.status !== 'running' || state.current_stage !== 'titles'
    || titles?.status !== 'running' || !Number.isInteger(titles?.attempt) || titles.attempt < 1) {
    add(blockers, 'title_request_stage_mismatch', 'Run titles stage must be running with a positive attempt.', {
      current_stage: state.current_stage,
      stage_status: titles?.status || null,
      stage_attempt: titles?.attempt ?? null
    });
  }
  if (state.capabilities?.providers?.title_generation?.status !== 'PASS'
    || state.capabilities?.providers?.title_generation?.contract !== 'title-generation-v1') {
    add(blockers, 'title_provider_unavailable', 'The title provider snapshot is not PASS for title-generation-v1.');
  }
  if (state.stages?.editing?.status !== 'completed') {
    add(blockers, 'title_prerequisite_missing', 'Title generation requires the completed editing stage.');
  }
  for (const issue of await gateIntegrity(runDir, state)) {
    add(blockers, issue.code, 'An approved artifact changed or disappeared.', issue);
  }

  const expectedEditing = expectedProofreadingStageArtifacts();
  const editingBindings = state.stages?.editing?.artifacts || [];
  const editingPaths = editingBindings.map((item) => item?.path);
  if (editingBindings.length !== expectedEditing.length || new Set(editingPaths).size !== expectedEditing.length
    || !expectedEditing.every((path) => editingPaths.includes(path))) {
    add(blockers, 'invalid_title_editing_binding', 'Completed editing stage must bind the exact canonical 90-file package.');
  }
  if (state.stages?.editing?.status === 'completed') {
    const editingValidation = await validateProofreadingStage(runDir, state);
    for (const issue of editingValidation.issues) add(blockers, issue.code, issue.message, issue);
  }

  const spec = definition(args.platform, args.variant);
  const sourceRelative = `05-platforms/${args.platform}/${args.variant}/final.md`;
  const sourcePath = join(runDir, sourceRelative);
  const sourceBinding = editingBindings.find((item) => item?.path === sourceRelative);
  if (!sourceBinding || !fileExists(sourcePath)) {
    add(blockers, 'missing_title_source', `Missing bound final draft: ${sourceRelative}.`, { path: sourceRelative });
  } else {
    const stat = await lstat(sourcePath);
    const actual = !stat.isSymbolicLink() && stat.isFile() && !await hasSymlinkComponent(runDir, sourcePath)
      && inside(runRealDir, await realpath(sourcePath)) ? await fileSha256(sourcePath) : null;
    if (!actual || actual !== sourceBinding.sha256) {
      add(blockers, 'title_source_binding_drift', `Final draft no longer matches the completed editing binding: ${sourceRelative}.`, { path: sourceRelative });
    }
  }

  const selectionDir = join(runDir, '06-selection');
  if (!fileExists(selectionDir) || (await lstat(selectionDir)).isSymbolicLink()
    || !(await lstat(selectionDir)).isDirectory() || await hasSymlinkComponent(runDir, selectionDir)
    || !inside(runRealDir, await realpath(selectionDir))) {
    add(blockers, 'title_output_escape', '06-selection must be a real directory inside run-dir.');
  }
  const outputDir = join(runDir, spec.base);
  if (!inside(selectionDir, outputDir) || await hasSymlinkComponent(runDir, outputDir)) {
    add(blockers, 'title_output_escape', `Output directory is unsafe: ${spec.base}.`);
  } else if (!blockers.length) {
    await ensureDir(outputDir);
    const outputStat = await lstat(outputDir);
    if (outputStat.isSymbolicLink() || !outputStat.isDirectory()
      || await hasSymlinkComponent(runDir, outputDir) || !inside(runRealDir, await realpath(outputDir))) {
      add(blockers, 'title_output_escape', `Output directory is unsafe: ${spec.base}.`);
    }
  }

  const requestPath = join(runDir, spec.request);
  const resultPath = join(runDir, spec.result);
  let unsafeControl = dirname(requestPath) !== outputDir || dirname(resultPath) !== outputDir;
  for (const path of [requestPath, resultPath]) {
    if (fileExists(path) && ((await lstat(path)).isSymbolicLink() || await hasSymlinkComponent(runDir, path))) {
      unsafeControl = true;
    }
  }
  if (unsafeControl) add(blockers, 'title_request_path_unsafe', 'Canonical title control path is unsafe.');
  for (const relativePath of spec.expected) {
    const path = join(runDir, relativePath);
    if (!inside(outputDir, path) || fileExists(path) && ((await lstat(path)).isSymbolicLink()
      || await hasSymlinkComponent(runDir, path))) {
      add(blockers, 'title_artifact_path_unsafe', `Expected artifact path is unsafe: ${relativePath}.`, { path: relativePath });
    }
  }

  if (blockers.length) {
    emitJson({ status: 'BLOCKED', run_dir: runDir, blockers }, 2);
  } else {
    const input = { role: 'final_draft', path: sourceRelative, sha256: await fileSha256(sourcePath) };
    const request = {
      schema_version: 1,
      contract: 'content-production-provider/v1',
      task_id: `title:${state.run_id}:${args.platform}:${args.variant}:attempt-${String(titles.attempt).padStart(3, '0')}`,
      capability: 'title_generation',
      provider_contract: 'title-generation-v1',
      run_dir: runDir,
      run_mode: state.run_mode,
      mode: 'generate_titles',
      platform: args.platform,
      variant: args.variant,
      inputs: [input],
      output_dir: spec.base,
      expected_artifacts: spec.expected,
      options: {
        count: titleCounts[args.platform],
        language: 'zh-CN',
        titles_only: true,
        old_title: null,
        brand_reference: null,
        verification_scope: 'none',
        execution_strategy: executionStrategy,
        model,
        parameters
      },
      interaction_policy: 'return_to_orchestrator'
    };
    await writeJson(requestPath, request);
    emitJson({
      status: 'PASS',
      task_id: request.task_id,
      request_path: requestPath,
      input_count: 1,
      target_count: request.options.count
    });
  }
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    blockers: [{ code: 'title_request_build_failed', message: error.message, resume_from: 'titles' }]
  }, 2);
}

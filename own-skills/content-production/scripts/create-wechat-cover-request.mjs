#!/usr/bin/env node

import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
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
  writeJson
} from './lib.mjs';

const backendHints = new Set(['runtime-native', 'configured-api', 'programmatic', 'unknown']);

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..'
    && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
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
  blockers.push({ code, message, resume_from: 'visual', ...extra });
}

function coverPaths(attempt) {
  const version = `v${String(attempt).padStart(3, '0')}`;
  const suffix = attempt === 1 ? '' : `.${version}`;
  const base = '07-visual/wechat-cover';
  return {
    base,
    request: `${base}/wechat-cover${suffix}.request.json`,
    result: `${base}/wechat-cover${suffix}.result.json`,
    cover: `${base}/cover${suffix}.png`,
    metadata: `${base}/cover${suffix}.json`
  };
}

function validTitle(title) {
  const count = typeof title === 'string' ? [...title.replace(/\s/gu, '')].length : 0;
  return typeof title === 'string' && title === title.trim() && Boolean(title)
    && /[\u3400-\u9fff]/u.test(title)
    && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(title)
    && count >= 2 && count <= 35;
}

const args = parseArgs(process.argv.slice(2));
const [runInput, ...extraPositionals] = args._;
const blockers = [];

try {
  const allowedOptions = new Set(['_', 'backend_hint']);
  const unknownOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
  if (!runInput || extraPositionals.length || unknownOptions.length) {
    throw new Error('Usage: create-wechat-cover-request.mjs <run-dir> [--backend-hint runtime-native|configured-api|programmatic|unknown]');
  }
  const backendHint = args.backend_hint || 'unknown';
  if (!backendHints.has(backendHint)) throw new Error('--backend-hint is invalid.');

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
  const visual = state.stages?.visual;
  if (state.schema_version !== 2 || state.status !== 'running' || state.current_stage !== 'visual'
    || visual?.status !== 'running' || !Number.isInteger(visual?.attempt) || visual.attempt < 1) {
    add(blockers, 'wechat_cover_stage_mismatch', 'Run visual stage must be running with a positive attempt.');
  }
  if (state.gates?.titles?.status !== 'approved') {
    add(blockers, 'wechat_cover_titles_gate_missing', 'WeChat cover generation requires the approved titles gate.');
  }
  if (state.gates?.visual?.status !== 'approved') {
    add(blockers, 'wechat_cover_visual_gate_missing', 'WeChat cover generation starts only after the current visual plans are approved.');
  }
  if (state.capabilities?.providers?.wechat_cover?.status !== 'PASS'
    || state.capabilities?.providers?.wechat_cover?.contract !== 'wechat-cover-v1') {
    add(blockers, 'wechat_cover_provider_unavailable', 'The WeChat cover provider snapshot is not PASS for wechat-cover-v1.');
  }
  for (const issue of await gateIntegrity(runDir, state)) {
    add(blockers, issue.code, 'An approved artifact changed or disappeared.', issue);
  }

  const decisionBinding = state.gates?.titles?.decision_ref;
  const decisionRelative = decisionBinding?.path;
  const decisionPath = decisionRelative ? resolve(runDir, decisionRelative) : null;
  let decision = null;
  if (!decisionPath || !inside(runDir, decisionPath) || !fileExists(decisionPath)
    || (await lstat(decisionPath)).isSymbolicLink() || await hasSymlinkComponent(runDir, decisionPath)
    || !inside(runRealDir, await realpath(decisionPath))
    || await fileSha256(decisionPath) !== decisionBinding.sha256) {
    add(blockers, 'invalid_wechat_cover_selection_decision', 'Titles gate must bind one current real selection decision.');
  } else {
    decision = await readJson(decisionPath);
  }
  const selections = Array.isArray(decision?.selections) ? decision.selections : [];
  const selectedPlatforms = selections.map((item) => item?.platform);
  if (selections.length !== platforms.length || new Set(selectedPlatforms).size !== platforms.length
    || !platforms.every((platform) => selectedPlatforms.includes(platform))) {
    add(blockers, 'invalid_wechat_cover_selections', 'Approved title decision must contain exactly one winner for every platform.');
  }
  const selection = selections.find((item) => item?.platform === 'wechat') || null;
  if (!validTitle(selection?.title)) {
    add(blockers, 'wechat_cover_title_unsupported', 'Selected WeChat title must contain Han text, be one clean line, and contain 2-35 non-whitespace characters.');
  }
  const sourcePath = selection?.draft_path ? resolve(runDir, selection.draft_path) : null;
  if (!selection || !['A', 'B'].includes(selection.variant)
    || selection.draft_path !== `05-platforms/wechat/${selection.variant}/final.md`
    || !sourcePath || !inside(runDir, sourcePath) || !fileExists(sourcePath)
    || (await lstat(sourcePath)).isSymbolicLink() || await hasSymlinkComponent(runDir, sourcePath)
    || !inside(runRealDir, await realpath(sourcePath))
    || !/^[a-f0-9]{64}$/.test(selection.draft_sha256 || '')
    || await fileSha256(sourcePath) !== selection.draft_sha256) {
    add(blockers, 'wechat_cover_selection_drift', 'Approved WeChat winner is missing or stale.');
  }

  const attempt = visual?.attempt || 1;
  const paths = coverPaths(attempt);
  const outputDir = resolve(runDir, paths.base);
  if (!inside(runDir, outputDir) || await hasSymlinkComponent(runDir, outputDir, false)) {
    add(blockers, 'wechat_cover_output_escape', `Unsafe WeChat cover output directory: ${paths.base}.`);
  } else if (!blockers.length) {
    await ensureDir(outputDir);
    if ((await lstat(outputDir)).isSymbolicLink() || !inside(runRealDir, await realpath(outputDir))) {
      add(blockers, 'wechat_cover_output_escape', `Unsafe WeChat cover output directory: ${paths.base}.`);
    }
  }
  for (const relativePath of [paths.request, paths.result, paths.cover, paths.metadata]) {
    const path = resolve(runDir, relativePath);
    if (!inside(outputDir, path) || await hasSymlinkComponent(runDir, path, false)
      || fileExists(path) && (await lstat(path)).isSymbolicLink()) {
      add(blockers, 'wechat_cover_artifact_path_unsafe', `Unsafe WeChat cover artifact path: ${relativePath}.`, { path: relativePath });
    }
  }

  if (blockers.length) {
    emitJson({ status: 'BLOCKED', run_dir: runDir, blockers }, 2);
  } else {
    const request = {
      schema_version: 1,
      contract: 'content-production-provider/v1',
      task_id: `wechat-cover:${state.run_id}:wechat:${selection.variant}:attempt-${String(attempt).padStart(3, '0')}`,
      capability: 'wechat_cover',
      provider_contract: 'wechat-cover-v1',
      run_dir: runDir,
      run_mode: state.run_mode,
      mode: 'generate_cover',
      attempt,
      platform: 'wechat',
      variant: selection.variant,
      selection,
      inputs: [
        { role: 'final_draft', path: selection.draft_path, sha256: selection.draft_sha256 },
        { role: 'title_selection', path: decisionRelative, sha256: decisionBinding.sha256 }
      ],
      output_dir: paths.base,
      expected_artifacts: [paths.cover, paths.metadata],
      options: {
        width: 1923,
        height: 818,
        format: 'png',
        style_id: 'warm-hand-drawn-notebook-v1',
        exact_title_required: true,
        best_effort_allowed: false,
        max_attempts: 3,
        backend_hint: backendHint,
        execution_strategy: 'one_candidate_at_a_time'
      },
      interaction_policy: 'return_to_orchestrator'
    };
    const requestPath = resolve(runDir, paths.request);
    if (fileExists(requestPath)) {
      const existing = await readJson(requestPath);
      if (JSON.stringify(existing) !== JSON.stringify(request)) {
        throw new Error(`Refusing to overwrite a different current-attempt request: ${paths.request}`);
      }
    } else {
      if ([paths.result, paths.cover, paths.metadata].some((path) => fileExists(join(runDir, path)))) {
        throw new Error('Current-attempt cover outputs exist without their canonical request; reopen visual to create a new attempt.');
      }
      await writeJson(requestPath, request);
    }
    emitJson({
      status: 'PASS',
      task_id: request.task_id,
      request_path: requestPath,
      expected_artifact_count: request.expected_artifacts.length
    });
  }
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    blockers: [{ code: 'wechat_cover_request_build_failed', message: error.message, resume_from: 'visual' }]
  }, 2);
}

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

const modes = new Set(['plan', 'generate']);
const backendHints = new Set(['runtime-native', 'configured-api', 'unknown']);
const brandOverrides = new Set(['enabled', 'disabled']);
const providerPlatform = { xiaohongshu: 'xhs' };
const requestedOutput = {
  wechat: 'body_illustrations',
  xiaohongshu: 'carousel',
  zhihu: 'post_illustrations',
  weibo: 'post_illustrations',
  toutiao: 'post_illustrations'
};

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

function attemptNames(attempt, platform) {
  const version = `v${String(attempt).padStart(3, '0')}`;
  const suffix = attempt === 1 ? '' : `.${version}`;
  const base = `07-visual/${platform}`;
  return {
    base,
    version,
    plan: `${base}/plan${suffix}.json`,
    shotList: `${base}/shot-list${suffix}.md`,
    bundle: `${base}/bundle${suffix}.json`,
    manifest: `${base}/manifest${suffix}.md`,
    planRequest: `${base}/illustration-plan${suffix}.request.json`,
    planResult: `${base}/illustration-plan${suffix}.result.json`,
    generateRequest: `${base}/illustration-generate${suffix}.request.json`,
    generateResult: `${base}/illustration-generate${suffix}.result.json`,
    versionDir: attempt === 1 ? '' : version
  };
}

function imageExtension(format) {
  if (format === 'png') return 'png';
  if (format === 'jpeg' || format === 'jpg') return 'jpg';
  return null;
}

function generateArtifacts(paths, plan) {
  const ids = Array.isArray(plan?.anchors) ? plan.anchors.map((item) => item?.image_id) : [];
  if (!ids.length || new Set(ids).size !== ids.length
    || ids.some((id) => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id))) {
    throw new Error('Approved illustration plan must contain unique filesystem-safe image IDs.');
  }
  if (plan.image_count !== ids.length || plan.status !== 'READY' || plan.residual_risk !== 'none') {
    throw new Error('Approved illustration plan is not READY or its image_count is inconsistent.');
  }
  const extension = imageExtension(plan.generation_backend?.artifact_format);
  if (!extension) throw new Error('Approved illustration plan has an unsupported backend artifact format.');
  if (plan.brand?.enabled === true && extension !== 'png') {
    throw new Error('Brand overlay requires a PNG generation artifact.');
  }
  if (typeof plan.brand?.enabled !== 'boolean') throw new Error('Approved illustration plan must resolve brand.enabled.');
  const nested = (root, id) => `${paths.base}/${root}/${paths.versionDir ? `${paths.versionDir}/` : ''}${id}.${extension}`;
  const prompts = ids.map((id) => `${paths.base}/prompts/${paths.versionDir ? `${paths.versionDir}/` : ''}${id}.md`);
  const sources = plan.brand.enabled ? ids.map((id) => nested('images/unbranded', id)) : [];
  const deliveries = ids.map((id) => plan.brand.enabled
    ? nested('images/branded', id)
    : nested('images', id));
  return [paths.bundle, paths.manifest, ...prompts, ...sources, ...deliveries];
}

const args = parseArgs(process.argv.slice(2));
const [runInput, mode, ...extraPositionals] = args._;
const blockers = [];

try {
  const allowedOptions = new Set([
    '_', 'platform', 'style_id', 'max_images', 'brand_override', 'backend_hint', 'model_preference'
  ]);
  const unknownOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
  if (!runInput || !modes.has(mode) || extraPositionals.length || unknownOptions.length) {
    throw new Error('Usage: create-illustration-request.mjs <run-dir> <plan|generate> --platform <id> [--style-id id] [--max-images N] [--brand-override enabled|disabled] [--backend-hint runtime-native|configured-api|unknown] [--model-preference id]');
  }
  if (!platforms.includes(args.platform)) {
    throw new Error('Illustration requires --platform wechat|xiaohongshu|zhihu|weibo|toutiao.');
  }
  const styleId = typeof args.style_id === 'string' && args.style_id.trim() ? args.style_id.trim() : null;
  const maxImages = args.max_images === undefined ? null : Number(args.max_images);
  if (maxImages !== null && (!Number.isInteger(maxImages) || maxImages < 1)) throw new Error('--max-images must be a positive integer.');
  const brandOverride = args.brand_override === undefined ? null : args.brand_override;
  if (brandOverride !== null && !brandOverrides.has(brandOverride)) throw new Error('--brand-override must be enabled or disabled.');
  const backendHint = args.backend_hint || 'unknown';
  if (!backendHints.has(backendHint)) throw new Error('--backend-hint is invalid.');
  const modelPreference = typeof args.model_preference === 'string' && args.model_preference.trim()
    ? args.model_preference.trim() : null;

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
    add(blockers, 'illustration_request_stage_mismatch', 'Run visual stage must be running with a positive attempt.');
  }
  if (state.gates?.titles?.status !== 'approved') {
    add(blockers, 'illustration_titles_gate_missing', 'Illustration requires an approved titles gate.');
  }
  if (state.capabilities?.providers?.illustration?.status !== 'PASS'
    || state.capabilities?.providers?.illustration?.contract !== 'illustration-v1') {
    add(blockers, 'illustration_provider_unavailable', 'The illustration provider snapshot is not PASS for illustration-v1.');
  }
  for (const issue of await gateIntegrity(runDir, state)) add(blockers, issue.code, 'An approved artifact changed or disappeared.', issue);
  if (mode === 'plan' && state.gates?.visual?.status === 'approved') {
    add(blockers, 'illustration_plan_already_approved', 'Reopen visual before replacing an approved illustration plan.');
  }
  if (mode === 'generate' && state.gates?.visual?.status !== 'approved') {
    add(blockers, 'illustration_plan_not_approved', 'Generate mode requires the current visual plan gate to be approved.');
  }

  const decisionBinding = state.gates?.titles?.decision_ref;
  const decisionRelative = decisionBinding?.path;
  const decisionPath = decisionRelative ? resolve(runDir, decisionRelative) : null;
  let decision = null;
  if (!decisionPath || !inside(runDir, decisionPath) || !fileExists(decisionPath)
    || (await lstat(decisionPath)).isSymbolicLink() || await hasSymlinkComponent(runDir, decisionPath)
    || !inside(runRealDir, await realpath(decisionPath))
    || await fileSha256(decisionPath) !== decisionBinding.sha256) {
    add(blockers, 'invalid_illustration_selection_decision', 'Titles gate must bind one current real selection decision.');
  } else {
    decision = await readJson(decisionPath);
  }
  const selections = Array.isArray(decision?.selections) ? decision.selections : [];
  const selectedPlatforms = selections.map((item) => item?.platform);
  if (selections.length !== platforms.length || new Set(selectedPlatforms).size !== platforms.length
    || !platforms.every((platform) => selectedPlatforms.includes(platform))) {
    add(blockers, 'invalid_illustration_selections', 'Approved title decision must contain exactly one winner for each platform.');
  }
  const selection = selections.find((item) => item?.platform === args.platform) || null;
  const sourcePath = selection?.draft_path ? resolve(runDir, selection.draft_path) : null;
  if (!selection || !['A', 'B'].includes(selection.variant)
    || selection.draft_path !== `05-platforms/${args.platform}/${selection.variant}/final.md`
    || !sourcePath || !inside(runDir, sourcePath) || !fileExists(sourcePath)
    || (await lstat(sourcePath)).isSymbolicLink() || await hasSymlinkComponent(runDir, sourcePath)
    || !inside(runRealDir, await realpath(sourcePath))
    || !/^[a-f0-9]{64}$/.test(selection.draft_sha256 || '')
    || await fileSha256(sourcePath) !== selection.draft_sha256) {
    add(blockers, 'illustration_selection_drift', `Approved ${args.platform} winner is missing or stale.`);
  }

  const attempt = visual?.attempt || 1;
  const paths = attemptNames(attempt, args.platform);
  const outputDir = resolve(runDir, paths.base);
  if (!inside(runDir, outputDir) || await hasSymlinkComponent(runDir, outputDir, false)) {
    add(blockers, 'illustration_output_escape', `Unsafe illustration output directory: ${paths.base}.`);
  } else if (!blockers.length) {
    await ensureDir(outputDir);
    if ((await lstat(outputDir)).isSymbolicLink() || !inside(runRealDir, await realpath(outputDir))) {
      add(blockers, 'illustration_output_escape', `Unsafe illustration output directory: ${paths.base}.`);
    }
  }

  let expectedArtifacts = mode === 'plan' ? [paths.plan, paths.shotList] : [];
  let plan = null;
  if (mode === 'generate' && !blockers.length) {
    const approved = new Map((state.gates.visual.bound_artifacts || []).map((item) => [item.path, item.sha256]));
    if (!approved.has(paths.plan) || !approved.has(paths.shotList)
      || !fileExists(join(runDir, paths.plan)) || !fileExists(join(runDir, paths.shotList))
      || approved.get(paths.plan) !== await fileSha256(join(runDir, paths.plan))
      || approved.get(paths.shotList) !== await fileSha256(join(runDir, paths.shotList))) {
      add(blockers, 'illustration_plan_binding_invalid', 'Visual gate must bind the current attempt plan and shot list for this platform.');
    } else {
      plan = await readJson(join(runDir, paths.plan));
      try { expectedArtifacts = generateArtifacts(paths, plan); } catch (error) {
        add(blockers, 'invalid_illustration_plan', error.message);
      }
    }
  }

  const requestRelative = mode === 'plan' ? paths.planRequest : paths.generateRequest;
  const resultRelative = mode === 'plan' ? paths.planResult : paths.generateResult;
  const requestPath = resolve(runDir, requestRelative);
  const resultPath = resolve(runDir, resultRelative);
  for (const path of [requestPath, resultPath, ...expectedArtifacts.map((item) => resolve(runDir, item))]) {
    if (!inside(outputDir, path) || await hasSymlinkComponent(runDir, path, false)
      || fileExists(path) && (await lstat(path)).isSymbolicLink()) {
      add(blockers, 'illustration_artifact_path_unsafe', `Unsafe illustration artifact path: ${relative(runDir, path)}.`);
    }
  }

  if (blockers.length) {
    emitJson({ status: 'BLOCKED', run_dir: runDir, blockers }, 2);
  } else {
    const inputs = [
      { role: 'final_draft', path: selection.draft_path, sha256: selection.draft_sha256 },
      { role: 'title_selection', path: decisionRelative, sha256: decisionBinding.sha256 }
    ];
    if (mode === 'generate') {
      inputs.push(
        { role: 'illustration_plan', path: paths.plan, sha256: await fileSha256(join(runDir, paths.plan)) },
        { role: 'shot_list', path: paths.shotList, sha256: await fileSha256(join(runDir, paths.shotList)) }
      );
    }
    const request = {
      schema_version: 1,
      contract: 'content-production-provider/v1',
      task_id: `illustration:${state.run_id}:${args.platform}:${selection.variant}:${mode}:attempt-${String(attempt).padStart(3, '0')}`,
      capability: 'illustration',
      provider_contract: 'illustration-v1',
      run_dir: runDir,
      run_mode: state.run_mode,
      mode,
      attempt,
      platform: args.platform,
      provider_platform: providerPlatform[args.platform] || args.platform,
      variant: selection.variant,
      selection,
      inputs,
      output_dir: paths.base,
      expected_artifacts: expectedArtifacts,
      options: mode === 'generate' ? plan.options : {
        requested_output: requestedOutput[args.platform],
        publishing_path: null,
        style_id: styleId,
        max_images: maxImages,
        brand_override: brandOverride,
        backend_hint: backendHint,
        model_preference: modelPreference,
        execution_strategy: 'one_image_at_a_time'
      },
      interaction_policy: 'return_to_orchestrator'
    };
    if (fileExists(requestPath)) {
      const existing = await readJson(requestPath);
      if (JSON.stringify(existing) !== JSON.stringify(request)) {
        throw new Error(`Refusing to overwrite a different current-attempt request: ${requestRelative}`);
      }
    } else {
      if (fileExists(resultPath) || expectedArtifacts.some((path) => fileExists(join(runDir, path)))) {
        throw new Error('Current-attempt provider outputs exist without their canonical request; reopen visual to create a new attempt.');
      }
      await writeJson(requestPath, request);
    }
    emitJson({
      status: 'PASS',
      mode,
      task_id: request.task_id,
      request_path: requestPath,
      expected_artifact_count: expectedArtifacts.length
    });
  }
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    blockers: [{ code: 'illustration_request_build_failed', message: error.message, resume_from: 'visual' }]
  }, 2);
}

#!/usr/bin/env node

import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  emitJson,
  ensureDir,
  expandPath,
  fileExists,
  fileSha256,
  parseArgs,
  platforms,
  readJson,
  skillDir,
  writeJson,
  writeText
} from './lib.mjs';
import { illustrationPaths, validateIllustrationPlans } from './illustration-contracts.mjs';
import { validateCurrentVisualDecision } from './visual-cardinality.mjs';
import { bodyVisualAttempt } from './visual-state.mjs';
import {
  createReuseFingerprint,
  createReuseInputSha256,
  selectReusableSuite,
  validReuseFingerprint
} from './visual-reuse.mjs';

const args = parseArgs(process.argv.slice(2));
const [runInput, command, ...extra] = args._;
const retryableIssues = new Set([
  'illustration_candidate_geometry', 'illustration_candidate_qa', 'illustration_candidate_text'
]);
const globalLimit = 4;
const suiteLimit = 2;
const generationTtlMs = 60 * 60 * 1000;
const setQaTtlMs = 30 * 60 * 1000;

function issue(code, message, extraValue = {}) {
  return { code, message, resume_from: 'visual', ...extraValue };
}

function queuePath(state) {
  const attempt = bodyVisualAttempt(state);
  return `07-visual/generation-queue${attempt === 1 ? '' : `.v${String(attempt).padStart(3, '0')}`}.json`;
}

function queuePathForAttempt(attempt) {
  return `07-visual/generation-queue${attempt === 1 ? '' : `.v${String(attempt).padStart(3, '0')}`}.json`;
}

function versionPart(attempt) {
  return attempt === 1 ? '' : `/v${String(attempt).padStart(3, '0')}`;
}

function childPaths(state, platform, imageId, candidateAttempt, format, brandEnabled) {
  const visualVersion = versionPart(bodyVisualAttempt(state));
  const number = String(candidateAttempt).padStart(2, '0');
  const extension = format === 'png' ? 'png' : 'jpg';
  const control = `07-visual/${platform}/children${visualVersion}/${imageId}/attempt-${number}`;
  const prompt = `07-visual/${platform}/prompts${visualVersion}/${imageId}/attempt-${number}.md`;
  const source = brandEnabled
    ? `07-visual/${platform}/images/unbranded${visualVersion}/${imageId}/attempt-${number}.${extension}`
    : `07-visual/${platform}/images${visualVersion}/${imageId}/attempt-${number}.${extension}`;
  const delivery = brandEnabled
    ? `07-visual/${platform}/images/branded${visualVersion}/${imageId}/attempt-${number}.${extension}`
    : source;
  return {
    control,
    request: `${control}/request.json`,
    result: `${control}/result.json`,
    qa: `${control}/qa.json`,
    prompt,
    source,
    delivery
  };
}

function setQaPaths(state, platform, round) {
  const visualVersion = versionPart(bodyVisualAttempt(state));
  const number = String(round).padStart(2, '0');
  const control = `07-visual/${platform}/set-qa${visualVersion}/round-${number}`;
  return {
    request: `${control}/request.json`,
    review: `${control}/review.json`,
    result: `${control}/result.json`
  };
}

const illustrationSkillRoot = join(skillDir, 'skills', 'post-illustration-images');

async function reuseInputs(runDir, parent, plan, anchor) {
  const styleFile = join(illustrationSkillRoot, plan.style.style_file);
  const styleSpec = join(illustrationSkillRoot, plan.style.style_spec);
  const styleReference = join(illustrationSkillRoot, plan.style.style_reference);
  const promptCompiler = join(illustrationSkillRoot, 'scripts', 'compile-generation-prompt.mjs');
  const brandRenderer = join(illustrationSkillRoot, 'scripts', 'apply-brand-overlay.mjs');
  const brandAsset = join(illustrationSkillRoot, 'assets', 'brand', 'tranfu-logo-reference.svg');
  const backendProfile = join(runDir, '07-visual', 'backend-profile.json');
  const input = (role) => parent.inputs.find((item) => item.role === role);
  const coverageBinding = input('visual_coverage');
  const coverage = await readJson(join(runDir, coverageBinding.path));
  const coverageUnit = coverage.coverage_units.find((unit) =>
    unit.eligible && unit.source_excerpt === anchor.source_excerpt);
  if (!coverageUnit) throw new Error(`No stable coverage unit matches ${anchor.image_id}.`);
  return {
    draft: input('final_draft'),
    title_selection: input('title_selection'),
    coverage_anchor: {
      coverage: {
        source: coverage.source,
        title_selection: coverage.title_selection,
        platform_profile: coverage.platform_profile,
        requested_output: coverage.requested_output,
        strategy: coverage.strategy,
        user_directive: coverage.user_directive,
        document_metrics: coverage.document_metrics,
        cardinality: coverage.cardinality,
        single_image_exception: coverage.single_image_exception,
        unit: coverageUnit
      },
      anchor
    },
    style: {
      ...plan.style,
      style_sha256: await fileSha256(styleFile),
      spec_sha256: await fileSha256(styleSpec),
      reference_sha256: await fileSha256(styleReference)
    },
    text_content: anchor.text_content,
    brand: {
      ...plan.brand,
      renderer_sha256: await fileSha256(brandRenderer),
      asset_sha256: await fileSha256(brandAsset)
    },
    backend_profile: { path: '07-visual/backend-profile.json', sha256: await fileSha256(backendProfile) },
    geometry: plan.generation_geometry,
    prompt_compiler: { id: 'deterministic-v1', sha256: await fileSha256(promptCompiler) }
  };
}

async function previousSuiteForReuse(runDir, queue, platform) {
  const suite = queue?.suites?.[platform];
  if (!suite) return null;
  const children = {};
  let bundle = null;
  if (suite.aggregate?.bundle?.path && fileExists(join(runDir, suite.aggregate.bundle.path))) {
    try { bundle = await readJson(join(runDir, suite.aggregate.bundle.path)); } catch { bundle = null; }
  }
  for (const imageId of suite.image_order || []) {
    const child = suite.children?.[imageId];
    const row = child?.selected_attempt === null
      ? child?.reuse : child?.attempts?.find((item) => item.attempt === child.selected_attempt);
    const fingerprint = row?.reuse_fingerprint || row?.fingerprint;
    const requestPath = row?.request_path;
    const resultPath = row?.result_path || row?.result?.path;
    if (!validReuseFingerprint(fingerprint) || !requestPath || !resultPath
      || !fileExists(join(runDir, requestPath)) || !fileExists(join(runDir, resultPath))) continue;
    const [request, result] = await Promise.all([
      readJson(join(runDir, requestPath)), readJson(join(runDir, resultPath))
    ]);
    const qaPath = request.artifacts?.qa;
    const delivery = result.image?.delivery;
    if (!qaPath || !delivery?.path || !fileExists(join(runDir, qaPath))
      || !fileExists(join(runDir, delivery.path))) continue;
    children[imageId] = {
      attempt: row.attempt || result.image?.selected_attempt,
      request_path: requestPath,
      result_path: resultPath,
      result_sha256: await fileSha256(join(runDir, resultPath)),
      result: { path: resultPath, sha256: await fileSha256(join(runDir, resultPath)) },
      image: { path: delivery.path, sha256: await fileSha256(join(runDir, delivery.path)) },
      qa: { path: qaPath, sha256: await fileSha256(join(runDir, qaPath)) },
      geometry_attempts: bundle?.images?.find((item) => item.image_id === imageId)?.geometry_attempts || [],
      completed_at: row.completed_at,
      fingerprint,
      text_policy: 'allowlist',
      source_body_attempt: queue.body_attempt
    };
  }
  return {
    children,
    bundle: suite.aggregate?.bundle || null,
    manifest: suite.aggregate?.manifest || null,
    set_qa_result: suite.aggregate?.set_qa_result || null,
    set_qa_review: suite.aggregate?.set_qa_review || null,
    set_qa_request: suite.set_qa_rounds?.find((row) => row.status === 'pass')?.request_path
      ? { path: suite.set_qa_rounds.find((row) => row.status === 'pass').request_path }
      : null,
    source_body_attempt: queue.body_attempt
  };
}

async function selectPriorReuse(runDir, currentAttempt, platform, currentChildren) {
  const partial = { children: {} };
  for (let attempt = currentAttempt - 1; attempt >= 1; attempt -= 1) {
    const path = join(runDir, queuePathForAttempt(attempt));
    if (!fileExists(path)) continue;
    let queue;
    try { queue = await readJson(path); } catch { continue; }
    const previous = await previousSuiteForReuse(runDir, queue, platform);
    if (!previous) continue;
    const selected = selectReusableSuite(previous, { children: currentChildren });
    if (selected.mode === 'suite' && previous.set_qa_request?.path
      && previous.set_qa_result?.path && previous.set_qa_review?.path
      && fileExists(join(runDir, previous.set_qa_request.path))
      && fileExists(join(runDir, previous.set_qa_result.path))
      && fileExists(join(runDir, previous.set_qa_review.path))) {
      return { ...selected, set_qa_result: previous.set_qa_result,
        set_qa_review: previous.set_qa_review, set_qa_request: previous.set_qa_request,
        source_body_attempt: queue.body_attempt };
    }
    for (const [imageId, child] of Object.entries(selected.children)) {
      partial.children[imageId] ||= child;
    }
  }
  return {
    mode: Object.keys(partial.children).length ? 'partial' : 'none',
    children: partial.children,
    bundle: null,
    manifest: null,
    set_qa_result: null,
    set_qa_review: null,
    rerun_set_qa: Object.keys(partial.children).length > 0
  };
}

async function loadState(runDir) {
  const state = await readJson(join(runDir, 'run.json'));
  if (state.schema_version !== 3 || state.status !== 'running' || state.current_stage !== 'visual'
    || state.stages?.visual?.status !== 'running'
    || state.stages?.visual?.body_visual?.status !== 'running'
    || state.gates?.visual?.status !== 'approved'
    || state.capabilities?.providers?.illustration?.contract !== 'illustration-v1'
    || state.capabilities?.providers?.illustration?.profile !== 'bounded-per-image-v2') {
    throw Object.assign(new Error('Bounded illustration queue requires an approved running visual stage.'), {
      issues: [issue('illustration_queue_stage_mismatch', 'Bounded illustration queue requires an approved running visual stage.')]
    });
  }
  return state;
}

async function withLock(runDir, callback) {
  const lock = join(runDir, '07-visual', '.generation-queue.lock');
  await ensureDir(dirname(lock));
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === 'EEXIST') throw Object.assign(new Error('Illustration queue is already being updated.'), {
      issues: [issue('illustration_queue_locked', 'Illustration queue is already being updated.')]
    });
    throw error;
  }
  try {
    return await callback();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

async function validateExistingQueue(runDir, state, queue) {
  let valid = queue?.schema_version === 2 && queue.profile === 'bounded-per-image-v2'
    && queue.run_id === state.run_id && queue.body_attempt === bodyVisualAttempt(state)
    && queue.global_limit === globalLimit && queue.suite_limit === suiteLimit
    && ['running', 'blocked', 'completed'].includes(queue.status)
    && Object.keys(queue.suites || {}).length === platforms.length;
  let activeGlobal = 0;
  for (const platform of platforms) {
    const suite = queue.suites?.[platform];
    const order = suite?.image_order;
    const children = suite?.children;
    const planPath = suite?.plan?.path ? join(runDir, suite.plan.path) : null;
    const parentPath = suite?.parent_request?.path ? join(runDir, suite.parent_request.path) : null;
    const shotPath = suite?.shot_list?.path ? join(runDir, suite.shot_list.path) : null;
    valid = valid && ['pending', 'generating', 'set_qa', 'pass', 'blocked'].includes(suite?.status)
      && Array.isArray(order) && order.length > 0 && order.length <= 8
      && new Set(order).size === order.length && suite.canary_id === order[0]
      && children && Object.keys(children).length === order.length
      && order.every((imageId) => Object.hasOwn(children, imageId))
      && planPath && parentPath && shotPath
      && fileExists(planPath) && fileExists(parentPath) && fileExists(shotPath)
      && suite.plan.sha256 === await fileSha256(planPath)
      && suite.parent_request.sha256 === await fileSha256(parentPath)
      && suite.shot_list.sha256 === await fileSha256(shotPath);
    const activeSuite = Object.values(children || {}).filter((child) => child?.status === 'active').length;
    activeGlobal += activeSuite;
    valid = valid && activeSuite <= suiteLimit;
    for (const [imageId, child] of Object.entries(children || {})) {
      const attempts = child?.attempts;
      valid = valid && ['pending', 'active', 'pass', 'blocked'].includes(child?.status)
        && (child.selected_attempt === null
          || Number.isInteger(child.selected_attempt) && child.selected_attempt >= 1 && child.selected_attempt <= 3)
        && Array.isArray(attempts) && attempts.length <= 3
        && attempts.every((row, index) => row?.attempt === index + 1
          && ['pending', 'active', 'released', 'pass', 'failed', 'blocked'].includes(row.status)
          && Array.isArray(row.leases));
      if (child?.selected_attempt !== null) {
        valid = valid && attempts?.[child.selected_attempt - 1]?.status === 'pass';
      } else if (child?.status === 'pass') {
        const reused = child.reuse;
        valid = valid && validReuseFingerprint(reused?.reuse_fingerprint)
          && reused.reuse_fingerprint.input_sha256 === child.reuse_input_sha256
          && reused.result_path && reused.qa?.path && reused.image?.path
          && fileExists(join(runDir, reused.result_path))
          && fileExists(join(runDir, reused.qa.path))
          && fileExists(join(runDir, reused.image.path))
          && reused.result_sha256 === await fileSha256(join(runDir, reused.result_path))
          && reused.qa.sha256 === await fileSha256(join(runDir, reused.qa.path))
          && reused.image.sha256 === await fileSha256(join(runDir, reused.image.path));
      }
      const canaryEverPassed = children?.[suite.canary_id]?.status === 'pass';
      if (imageId !== suite.canary_id && !canaryEverPassed) {
        valid = valid && attempts?.length === 0;
      }
    }
  }
  valid = valid && activeGlobal <= globalLimit && !Object.hasOwn(queue, 'cover');
  if (!valid) {
    throw Object.assign(new Error('Existing bounded illustration queue is invalid or exceeds fixed concurrency limits.'), {
      issues: [issue('invalid_illustration_queue', 'Existing bounded illustration queue is invalid or exceeds fixed concurrency limits.')]
    });
  }
}

async function initialize(runDir, state) {
  const plans = await validateIllustrationPlans(runDir, state);
  const decision = await validateCurrentVisualDecision(runDir, state, plans.tasks);
  const controlIssues = [...plans.issues, ...decision.issues];
  if (controlIssues.length) {
    throw Object.assign(new Error('Current visual plans or decision failed cardinality validation.'), {
      issues: controlIssues
    });
  }
  const relativePath = queuePath(state);
  const absolutePath = join(runDir, relativePath);
  if (fileExists(absolutePath)) {
    const existing = await readJson(absolutePath);
    await validateExistingQueue(runDir, state, existing);
    return { queue: existing, path: absolutePath, created: false };
  }
  const suites = {};
  for (const platform of platforms) {
    const paths = illustrationPaths(state, platform);
    const parentPath = join(runDir, paths.generateRequest);
    const planPath = join(runDir, paths.plan);
    if (!fileExists(parentPath) || !fileExists(planPath)) {
      throw Object.assign(new Error(`Missing bounded parent request for ${platform}.`), {
        issues: [issue('missing_illustration_parent', `Missing bounded parent request for ${platform}.`, { platform })]
      });
    }
    const parent = await readJson(parentPath);
    const plan = await readJson(planPath);
    if (parent.mode !== 'generate' || parent.options?.execution_strategy !== 'bounded_per_image_v2'
      || JSON.stringify(parent.expected_artifacts) !== JSON.stringify([paths.bundle, paths.manifest])
      || plan.status !== 'READY' || !Array.isArray(plan.anchors) || !plan.anchors.length || plan.anchors.length > 8) {
      throw Object.assign(new Error(`Invalid bounded parent request for ${platform}.`), {
        issues: [issue('invalid_illustration_parent', `Invalid bounded parent request for ${platform}.`, { platform })]
      });
    }
    const children = {};
    for (const anchor of plan.anchors) {
      const fingerprintInput = await reuseInputs(runDir, parent, plan, anchor);
      children[anchor.image_id] = {
        status: 'pending', selected_attempt: null, attempts: [],
        reuse_input_sha256: createReuseInputSha256(fingerprintInput)
      };
    }
    suites[platform] = {
      status: 'pending',
      parent_request: { path: paths.generateRequest, sha256: await fileSha256(parentPath) },
      plan: { path: paths.plan, sha256: await fileSha256(planPath) },
      shot_list: { path: paths.shotList, sha256: await fileSha256(join(runDir, paths.shotList)) },
      canary_id: plan.anchors[0].image_id,
      image_order: plan.anchors.map((anchor) => anchor.image_id),
      children,
      set_qa_rounds: [],
      average_generation_ms: 0
    };
  }
  const now = new Date().toISOString();
  const queue = {
    schema_version: 2,
    profile: 'bounded-per-image-v2',
    run_id: state.run_id,
    body_attempt: bodyVisualAttempt(state),
    global_limit: globalLimit,
    suite_limit: suiteLimit,
    generation_ttl_ms: generationTtlMs,
    set_qa_ttl_ms: setQaTtlMs,
    status: 'running',
    suites,
    timings: { reconcile_ms: 0, idle_ms: 0, last_active_at: now },
    created_at: now,
    updated_at: now,
    events: [{ at: now, event: 'queue_initialized' }]
  };
  if (bodyVisualAttempt(state) > 1) {
    for (const [platform, suite] of Object.entries(suites)) {
      const currentChildren = Object.fromEntries(Object.entries(suite.children).map(([imageId, child]) => [
        imageId, { input_sha256: child.reuse_input_sha256, text_policy: 'allowlist' }
      ]));
      const selected = await selectPriorReuse(runDir, bodyVisualAttempt(state), platform, currentChildren);
      for (const [imageId, reusable] of Object.entries(selected.children)) {
        suite.children[imageId].status = 'pass';
        suite.children[imageId].reuse = {
          ...reusable,
          reuse_fingerprint: reusable.fingerprint
        };
      }
      if (selected.mode !== 'none') {
        suite.reuse = {
          mode: selected.mode,
          source_body_attempt: selected.source_body_attempt
            || Math.max(...Object.values(selected.children).map((child) => child.source_body_attempt || 0)),
          source_bundle: selected.bundle,
          source_manifest: selected.manifest,
          rerun_set_qa: selected.rerun_set_qa
        };
        queue.events.push({
          at: now, event: 'pass_assets_imported', platform, mode: selected.mode,
          image_ids: Object.keys(selected.children), pixels_copied: false
        });
      }
      if (selected.mode === 'suite') {
        const qaResult = await readJson(join(runDir, selected.set_qa_result.path));
        const qaRow = {
          round: 0,
          task_id: `illustration:${state.run_id}:${platform}:set-qa:reused-from-body-${String(selected.source_body_attempt).padStart(3, '0')}`,
          request_path: selected.set_qa_request.path,
          result_path: selected.set_qa_result.path,
          status: 'pass',
          result_sha256: await fileSha256(join(runDir, selected.set_qa_result.path)),
          failed_image_ids: [],
          started_at: now,
          heartbeat_at: now,
          expires_at: now,
          completed_at: now,
          reused: true,
          source_body_attempt: selected.source_body_attempt,
          timings: { dispatch_ms: 0, set_qa_ms: 0, reconcile_ms: 0 }
        };
        suite.set_qa_rounds.push(qaRow);
        await aggregateSuite(runDir, state, platform, suite, qaRow, qaResult);
        suite.reuse.source_set_qa = {
          request: selected.set_qa_request,
          result: selected.set_qa_result,
          review: selected.set_qa_review
        };
      }
    }
  }
  queue.status = Object.values(suites).every((suite) => suite.status === 'pass') ? 'completed' : 'running';
  await writeJson(absolutePath, queue);
  return { queue, path: absolutePath, created: true };
}

function childTaskId(state, parent, platform, imageId, attempt) {
  return `illustration:${state.run_id}:${platform}:${parent.variant}:${imageId}:candidate-${String(attempt).padStart(2, '0')}:body-${String(bodyVisualAttempt(state)).padStart(3, '0')}`;
}

async function createChildRequest(runDir, state, platform, suite, imageId) {
  const parent = await readJson(join(runDir, suite.parent_request.path));
  const plan = await readJson(join(runDir, suite.plan.path));
  const anchor = plan.anchors.find((item) => item.image_id === imageId);
  const child = suite.children[imageId];
  let row = child.attempts.at(-1);
  if (!row || !['released', 'pending'].includes(row.status)) {
    const attempt = child.attempts.length + 1;
    const paths = childPaths(state, platform, imageId, attempt, plan.generation_backend.artifact_format, plan.brand.enabled);
    const taskId = childTaskId(state, parent, platform, imageId, attempt);
    const inputs = [
      ...parent.inputs.filter((input) => input.role !== 'visual_coverage'),
      { role: 'parent_request', path: suite.parent_request.path, sha256: suite.parent_request.sha256 }
    ];
    const expected = [...new Set([paths.prompt, paths.source, paths.delivery, paths.qa])];
    const priorResult = row?.result_path && fileExists(join(runDir, row.result_path))
      ? await readJson(join(runDir, row.result_path)) : null;
    const priorRequest = row?.request_path && fileExists(join(runDir, row.request_path))
      ? await readJson(join(runDir, row.request_path)) : null;
    const textVariant = priorResult?.issues?.some((item) => item.code === 'illustration_candidate_text')
      ? 'compact' : priorRequest?.text_variant || 'primary';
    const request = {
      schema_version: 2,
      contract: 'content-production-provider/v2',
      provider_contract: 'illustration-v1',
      capability: 'illustration',
      task_id: taskId,
      run_mode: state.run_mode,
      mode: 'generate_image',
      body_attempt: bodyVisualAttempt(state),
      candidate_attempt: attempt,
      platform,
      provider_platform: parent.provider_platform,
      variant: parent.variant,
      parent_task_id: parent.task_id,
      selection: parent.selection,
      inputs,
      anchor,
      text_variant: textVariant,
      style: plan.style,
      brand: plan.brand,
      generation_backend: plan.generation_backend,
      generation_geometry: plan.generation_geometry,
      output_dir: `07-visual/${platform}`,
      artifacts: { prompt: paths.prompt, candidate: paths.source, delivery: paths.delivery, qa: paths.qa },
      expected_artifacts: expected,
      interaction_policy: 'return_to_orchestrator'
    };
    await writeJson(join(runDir, paths.request), request);
    row = {
      attempt,
      task_id: taskId,
      request_path: paths.request,
      result_path: paths.result,
      status: 'pending',
      transport_retries: 0,
      started_at: null,
      completed_at: null,
      duration_ms: null,
      leases: [],
      timings: {
        dispatch_ms: 0,
        model_call: { status: 'unobservable', duration_ms: null },
        file_write_ms: null,
        brand_overlay_ms: null,
        single_qa_ms: null,
        reconcile_ms: null
      }
    };
    child.attempts.push(row);
  }
  const now = new Date();
  const lease = {
    status: 'active',
    started_at: now.toISOString(),
    heartbeat_at: now.toISOString(),
    expires_at: new Date(now.getTime() + generationTtlMs).toISOString(),
    completed_at: null
  };
  row.leases.push(lease);
  row.status = 'active';
  row.started_at ||= lease.started_at;
  row.heartbeat_at = lease.heartbeat_at;
  row.expires_at = lease.expires_at;
  child.status = 'active';
  suite.status = 'generating';
  return resolve(runDir, row.request_path);
}

async function createSetQaRequest(runDir, state, platform, suite) {
  const parent = await readJson(join(runDir, suite.parent_request.path));
  const round = suite.set_qa_rounds.length + 1;
  const paths = setQaPaths(state, platform, round);
  const inputs = [];
  for (const imageId of suite.image_order) {
    const child = suite.children[imageId];
    const row = child.attempts.find((item) => item.attempt === child.selected_attempt);
    inputs.push({
      role: 'illustration_child_result',
      image_id: imageId,
      path: row.result_path,
      sha256: await fileSha256(join(runDir, row.result_path))
    });
  }
  const request = {
    schema_version: 2,
    contract: 'content-production-provider/v2',
    provider_contract: 'illustration-v1',
    capability: 'illustration',
    task_id: `illustration:${state.run_id}:${platform}:${parent.variant}:set-qa:round-${String(round).padStart(2, '0')}:body-${String(bodyVisualAttempt(state)).padStart(3, '0')}`,
    run_mode: state.run_mode,
    mode: 'set_qa',
    body_attempt: bodyVisualAttempt(state),
    round,
    platform,
    provider_platform: parent.provider_platform,
    variant: parent.variant,
    parent_task_id: parent.task_id,
    inputs,
    output_dir: `07-visual/${platform}`,
    review_path: paths.review,
    expected_artifacts: [paths.review],
    interaction_policy: 'return_to_orchestrator'
  };
  await writeJson(join(runDir, paths.request), request);
  const now = new Date();
  suite.set_qa_rounds.push({
    round,
    task_id: request.task_id,
    request_path: paths.request,
    result_path: paths.result,
    status: 'active',
    result_sha256: null,
    failed_image_ids: [],
    started_at: now.toISOString(),
    heartbeat_at: now.toISOString(),
    expires_at: new Date(now.getTime() + setQaTtlMs).toISOString(),
    completed_at: null,
    timings: { dispatch_ms: 0, set_qa_ms: null, reconcile_ms: null }
  });
  suite.status = 'set_qa';
  return resolve(runDir, paths.request);
}

function selectedRow(suite, imageId) {
  const child = suite.children[imageId];
  return child.selected_attempt === null && child.reuse
    ? child.reuse : child.attempts.find((item) => item.attempt === child.selected_attempt);
}

async function geometryAttempts(runDir, plan, child, selectedAttempt) {
  if (child.reuse) return child.reuse.geometry_attempts;
  const values = [];
  for (const row of child.attempts.filter((item) => item.attempt <= selectedAttempt)) {
    const result = fileExists(join(runDir, row.result_path))
      ? await readJson(join(runDir, row.result_path)) : null;
    const sourceDimensions = result?.image?.source
      ? { width: result.image.source.width, height: result.image.source.height }
      : result?.checks?.source_dimensions;
    const rejectedGeometry = result?.issues?.some((item) => item.code === 'illustration_candidate_geometry');
    values.push({
      attempt: row.attempt,
      requested_dimensions: plan.generation_geometry.requested_dimensions,
      source_dimensions: sourceDimensions,
      status: row.attempt === selectedAttempt ? 'pass-native'
        : row.set_qa_rejected || !rejectedGeometry ? 'rejected-qa' : 'rejected-geometry'
    });
  }
  return values;
}

async function aggregateSuite(runDir, state, platform, suite, qaRow, qaResult) {
  const paths = illustrationPaths(state, platform);
  const parent = await readJson(join(runDir, suite.parent_request.path));
  const plan = await readJson(join(runDir, suite.plan.path));
  const images = [];
  for (const anchor of plan.anchors) {
    const child = suite.children[anchor.image_id];
    const row = selectedRow(suite, anchor.image_id);
    const result = await readJson(join(runDir, row.result_path));
    const value = result.image;
    const sourceFile = plan.brand.enabled ? value.source.path : null;
    images.push({
      image_id: anchor.image_id,
      file: value.delivery.path,
      file_sha256: value.delivery.sha256,
      source_file: sourceFile,
      source_sha256: sourceFile ? value.source.sha256 : null,
      prompt_path: value.prompt.path,
      prompt_sha256: value.prompt.sha256,
      placement: anchor.placement,
      core_meaning: anchor.core_meaning,
      structure: anchor.structure,
      visual_metaphor: anchor.visual_metaphor,
      content_qa_status: 'pass',
      style_qa_status: 'pass',
      brand_qa_status: plan.brand.enabled ? 'pass' : plan.brand.disabled_reason,
      set_qa_status: 'pass',
      brand_overlay_status: plan.brand.enabled ? 'applied' : plan.brand.disabled_reason,
      size_check_status: 'pass-native',
      generation_attempt: row.attempt,
      requested_dimensions: plan.generation_geometry.requested_dimensions,
      source_dimensions: { width: value.source.width, height: value.source.height },
      source_aspect_ratio: value.source.aspect_ratio,
      source_artifact: { format: value.source.format, bytes: value.source.bytes },
      delivery_dimensions: { width: value.delivery.width, height: value.delivery.height },
      delivery_artifact: { format: value.delivery.format, bytes: value.delivery.bytes, hard_limit_exporter: null },
      native_output_preserved: true,
      post_generation_actions: plan.brand.enabled ? ['brand-overlay-native'] : [],
      geometry_attempts: await geometryAttempts(runDir, plan, child, row.attempt),
      residual_risk: 'none'
    });
  }
  await writeText(join(runDir, paths.manifest), [
    'post_illustration_bundle:',
    `  platform: ${parent.provider_platform}`,
    `  style_id: ${plan.style.id}`,
    '  images:',
    ...images.map((image) => `    - image_id: ${image.image_id}\n      file: ${image.file}`)
  ].join('\n'));
  const bundle = {
    schema_version: 1,
    task_id: parent.task_id,
    status: 'PASS',
    platform,
    provider_platform: parent.provider_platform,
    variant: parent.variant,
    source: parent.inputs[0],
    selection: parent.selection,
    plan: suite.plan,
    shot_list: suite.shot_list,
    style: plan.style,
    brand: plan.brand,
    generation_backend: { ...plan.generation_backend, process_cleanup_status: 'pass' },
    generation_geometry: plan.generation_geometry,
    image_count: images.length,
    manifest: { path: paths.manifest, sha256: await fileSha256(join(runDir, paths.manifest)) },
    images,
    residual_risk: 'none'
  };
  await writeJson(join(runDir, paths.bundle), bundle);
  const result = {
    schema_version: 2,
    contract: 'content-production-provider/v2',
    provider_contract: 'illustration-v1',
    task_id: parent.task_id,
    request_sha256: await fileSha256(join(runDir, suite.parent_request.path)),
    status: 'PASS',
    artifacts: [
      { role: 'illustration_bundle', path: paths.bundle, sha256: await fileSha256(join(runDir, paths.bundle)) },
      { role: 'native_manifest', path: paths.manifest, sha256: await fileSha256(join(runDir, paths.manifest)) }
    ],
    checks: {
      request_valid: true,
      mode: 'generate',
      attempt: bodyVisualAttempt(state),
      platform,
      provider_platform: parent.provider_platform
    },
    issues: [],
    warnings: []
  };
  await writeJson(join(runDir, paths.generateResult), result);
  suite.status = 'pass';
  suite.aggregate = {
    bundle: { path: paths.bundle, sha256: await fileSha256(join(runDir, paths.bundle)) },
    manifest: { path: paths.manifest, sha256: await fileSha256(join(runDir, paths.manifest)) },
    parent_result: { path: paths.generateResult, sha256: await fileSha256(join(runDir, paths.generateResult)) },
    set_qa_result: { path: qaRow.result_path, sha256: qaRow.result_sha256 },
    set_qa_review: qaResult.set_qa.review
  };
}

async function reconcile(runDir, state, queue) {
  const reconcileStarted = Date.now();
  const now = new Date();
  for (const [platform, suite] of Object.entries(queue.suites)) {
    const durations = [];
    for (const child of Object.values(suite.children)) {
      const row = child.attempts.find((item) => item.status === 'active' && fileExists(join(runDir, item.result_path)));
      if (!row) continue;
      const result = await readJson(join(runDir, row.result_path));
      row.completed_at = now.toISOString();
      row.duration_ms = Math.max(0, Date.parse(row.completed_at) - Date.parse(row.started_at));
      const lease = row.leases.at(-1);
      if (lease?.status === 'active') {
        lease.status = 'completed';
        lease.completed_at = row.completed_at;
        lease.heartbeat_at = row.completed_at;
      }
      row.timings = {
        ...row.timings,
        ...(result.timings || {}),
        reconcile_ms: 0
      };
      durations.push(row.duration_ms);
      if (result.status === 'PASS') {
        row.status = 'pass';
        row.result_sha256 = await fileSha256(join(runDir, row.result_path));
        const [parent, plan, request] = await Promise.all([
          readJson(join(runDir, suite.parent_request.path)),
          readJson(join(runDir, suite.plan.path)),
          readJson(join(runDir, row.request_path))
        ]);
        const anchor = plan.anchors.find((item) => item.image_id === request.anchor?.image_id);
        const qaPath = request.artifacts.qa;
        const imagePath = result.image?.delivery?.path;
        if (!anchor || !qaPath || !imagePath || !fileExists(join(runDir, qaPath))
          || !fileExists(join(runDir, imagePath))) {
          row.status = 'blocked';
          child.status = 'blocked';
          continue;
        }
        row.reuse_fingerprint = createReuseFingerprint({
          ...await reuseInputs(runDir, parent, plan, anchor),
          qa: { path: qaPath, sha256: await fileSha256(join(runDir, qaPath)) },
          image: { path: imagePath, sha256: await fileSha256(join(runDir, imagePath)) }
        });
        child.status = 'pass';
        child.selected_attempt = row.attempt;
      } else if (result.status === 'FAILED' && result.issues?.some((item) => retryableIssues.has(item.code))
        && row.attempt < 3) {
        row.status = 'failed';
        child.status = 'pending';
      } else {
        row.status = result.status === 'FAILED' ? 'failed' : 'blocked';
        child.status = 'blocked';
      }
    }
    for (const [imageId, child] of Object.entries(suite.children)) {
      const row = child.attempts.find((item) => item.status === 'active'
        && !fileExists(join(runDir, item.result_path)));
      if (!row || Date.parse(row.expires_at) > now.getTime()) continue;
      const lease = row.leases.at(-1);
      if (lease?.status === 'active') {
        lease.status = 'abandoned';
        lease.completed_at = now.toISOString();
        lease.heartbeat_at = row.heartbeat_at;
      }
      row.status = 'pending';
      row.abandoned_count = (row.abandoned_count || 0) + 1;
      child.status = 'pending';
      queue.events.push({
        at: now.toISOString(), event: 'generation_abandoned', platform,
        image_id: imageId, task_id: row.task_id, candidate_attempt: row.attempt
      });
    }
    const prior = Object.values(suite.children).flatMap((child) => child.attempts)
      .map((row) => row.duration_ms).filter(Number.isFinite);
    if (durations.length || prior.length) {
      suite.average_generation_ms = Math.round(prior.reduce((sum, value) => sum + value, 0) / prior.length);
    }
    const qaRow = suite.set_qa_rounds.find((item) => item.status === 'active'
      && fileExists(join(runDir, item.result_path)));
    if (qaRow) {
      const qaResult = await readJson(join(runDir, qaRow.result_path));
      qaRow.result_sha256 = await fileSha256(join(runDir, qaRow.result_path));
      qaRow.completed_at = now.toISOString();
      if (qaResult.status === 'PASS' && qaResult.set_qa?.status === 'PASS') {
        qaRow.status = 'pass';
        await aggregateSuite(runDir, state, platform, suite, qaRow, qaResult);
      } else if (qaResult.status === 'FAILED' && qaResult.set_qa?.status === 'FAILED') {
        const failedIds = qaResult.set_qa.failed_image_ids;
        const validIds = Array.isArray(failedIds) && failedIds.length > 0
          && new Set(failedIds).size === failedIds.length
          && failedIds.every((imageId) => suite.image_order.includes(imageId));
        if (!validIds) {
          qaRow.status = 'blocked';
          suite.status = 'blocked';
        } else {
          qaRow.status = 'failed';
          qaRow.failed_image_ids = failedIds;
          for (const imageId of failedIds) {
            const child = suite.children[imageId];
            const selected = selectedRow(suite, imageId);
            selected.set_qa_rejected = true;
            child.selected_attempt = null;
            if (selected.attempt >= 3) {
              child.status = 'blocked';
            } else {
              child.status = 'pending';
              if (suite.status !== 'blocked') suite.status = 'generating';
            }
          }
        }
      } else {
        qaRow.status = 'blocked';
        suite.status = 'blocked';
      }
    }
    const expiredQa = suite.set_qa_rounds.find((item) => item.status === 'active'
      && !fileExists(join(runDir, item.result_path)) && Date.parse(item.expires_at) <= now.getTime());
    if (expiredQa) {
      expiredQa.status = 'abandoned';
      expiredQa.completed_at = now.toISOString();
      suite.status = 'generating';
      queue.events.push({
        at: now.toISOString(), event: 'set_qa_abandoned', platform, task_id: expiredQa.task_id
      });
    }
    const childStatuses = Object.values(suite.children).map((child) => child.status);
    if (suite.children[suite.canary_id]?.status === 'blocked') suite.status = 'blocked';
    else if (childStatuses.some((value) => ['pending', 'active'].includes(value))) suite.status = 'generating';
    else if (childStatuses.some((value) => value === 'blocked')
      && !suite.set_qa_rounds.some((row) => row.status === 'active')) suite.status = 'blocked';
  }
  queue.timings.reconcile_ms += Date.now() - reconcileStarted;
}

function activeCounts(queue) {
  const perSuite = {};
  let global = 0;
  for (const [platform, suite] of Object.entries(queue.suites)) {
    const count = Object.values(suite.children).filter((child) => child.status === 'active').length;
    perSuite[platform] = count;
    global += count;
  }
  return { global, perSuite };
}

function eligibleChildren(queue) {
  const canaryBarrierPassed = Object.values(queue.suites).every((suite) =>
    suite.children?.[suite.canary_id]?.status === 'pass');
  return Object.entries(queue.suites).flatMap(([platform, suite], platformIndex) => {
    if (suite.status === 'pass') return [];
    const ids = canaryBarrierPassed ? suite.image_order : [suite.canary_id];
    const remaining = suite.image_order.filter((id) => suite.children[id].selected_attempt === null).length;
    return ids.filter((id) => suite.children[id].status === 'pending').map((imageId) => ({
      platform,
      platformIndex,
      suite,
      imageId,
      imageIndex: suite.image_order.indexOf(imageId),
      remaining,
      duration: suite.average_generation_ms
    }));
  }).sort((left, right) => right.remaining - left.remaining || right.duration - left.duration
    || left.platformIndex - right.platformIndex || left.imageIndex - right.imageIndex);
}

async function dispatch(runDir, state, queue) {
  await reconcile(runDir, state, queue);
  const output = [];
  const qaOutput = [];
  for (const [platform, suite] of Object.entries(queue.suites)) {
    const ready = suite.status !== 'pass' && suite.status !== 'blocked'
      && Object.values(suite.children).every((child) => child.status === 'pass'
        && (child.selected_attempt !== null || child.reuse))
      && !suite.set_qa_rounds.some((row) => row.status === 'active');
    if (ready) qaOutput.push(await createSetQaRequest(runDir, state, platform, suite));
  }
  const counts = activeCounts(queue);
  for (const job of eligibleChildren(queue)) {
    if (counts.global >= globalLimit) break;
    if (counts.perSuite[job.platform] >= suiteLimit) continue;
    output.push(await createChildRequest(runDir, state, job.platform, job.suite, job.imageId));
    counts.global += 1;
    counts.perSuite[job.platform] += 1;
  }
  const suiteStatuses = Object.values(queue.suites).map((suite) => suite.status);
  if (suiteStatuses.every((value) => value === 'pass')) {
    queue.status = 'completed';
  } else if (suiteStatuses.every((value) => ['pass', 'blocked'].includes(value))) {
    queue.status = 'blocked';
  } else {
    queue.status = 'running';
  }
  const now = new Date().toISOString();
  queue.updated_at = now;
  queue.events.push({
    at: now,
    event: 'queue_dispatched',
    generation_task_count: output.length,
    set_qa_task_count: qaOutput.length,
    active_generation_count: activeCounts(queue).global,
    active_generation_by_suite: activeCounts(queue).perSuite,
    canary_barrier: Object.values(queue.suites).every((suite) =>
      suite.children?.[suite.canary_id]?.status === 'pass') ? 'PASS' : 'WAITING'
  });
  await writeJson(join(runDir, queuePath(state)), queue);
  return { generationRequests: output, qaRequests: qaOutput };
}

async function release(runDir, state, queue) {
  const taskId = args.task_id;
  const reason = args.reason;
  if (!taskId || !['rate_limit', 'transport'].includes(reason)) {
    throw new Error('release requires --task-id and --reason rate_limit|transport.');
  }
  let found = null;
  for (const suite of Object.values(queue.suites)) {
    for (const child of Object.values(suite.children)) {
      const row = child.attempts.find((item) => item.task_id === taskId && item.status === 'active');
      if (row) found = { child, row };
    }
  }
  if (!found) throw new Error(`No active queue task: ${taskId}`);
  found.row.status = 'released';
  found.row.transport_retries += 1;
  const lease = found.row.leases.at(-1);
  if (lease?.status === 'active') {
    lease.status = 'released';
    lease.completed_at = new Date().toISOString();
  }
  found.child.status = 'pending';
  const now = new Date().toISOString();
  queue.updated_at = now;
  queue.events.push({ at: now, event: 'generation_released', task_id: taskId, reason });
  await writeJson(join(runDir, queuePath(state)), queue);
}

async function heartbeat(runDir, state, queue) {
  if (!args.task_id) throw new Error('heartbeat requires --task-id.');
  const now = new Date();
  for (const suite of Object.values(queue.suites)) {
    for (const child of Object.values(suite.children)) {
      const row = child.attempts.find((item) => item.task_id === args.task_id && item.status === 'active');
      if (!row) continue;
      const lease = row.leases.at(-1);
      lease.heartbeat_at = now.toISOString();
      lease.expires_at = new Date(now.getTime() + generationTtlMs).toISOString();
      row.heartbeat_at = lease.heartbeat_at;
      row.expires_at = lease.expires_at;
      queue.updated_at = now.toISOString();
      queue.events.push({ at: now.toISOString(), event: 'generation_heartbeat', task_id: args.task_id });
      await writeJson(join(runDir, queuePath(state)), queue);
      return;
    }
    const qa = suite.set_qa_rounds.find((item) => item.task_id === args.task_id && item.status === 'active');
    if (qa) {
      qa.heartbeat_at = now.toISOString();
      qa.expires_at = new Date(now.getTime() + setQaTtlMs).toISOString();
      queue.updated_at = now.toISOString();
      queue.events.push({ at: now.toISOString(), event: 'set_qa_heartbeat', task_id: args.task_id });
      await writeJson(join(runDir, queuePath(state)), queue);
      return;
    }
  }
  throw new Error(`No active queue task: ${args.task_id}`);
}

try {
  if (!runInput || !['init', 'dispatch', 'release', 'heartbeat', 'inspect'].includes(command) || extra.length) {
    throw new Error('Usage: illustration-queue.mjs <run-dir> <init|dispatch|release|heartbeat|inspect> [--task-id id --reason rate_limit|transport]');
  }
  const runDir = expandPath(runInput);
  const state = await loadState(runDir);
  await withLock(runDir, async () => {
    const initialized = await initialize(runDir, state);
    if (command === 'init') {
      emitJson({ status: 'PASS', run_id: state.run_id, queue_path: queuePath(state), created: initialized.created });
      return;
    }
    const queue = initialized.queue;
    if (command === 'dispatch') {
      const dispatched = await dispatch(runDir, state, queue);
      emitJson({
        status: 'PASS',
        run_id: state.run_id,
        queue_path: queuePath(state),
        generation_requests: dispatched.generationRequests.map((path) => path.slice(runDir.length + 1)),
        qa_requests: dispatched.qaRequests.map((path) => path.slice(runDir.length + 1))
      });
      return;
    }
    if (command === 'release') {
      await release(runDir, state, queue);
      emitJson({ status: 'PASS', run_id: state.run_id, queue_path: queuePath(state), task_id: args.task_id });
      return;
    }
    if (command === 'heartbeat') {
      await heartbeat(runDir, state, queue);
      emitJson({ status: 'PASS', run_id: state.run_id, queue_path: queuePath(state), task_id: args.task_id });
      return;
    }
    await reconcile(runDir, state, queue);
    await writeJson(join(runDir, queuePath(state)), queue);
    emitJson({ status: 'PASS', run_id: state.run_id, queue_path: queuePath(state), queue });
  });
} catch (error) {
  emitJson({ status: 'BLOCKED', issues: error.issues || [issue('illustration_queue_failed', error.message)] }, 2);
}

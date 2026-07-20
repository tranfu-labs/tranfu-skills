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
  writeJson,
  writeText
} from './lib.mjs';
import { coverPaths } from './wechat-cover-contracts.mjs';
import { illustrationPaths } from './illustration-contracts.mjs';

const args = parseArgs(process.argv.slice(2));
const [runInput, command, ...extra] = args._;
const retryableIssues = new Set(['illustration_candidate_geometry', 'illustration_candidate_qa']);
const globalLimit = 4;
const suiteLimit = 2;

function issue(code, message, extraValue = {}) {
  return { code, message, resume_from: 'visual', ...extraValue };
}

function queuePath(state) {
  const attempt = state.stages.visual.attempt;
  return `07-visual/generation-queue${attempt === 1 ? '' : `.v${String(attempt).padStart(3, '0')}`}.json`;
}

function versionPart(attempt) {
  return attempt === 1 ? '' : `/v${String(attempt).padStart(3, '0')}`;
}

function childPaths(state, platform, imageId, candidateAttempt, format, brandEnabled) {
  const visualVersion = versionPart(state.stages.visual.attempt);
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
  const visualVersion = versionPart(state.stages.visual.attempt);
  const number = String(round).padStart(2, '0');
  const control = `07-visual/${platform}/set-qa${visualVersion}/round-${number}`;
  return {
    request: `${control}/request.json`,
    review: `${control}/review.json`,
    result: `${control}/result.json`
  };
}

async function loadState(runDir) {
  const state = await readJson(join(runDir, 'run.json'));
  if (state.schema_version !== 2 || state.status !== 'running' || state.current_stage !== 'visual'
    || state.stages?.visual?.status !== 'running' || state.gates?.visual?.status !== 'approved'
    || state.capabilities?.providers?.illustration?.contract !== 'illustration-v1'
    || state.capabilities?.providers?.illustration?.profile !== 'bounded-per-image') {
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
  let valid = queue?.schema_version === 1 && queue.profile === 'bounded-per-image'
    && queue.run_id === state.run_id && queue.visual_attempt === state.stages.visual.attempt
    && queue.global_limit === globalLimit && queue.suite_limit === suiteLimit
    && ['running', 'blocked', 'completed'].includes(queue.status)
    && Object.keys(queue.suites || {}).length === platforms.length;
  let activeGlobal = queue.cover?.status === 'active' ? 1 : 0;
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
          && ['pending', 'active', 'released', 'pass', 'failed', 'blocked'].includes(row.status));
      if (child?.selected_attempt !== null) {
        valid = valid && attempts?.[child.selected_attempt - 1]?.status === 'pass';
      }
      const canaryEverPassed = children?.[suite.canary_id]?.attempts?.some((row) => row.status === 'pass');
      if (imageId !== suite.canary_id && !canaryEverPassed) {
        valid = valid && attempts?.length === 0;
      }
    }
  }
  valid = valid && activeGlobal <= globalLimit
    && (!queue.cover || ['pending', 'active', 'pass', 'blocked'].includes(queue.cover.status));
  if (!valid) {
    throw Object.assign(new Error('Existing bounded illustration queue is invalid or exceeds fixed concurrency limits.'), {
      issues: [issue('invalid_illustration_queue', 'Existing bounded illustration queue is invalid or exceeds fixed concurrency limits.')]
    });
  }
}

async function initialize(runDir, state) {
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
    if (parent.mode !== 'generate' || parent.options?.execution_strategy !== 'bounded_per_image'
      || JSON.stringify(parent.expected_artifacts) !== JSON.stringify([paths.bundle, paths.manifest])
      || plan.status !== 'READY' || !Array.isArray(plan.anchors) || !plan.anchors.length || plan.anchors.length > 8) {
      throw Object.assign(new Error(`Invalid bounded parent request for ${platform}.`), {
        issues: [issue('invalid_illustration_parent', `Invalid bounded parent request for ${platform}.`, { platform })]
      });
    }
    suites[platform] = {
      status: 'pending',
      parent_request: { path: paths.generateRequest, sha256: await fileSha256(parentPath) },
      plan: { path: paths.plan, sha256: await fileSha256(planPath) },
      shot_list: { path: paths.shotList, sha256: await fileSha256(join(runDir, paths.shotList)) },
      canary_id: plan.anchors[0].image_id,
      image_order: plan.anchors.map((anchor) => anchor.image_id),
      children: Object.fromEntries(plan.anchors.map((anchor) => [anchor.image_id, {
        status: 'pending', selected_attempt: null, attempts: []
      }])),
      set_qa_rounds: [],
      average_generation_ms: 0
    };
  }
  const cover = coverPaths(state);
  const coverRequestPath = join(runDir, cover.request);
  const coverRequest = fileExists(coverRequestPath) ? await readJson(coverRequestPath) : null;
  const now = new Date().toISOString();
  const queue = {
    schema_version: 1,
    profile: 'bounded-per-image',
    run_id: state.run_id,
    visual_attempt: state.stages.visual.attempt,
    global_limit: globalLimit,
    suite_limit: suiteLimit,
    status: 'running',
    suites,
    cover: coverRequest ? {
      status: 'pending', task_id: coverRequest.task_id,
      request: { path: cover.request, sha256: await fileSha256(coverRequestPath) },
      result_path: cover.result,
      lease: null,
      transport_retries: 0
    } : null,
    created_at: now,
    updated_at: now,
    events: [{ at: now, event: 'queue_initialized' }]
  };
  await writeJson(absolutePath, queue);
  return { queue, path: absolutePath, created: true };
}

function childTaskId(state, parent, platform, imageId, attempt) {
  return `illustration:${state.run_id}:${platform}:${parent.variant}:${imageId}:candidate-${String(attempt).padStart(2, '0')}:visual-${String(state.stages.visual.attempt).padStart(3, '0')}`;
}

async function createChildRequest(runDir, state, platform, suite, imageId) {
  const parent = await readJson(join(runDir, suite.parent_request.path));
  const plan = await readJson(join(runDir, suite.plan.path));
  const anchor = plan.anchors.find((item) => item.image_id === imageId);
  const child = suite.children[imageId];
  let row = child.attempts.at(-1);
  if (!row || row.status !== 'released') {
    const attempt = child.attempts.length + 1;
    const paths = childPaths(state, platform, imageId, attempt, plan.generation_backend.artifact_format, plan.brand.enabled);
    const taskId = childTaskId(state, parent, platform, imageId, attempt);
    const inputs = [
      ...parent.inputs,
      { role: 'parent_request', path: suite.parent_request.path, sha256: suite.parent_request.sha256 }
    ];
    const expected = [...new Set([paths.prompt, paths.source, paths.delivery, paths.qa])];
    const request = {
      schema_version: 1,
      contract: 'content-production-provider/v1',
      provider_contract: 'illustration-v1',
      capability: 'illustration',
      task_id: taskId,
      run_dir: runDir,
      run_mode: state.run_mode,
      mode: 'generate_image',
      visual_attempt: state.stages.visual.attempt,
      candidate_attempt: attempt,
      platform,
      provider_platform: parent.provider_platform,
      variant: parent.variant,
      parent_task_id: parent.task_id,
      selection: parent.selection,
      inputs,
      anchor,
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
      duration_ms: null
    };
    child.attempts.push(row);
  }
  row.status = 'active';
  row.started_at = new Date().toISOString();
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
    schema_version: 1,
    contract: 'content-production-provider/v1',
    provider_contract: 'illustration-v1',
    capability: 'illustration',
    task_id: `illustration:${state.run_id}:${platform}:${parent.variant}:set-qa:round-${String(round).padStart(2, '0')}:visual-${String(state.stages.visual.attempt).padStart(3, '0')}`,
    run_dir: runDir,
    run_mode: state.run_mode,
    mode: 'set_qa',
    visual_attempt: state.stages.visual.attempt,
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
  suite.set_qa_rounds.push({
    round,
    task_id: request.task_id,
    request_path: paths.request,
    result_path: paths.result,
    status: 'active',
    result_sha256: null,
    failed_image_ids: []
  });
  suite.status = 'set_qa';
  return resolve(runDir, paths.request);
}

function selectedRow(suite, imageId) {
  const child = suite.children[imageId];
  return child.attempts.find((item) => item.attempt === child.selected_attempt);
}

async function geometryAttempts(runDir, plan, child, selectedAttempt) {
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
    schema_version: 1,
    contract: 'content-production-provider/v1',
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
      attempt: state.stages.visual.attempt,
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
  for (const [platform, suite] of Object.entries(queue.suites)) {
    const durations = [];
    for (const child of Object.values(suite.children)) {
      const row = child.attempts.find((item) => item.status === 'active' && fileExists(join(runDir, item.result_path)));
      if (!row) continue;
      const result = await readJson(join(runDir, row.result_path));
      row.completed_at = new Date().toISOString();
      row.duration_ms = Math.max(0, Date.parse(row.completed_at) - Date.parse(row.started_at));
      durations.push(row.duration_ms);
      if (result.status === 'PASS') {
        row.status = 'pass';
        row.result_sha256 = await fileSha256(join(runDir, row.result_path));
        child.status = 'pass';
        child.selected_attempt = row.attempt;
      } else if (result.status === 'FAILED' && result.issues?.some((item) => retryableIssues.has(item.code))
        && row.attempt < 3) {
        row.status = 'failed';
        child.status = 'pending';
      } else {
        row.status = result.status === 'FAILED' ? 'failed' : 'blocked';
        child.status = 'blocked';
        suite.status = 'blocked';
      }
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
              suite.status = 'blocked';
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
  }
  if (queue.cover?.status === 'active' && fileExists(join(runDir, queue.cover.result_path))) {
    const result = await readJson(join(runDir, queue.cover.result_path));
    queue.cover.status = result.status === 'PASS' ? 'pass' : 'blocked';
    queue.cover.lease.completed_at = new Date().toISOString();
  }
}

function activeCounts(queue) {
  const perSuite = {};
  let global = queue.cover?.status === 'active' ? 1 : 0;
  for (const [platform, suite] of Object.entries(queue.suites)) {
    const count = Object.values(suite.children).filter((child) => child.status === 'active').length;
    perSuite[platform] = count;
    global += count;
  }
  return { global, perSuite };
}

function eligibleChildren(queue) {
  return Object.entries(queue.suites).flatMap(([platform, suite], platformIndex) => {
    if (suite.status === 'blocked') return [];
    const canary = suite.children[suite.canary_id];
    const canaryPassed = canary.selected_attempt !== null;
    const ids = canaryPassed ? suite.image_order : [suite.canary_id];
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
        && child.selected_attempt !== null)
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
  if (counts.global < globalLimit && queue.cover?.status === 'pending') {
    queue.cover.status = 'active';
    queue.cover.lease = { started_at: new Date().toISOString(), completed_at: null };
    output.push(resolve(runDir, queue.cover.request.path));
  }
  if (Object.values(queue.suites).some((suite) => suite.status === 'blocked')
    || queue.cover?.status === 'blocked') {
    queue.status = 'blocked';
  } else if (Object.values(queue.suites).every((suite) => suite.status === 'pass')
    && (!queue.cover || queue.cover.status === 'pass')) {
    queue.status = 'completed';
  }
  const now = new Date().toISOString();
  queue.updated_at = now;
  queue.events.push({
    at: now,
    event: 'queue_dispatched',
    generation_task_count: output.length,
    set_qa_task_count: qaOutput.length,
    active_generation_count: activeCounts(queue).global,
    active_generation_by_suite: activeCounts(queue).perSuite
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
  if (queue.cover?.task_id === taskId && queue.cover.status === 'active') {
    queue.cover.status = 'pending';
    queue.cover.lease = null;
    queue.cover.transport_retries += 1;
  } else {
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
    found.child.status = 'pending';
  }
  const now = new Date().toISOString();
  queue.updated_at = now;
  queue.events.push({ at: now, event: 'generation_released', task_id: taskId, reason });
  await writeJson(join(runDir, queuePath(state)), queue);
}

try {
  if (!runInput || !['init', 'dispatch', 'release', 'inspect'].includes(command) || extra.length) {
    throw new Error('Usage: illustration-queue.mjs <run-dir> <init|dispatch|release|inspect> [--task-id id --reason rate_limit|transport]');
  }
  const runDir = expandPath(runInput);
  const state = await loadState(runDir);
  await withLock(runDir, async () => {
    const initialized = await initialize(runDir, state);
    if (command === 'init') {
      emitJson({ status: 'PASS', queue_path: initialized.path, created: initialized.created });
      return;
    }
    const queue = initialized.queue;
    if (command === 'dispatch') {
      const dispatched = await dispatch(runDir, state, queue);
      emitJson({
        status: 'PASS',
        queue_path: initialized.path,
        generation_requests: dispatched.generationRequests,
        qa_requests: dispatched.qaRequests
      });
      return;
    }
    if (command === 'release') {
      await release(runDir, state, queue);
      emitJson({ status: 'PASS', queue_path: initialized.path, task_id: args.task_id });
      return;
    }
    await reconcile(runDir, state, queue);
    await writeJson(join(runDir, queuePath(state)), queue);
    emitJson({ status: 'PASS', queue_path: initialized.path, queue });
  });
} catch (error) {
  emitJson({ status: 'BLOCKED', issues: error.issues || [issue('illustration_queue_failed', error.message)] }, 2);
}

#!/usr/bin/env node

import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  emitJson,
  ensureDir,
  expandPath,
  fileExists,
  fileSha256,
  parseArgs,
  readJson,
  writeJson
} from './lib.mjs';
import { coverAttempt, coverPaths } from './wechat-cover-contracts.mjs';

export const COVER_LEASE_TTL_MS = 60 * 60 * 1000;
const SLOT_LIMIT = 1;

function issue(code, message, extra = {}) {
  return { code, message, resume_from: 'visual', ...extra };
}

function coverControl(state) {
  const visual = state?.stages?.visual;
  return visual?.wechat_cover || null;
}

function coverStatus(state) {
  return coverControl(state)?.status || state?.stages?.visual?.status || null;
}

export function coverQueuePath(state) {
  const attempt = coverAttempt(state);
  return `07-visual/wechat-cover/queue${attempt === 1 ? '' : `.v${String(attempt).padStart(3, '0')}`}.json`;
}

function timings() {
  return {
    dispatch_ms: 0,
    model_call: { status: 'unobservable', duration_ms: null },
    file_write_ms: 0,
    brand_overlay_ms: 0,
    image_qa_ms: 0,
    set_qa: { status: 'not_applicable', duration_ms: null },
    reconcile_ms: 0,
    idle_ms: 0
  };
}

function addIdle(queue, nowMs) {
  const prior = Date.parse(queue.updated_at);
  if (queue.task.status === 'pending' && Number.isFinite(prior)) {
    queue.timings.idle_ms += Math.max(0, nowMs - prior);
  }
}

function validLease(value) {
  return value && Number.isInteger(value.sequence) && value.sequence > 0
    && ['active', 'completed', 'released', 'abandoned'].includes(value.status)
    && typeof value.started_at === 'string' && typeof value.heartbeat_at === 'string'
    && typeof value.expires_at === 'string'
    && (value.completed_at === null || typeof value.completed_at === 'string')
    && (value.reason === null || typeof value.reason === 'string');
}

function validateQueue(queue, state) {
  const valid = queue?.schema_version === 1 && queue.profile === 'cover-queue-v1'
    && queue.run_id === state.run_id && queue.cover_attempt === coverAttempt(state)
    && queue.slot_limit === SLOT_LIMIT && queue.lease_ttl_ms === COVER_LEASE_TTL_MS
    && ['running', 'blocked', 'completed'].includes(queue.status)
    && queue.task && ['pending', 'active', 'pass', 'blocked'].includes(queue.task.status)
    && Array.isArray(queue.task.leases) && queue.task.leases.every(validLease)
    && queue.task.leases.filter((lease) => lease.status === 'active').length <= SLOT_LIMIT
    && queue.task.quality_attempts_consumed === 0
    && queue.timings?.model_call?.status === 'unobservable';
  if (!valid) {
    throw Object.assign(new Error('Existing cover queue is invalid.'), {
      issues: [issue('invalid_cover_queue', 'Existing cover queue is invalid.')]
    });
  }
}

async function loadState(runDir) {
  const state = await readJson(join(runDir, 'run.json'));
  const attempt = coverAttempt(state);
  if (state.schema_version !== 3 || state.status !== 'running'
    || state.current_stage !== 'visual' || coverStatus(state) !== 'running'
    || !Number.isInteger(attempt) || attempt < 1) {
    throw Object.assign(new Error('Cover queue requires the current approved cover lifecycle to be running.'), {
      issues: [issue('cover_queue_stage_mismatch', 'Cover queue requires the current approved cover lifecycle to be running.')]
    });
  }
  return state;
}

async function withLock(runDir, callback) {
  const lock = join(runDir, '07-visual', 'wechat-cover', '.queue.lock');
  await ensureDir(dirname(lock));
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw Object.assign(new Error('Cover queue is already being updated.'), {
        issues: [issue('cover_queue_locked', 'Cover queue is already being updated.')]
      });
    }
    throw error;
  }
  try {
    return await callback();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

export async function initializeCoverQueue(runDir, state, { now = new Date() } = {}) {
  const relativePath = coverQueuePath(state);
  const absolutePath = join(runDir, relativePath);
  if (fileExists(absolutePath)) {
    const queue = await readJson(absolutePath);
    validateQueue(queue, state);
    return { queue, path: relativePath, created: false };
  }
  const paths = coverPaths(state);
  const requestPath = join(runDir, paths.request);
  if (!fileExists(requestPath)) {
    throw Object.assign(new Error('Current cover request is missing.'), {
      issues: [issue('cover_request_missing', 'Current cover request is missing.')]
    });
  }
  const request = await readJson(requestPath);
  if (request.attempt !== paths.attempt || request.task_id === undefined) {
    throw Object.assign(new Error('Current cover request does not match cover_attempt.'), {
      issues: [issue('cover_request_attempt_mismatch', 'Current cover request does not match cover_attempt.')]
    });
  }
  const at = now.toISOString();
  const queue = {
    schema_version: 1,
    profile: 'cover-queue-v1',
    run_id: state.run_id,
    cover_attempt: paths.attempt,
    slot_limit: SLOT_LIMIT,
    lease_ttl_ms: COVER_LEASE_TTL_MS,
    status: 'running',
    task: {
      status: 'pending',
      task_id: request.task_id,
      request: { path: paths.request, sha256: await fileSha256(requestPath) },
      result_path: paths.result,
      result_sha256: null,
      quality_attempts_consumed: 0,
      transport_retries: 0,
      leases: []
    },
    timings: timings(),
    created_at: at,
    updated_at: at,
    events: [{ at, event: 'cover_queue_initialized' }]
  };
  await writeJson(absolutePath, queue);
  return { queue, path: relativePath, created: true };
}

export async function reconcileCoverQueue(runDir, queue, { now = new Date() } = {}) {
  const started = Date.now();
  const active = queue.task.leases.find((lease) => lease.status === 'active') || null;
  if (!active) return { changed: false, elapsedMs: Math.max(0, Date.now() - started) };
  const resultPath = join(runDir, queue.task.result_path);
  if (fileExists(resultPath)) {
    const result = await readJson(resultPath);
    const completedAt = now.toISOString();
    active.status = result.status === 'PASS' ? 'completed' : 'released';
    active.completed_at = completedAt;
    active.reason = result.status === 'PASS' ? 'result_pass' : 'result_blocked';
    queue.task.status = result.status === 'PASS' ? 'pass' : 'blocked';
    queue.task.result_sha256 = await fileSha256(resultPath);
    queue.status = result.status === 'PASS' ? 'completed' : 'blocked';
    queue.events.push({ at: completedAt, event: 'cover_result_reconciled', status: result.status });
    const elapsedMs = Math.max(0, Date.now() - started);
    queue.timings.reconcile_ms += elapsedMs;
    return { changed: true, elapsedMs };
  }
  if (now.getTime() >= Date.parse(active.expires_at)) {
    const completedAt = now.toISOString();
    active.status = 'abandoned';
    active.completed_at = completedAt;
    active.reason = 'lease_expired_without_result';
    queue.task.status = 'pending';
    queue.events.push({
      at: completedAt,
      event: 'cover_lease_abandoned',
      sequence: active.sequence,
      quality_attempt_consumed: false
    });
    const elapsedMs = Math.max(0, Date.now() - started);
    queue.timings.reconcile_ms += elapsedMs;
    return { changed: true, elapsedMs };
  }
  const elapsedMs = Math.max(0, Date.now() - started);
  queue.timings.reconcile_ms += elapsedMs;
  return { changed: false, elapsedMs };
}

export async function dispatchCoverQueue(runDir, queue, { now = new Date() } = {}) {
  await reconcileCoverQueue(runDir, queue, { now });
  if (queue.task.status !== 'pending') return null;
  const started = Date.now();
  const nowMs = now.getTime();
  addIdle(queue, nowMs);
  const sequence = queue.task.leases.length + 1;
  queue.task.leases.push({
    sequence,
    status: 'active',
    started_at: now.toISOString(),
    heartbeat_at: now.toISOString(),
    expires_at: new Date(nowMs + COVER_LEASE_TTL_MS).toISOString(),
    completed_at: null,
    reason: null
  });
  queue.task.status = 'active';
  queue.timings.dispatch_ms += Math.max(0, Date.now() - started);
  queue.events.push({ at: now.toISOString(), event: 'cover_dispatched', sequence });
  return queue.task.request.path;
}

export async function releaseCoverQueue(queue, taskId, reason, { now = new Date() } = {}) {
  if (queue.task.task_id !== taskId || queue.task.status !== 'active') {
    throw new Error(`No active cover task: ${taskId}`);
  }
  if (!['rate_limit', 'transport'].includes(reason)) {
    throw new Error('release requires --reason rate_limit|transport.');
  }
  const active = queue.task.leases.find((lease) => lease.status === 'active');
  active.status = 'released';
  active.completed_at = now.toISOString();
  active.reason = reason;
  queue.task.status = 'pending';
  queue.task.transport_retries += 1;
  queue.events.push({
    at: now.toISOString(), event: 'cover_released', reason,
    quality_attempt_consumed: false
  });
}

export function heartbeatCoverQueue(queue, taskId, { now = new Date() } = {}) {
  if (queue.task.task_id !== taskId || queue.task.status !== 'active') {
    throw new Error(`No active cover task: ${taskId}`);
  }
  const active = queue.task.leases.find((lease) => lease.status === 'active');
  active.heartbeat_at = now.toISOString();
  active.expires_at = new Date(now.getTime() + COVER_LEASE_TTL_MS).toISOString();
  queue.events.push({ at: now.toISOString(), event: 'cover_heartbeat', sequence: active.sequence });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [runInput, command, ...extra] = args._;
  if (!runInput || !['init', 'dispatch', 'inspect', 'release', 'heartbeat'].includes(command) || extra.length) {
    throw new Error('Usage: cover-queue.mjs <run-dir> <init|dispatch|inspect|release|heartbeat> [--task-id id --reason rate_limit|transport]');
  }
  const runDir = expandPath(runInput);
  const state = await loadState(runDir);
  await withLock(runDir, async () => {
    const initialized = await initializeCoverQueue(runDir, state);
    const queue = initialized.queue;
    let requestPath = null;
    if (command === 'dispatch') requestPath = await dispatchCoverQueue(runDir, queue);
    if (command === 'inspect') await reconcileCoverQueue(runDir, queue);
    if (command === 'release') await releaseCoverQueue(queue, args.task_id, args.reason);
    if (command === 'heartbeat') heartbeatCoverQueue(queue, args.task_id);
    if (command !== 'init') {
      queue.updated_at = new Date().toISOString();
      await writeJson(join(runDir, initialized.path), queue);
    }
    emitJson({
      status: 'PASS', queue_path: initialized.path, created: initialized.created,
      queue_status: queue.status, task_status: queue.task.status,
      ...(requestPath ? { request_path: requestPath } : {})
    });
  });
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((error) => emitJson({
    status: 'BLOCKED',
    issues: error.issues || [issue('cover_queue_failed', error.message)]
  }, 2));
}

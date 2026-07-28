import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  COVER_LEASE_TTL_MS,
  dispatchCoverQueue,
  initializeCoverQueue,
  reconcileCoverQueue
} from '../scripts/cover-queue.mjs';
import { coverPaths } from '../scripts/wechat-cover-contracts.mjs';
import {
  validateBackendPreflight,
  validateVisualPreflight
} from '../scripts/visual-preflight.mjs';

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function state() {
  return {
    schema_version: 3,
    run_id: 'cover-queue-fixture',
    run_mode: 'reviewed',
    status: 'running',
    current_stage: 'visual',
    stages: {
      visual: {
        status: 'running', revision: 1, artifacts: [],
        body_visual: { status: 'running', attempt: 7, artifacts: [], error: null },
        wechat_cover: { status: 'running', attempt: 2, artifacts: [], error: null }
      }
    },
    gates: { visual: { status: 'approved' } }
  };
}

test('cover queue uses only nested cover_attempt and recycles an expired lease without a quality attempt', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'cover-queue-'));
  try {
    const runState = state();
    writeJson(join(runDir, 'run.json'), runState);
    const paths = coverPaths(runState);
    writeJson(join(runDir, paths.request), {
      schema_version: 2,
      task_id: 'wechat-cover:cover-queue-fixture:wechat:A:attempt-002',
      attempt: 2
    });
    const at = new Date('2026-07-27T00:00:00.000Z');
    const initialized = await initializeCoverQueue(runDir, runState, { now: at });
    assert.equal(initialized.path, '07-visual/wechat-cover/queue.v002.json');
    assert.equal(initialized.queue.cover_attempt, 2);
    assert.equal(Object.hasOwn(initialized.queue, 'body_visual'), false);

    const first = await dispatchCoverQueue(runDir, initialized.queue, { now: at });
    assert.equal(first, paths.request);
    assert.equal(initialized.queue.task.leases.length, 1);
    assert.equal(initialized.queue.task.leases[0].status, 'active');

    const afterExpiry = new Date(at.getTime() + COVER_LEASE_TTL_MS + 1);
    const second = await dispatchCoverQueue(runDir, initialized.queue, { now: afterExpiry });
    assert.equal(second, paths.request);
    assert.equal(initialized.queue.task.leases[0].status, 'abandoned');
    assert.equal(initialized.queue.task.leases[1].status, 'active');
    assert.equal(initialized.queue.task.quality_attempts_consumed, 0);

    writeJson(join(runDir, paths.result), { status: 'PASS' });
    await reconcileCoverQueue(runDir, initialized.queue, {
      now: new Date(afterExpiry.getTime() + 1000)
    });
    assert.equal(initialized.queue.status, 'completed');
    assert.equal(initialized.queue.task.status, 'pass');
    assert.equal(initialized.queue.timings.model_call.status, 'unobservable');
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test('backend preflight validates immutable profile and both consumer leases', async () => {
  const calls = [];
  const runtime = {
    async loadBackendProfile(runDir) {
      calls.push(['profile', runDir]);
      return { issues: [], value: { artifact: 'BackendProfile' } };
    },
    async loadBackendLease(runDir, _state, consumer) {
      calls.push(['lease', runDir, consumer]);
      return { issues: [], value: { artifact: 'BackendLease', consumer } };
    }
  };
  const report = await validateBackendPreflight('/runtime/run-id', state(), { runtime });
  assert.deepEqual(report.issues, []);
  assert.deepEqual(calls.map((item) => item.at(-1)), [
    '/runtime/run-id', 'body_visual', 'wechat_cover'
  ]);
});

test('visual preflight covers static visual dependencies before planning', async () => {
  const runtime = {
    async loadBackendProfile() { return { issues: [], value: {} }; },
    async loadBackendLease() { return { issues: [], value: {} }; }
  };
  const report = await validateVisualPreflight('/runtime/run-id', state(), {
    runtime,
    execute: async (_executable, args) => ({
      code: /(?:normalize_cover\.py|wechat-sketch-cover\/scripts\/provider-contract\.mjs)$/.test(args[0]) ? 2 : 0,
      stdout: '', stderr: ''
    })
  });
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.issues, []);
  for (const id of [
    'illustration_style_registry', 'prompt_compiler', 'brand_renderer',
    'geometry_profile', 'cover_style', 'cover_normalizer', 'cover_provider',
    'backend_profile', 'body_visual_lease', 'wechat_cover_lease'
  ]) {
    assert.equal(report.checks.find((item) => item.id === id)?.status, 'PASS', id);
  }
});

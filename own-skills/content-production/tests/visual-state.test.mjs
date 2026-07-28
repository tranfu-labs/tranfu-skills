import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateVisualArtifacts,
  bodyVisualAttempt,
  deriveVisualStatus,
  resetVisualAggregate,
  wechatCoverAttempt
} from '../scripts/visual-state.mjs';

test('body and cover attempts are independent and may complete together', () => {
  const visual = {
    status: 'running',
    revision: 3,
    body_visual: { status: 'completed', attempt: 2, artifacts: [{ path: 'body' }] },
    wechat_cover: { status: 'completed', attempt: 4, artifacts: [{ path: 'cover' }] }
  };
  const state = { stages: { visual } };
  assert.equal(bodyVisualAttempt(state), 2);
  assert.equal(wechatCoverAttempt(state), 4);
  assert.equal(deriveVisualStatus(visual), 'completed');
  assert.deepEqual(aggregateVisualArtifacts(visual), [{ path: 'body' }, { path: 'cover' }]);
});

test('one blocked component does not stop a runnable sibling', () => {
  assert.equal(deriveVisualStatus({
    body_visual: { status: 'running' },
    wechat_cover: { status: 'blocked' }
  }), 'running');
  assert.equal(deriveVisualStatus({
    body_visual: { status: 'completed' },
    wechat_cover: { status: 'blocked' }
  }), 'blocked');
});

test('legacy visual attempt is read only as a V2 compatibility fallback', () => {
  const state = { stages: { visual: { attempt: 7 } } };
  assert.equal(bodyVisualAttempt(state), 7);
  assert.equal(wechatCoverAttempt(state), 7);
});

test('upstream invalidation preserves independent attempts and resets both components', () => {
  const reset = resetVisualAggregate({
    status: 'completed',
    revision: 8,
    artifacts: [{ path: 'combined' }],
    body_visual: { status: 'completed', attempt: 2, artifacts: [{ path: 'body' }] },
    wechat_cover: { status: 'completed', attempt: 5, artifacts: [{ path: 'cover' }] }
  }, 'titles', '2026-07-28T00:00:00.000Z');

  assert.equal(reset.status, 'pending');
  assert.equal(reset.revision, 8);
  assert.equal(reset.body_visual.attempt, 2);
  assert.equal(reset.wechat_cover.attempt, 5);
  assert.equal(reset.body_visual.status, 'pending');
  assert.equal(reset.wechat_cover.status, 'pending');
  assert.deepEqual(reset.artifacts, []);
  assert.deepEqual(reset.body_visual.artifacts, []);
  assert.deepEqual(reset.wechat_cover.artifacts, []);
  assert.equal('attempt' in reset, false);
});

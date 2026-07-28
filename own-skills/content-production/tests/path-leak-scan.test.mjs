import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { findPathLeaks, scanPathLeaks } from '../scripts/scan-path-leaks.mjs';

test('recursive path scanner rejects macOS, Linux, Windows, and current-home leaks', () => {
  const value = {
    run: '/Users/example/run',
    nested: [{ config: '/home/alice/.config/app' }],
    windows: 'C:\\Users\\bob\\secret.json',
    portable: { root: 'RUN_ROOT', path: '07-visual/request.json' }
  };
  const leaks = findPathLeaks(value, { currentHome: '/private/current-home' });
  assert.equal(leaks.length, 3);
  assert.equal(leaks.some((item) => item.location.endsWith('.portable.path')), false);
});

test('recursive path scanner includes queue JSON and handoff Markdown but skips images', async () => {
  const root = mkdtempSync(join(tmpdir(), 'path-leak-scan-'));
  try {
    const write = (path, value) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, value);
    };
    write(join(root, '07-visual/generation-queue.json'), '{"adapter":"/Users/example/adapter.mjs"}');
    write(join(root, '09-qa/handoff.md'), 'Open /home/alice/private/output.md');
    write(join(root, '07-visual/image.png'), Buffer.from('/Users/example/not-text'));
    const report = await scanPathLeaks(root, { currentHome: '/private/current-home' });
    assert.equal(report.files.length, 2);
    assert.equal(report.leaks.length, 2);
    assert.deepEqual(report.leaks.map((item) => item.location).sort(), [
      '07-visual/generation-queue.json.adapter', '09-qa/handoff.md'
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

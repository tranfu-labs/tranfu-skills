import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = resolve('own-skills/content-production');
const script = join(root, 'scripts', 'migrate-v2-to-v3.mjs');

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function run(args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { status: result.status, json: JSON.parse(result.stdout) };
}

test('migration is dry-run by default and apply creates a non-destructive V3 copy', () => {
  const temp = mkdtempSync(join(tmpdir(), 'content-v3-migrate-'));
  const source = join(temp, 'source');
  const output = join(temp, 'output');
  try {
    write(join(source, 'run.json'), {
      schema_version: 2,
      run_id: 'legacy-run',
      status: 'blocked',
      current_stage: 'visual',
      capabilities: {},
      snapshots: { brief: { source_path: '/Users/example/private.md', snapshot_path: '00-intake/brief.md', sha256: 'a'.repeat(64) } },
      stages: {
        titles: { status: 'completed', attempt: 1, artifacts: [] },
        visual: { status: 'blocked', attempt: 2, artifacts: [] },
        package: { status: 'pending', attempt: 0, artifacts: [] },
        final_qa: { status: 'pending', attempt: 0, artifacts: [] }
      },
      gates: { titles: { status: 'approved' }, visual: { status: 'pending' }, final: { status: 'pending' } }
    });
    const before = readFileSync(join(source, 'run.json'), 'utf8');
    const dry = run([source]);
    assert.equal(dry.status, 0);
    assert.equal(dry.json.status, 'DRY_RUN');
    assert.equal(readFileSync(join(source, 'run.json'), 'utf8'), before);

    const applied = run([source, '--apply', '--output-root', output]);
    assert.equal(applied.status, 0, JSON.stringify(applied.json));
    const migrated = JSON.parse(readFileSync(join(output, 'legacy-run-v3', 'run.json'), 'utf8'));
    assert.equal(migrated.schema_version, 3);
    assert.equal(migrated.stages.visual.body_visual.attempt, 0);
    assert.equal(JSON.stringify(migrated).includes('/Users/'), false);
    assert.equal(readFileSync(join(source, 'run.json'), 'utf8'), before);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

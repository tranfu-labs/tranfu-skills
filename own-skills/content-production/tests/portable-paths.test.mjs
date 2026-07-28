import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  findRunDirFromRequest,
  portablePathRef,
  resolvePortablePathRef
} from '../scripts/lib.mjs';

const skillDir = resolve(import.meta.dirname, '..');
const scriptsDir = join(skillDir, 'scripts');
const topicProvider = join(skillDir, 'skills/content-topics/scripts/provider-contract.mjs');

function tempDir(name) {
  return mkdtempSync(join(tmpdir(), `content-production-portable-${name}-`));
}

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

function run(script, args) {
  return spawnSync(process.execPath, [join(scriptsDir, script), ...args], {
    cwd: skillDir,
    encoding: 'utf8'
  });
}

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function textFiles(root, current = root) {
  const results = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) results.push(...textFiles(root, path));
    else results.push(path);
  }
  return results;
}

function assertNoPrivatePath(value, label) {
  const text = String(value);
  const patterns = [
    /\/Users\/[^/\s"']+/,
    /\/home\/[^/\s"']+/,
    /[A-Za-z]:\\Users\\[^\\\s"']+/i,
    new RegExp(homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  ];
  for (const pattern of patterns) assert.doesNotMatch(text, pattern, label);
}

test('PortablePathRef accepts only supported roots and safe relative POSIX paths', () => {
  assert.deepEqual(portablePathRef('RUN_ROOT', '00-intake/brief.md'), {
    root: 'RUN_ROOT', path: '00-intake/brief.md'
  });
  for (const [root, path] of [
    ['UNKNOWN', 'file.md'],
    ['RUN_ROOT', '../file.md'],
    ['RUN_ROOT', '/tmp/file.md'],
    ['RUN_ROOT', 'folder\\file.md'],
    ['RUN_ROOT', 'folder//file.md']
  ]) assert.throws(() => portablePathRef(root, path));

  const root = tempDir('resolve');
  assert.equal(resolvePortablePathRef({ root: 'RUN_ROOT', path: 'file.md' }, { RUN_ROOT: root }), join(root, 'file.md'));
});

test('schema v3 run and provider v2 artifacts contain no local absolute paths', async () => {
  const root = tempDir('init');
  const material = join(root, 'private-material.md');
  write(material, '# Material\n\nPortable input.');
  const runsRoot = join(root, 'runs');
  const initialized = run('init-run.mjs', [
    'portable-run', '--root', runsRoot, '--brief', '验证可移植路径', '--material', material
  ]);
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  assertNoPrivatePath(initialized.stdout, 'init CLI output');
  const output = JSON.parse(initialized.stdout);
  assert.deepEqual(Object.keys(output).sort(), ['capability_status', 'run_id', 'run_path', 'status']);
  assert.equal(output.run_path, output.run_id);

  const runDir = join(runsRoot, output.run_id);
  const state = json(join(runDir, 'run.json'));
  assert.equal(state.schema_version, 3);
  assert.equal(state.stages.visual.revision, 0);
  assert.equal(Object.hasOwn(state.stages.visual, 'attempt'), false);
  assert.deepEqual(state.stages.visual.body_visual, { status: 'pending', attempt: 0, artifacts: [], error: null });
  assert.deepEqual(state.stages.visual.wechat_cover, { status: 'pending', attempt: 0, artifacts: [], error: null });
  assert.deepEqual(state.capabilities.config_ref, { root: 'SKILL_ROOT', path: 'capabilities.yaml' });
  assert.ok(Object.values(state.capabilities.providers).every((provider) => provider.skill_ref?.root === 'SKILL_ROOT'));
  assert.equal(JSON.stringify(state).includes('skill_path'), false);
  assert.equal(JSON.stringify(state).includes('config_path'), false);
  assert.equal(JSON.stringify(state).includes('source_path'), false);

  const materials = json(join(runDir, '00-intake/materials.json'));
  assert.deepEqual(Object.keys(materials.items[0]).sort(), ['basename', 'id', 'sha256', 'snapshot_path']);
  assert.equal(materials.items[0].basename, 'private-material.md');

  const built = run('create-topic-request.mjs', [runDir]);
  assert.equal(built.status, 0, built.stderr || built.stdout);
  assertNoPrivatePath(built.stdout, 'request builder CLI output');
  const requestRelative = JSON.parse(built.stdout).request_path;
  const requestPath = join(runDir, requestRelative);
  const request = json(requestPath);
  assert.equal(request.schema_version, 2);
  assert.equal(request.contract, 'content-production-provider/v2');
  assert.equal(Object.hasOwn(request, 'run_dir'), false);
  assert.equal(await findRunDirFromRequest(requestPath), runDir);

  const validated = spawnSync(process.execPath, [topicProvider, 'validate-request', requestPath], {
    cwd: skillDir,
    encoding: 'utf8'
  });
  assert.equal(validated.status, 0, validated.stderr || validated.stdout);
  assertNoPrivatePath(validated.stdout, 'provider CLI output');

  for (const path of textFiles(runDir)) {
    assertNoPrivatePath(readFileSync(path, 'utf8'), path.slice(runDir.length + 1));
  }
});

test('request ancestry lookup rejects a packet copied outside its run', async () => {
  const root = tempDir('ancestry');
  const runDir = join(root, 'run');
  const requestPath = join(runDir, '02-research', 'request.json');
  write(join(runDir, 'run.json'), '{"schema_version":3}');
  write(requestPath, '{}');
  assert.equal(await findRunDirFromRequest(requestPath), runDir);

  const detached = join(root, 'detached', 'request.json');
  write(detached, '{}');
  await assert.rejects(findRunDirFromRequest(detached), /Cannot locate run\.json/);
});

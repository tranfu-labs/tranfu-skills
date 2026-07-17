#!/usr/bin/env node

import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import {
  emitJson,
  expandPath,
  fileExists,
  fileSha256,
  parseArgs,
  readJson,
  writeJson
} from './lib.mjs';

const expectedArtifacts = [
  '01-discovery/discovery.md',
  '01-discovery/topic-candidates.md',
  '01-discovery/topic-candidates.json'
];
const snapshotInputs = [
  ['brief', '00-intake/brief.md'],
  ['materials', '00-intake/materials.json'],
  ['core_audience', '00-intake/core-audience.md'],
  ['platform_profiles', '00-intake/platform-profiles.json'],
  ['topic_history', '00-intake/topic-history.md'],
  ['article_audience', '00-intake/article-audience.md']
];

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function add(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: 'discovery', ...extra });
}

const args = parseArgs(process.argv.slice(2));
const [runInput] = args._;
const issues = [];

try {
  if (!runInput) throw new Error('Usage: create-topic-request.mjs <run-dir> [--output <run-relative-path>]');
  const runDir = expandPath(runInput);
  const statePath = join(runDir, 'run.json');
  if (!fileExists(statePath)) throw new Error(`Missing run.json: ${statePath}`);
  const runStat = await lstat(runDir);
  if (runStat.isSymbolicLink() || !runStat.isDirectory()) throw new Error('run-dir must be a real directory, not a symlink.');
  const runRealDir = await realpath(runDir);
  const state = await readJson(statePath);

  if (state.schema_version !== 2 || state.input_mode !== 'brief' || state.mode !== 'brief') {
    add(issues, 'topic_request_not_applicable', 'topic_planning request is only valid for a schema v2 brief run.');
  }
  if (state.status !== 'running' || state.current_stage !== 'discovery' || state.gates?.topic?.status !== 'pending') {
    add(issues, 'topic_request_stage_mismatch', 'Run must be active at discovery with a pending topic gate.');
  }
  if (state.capabilities?.providers?.topic_planning?.status !== 'PASS'
    || state.capabilities?.providers?.topic_planning?.contract !== 'topic-planning-v1') {
    add(issues, 'topic_provider_unavailable', 'The topic_planning provider snapshot is not PASS for topic-planning-v1.');
  }

  const inputs = [];
  for (const [role, path] of snapshotInputs) {
    const absolute = join(runDir, path);
    if (!fileExists(absolute)) {
      add(issues, 'missing_topic_input', `Missing topic input: ${path}.`, { role, path });
      continue;
    }
    const stat = await lstat(absolute);
    const real = await realpath(absolute);
    if (stat.isSymbolicLink() || !inside(runRealDir, real)) {
      add(issues, 'topic_input_symlink', `Topic input must be a real file inside run_dir: ${path}.`, { role, path });
      continue;
    }
    const actual = await fileSha256(absolute);
    const snapshot = state.snapshots?.[role];
    if (!snapshot || snapshot.snapshot_path !== path || snapshot.sha256 !== actual) {
      add(issues, 'topic_input_snapshot_drift', `Snapshot metadata is stale for ${role}.`, { role, path });
    }
    inputs.push({ role, path, sha256: actual });
  }

  const materialsPath = join(runDir, '00-intake', 'materials.json');
  if (fileExists(materialsPath)) {
    const materials = await readJson(materialsPath);
    if (!Array.isArray(materials.items)) {
      add(issues, 'invalid_materials_manifest', '00-intake/materials.json must contain an items array.');
    } else {
      const intakeDir = join(runDir, '00-intake');
      const ids = new Set();
      for (const item of materials.items) {
        if (!item?.id || ids.has(item.id) || !item?.snapshot_path || !/^[a-f0-9]{64}$/.test(item?.sha256 || '')) {
          add(issues, 'invalid_material_item', 'Each material needs a unique id, snapshot_path, and SHA-256.');
          continue;
        }
        ids.add(item.id);
        const absolute = resolve(intakeDir, item.snapshot_path);
        if (!inside(intakeDir, absolute) || !fileExists(absolute)) {
          add(issues, 'invalid_material_snapshot_path', `Material snapshot is missing or escapes intake: ${item.snapshot_path}.`, { id: item.id });
          continue;
        }
        const stat = await lstat(absolute);
        const real = await realpath(absolute);
        if (stat.isSymbolicLink() || !inside(runRealDir, real)) {
          add(issues, 'material_snapshot_symlink', `Material snapshot must be a real file inside run_dir: ${item.snapshot_path}.`, { id: item.id });
          continue;
        }
        const actual = await fileSha256(absolute);
        if (actual !== item.sha256) add(issues, 'material_snapshot_drift', `Material snapshot hash is stale: ${item.id}.`, { id: item.id });
        inputs.push({
          role: `material:${item.id}`,
          path: `00-intake/${item.snapshot_path}`,
          sha256: actual
        });
      }
    }
  }

  const outputPath = args.output
    ? expandPath(args.output, runDir)
    : join(runDir, '01-discovery', 'topic-planning.request.json');
  const discoveryDir = join(runDir, '01-discovery');
  if (!inside(discoveryDir, outputPath) || expectedArtifacts.includes(relative(runDir, outputPath).split('\\').join('/'))) {
    add(issues, 'topic_request_output_escape', 'Request packet must be a separate file inside 01-discovery.');
  } else if (dirname(outputPath) !== discoveryDir) {
    const parentIsSymlink = fileExists(dirname(outputPath)) && (await lstat(dirname(outputPath))).isSymbolicLink();
    add(
      issues,
      parentIsSymlink ? 'topic_request_output_symlink' : 'topic_request_output_parent',
      'Request packet must be a direct child of 01-discovery.'
    );
  } else {
    const discoveryStat = await lstat(discoveryDir);
    const discoveryReal = await realpath(discoveryDir);
    if (discoveryStat.isSymbolicLink() || !inside(runRealDir, discoveryReal)) {
      add(issues, 'topic_request_output_symlink', '01-discovery must be a real directory inside run_dir.');
    }
    if (fileExists(outputPath) && (await lstat(outputPath)).isSymbolicLink()) {
      add(issues, 'topic_request_output_symlink', 'Request packet path must not be a symbolic link.');
    }
  }

  if (issues.length) {
    emitJson({ status: 'BLOCKED', run_dir: runDir, blockers: issues }, 2);
  } else {
    const request = {
      schema_version: 1,
      contract: 'content-production-provider/v1',
      task_id: `topic-planning:${state.run_id}`,
      capability: 'topic_planning',
      provider_contract: 'topic-planning-v1',
      run_dir: runDir,
      run_mode: state.run_mode,
      mode: 'plan',
      inputs,
      output_dir: '01-discovery',
      expected_artifacts: expectedArtifacts,
      options: { input_mode: 'brief' },
      interaction_policy: 'return_to_orchestrator'
    };
    await writeJson(outputPath, request);
    emitJson({ status: 'PASS', task_id: request.task_id, request_path: outputPath, input_count: inputs.length });
  }
} catch (error) {
  emitJson({ status: 'BLOCKED', blockers: [{ code: 'topic_request_build_failed', message: error.message, resume_from: 'discovery' }] }, 2);
}

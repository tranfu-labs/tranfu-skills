#!/usr/bin/env node

import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import {
  emitJson,
  expandPath,
  fileExists,
  fileSha256,
  gateIntegrity,
  parseArgs,
  readJson,
  sha256,
  writeJson
} from './lib.mjs';

const expectedArtifacts = [
  '02-research/brief.md',
  '02-research/source-log.md',
  '02-research/claims.json',
  '02-research/evidence-map.md'
];
const snapshotInputs = [
  ['brief', '00-intake/brief.md'],
  ['materials', '00-intake/materials.json'],
  ['core_audience', '00-intake/core-audience.md'],
  ['article_audience', '00-intake/article-audience.md']
];

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function runRelative(runDir, path) {
  return relative(runDir, path).replaceAll('\\', '/');
}

function add(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: 'research', ...extra });
}

async function authorizeFile(runDir, runRealDir, role, path, issues) {
  const absolute = resolve(runDir, path);
  if (!inside(runDir, absolute) || !fileExists(absolute)) {
    add(issues, 'missing_source_input', `Missing source research input: ${path}.`, { role, path });
    return null;
  }
  const stat = await lstat(absolute);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    add(issues, 'source_input_symlink', `Source research input must be a real file inside run_dir: ${path}.`, { role, path });
    return null;
  }
  const real = await realpath(absolute);
  if (!inside(runRealDir, real)) {
    add(issues, 'source_input_symlink', `Resolved source research input escapes run_dir: ${path}.`, { role, path });
    return null;
  }
  return { role, path: runRelative(runDir, absolute), sha256: await fileSha256(absolute) };
}

async function validateDirectOutput(runDir, runRealDir, directory, output, issues, codePrefix) {
  if (!inside(directory, output) || dirname(output) !== directory) {
    const parent = dirname(output);
    const parentIsSymlink = fileExists(parent) && (await lstat(parent)).isSymbolicLink();
    add(issues, parentIsSymlink ? `${codePrefix}_symlink` : `${codePrefix}_escape`, `Output must be a direct child of ${runRelative(runDir, directory)}.`);
    return;
  }
  const directoryStat = await lstat(directory);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    add(issues, `${codePrefix}_symlink`, `${runRelative(runDir, directory)} must be a real directory inside run_dir.`);
    return;
  }
  const directoryReal = await realpath(directory);
  if (!inside(runRealDir, directoryReal)) {
    add(issues, `${codePrefix}_symlink`, `Resolved ${runRelative(runDir, directory)} escapes run_dir.`);
  }
  if (fileExists(output) && (await lstat(output)).isSymbolicLink()) {
    add(issues, `${codePrefix}_symlink`, 'Output path must not be a symbolic link.');
  }
}

const args = parseArgs(process.argv.slice(2));
const [runInput] = args._;
const issues = [];

try {
  if (!runInput) throw new Error('Usage: create-source-request.mjs <run-dir> [--output <run-relative-path>]');
  const runDir = expandPath(runInput);
  const statePath = join(runDir, 'run.json');
  if (!fileExists(statePath)) throw new Error(`Missing run.json: ${statePath}`);
  const runStat = await lstat(runDir);
  if (runStat.isSymbolicLink() || !runStat.isDirectory()) throw new Error('run-dir must be a real directory, not a symlink.');
  const runRealDir = await realpath(runDir);
  const stateStat = await lstat(statePath);
  if (stateStat.isSymbolicLink() || !stateStat.isFile() || !inside(runRealDir, await realpath(statePath))) {
    throw new Error('run.json must be a real file inside run-dir.');
  }
  const state = await readJson(statePath);

  if (state.schema_version !== 2 || !['brief', 'topic', 'outline'].includes(state.input_mode)) {
    add(issues, 'source_request_not_applicable', 'source_research requires a schema v2 brief, topic, or outline run.');
  }
  if (state.status !== 'running' || state.current_stage !== 'research'
    || state.gates?.topic?.status !== 'approved'
    || !['pending', 'running'].includes(state.stages?.research?.status)) {
    add(issues, 'source_request_stage_mismatch', 'Run must be active at research with an approved topic gate.');
  }
  if (state.capabilities?.providers?.source_research?.status !== 'PASS'
    || state.capabilities?.providers?.source_research?.contract !== 'source-research-v1') {
    add(issues, 'source_provider_unavailable', 'The source_research provider snapshot is not PASS for source-research-v1.');
  }
  const integrityIssues = await gateIntegrity(runDir, state);
  for (const issue of integrityIssues) add(issues, issue.code, 'An approved topic artifact changed or disappeared.', issue);

  const inputs = [];
  for (const [role, path] of snapshotInputs) {
    const input = await authorizeFile(runDir, runRealDir, role, path, issues);
    if (!input) continue;
    const snapshot = state.snapshots?.[role];
    if (!snapshot || snapshot.snapshot_path !== path || snapshot.sha256 !== input.sha256) {
      add(issues, 'source_input_snapshot_drift', `Snapshot metadata is stale for ${role}.`, { role, path });
    }
    inputs.push(input);
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
        const input = await authorizeFile(runDir, runRealDir, `material:${item.id}`, `00-intake/${item.snapshot_path}`, issues);
        if (!input) continue;
        const expected = resolve(intakeDir, item.snapshot_path);
        if (!inside(intakeDir, expected) || input.path !== runRelative(runDir, expected)) {
          add(issues, 'invalid_material_snapshot_path', `Material snapshot escapes intake: ${item.snapshot_path}.`, { id: item.id });
        }
        if (input.sha256 !== item.sha256) {
          add(issues, 'material_snapshot_drift', `Material snapshot hash is stale: ${item.id}.`, { id: item.id });
        }
        inputs.push(input);
      }
    }
  }

  let topic = null;
  let authority = null;
  const modeInputs = [];
  if (state.input_mode === 'brief') {
    const decision = state.gates.topic.decision_ref;
    const candidatesBinding = state.gates.topic.bound_artifacts?.find((item) => /^topic-candidates(?:\.v\d{3})?\.json$/.test(basename(item.path)));
    const discoveryBinding = state.stages.discovery?.artifacts?.find((item) => /^discovery(?:\.v\d{3})?\.md$/.test(basename(item.path)));
    if (!decision?.path || !candidatesBinding || !discoveryBinding) {
      add(issues, 'missing_approved_topic_inputs', 'Brief research requires bound discovery, topic candidates, and topic decision files.');
    } else {
      const discoveryInput = await authorizeFile(runDir, runRealDir, 'topic_discovery', discoveryBinding.path, issues);
      const candidatesInput = await authorizeFile(runDir, runRealDir, 'topic_candidates', candidatesBinding.path, issues);
      const decisionInput = await authorizeFile(runDir, runRealDir, 'topic_decision', decision.path, issues);
      if (discoveryInput) modeInputs.push(discoveryInput);
      if (candidatesInput) modeInputs.push(candidatesInput);
      if (decisionInput) modeInputs.push(decisionInput);
      for (const [input, binding] of [
        [discoveryInput, discoveryBinding],
        [candidatesInput, candidatesBinding],
        [decisionInput, decision]
      ]) {
        if (input && input.sha256 !== binding.sha256) {
          add(issues, 'source_authority_drift', `Approved source research authority changed: ${binding.path}.`, { path: binding.path });
        }
      }
      if (candidatesInput && decisionInput) {
        const candidates = await readJson(join(runDir, candidatesInput.path));
        const selected = await readJson(join(runDir, decisionInput.path));
        const candidate = candidates.candidates?.find((item) => item.id === selected.topic_id);
        if (!candidate?.topic) add(issues, 'topic_decision_mismatch', 'Approved topic decision does not resolve to a candidate topic.');
        else topic = candidate.topic;
        authority = { kind: 'topic_decision', path: decisionInput.path, sha256: decisionInput.sha256 };
      }
    }
  } else {
    const skipInput = await authorizeFile(runDir, runRealDir, 'discovery_skip', '01-discovery/skip.json', issues);
    if (skipInput) modeInputs.push(skipInput);
    if (state.input_mode === 'topic') {
      const decision = state.gates.topic.decision_ref;
      if (!decision?.inline || decision.sha256 !== sha256(decision.inline)) {
        add(issues, 'invalid_inline_topic_authority', 'Topic entry must retain its approved inline topic and hash.');
      } else {
        topic = decision.inline;
        const briefInput = inputs.find((item) => item.role === 'brief');
        authority = { kind: 'user_topic', path: briefInput?.path, sha256: briefInput?.sha256 };
      }
    } else {
      const outlineInput = await authorizeFile(runDir, runRealDir, 'provided_outline', '03-outline/provided-outline.md', issues);
      if (outlineInput) {
        modeInputs.push(outlineInput);
        authority = { kind: 'user_outline', path: outlineInput.path, sha256: outlineInput.sha256 };
      }
    }
  }

  const discoveryDir = join(runDir, '01-discovery');
  const researchDir = join(runDir, '02-research');
  const subjectPath = join(discoveryDir, 'research-subject.json');
  const requestPath = args.output
    ? expandPath(args.output, runDir)
    : join(researchDir, 'source-research.request.json');
  await validateDirectOutput(runDir, runRealDir, discoveryDir, subjectPath, issues, 'research_subject_output');
  await validateDirectOutput(runDir, runRealDir, researchDir, requestPath, issues, 'source_request_output');
  if (expectedArtifacts.includes(runRelative(runDir, requestPath))) {
    add(issues, 'source_request_output_escape', 'Request packet must not replace a research artifact.');
  }

  if (issues.length) {
    emitJson({ status: 'BLOCKED', run_dir: runDir, blockers: issues }, 2);
  } else {
    const subject = {
      schema_version: 1,
      input_mode: state.input_mode,
      topic,
      authority
    };
    await writeJson(subjectPath, subject);
    const subjectInput = {
      role: 'research_subject',
      path: runRelative(runDir, subjectPath),
      sha256: await fileSha256(subjectPath)
    };
    const request = {
      schema_version: 1,
      contract: 'content-production-provider/v1',
      task_id: `source-research:${state.run_id}`,
      capability: 'source_research',
      provider_contract: 'source-research-v1',
      run_dir: runDir,
      run_mode: state.run_mode,
      mode: 'research',
      inputs: [subjectInput, ...inputs, ...modeInputs],
      output_dir: '02-research',
      expected_artifacts: expectedArtifacts,
      options: { input_mode: state.input_mode },
      interaction_policy: 'return_to_orchestrator'
    };
    await writeJson(requestPath, request);
    emitJson({ status: 'PASS', task_id: request.task_id, request_path: requestPath, subject_path: subjectPath, input_count: request.inputs.length });
  }
} catch (error) {
  emitJson({ status: 'BLOCKED', blockers: [{ code: 'source_request_build_failed', message: error.message, resume_from: 'research' }] }, 2);
}

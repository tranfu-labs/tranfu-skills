#!/usr/bin/env node

import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import { validateResearchPackage, validateResearchProviderResult } from './contracts.mjs';
import {
  emitJson,
  expandPath,
  fileExists,
  fileSha256,
  gateIntegrity,
  parseArgs,
  platforms,
  readJson,
  readText,
  variants,
  writeJson,
  writeText
} from './lib.mjs';

const researchArtifacts = [
  '02-research/brief.md',
  '02-research/source-log.md',
  '02-research/claims.json',
  '02-research/evidence-map.md'
];
const executionStrategies = new Set(['parallel_subagents', 'sequential_fallback']);
const modeStages = { outline: 'outline', master: 'masters', adapt: 'platforms' };

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function runRelative(runDir, path) {
  return relative(runDir, path).replaceAll('\\', '/');
}

function add(issues, mode, code, message, extra = {}) {
  issues.push({ code, message, resume_from: modeStages[mode] || 'outline', ...extra });
}

async function hasSymlinkComponent(root, path) {
  const rel = relative(root, path);
  if (!inside(root, path)) return true;
  let current = root;
  for (const part of rel.split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    if (fileExists(current) && (await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

async function authorizeFile(runDir, runRealDir, mode, role, path, issues, binding = null) {
  const absolute = resolve(runDir, path);
  if (!inside(runDir, absolute) || !fileExists(absolute)) {
    add(issues, mode, 'missing_drafting_input', `Missing drafting input: ${path}.`, { role, path });
    return null;
  }
  const stat = await lstat(absolute);
  if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(runDir, absolute)) {
    add(issues, mode, 'drafting_input_symlink', `Drafting input must be a real file under run_dir: ${path}.`, { role, path });
    return null;
  }
  const real = await realpath(absolute);
  if (!inside(runRealDir, real)) {
    add(issues, mode, 'drafting_input_symlink', `Resolved drafting input escapes run_dir: ${path}.`, { role, path });
    return null;
  }
  const input = { role, path: runRelative(runDir, absolute), sha256: await fileSha256(absolute) };
  if (binding && (binding.path !== input.path || binding.sha256 !== input.sha256)) {
    add(issues, mode, 'drafting_input_binding_drift', `Drafting input no longer matches its approved or completed binding: ${path}.`, {
      role,
      path: input.path,
      expected_path: binding.path,
      expected_sha256: binding.sha256,
      actual_sha256: input.sha256
    });
  }
  return input;
}

async function authorizeSnapshot(runDir, runRealDir, state, mode, role, expectedPath, issues) {
  const input = await authorizeFile(runDir, runRealDir, mode, role, expectedPath, issues);
  if (!input) return null;
  const snapshot = state.snapshots?.[role];
  if (!snapshot || snapshot.snapshot_path !== input.path || snapshot.sha256 !== input.sha256) {
    add(issues, mode, 'drafting_snapshot_drift', `Snapshot metadata is stale for ${role}.`, {
      role,
      path: input.path
    });
  }
  return input;
}

function exactBindings(issues, mode, actual, expected, code, message) {
  const paths = (actual || []).map((item) => item?.path);
  const valid = paths.length === expected.length
    && new Set(paths).size === expected.length
    && expected.every((path) => paths.includes(path))
    && (actual || []).every((item) => /^[a-f0-9]{64}$/.test(item?.sha256 || ''));
  if (!valid) add(issues, mode, code, message, { expected, actual: paths });
  return new Map((actual || []).filter((item) => item?.path).map((item) => [item.path, item]));
}

function singleBinding(issues, mode, bindings, pattern, label) {
  const matches = (bindings || []).filter((item) => pattern.test(basename(item?.path || '')));
  if (matches.length !== 1) {
    add(issues, mode, 'invalid_drafting_gate_binding', `Expected exactly one active ${label} binding.`, {
      matches: matches.map((item) => item.path)
    });
    return null;
  }
  return matches[0];
}

function versionOf(path) {
  return basename(path || '').match(/\.v(\d{3})\.md$/)?.[1] || '001';
}

function bodyWithoutFirstH1(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const heading = lines.findIndex((line) => /^#(?!#)\s+\S/.test(line));
  if (heading >= 0) lines.splice(heading, 1);
  while (lines[0] === '') lines.shift();
  while (lines.at(-1) === '') lines.pop();
  return lines.join('\n');
}

async function renderAudienceSnapshot(runDir, state, platform, variant) {
  const corePath = join(runDir, '00-intake', 'core-audience.md');
  const profilesPath = join(runDir, '00-intake', 'platform-profiles.json');
  const articlePath = join(runDir, '00-intake', 'article-audience.md');
  const [core, profiles, article] = await Promise.all([
    readText(corePath),
    readJson(profilesPath),
    readText(articlePath)
  ]);
  const overlay = profiles.platforms?.[platform]?.audience_overlay;
  if (!overlay || !profiles.profile_set?.version) throw new Error(`Missing audience profile for ${platform}.`);

  const base = `05-platforms/${platform}/${variant}`;
  const markdownRelative = `${base}/audience-snapshot.md`;
  const jsonRelative = `${base}/audience-snapshot.json`;
  await writeText(join(runDir, markdownRelative), `# ${platform} 受众快照

## 核心受众

${bodyWithoutFirstH1(core)}

## 平台覆盖层

\`\`\`json
${JSON.stringify(overlay, null, 2)}
\`\`\`

## 本篇细分受众

${bodyWithoutFirstH1(article)}`);
  await writeJson(join(runDir, jsonRelative), {
    schema_version: 1,
    platform,
    variant,
    merge_order: ['core_audience', 'platform_overlay', 'article_segment'],
    sources: {
      core_audience: { path: '00-intake/core-audience.md', sha256: await fileSha256(corePath) },
      platform_profiles: {
        path: '00-intake/platform-profiles.json',
        sha256: await fileSha256(profilesPath),
        profile_set_version: profiles.profile_set.version,
        platform_id: platform
      },
      article_audience: {
        path: '00-intake/article-audience.md',
        sha256: await fileSha256(articlePath),
        empty: Boolean(state.snapshots?.article_audience?.empty)
      }
    },
    merged_snapshot: { path: markdownRelative, sha256: await fileSha256(join(runDir, markdownRelative)) }
  });
  return [
    { role: 'audience_snapshot', path: markdownRelative, sha256: await fileSha256(join(runDir, markdownRelative)) },
    { role: 'audience_manifest', path: jsonRelative, sha256: await fileSha256(join(runDir, jsonRelative)) }
  ];
}

async function validateOutput(runDir, runRealDir, mode, outputDir, requestPath, expectedArtifacts, issues) {
  const directory = resolve(runDir, outputDir);
  if (!inside(runDir, directory) || !fileExists(directory)) {
    add(issues, mode, 'drafting_request_output_escape', `Missing canonical drafting output directory: ${outputDir}.`);
    return;
  }
  const directoryStat = await lstat(directory);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()
    || await hasSymlinkComponent(runDir, directory)
    || !inside(runRealDir, await realpath(directory))) {
    add(issues, mode, 'drafting_request_output_symlink', `Drafting output directory must be a real directory under run_dir: ${outputDir}.`);
    return;
  }
  if (dirname(requestPath) !== directory || !inside(directory, requestPath)) {
    add(issues, mode, 'drafting_request_output_escape', `Request packet must be a direct child of ${outputDir}.`);
  } else if (fileExists(requestPath)
    && ((await lstat(requestPath)).isSymbolicLink() || await hasSymlinkComponent(runDir, requestPath))) {
    add(issues, mode, 'drafting_request_output_symlink', 'Request packet path must not be a symbolic link.');
  }
  for (const path of expectedArtifacts) {
    const absolute = resolve(runDir, path);
    if (!inside(directory, absolute) || dirname(absolute) !== directory) {
      add(issues, mode, 'drafting_artifact_output_escape', `Expected artifact must be a direct child of ${outputDir}: ${path}.`, { path });
    } else if (fileExists(absolute)
      && ((await lstat(absolute)).isSymbolicLink() || await hasSymlinkComponent(runDir, absolute))) {
      add(issues, mode, 'drafting_artifact_output_symlink', `Expected artifact path must not be a symbolic link: ${path}.`, { path });
    }
  }
}

function outlineRevisionSuffix(revision) {
  return revision === 1 ? '' : `.v${String(revision).padStart(3, '0')}`;
}

function definitionFor(mode, variant, platform, revision = 1) {
  if (mode === 'outline') {
    const suffix = outlineRevisionSuffix(revision);
    return {
      outputDir: '03-outline',
      requestFile: `drafting-outline${suffix}.request.json`,
      expectedArtifacts: [
        `03-outline/control-outline${suffix}.md`,
        `03-outline/A-structure${suffix}.md`,
        `03-outline/B-structure${suffix}.md`
      ]
    };
  }
  if (mode === 'master') {
    const outputDir = `04-masters/${variant}`;
    return {
      outputDir,
      requestFile: 'drafting-master.request.json',
      expectedArtifacts: [`${outputDir}/final.md`, `${outputDir}/review.md`, `${outputDir}/provenance.json`]
    };
  }
  const outputDir = `05-platforms/${platform}/${variant}`;
  return {
    outputDir,
    requestFile: 'drafting-adapt.request.json',
    expectedArtifacts: [
      `${outputDir}/draft.md`,
      `${outputDir}/audience-snapshot.md`,
      `${outputDir}/audience-snapshot.json`,
      `${outputDir}/provenance.json`
    ]
  };
}

function taskId(state, mode, variant, platform, revision = 1) {
  if (mode === 'outline') return `drafting:outline:${state.run_id}:v${String(revision).padStart(3, '0')}`;
  const stage = modeStages[mode];
  const attempt = state.stages[stage].attempt;
  const attemptSuffix = `attempt-${String(attempt).padStart(3, '0')}`;
  if (mode === 'master') return `drafting:master:${state.run_id}:${variant}:${attemptSuffix}`;
  return `drafting:adapt:${state.run_id}:${platform}:${variant}:${attemptSuffix}`;
}

const args = parseArgs(process.argv.slice(2));
const [runInput, mode, ...extraPositionals] = args._;
const issues = [];

try {
  if (!runInput || !['outline', 'master', 'adapt'].includes(mode) || extraPositionals.length) {
    throw new Error('Usage: create-drafting-request.mjs <run-dir> <outline|master|adapt> [--variant A|B] [--platform id] [--model id] [--parameters-json json] [--execution-strategy parallel_subagents|sequential_fallback]');
  }
  const allowedOptions = new Set(['_', 'variant', 'platform', 'model', 'parameters_json', 'execution_strategy']);
  const unknownOptions = Object.keys(args).filter((key) => !allowedOptions.has(key));
  if (unknownOptions.length) throw new Error(`Unknown option(s): ${unknownOptions.join(', ')}.`);

  const variant = args.variant;
  const platform = args.platform;
  if (mode === 'outline' && (variant !== undefined || platform !== undefined)) {
    throw new Error('outline mode does not accept --variant or --platform.');
  }
  if (['master', 'adapt'].includes(mode) && !variants.includes(variant)) {
    throw new Error(`${mode} mode requires --variant A or --variant B.`);
  }
  if (mode === 'master' && platform !== undefined) throw new Error('master mode does not accept --platform.');
  if (mode === 'adapt' && !platforms.includes(platform)) {
    throw new Error(`adapt mode requires --platform ${platforms.join('|')}.`);
  }

  const executionStrategy = args.execution_strategy || 'parallel_subagents';
  if (!executionStrategies.has(executionStrategy)) {
    throw new Error('execution-strategy must be parallel_subagents or sequential_fallback.');
  }
  const model = args.model || 'runtime-default';
  if (typeof model !== 'string' || !model.trim()) throw new Error('model must be a non-empty string.');
  let parameters = {};
  if (args.parameters_json !== undefined) {
    if (typeof args.parameters_json !== 'string') throw new Error('parameters-json requires a JSON object.');
    parameters = JSON.parse(args.parameters_json);
    if (!parameters || Array.isArray(parameters) || typeof parameters !== 'object') {
      throw new Error('parameters-json must decode to a JSON object.');
    }
  }

  const runDir = expandPath(runInput);
  const statePath = join(runDir, 'run.json');
  if (!fileExists(runDir) || !fileExists(statePath)) throw new Error(`Missing run.json: ${statePath}`);
  const runStat = await lstat(runDir);
  if (runStat.isSymbolicLink() || !runStat.isDirectory()) throw new Error('run-dir must be a real directory, not a symlink.');
  const runRealDir = await realpath(runDir);
  const stateStat = await lstat(statePath);
  if (stateStat.isSymbolicLink() || !stateStat.isFile()
    || await hasSymlinkComponent(runDir, statePath)
    || !inside(runRealDir, await realpath(statePath))) {
    throw new Error('run.json must be a real file inside run-dir.');
  }
  const state = await readJson(statePath);
  const stage = modeStages[mode];
  const revision = mode === 'outline' ? Math.max(1, (state.gates?.outline?.revision || 0) + 1) : null;

  if (state.schema_version !== 2 || !['brief', 'topic', 'outline'].includes(state.input_mode)) {
    add(issues, mode, 'drafting_request_not_applicable', 'drafting requires a schema v2 brief, topic, or outline run.');
  }
  if (state.status !== 'running' || state.current_stage !== stage
    || state.stages?.[stage]?.status !== 'running'
    || !Number.isInteger(state.stages?.[stage]?.attempt) || state.stages[stage].attempt < 1) {
    add(issues, mode, 'drafting_request_stage_mismatch', `Run stage ${stage} must be running with a positive attempt.`, {
      current_stage: state.current_stage,
      stage_status: state.stages?.[stage]?.status || null,
      stage_attempt: state.stages?.[stage]?.attempt ?? null
    });
  }
  if (state.capabilities?.providers?.drafting?.status !== 'PASS'
    || state.capabilities?.providers?.drafting?.contract !== 'drafting-v1') {
    add(issues, mode, 'drafting_provider_unavailable', 'The drafting provider snapshot is not PASS for drafting-v1.');
  }
  const integrityIssues = await gateIntegrity(runDir, state);
  for (const issue of integrityIssues) {
    add(issues, mode, issue.code, 'An approved artifact changed or disappeared.', issue);
  }

  if (state.gates?.topic?.status !== 'approved' || state.stages?.research?.status !== 'completed') {
    add(issues, mode, 'drafting_prerequisite_missing', 'Drafting requires an approved topic gate and completed research.');
  }
  if (mode === 'outline' && !['pending', 'blocked'].includes(state.gates?.outline?.status)) {
    add(issues, mode, 'drafting_gate_mismatch', 'outline mode requires an unapproved outline gate.');
  }
  if (mode !== 'outline'
    && (state.gates?.outline?.status !== 'approved' || state.stages?.outline?.status !== 'completed')) {
    add(issues, mode, 'drafting_gate_mismatch', `${mode} mode requires a completed and approved outline.`);
  }
  if (mode === 'adapt' && state.stages?.masters?.status !== 'completed') {
    add(issues, mode, 'drafting_prerequisite_missing', 'adapt mode requires the masters stage to be completed.');
  }

  const researchBindings = exactBindings(
    issues,
    mode,
    state.stages?.research?.artifacts,
    researchArtifacts,
    'invalid_drafting_research_binding',
    'The completed research stage must bind exactly the canonical four-file package.'
  );
  const researchValidation = await validateResearchPackage(runDir);
  for (const issue of researchValidation.issues) add(issues, mode, issue.code, issue.message, issue);
  const researchProviderValidation = await validateResearchProviderResult(runDir);
  for (const issue of researchProviderValidation.issues) add(issues, mode, issue.code, issue.message, issue);

  const inputs = [];
  const push = (input) => { if (input) inputs.push(input); };
  const sourceRequestInputs = new Map(
    (researchProviderValidation.request?.inputs || []).map((item) => [item.role, item])
  );

  if (mode === 'outline') {
    const subjectInput = await authorizeFile(
      runDir,
      runRealDir,
      mode,
      'research_subject',
      '01-discovery/research-subject.json',
      issues,
      sourceRequestInputs.get('research_subject') || null
    );
    push(subjectInput);
    if (subjectInput) {
      try {
        const subject = await readJson(join(runDir, subjectInput.path));
        if (subject.schema_version !== 1 || subject.input_mode !== state.input_mode) {
          add(issues, mode, 'invalid_drafting_research_subject', 'Research subject does not match the run input mode.', {
            path: subjectInput.path
          });
        }
      } catch (error) {
        add(issues, mode, 'invalid_drafting_research_subject', error.message, { path: subjectInput.path });
      }
    }
    for (const [role, path] of [
      ['research_brief', '02-research/brief.md'],
      ['source_log', '02-research/source-log.md'],
      ['claims', '02-research/claims.json'],
      ['evidence_map', '02-research/evidence-map.md']
    ]) {
      push(await authorizeFile(runDir, runRealDir, mode, role, path, issues, researchBindings.get(path)));
    }
    push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'brief', '00-intake/brief.md', issues));
    push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'core_audience', '00-intake/core-audience.md', issues));
    push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'platform_profiles', '00-intake/platform-profiles.json', issues));
    push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'article_audience', '00-intake/article-audience.md', issues));

    if (state.input_mode === 'brief') {
      const candidates = singleBinding(
        issues,
        mode,
        state.gates.topic.bound_artifacts,
        /^topic-candidates(?:\.v\d{3})?\.json$/,
        'topic candidates'
      );
      const decision = state.gates.topic.decision_ref;
      if (!decision?.path) {
        add(issues, mode, 'invalid_drafting_topic_authority', 'Brief entry requires a file-backed approved topic decision.');
      } else {
        push(await authorizeFile(runDir, runRealDir, mode, 'topic_decision', decision.path, issues, decision));
      }
      if (candidates) {
        push(await authorizeFile(runDir, runRealDir, mode, 'topic_candidates', candidates.path, issues, candidates));
      }
    } else {
      const skipBinding = (state.stages?.discovery?.artifacts || []).find((item) => item.path === '01-discovery/skip.json');
      if (!skipBinding) add(issues, mode, 'invalid_drafting_entry_binding', 'Topic and outline entries require the bound discovery skip record.');
      push(await authorizeFile(runDir, runRealDir, mode, 'discovery_skip', '01-discovery/skip.json', issues, skipBinding));
      if (state.input_mode === 'outline') {
        const supplied = (state.gates.topic.bound_artifacts || []).find((item) => item.path === '03-outline/provided-outline.md');
        if (!supplied) add(issues, mode, 'invalid_drafting_entry_binding', 'Outline entry requires the approved provided outline binding.');
        push(await authorizeFile(runDir, runRealDir, mode, 'provided_outline', '03-outline/provided-outline.md', issues, supplied));
      }
    }

  } else {
    if (mode === 'master') {
      for (const [role, path] of [
        ['research_brief', '02-research/brief.md'],
        ['claims', '02-research/claims.json'],
        ['evidence_map', '02-research/evidence-map.md']
      ]) {
        push(await authorizeFile(runDir, runRealDir, mode, role, path, issues, researchBindings.get(path)));
      }
      const outlineBindings = state.gates.outline.bound_artifacts || [];
      const control = singleBinding(issues, mode, outlineBindings, /^control-outline(?:\.v\d{3})?\.md$/, 'control outline');
      const structures = Object.fromEntries(variants.map((item) => [item, singleBinding(
        issues,
        mode,
        outlineBindings,
        new RegExp(`^${item}-structure(?:\\.v\\d{3})?\\.md$`),
        `${item} structure`
      )]));
      const activeBindings = [control, structures.A, structures.B].filter(Boolean);
      if (outlineBindings.length !== 3 || new Set(outlineBindings.map((item) => item.path)).size !== 3) {
        add(issues, mode, 'invalid_drafting_gate_binding', 'Outline gate must bind exactly one control outline and both branch structures.');
      }
      if (activeBindings.length === 3
        && activeBindings.some((binding) => versionOf(binding.path) !== versionOf(control.path))) {
        add(issues, mode, 'drafting_outline_version_mismatch', 'Control outline and both branch structures must use the same revision.', {
          paths: activeBindings.map((binding) => binding.path)
        });
      }
      const outlineStageBindings = new Map((state.stages.outline.artifacts || []).map((item) => [item.path, item]));
      if (state.stages.outline.artifacts?.length !== 3) {
        add(issues, mode, 'drafting_outline_stage_binding_mismatch', 'Completed outline stage must bind exactly the active three-file outline package.');
      }
      for (const binding of activeBindings) {
        if (binding && outlineStageBindings.get(binding.path)?.sha256 !== binding.sha256) {
          add(issues, mode, 'drafting_outline_stage_binding_mismatch', `Approved outline input is not bound by the completed outline stage: ${binding.path}.`, { path: binding.path });
        }
      }
      const structure = structures[variant];
      if (control) push(await authorizeFile(runDir, runRealDir, mode, 'control_outline', control.path, issues, control));
      if (structure) push(await authorizeFile(runDir, runRealDir, mode, 'structure', structure.path, issues, structure));
      push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'core_audience', '00-intake/core-audience.md', issues));
      push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'article_audience', '00-intake/article-audience.md', issues));
      if (variant === 'B') {
        push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'style_b', '00-intake/style-b.md', issues));
      }
    } else {
      const masterPaths = variants.flatMap((item) => [
        `04-masters/${item}/final.md`,
        `04-masters/${item}/review.md`,
        `04-masters/${item}/provenance.json`
      ]);
      const masterBindings = exactBindings(
        issues,
        mode,
        state.stages.masters.artifacts,
        masterPaths,
        'invalid_drafting_master_binding',
        'The completed masters stage must bind exactly both canonical three-file packages.'
      );
      const masterPath = `04-masters/${variant}/final.md`;
      const provenancePath = `04-masters/${variant}/provenance.json`;
      push(await authorizeFile(runDir, runRealDir, mode, 'source_master', masterPath, issues, masterBindings.get(masterPath)));
      push(await authorizeFile(runDir, runRealDir, mode, 'master_provenance', provenancePath, issues, masterBindings.get(provenancePath)));
      push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'core_audience', '00-intake/core-audience.md', issues));
      push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'platform_profiles', '00-intake/platform-profiles.json', issues));
      push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'article_audience', '00-intake/article-audience.md', issues));
      if (variant === 'B') {
        push(await authorizeSnapshot(runDir, runRealDir, state, mode, 'style_b', '00-intake/style-b.md', issues));
      }
    }
  }

  const definition = definitionFor(mode, variant, platform, revision);
  const requestPath = join(runDir, definition.outputDir, definition.requestFile);
  await validateOutput(runDir, runRealDir, mode, definition.outputDir, requestPath, definition.expectedArtifacts, issues);

  if (issues.length) {
    emitJson({ status: 'BLOCKED', run_dir: runDir, blockers: issues }, 2);
  } else {
    if (mode === 'adapt') inputs.push(...await renderAudienceSnapshot(runDir, state, platform, variant));
    const options = {
      input_mode: state.input_mode,
      execution_strategy: executionStrategy,
      model: model.trim(),
      parameters,
      ...(mode === 'outline' ? { revision } : {}),
      ...(variant ? { variant } : {}),
      ...(platform ? { platform } : {})
    };
    const request = {
      schema_version: 1,
      contract: 'content-production-provider/v1',
      task_id: taskId(state, mode, variant, platform, revision),
      capability: 'drafting',
      provider_contract: 'drafting-v1',
      run_dir: runDir,
      run_mode: state.run_mode,
      mode,
      inputs,
      output_dir: definition.outputDir,
      expected_artifacts: definition.expectedArtifacts,
      options,
      interaction_policy: 'return_to_orchestrator'
    };
    await writeJson(requestPath, request);
    emitJson({
      status: 'PASS',
      task_id: request.task_id,
      request_path: requestPath,
      input_count: request.inputs.length
    });
  }
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    blockers: [{
      code: 'drafting_request_build_failed',
      message: error.message,
      resume_from: modeStages[mode] || 'outline'
    }]
  }, 2);
}

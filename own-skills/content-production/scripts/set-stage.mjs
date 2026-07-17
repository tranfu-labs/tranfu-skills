#!/usr/bin/env node
import { join } from 'node:path';
import {
  expectedDraftingStageArtifacts,
  expectedProofreadingStageArtifacts,
  expectedTitleStageArtifacts,
  validateDraftingMastersStage,
  validateDraftingOutlineStage,
  validateDraftingPlatformsStage,
  validateProofreadingStage,
  validateTitleGenerationStage,
  validateResearchPackage,
  validateResearchProviderResult
} from './contracts.mjs';
import {
  expectedVisualStageArtifacts,
  validateIllustrationGeneration
} from './illustration-contracts.mjs';
import {
  expectedWechatCoverStageArtifacts,
  validateWechatCover
} from './wechat-cover-contracts.mjs';
import {
  compressionPlanPath,
  compressionProviderRequired,
  expectedPackageStageArtifacts,
  validatePublishPackages
} from './package-contracts.mjs';
import {
  validateWechatLayoutDelivery,
  wechatLayoutPaths,
  wechatLayoutProviderRequired
} from './wechat-layout-contracts.mjs';
import {
  artifactBinding,
  emitJson,
  expandPath,
  fileExists,
  gateIntegrity,
  parseArgs,
  readJson,
  relativeTo,
  stageOrder,
  writeJson
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const [runArg, stage, status] = args._;
const allowedStatuses = ['pending', 'running', 'blocked', 'completed'];
const researchArtifacts = [
  '02-research/brief.md',
  '02-research/source-log.md',
  '02-research/claims.json',
  '02-research/evidence-map.md'
];

function prerequisite(state, stageName) {
  const requirements = {
    init: [state.capabilities?.status === 'PASS', 'capability preflight must pass'],
    discovery: [state.stages?.init?.status === 'completed', 'init must be completed'],
    research: [state.gates?.topic?.status === 'approved', 'topic gate must be approved'],
    outline: [state.stages?.research?.status === 'completed', 'research must be completed'],
    masters: [state.gates?.outline?.status === 'approved', 'outline gate must be approved'],
    platforms: [state.stages?.masters?.status === 'completed', 'masters must be completed'],
    editing: [state.stages?.platforms?.status === 'completed', 'platforms must be completed'],
    titles: [state.stages?.editing?.status === 'completed', 'editing must be completed'],
    visual: [state.gates?.titles?.status === 'approved', 'titles gate must be approved'],
    package: [state.gates?.visual?.status === 'approved' && state.stages?.visual?.status === 'completed', 'visual gate and visual stage must be completed'],
    final_qa: [state.stages?.package?.status === 'completed', 'package must be completed']
  };
  return requirements[stageName];
}

function nextStage(state, stageName) {
  const next = {
    init: state.gates?.topic?.status === 'approved' ? 'research' : 'discovery',
    discovery: 'topic_approval',
    research: 'outline',
    outline: 'outline_approval',
    masters: 'platforms',
    platforms: 'editing',
    editing: 'titles',
    titles: 'titles_approval',
    visual: 'package',
    package: 'final_qa',
    final_qa: 'final_approval'
  };
  return next[stageName];
}

function invalidateDraftingDownstream(state, stageName, now) {
  state.stages = state.stages || {};
  state.gates = state.gates || {};
  const invalidatedStages = [];
  for (const downstream of stageOrder.slice(stageOrder.indexOf(stageName) + 1)) {
    const previous = state.stages?.[downstream];
    if (previous && (previous.status !== 'pending' || previous.artifacts?.length)) {
      invalidatedStages.push({ stage: downstream, previous });
    }
    state.stages[downstream] = {
      status: 'pending',
      attempt: previous?.attempt || 0,
      artifacts: [],
      error: null,
      invalidated_by: stageName,
      updated_at: now
    };
  }

  const invalidatedGates = [];
  if (stageName === 'outline') {
    const previous = state.gates?.outline;
    if (previous) invalidatedGates.push({ gate: 'outline', previous });
    state.gates.outline = {
      status: 'pending',
      revision: previous?.revision || 0,
      decision_ref: null,
      bound_artifacts: [],
      approval_mode: null,
      approved_at: null,
      invalidated_by: stageName,
      updated_at: now
    };
  }
  for (const gate of ['titles', 'visual', 'final']) {
    const previous = state.gates?.[gate];
    if (previous && (previous.status !== 'pending' || previous.bound_artifacts?.length || previous.decision_ref)) {
      invalidatedGates.push({ gate, previous });
    }
    state.gates[gate] = {
      status: 'pending',
      revision: previous?.revision || 0,
      decision_ref: null,
      bound_artifacts: [],
      approval_mode: null,
      approved_at: null,
      invalidated_by: stageName,
      updated_at: now
    };
  }
  state.platform_selections = {};
  const record = { at: now, source_stage: stageName, stages: invalidatedStages, gates: invalidatedGates };
  state.invalidations = [...(state.invalidations || []), record];
  return record;
}

function invalidateVisualDownstream(state, now) {
  state.stages = state.stages || {};
  state.gates = state.gates || {};
  const invalidatedStages = [];
  for (const stage of ['package', 'final_qa']) {
    const previous = state.stages[stage];
    if (previous && (previous.status !== 'pending' || previous.artifacts?.length)) {
      invalidatedStages.push({ stage, previous });
    }
    state.stages[stage] = {
      status: 'pending', attempt: previous?.attempt || 0, artifacts: [], error: null,
      invalidated_by: 'visual', updated_at: now
    };
  }
  const invalidatedGates = [];
  for (const gate of ['visual', 'final']) {
    const previous = state.gates[gate];
    if (previous && (previous.status !== 'pending' || previous.bound_artifacts?.length || previous.decision_ref)) {
      invalidatedGates.push({ gate, previous });
    }
    state.gates[gate] = {
      status: 'pending', revision: previous?.revision || 0, decision_ref: null,
      bound_artifacts: [], approval_mode: null, approved_at: null,
      invalidated_by: 'visual', updated_at: now
    };
  }
  const record = { at: now, source_stage: 'visual', stages: invalidatedStages, gates: invalidatedGates };
  state.invalidations = [...(state.invalidations || []), record];
  return record;
}

function invalidatePackageDownstream(state, now) {
  state.stages = state.stages || {};
  state.gates = state.gates || {};
  const previousStage = state.stages.final_qa;
  state.stages.final_qa = {
    status: 'pending', attempt: previousStage?.attempt || 0, artifacts: [], error: null,
    invalidated_by: 'package', updated_at: now
  };
  const previousGate = state.gates.final;
  state.gates.final = {
    status: 'pending', revision: previousGate?.revision || 0, decision_ref: null,
    bound_artifacts: [], approval_mode: null, approved_at: null,
    invalidated_by: 'package', updated_at: now
  };
  const record = {
    at: now,
    source_stage: 'package',
    stages: previousStage ? [{ stage: 'final_qa', previous: previousStage }] : [],
    gates: previousGate ? [{ gate: 'final', previous: previousGate }] : []
  };
  state.invalidations = [...(state.invalidations || []), record];
  return record;
}

if (!runArg || !stageOrder.includes(stage) || !allowedStatuses.includes(status)) {
  emitJson({ status: 'BLOCKED', message: 'Usage: set-stage.mjs <run-dir> <stage> <pending|running|blocked|completed> [--artifact path] [--error message]' }, 2);
} else {
  try {
    const runDir = expandPath(runArg);
    const statePath = join(runDir, 'run.json');
    const state = await readJson(statePath);
    const integrityIssues = await gateIntegrity(runDir, state);
    if (integrityIssues.length) throw Object.assign(new Error('Approved artifact integrity failed.'), { issues: integrityIssues });

    if (['running', 'completed'].includes(status)) {
      const [met, message] = prerequisite(state, stage);
      if (!met) throw new Error(`Cannot ${status === 'running' ? 'start' : 'complete'} ${stage}; ${message}.`);
    }

    const previous = state.stages?.[stage] || { status: 'pending', attempt: 0, artifacts: [], error: null };
    if (['editing', 'titles', 'visual', 'package'].includes(stage) && previous.status === 'completed' && !['completed', 'running'].includes(status)) {
      throw Object.assign(new Error(`Completed ${stage} must be reopened through running before its status can change.`), {
        issues: [{ code: `invalid_${stage}_transition`, message: `Use ${stage} running to reopen, increment attempt, and invalidate downstream work.`, resume_from: stage }]
      });
    }
    if (['editing', 'titles', 'visual', 'package'].includes(stage) && status === 'completed' && !['running', 'completed'].includes(previous.status)) {
      throw Object.assign(new Error(`${stage} can only complete from running.`), {
        issues: [{ code: `invalid_${stage}_transition`, message: `Start ${stage} before completing it; blocked or pending attempts cannot reuse old artifacts.`, resume_from: stage }]
      });
    }
    if (status === 'completed' && stage === 'research') {
      const requested = args.artifact?.length
        ? args.artifact
        : (previous.artifacts || []).map((artifact) => artifact.path);
      const paths = requested.map((path) => relativeTo(runDir, expandPath(path, runDir)));
      const exactPackage = paths.length === researchArtifacts.length
        && new Set(paths).size === researchArtifacts.length
        && researchArtifacts.every((path) => paths.includes(path));
      if (!exactPackage) {
        throw Object.assign(new Error('Research completion must bind exactly the four canonical research artifacts.'), {
          issues: [{
            code: 'invalid_research_artifact_binding',
            message: 'Bind brief.md, source-log.md, claims.json, and evidence-map.md from 02-research exactly once.',
            resume_from: 'research',
            expected: researchArtifacts,
            actual: paths
          }]
        });
      }
      const validation = await validateResearchPackage(runDir);
      if (validation.issues.length) {
        throw Object.assign(new Error('Research package violates the completion contract.'), { issues: validation.issues });
      }
      const providerValidation = await validateResearchProviderResult(runDir);
      if (providerValidation.issues.length) {
        throw Object.assign(new Error('Research provider result is missing, blocked, failed, or stale.'), { issues: providerValidation.issues });
      }
    }
    if (status === 'completed' && ['outline', 'masters', 'platforms'].includes(stage)) {
      const expected = expectedDraftingStageArtifacts(stage, state);
      const requested = args.artifact?.length
        ? args.artifact
        : (previous.artifacts || []).map((artifact) => artifact.path);
      const paths = requested.map((path) => relativeTo(runDir, expandPath(path, runDir)));
      const exactPackage = paths.length === expected.length
        && new Set(paths).size === expected.length
        && expected.every((path) => paths.includes(path));
      if (!exactPackage) {
        throw Object.assign(new Error(`${stage} completion must bind exactly its canonical drafting artifacts.`), {
          issues: [{
            code: 'invalid_drafting_artifact_binding',
            message: `${stage} must bind exactly ${expected.length} canonical drafting artifacts, each once.`,
            resume_from: stage,
            expected,
            actual: paths
          }]
        });
      }
      const validator = {
        outline: validateDraftingOutlineStage,
        masters: validateDraftingMastersStage,
        platforms: validateDraftingPlatformsStage
      }[stage];
      const validation = await validator(runDir, state);
      if (validation.issues.length) {
        throw Object.assign(new Error(`${stage} drafting package violates the completion contract.`), { issues: validation.issues });
      }
    }
    if (status === 'completed' && stage === 'editing') {
      const expected = expectedProofreadingStageArtifacts();
      const requested = args.artifact?.length
        ? args.artifact
        : (previous.artifacts || []).map((artifact) => artifact.path);
      const paths = requested.map((path) => relativeTo(runDir, expandPath(path, runDir)));
      const exactPackage = paths.length === expected.length
        && new Set(paths).size === expected.length
        && expected.every((path) => paths.includes(path));
      if (!exactPackage) {
        throw Object.assign(new Error('editing completion must bind exactly its canonical proofreading artifacts.'), {
          issues: [{
            code: 'invalid_proofreading_artifact_binding',
            message: `editing must bind exactly ${expected.length} canonical proofreading and regression artifacts, each once.`,
            resume_from: 'editing',
            expected,
            actual: paths
          }]
        });
      }
      const validation = await validateProofreadingStage(runDir, state);
      if (validation.issues.length) {
        throw Object.assign(new Error('editing proofreading package violates the completion contract.'), { issues: validation.issues });
      }
    }
    if (status === 'completed' && stage === 'titles') {
      const expected = expectedTitleStageArtifacts(state);
      const requested = args.artifact?.length
        ? args.artifact
        : (previous.artifacts || []).map((artifact) => artifact.path);
      const paths = requested.map((path) => relativeTo(runDir, expandPath(path, runDir)));
      const exactPackage = paths.length === expected.length
        && new Set(paths).size === expected.length
        && expected.every((path) => paths.includes(path));
      if (!exactPackage) {
        throw Object.assign(new Error('titles completion must bind exactly its canonical provider and aggregate artifacts.'), {
          issues: [{
            code: 'invalid_title_artifact_binding',
            message: `titles must bind exactly ${expected.length} canonical candidate and aggregate artifacts, each once.`,
            resume_from: 'titles',
            expected,
            actual: paths
          }]
        });
      }
      const validation = await validateTitleGenerationStage(runDir, state);
      if (validation.issues.length) {
        throw Object.assign(new Error('titles package violates the title-generation completion contract.'), { issues: validation.issues });
      }
    }
    if (status === 'completed' && stage === 'visual') {
      if (state.gates?.visual?.status !== 'approved') {
        throw Object.assign(new Error('visual can only complete after the current illustration plans are approved.'), {
          issues: [{ code: 'visual_gate_not_approved', message: 'Approve the current five illustration plans before generation can complete.', resume_from: 'visual' }]
        });
      }
      const expected = [
        ...expectedVisualStageArtifacts(state),
        ...expectedWechatCoverStageArtifacts(state)
      ];
      const requested = args.artifact?.length
        ? args.artifact
        : (previous.artifacts || []).map((artifact) => artifact.path);
      const paths = requested.map((path) => relativeTo(runDir, expandPath(path, runDir)));
      if (paths.length !== expected.length || new Set(paths).size !== expected.length
        || !expected.every((path) => paths.includes(path))) {
        throw Object.assign(new Error('visual completion must bind exactly its five current illustration bundles and WeChat cover.'), {
          issues: [{
            code: 'invalid_visual_artifact_binding',
            message: 'Bind each current plan, shot list, bundle, native manifest, cover PNG, and cover metadata exactly once (22 files total).',
            resume_from: 'visual', expected, actual: paths
          }]
        });
      }
      const [illustrations, cover] = await Promise.all([
        validateIllustrationGeneration(runDir, state),
        validateWechatCover(runDir, state)
      ]);
      const visualIssues = [...illustrations.issues, ...cover.issues];
      if (visualIssues.length) {
        throw Object.assign(new Error('Visual generation violates the illustration or WeChat cover completion contract.'), { issues: visualIssues });
      }
    }
    const layoutPaths = wechatLayoutPaths(state);
    const providerPackage = compressionProviderRequired(state)
      || fileExists(join(runDir, compressionPlanPath(state)));
    const providerLayout = wechatLayoutProviderRequired(state)
      || [layoutPaths.request, layoutPaths.result, layoutPaths.stagedClean, layoutPaths.stagedPreview]
        .some((path) => fileExists(join(runDir, path)));
    if (status === 'completed' && stage === 'package' && (providerPackage || providerLayout)) {
      const packageContract = await expectedPackageStageArtifacts(runDir, state, { includeLayout: true });
      if (packageContract.issues.length) {
        throw Object.assign(new Error('Current compression and publish-pack artifacts violate the package contract.'), {
          issues: packageContract.issues
        });
      }
      const requested = args.artifact?.length
        ? args.artifact
        : (previous.artifacts || []).map((artifact) => artifact.path);
      const paths = requested.map((path) => relativeTo(runDir, expandPath(path, runDir)));
      const expected = packageContract.artifacts;
      if (paths.length !== expected.length || new Set(paths).size !== expected.length
        || !expected.every((path) => paths.includes(path))) {
        throw Object.assign(new Error('package completion must bind the exact current publish package and layout artifacts.'), {
          issues: [{
            code: 'invalid_package_artifact_binding',
            message: `Bind the current five manifests, five final Markdown files, five metadata files, five optimization reports, all publish images, WeChat cover, and three layout artifacts exactly once (${expected.length} files total).`,
            resume_from: 'package', expected, actual: paths
          }]
        });
      }
      const validation = await validatePublishPackages(runDir, state);
      if (validation.issues.length) {
        throw Object.assign(new Error('Publish packages violate the provider-aware package contract.'), { issues: validation.issues });
      }
      if (providerLayout) {
        const layout = await validateWechatLayoutDelivery(runDir, state);
        if (layout.issues.length) {
          throw Object.assign(new Error('WeChat layout violates the provider-aware delivery contract.'), { issues: layout.issues });
        }
      }
      const missing = expected.filter((path) => !fileExists(join(runDir, path)));
      if (missing.length) {
        throw Object.assign(new Error('Package layout artifacts are not ready.'), {
          issues: [{
            code: 'missing_package_artifact',
            message: 'Current package completion references missing business or layout artifacts.',
            resume_from: 'package', paths: missing
          }]
        });
      }
    }
    const now = new Date().toISOString();
    const reopening = status === 'running'
      && (previous.status === 'completed' && ['outline', 'masters', 'platforms', 'editing', 'titles', 'visual', 'package'].includes(stage)
        || stage === 'visual' && previous.status === 'blocked');
    const invalidation = reopening
      ? stage === 'visual'
        ? invalidateVisualDownstream(state, now)
        : stage === 'package'
          ? invalidatePackageDownstream(state, now)
          : invalidateDraftingDownstream(state, stage, now)
      : null;
    const artifacts = args.artifact?.length
      ? await Promise.all(args.artifact.map((path) => artifactBinding(runDir, path)))
      : reopening ? [] : previous.artifacts || [];
    if (status === 'completed' && stage !== 'init' && !artifacts.length) {
      throw new Error(`${stage} completion must bind its machine-verifiable artifacts with --artifact.`);
    }
    const attempt = status === 'running' && previous.status !== 'running' ? (previous.attempt || 0) + 1 : previous.attempt || 0;
    state.stages = state.stages || {};
    state.stages[stage] = {
      status,
      attempt,
      artifacts,
      error: status === 'blocked' ? args.error || 'stage_blocked' : null,
      started_at: status === 'running' ? now : previous.started_at || null,
      completed_at: status === 'completed' ? now : null,
      updated_at: now
    };
    state.updated_at = now;
    state.status = status === 'blocked' ? 'blocked' : 'running';
    state.current_stage = status === 'completed' ? nextStage(state, stage) : stage;
    state.resume = {
      next_stage: state.current_stage,
      reason: status === 'completed' ? 'stage_completed' : status === 'blocked' ? 'stage_blocked' : 'stage_in_progress'
    };
    state.history = [
      ...(state.history || []),
      ...(invalidation ? [{
        at: now,
        event: 'stage_reopened',
        stage,
        invalidated_stages: invalidation.stages.map((item) => item.stage),
        invalidated_gates: invalidation.gates.map((item) => item.gate)
      }] : []),
      { at: now, event: 'stage_updated', stage, from: previous.status, to: status, attempt }
    ];
    await writeJson(statePath, state);
    emitJson({ status: 'PASS', stage, stage_status: status, run_status: state.status, next_stage: state.current_stage, attempt });
  } catch (error) {
    emitJson({ status: 'BLOCKED', message: error.message, issues: error.issues || [] }, 2);
  }
}

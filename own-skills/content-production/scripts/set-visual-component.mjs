#!/usr/bin/env node

import { join } from 'node:path';
import {
  expectedVisualStageArtifacts,
  validateIllustrationGeneration
} from './illustration-contracts.mjs';
import {
  expectedWechatCoverStageArtifacts,
  validateWechatCover
} from './wechat-cover-contracts.mjs';
import {
  artifactBinding,
  emitJson,
  expandPath,
  gateIntegrity,
  parseArgs,
  readJson,
  relativeTo,
  writeJson
} from './lib.mjs';
import {
  aggregateVisualArtifacts,
  deriveVisualStatus,
  initialVisualComponent,
  visualComponentNames
} from './visual-state.mjs';

const args = parseArgs(process.argv.slice(2));
const [runInput, componentName, status, ...extra] = args._;
const statuses = new Set(['running', 'blocked', 'completed']);

function issue(code, message) {
  return { code, message, resume_from: 'visual', component: componentName };
}

function invalidateDelivery(state, now) {
  for (const stageName of ['package', 'final_qa']) {
    const previous = state.stages?.[stageName] || { status: 'pending', attempt: 0 };
    state.stages[stageName] = {
      status: 'pending', attempt: previous.attempt || 0, artifacts: [], error: null,
      invalidated_by: componentName, updated_at: now
    };
  }
  const previous = state.gates?.final || { revision: 0 };
  state.gates.final = {
    status: 'pending', revision: previous.revision || 0, decision_ref: null,
    bound_artifacts: [], approval_mode: null, approved_at: null,
    invalidated_by: componentName, updated_at: now
  };
}

function invalidateBodyGate(state, now) {
  const previous = state.gates?.visual || { revision: 0 };
  state.gates.visual = {
    status: 'pending', revision: previous.revision || 0, decision_ref: null,
    bound_artifacts: [], approval_mode: null, approved_at: null,
    invalidated_by: componentName, updated_at: now
  };
}

try {
  if (!runInput || !visualComponentNames.includes(componentName) || !statuses.has(status)
    || extra.length || Object.keys(args).some((key) => !['_', 'artifact', 'error'].includes(key))) {
    throw new Error('Usage: set-visual-component.mjs <run-dir> <body_visual|wechat_cover> <running|blocked|completed> [--artifact path] [--error message]');
  }
  const runDir = expandPath(runInput);
  const statePath = join(runDir, 'run.json');
  const state = await readJson(statePath);
  if (state.schema_version !== 3 || state.gates?.titles?.status !== 'approved') {
    throw Object.assign(new Error('Visual components require a V3 run with approved titles.'), {
      issues: [issue('visual_component_stage_mismatch', 'Approve titles in a V3 run before starting visual work.')]
    });
  }
  const integrity = await gateIntegrity(runDir, state);
  if (integrity.length) throw Object.assign(new Error('Approved artifact integrity failed.'), { issues: integrity });

  state.stages.visual ||= {
    status: 'pending', revision: 0, artifacts: [], error: null,
    body_visual: initialVisualComponent(), wechat_cover: initialVisualComponent()
  };
  const visual = state.stages.visual;
  const previous = visual[componentName] || initialVisualComponent();
  const now = new Date().toISOString();
  let artifacts = previous.artifacts || [];
  let attempt = previous.attempt || 0;

  if (status === 'running') {
    if (previous.status === 'running') throw new Error(`${componentName} is already running.`);
    attempt += 1;
    artifacts = [];
    invalidateDelivery(state, now);
    if (componentName === 'body_visual') invalidateBodyGate(state, now);
  } else if (status === 'blocked') {
    if (previous.status !== 'running') throw new Error(`Only a running ${componentName} can be blocked.`);
    artifacts = previous.artifacts || [];
  } else {
    if (previous.status !== 'running') throw new Error(`Only a running ${componentName} can be completed.`);
    if (componentName === 'body_visual' && state.gates?.visual?.status !== 'approved') {
      throw Object.assign(new Error('Body visual requires its current plan gate.'), {
        issues: [issue('visual_gate_not_approved', 'Approve the current body illustration plans before completion.')]
      });
    }
    const expected = componentName === 'body_visual'
      ? expectedVisualStageArtifacts(state) : expectedWechatCoverStageArtifacts(state);
    const requested = args.artifact?.length ? args.artifact : [];
    const relativePaths = requested.map((path) => relativeTo(runDir, expandPath(path, runDir)));
    if (relativePaths.length !== expected.length || new Set(relativePaths).size !== expected.length
      || !expected.every((path) => relativePaths.includes(path))) {
      throw Object.assign(new Error(`${componentName} must bind its exact current artifacts.`), {
        issues: [{
          ...issue('invalid_visual_component_artifact_binding', `${componentName} artifact binding is incomplete or stale.`),
          expected,
          actual: relativePaths
        }]
      });
    }
    const validation = componentName === 'body_visual'
      ? await validateIllustrationGeneration(runDir, state)
      : await validateWechatCover(runDir, state);
    if (validation.issues.length) {
      throw Object.assign(new Error(`${componentName} completion contract failed.`), { issues: validation.issues });
    }
    artifacts = await Promise.all(requested.map((path) => artifactBinding(runDir, path)));
  }

  visual[componentName] = {
    status,
    attempt,
    artifacts,
    error: status === 'blocked' ? args.error || 'component_blocked' : null,
    started_at: status === 'running' ? now : previous.started_at || null,
    completed_at: status === 'completed' ? now : null,
    updated_at: now
  };
  visual.revision = (visual.revision || 0) + 1;
  visual.status = deriveVisualStatus(visual);
  visual.artifacts = visual.status === 'completed' ? aggregateVisualArtifacts(visual) : [];
  visual.error = visual.status === 'blocked' ? 'visual_component_blocked' : null;
  visual.updated_at = now;

  state.updated_at = now;
  state.status = visual.status === 'blocked' ? 'blocked' : 'running';
  state.current_stage = visual.status === 'completed' ? 'package' : 'visual';
  state.resume = {
    next_stage: state.current_stage,
    reason: visual.status === 'completed' ? 'visual_components_completed'
      : visual.status === 'blocked' ? 'visual_component_blocked' : 'visual_component_in_progress'
  };
  state.history = [
    ...(state.history || []),
    {
      at: now,
      event: 'visual_component_updated',
      component: componentName,
      from: previous.status,
      to: status,
      attempt,
      aggregate_status: visual.status
    }
  ];
  await writeJson(statePath, state);
  emitJson({
    status: 'PASS',
    run_id: state.run_id,
    component: componentName,
    component_status: status,
    attempt,
    visual_status: visual.status,
    next_stage: state.current_stage
  });
} catch (error) {
  emitJson({ status: 'BLOCKED', message: error.message, issues: error.issues || [] }, 2);
}

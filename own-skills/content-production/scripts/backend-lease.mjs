#!/usr/bin/env node

import { rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  backendLeasePathForAttempt,
  backendProfilePath,
  classifyBackendOutcome,
  createBackendLease,
  createBackendProfile,
  loadBackendLease,
  loadBackendProfile,
  resolveConfiguredBackend,
  resolveNativeBackend,
  selectBackendKind
} from './backend-runtime.mjs';
import {
  emitJson,
  expandPath,
  fileExists,
  fileSha256,
  parseArgs,
  readJson,
  writeJson
} from './lib.mjs';
import { aggregateVisualArtifacts, deriveVisualStatus } from './visual-state.mjs';

const args = parseArgs(process.argv.slice(2));
const [runInput, command, ...extra] = args._;
const consumers = ['body_visual', 'wechat_cover'];

function blocker(code, message, consumer = null) {
  return { code, message, resume_from: 'visual', ...(consumer ? { consumer } : {}) };
}

function sameProfile(left, right) {
  return left?.backend_kind === right?.backend_kind && left?.provider === right?.provider
    && left?.endpoint_source === right?.endpoint_source
    && left?.endpoint_origin === right?.endpoint_origin
    && left?.endpoint_sha256 === right?.endpoint_sha256
    && left?.adapter?.id === right?.adapter?.id && left?.adapter?.sha256 === right?.adapter?.sha256
    && left?.model === right?.model && left?.artifact_format === right?.artifact_format;
}

async function resolveRequested(runDir) {
  const backendKind = selectBackendKind({
    explicitBackend: args.backend || null,
    nativeStatus: args.native_status
  });
  if (backendKind === 'runtime-native') {
    return resolveNativeBackend({ nativeStatus: args.native_status });
  }
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
  return resolveConfiguredBackend({
    configPath: expandPath(args.config || join(codexHome, 'config.toml')),
    authPath: expandPath(args.auth || join(codexHome, 'auth.json')),
    adapterPath: expandPath(args.adapter || join(codexHome, 'skills', '.system', 'imagegen', 'scripts', 'image_gen.py')),
    explicitBaseUrl: typeof args.base_url === 'string' ? args.base_url : null,
    model: typeof args.model === 'string' ? args.model : null,
    outputRoot: join(runDir, '07-visual')
  });
}

async function createProfileAndLeases(runDir, state, selectedConsumers) {
  const absoluteProfile = join(runDir, backendProfilePath());
  if (fileExists(absoluteProfile) && args.backend) {
    const existing = await loadBackendProfile(runDir, state);
    if (!existing.issues.length && existing.value.backend_kind !== args.backend) {
      return { status: 'BLOCKED', issues: [blocker('backend_switch_forbidden', 'backend endpoint mismatch')] };
    }
  }
  const resolved = await resolveRequested(runDir);
  if (resolved.issues.length) return { status: 'BLOCKED', issues: resolved.issues };
  const candidate = createBackendProfile({ state, resolved, runDir });
  const profilePath = backendProfilePath();
  let idempotent = fileExists(absoluteProfile);
  if (idempotent) {
    const existing = await loadBackendProfile(runDir, state);
    if (existing.issues.length || !sameProfile(existing.value, candidate)) {
      return { status: 'BLOCKED', issues: existing.issues.length ? existing.issues
        : [blocker('backend_switch_forbidden', 'backend endpoint mismatch')] };
    }
  } else {
    await writeJson(absoluteProfile, candidate);
  }
  const profile = await loadBackendProfile(runDir, state);
  if (profile.issues.length) return { status: 'BLOCKED', issues: profile.issues };
  const leasePaths = [];
  for (const consumer of selectedConsumers) {
    const leasePath = backendLeasePathForAttempt(state, consumer);
    const absolute = join(runDir, leasePath);
    if (fileExists(absolute)) {
      const existing = await loadBackendLease(runDir, state, consumer);
      if (existing.issues.length) return { status: 'BLOCKED', issues: existing.issues };
      idempotent = true;
    } else {
      const lease = createBackendLease({
        state,
        resolved,
        profile: profile.value,
        profileSha256: profile.sha256,
        consumer,
        runDir
      });
      await writeJson(absolute, lease);
    }
    leasePaths.push(leasePath);
  }
  return {
    status: 'PASS', run_id: state.run_id, backend_kind: profile.value.backend_kind,
    profile_path: profilePath, lease_paths: leasePaths, idempotent, issues: []
  };
}

async function resetBackend(runDir, state, statePath) {
  if (args.confirm !== 'reset-all-visual') {
    throw new Error('reset requires --confirm reset-all-visual.');
  }
  const now = new Date().toISOString();
  const profilePath = join(runDir, backendProfilePath());
  if (fileExists(profilePath)) {
    const archive = join(runDir, '07-visual', `backend-profile.reset-${Date.now()}.json`);
    await rename(profilePath, archive);
  }
  for (const consumer of consumers) {
    const component = state.stages.visual[consumer];
    state.stages.visual[consumer] = {
      ...component,
      status: 'running',
      attempt: (component?.attempt || 0) + 1,
      artifacts: [],
      error: null,
      started_at: now,
      completed_at: null,
      updated_at: now
    };
  }
  state.stages.visual.status = 'running';
  state.stages.visual.revision = (state.stages.visual.revision || 0) + 1;
  state.stages.visual.artifacts = [];
  state.stages.visual.error = null;
  state.gates.visual = {
    status: 'pending', revision: state.gates.visual?.revision || 0, decision_ref: null,
    bound_artifacts: [], approval_mode: null, approved_at: null,
    invalidated_by: 'backend_reset', updated_at: now
  };
  for (const stage of ['package', 'final_qa']) {
    state.stages[stage] = {
      status: 'pending', attempt: state.stages[stage]?.attempt || 0,
      artifacts: [], error: null, invalidated_by: 'backend_reset', updated_at: now
    };
  }
  state.status = 'running';
  state.current_stage = 'visual';
  state.updated_at = now;
  state.history = [...(state.history || []), { at: now, event: 'backend_profile_reset' }];
  await writeJson(statePath, state);
  return { status: 'PASS', run_id: state.run_id, reset: true, issues: [] };
}

try {
  const allowed = new Set([
    '_', 'backend', 'native_status', 'base_url', 'config', 'auth', 'adapter', 'model',
    'outcome', 'consumer', 'confirm'
  ]);
  if (!runInput || !['create', 'validate', 'record', 'reset'].includes(command) || extra.length
    || Object.keys(args).some((key) => !allowed.has(key))) {
    throw new Error('Usage: backend-lease.mjs <run-dir> create|validate|record|reset [options]');
  }
  const runDir = expandPath(runInput);
  const statePath = join(runDir, 'run.json');
  const state = await readJson(statePath);
  if (state.schema_version !== 3 || state.current_stage !== 'visual'
    || !state.stages?.visual?.body_visual || !state.stages?.visual?.wechat_cover) {
    throw Object.assign(new Error('Backend controls require a current V3 visual lifecycle.'), {
      issues: [blocker('backend_lease_stage_mismatch', 'backend configuration inaccessible')]
    });
  }
  if (command === 'reset') {
    emitJson(await resetBackend(runDir, state, statePath));
  } else {
    const selected = args.consumer ? [args.consumer] : consumers;
    if (selected.some((consumer) => !consumers.includes(consumer))) {
      throw new Error('--consumer must be body_visual or wechat_cover.');
    }
    if (command === 'create') {
      const result = await createProfileAndLeases(runDir, state, selected);
      emitJson(result, result.status === 'PASS' ? 0 : 2);
    } else if (command === 'validate') {
      const profile = await loadBackendProfile(runDir, state);
      const leases = await Promise.all(selected.map((consumer) => loadBackendLease(runDir, state, consumer)));
      const issues = [...profile.issues, ...leases.flatMap((lease) => lease.issues)];
      emitJson({
        status: issues.length ? 'BLOCKED' : 'PASS', run_id: state.run_id,
        profile_path: profile.path,
        lease_paths: leases.map((lease) => lease.path), issues
      }, issues.length ? 2 : 0);
    } else {
      if (!args.outcome || selected.length !== 1) {
        throw new Error('record requires --consumer and --outcome.');
      }
      const consumer = selected[0];
      const lease = await loadBackendLease(runDir, state, consumer);
      if (lease.issues.length) emitJson({ status: 'BLOCKED', issues: lease.issues }, 2);
      else {
        const result = classifyBackendOutcome(args.outcome, lease.value.backend_kind);
        if (result.block_attempt) {
          const now = new Date().toISOString();
          state.stages.visual[consumer] = {
            ...state.stages.visual[consumer], status: 'blocked',
            error: `${lease.value.backend_kind} irrecoverable execution error`, updated_at: now
          };
          state.stages.visual.status = deriveVisualStatus(state.stages.visual);
          state.stages.visual.artifacts = state.stages.visual.status === 'completed'
            ? aggregateVisualArtifacts(state.stages.visual) : [];
          state.status = state.stages.visual.status === 'blocked' ? 'blocked' : 'running';
          state.updated_at = now;
          state.history = [...(state.history || []), {
            at: now, event: 'backend_consumer_blocked', consumer,
            attempt: state.stages.visual[consumer].attempt, backend_kind: lease.value.backend_kind
          }];
          await writeJson(statePath, state);
        }
        emitJson({ status: result.block_attempt ? 'BLOCKED' : 'PASS', run_id: state.run_id, ...result }, result.block_attempt ? 2 : 0);
      }
    }
  }
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    message: error.message,
    issues: error.issues || [blocker('backend_configuration_inaccessible', 'backend configuration inaccessible')]
  }, 2);
}

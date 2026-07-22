#!/usr/bin/env node

import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  backendLeasePathForAttempt,
  classifyBackendOutcome,
  createBackendLease,
  resolveConfiguredBackend,
  resolveNativeBackend,
  selectBackendKind,
  validateBackendLeaseFile
} from './backend-runtime.mjs';
import {
  emitJson,
  expandPath,
  fileExists,
  parseArgs,
  platforms,
  readJson,
  writeJson
} from './lib.mjs';
import { validateVisualCoverageSet } from './visual-cardinality.mjs';

const args = parseArgs(process.argv.slice(2));
const [runInput, command, ...extra] = args._;

function blocker(code, message) {
  return { code, message, resume_from: 'visual' };
}

try {
  const allowed = new Set([
    '_', 'backend', 'native_status', 'base_url', 'config', 'auth', 'adapter', 'model', 'outcome'
  ]);
  if (!runInput || !['create', 'validate', 'record'].includes(command) || extra.length
    || Object.keys(args).some((key) => !allowed.has(key))) {
    throw new Error('Usage: backend-lease.mjs <run-dir> create|validate|record [options]');
  }
  const runDir = expandPath(runInput);
  const statePath = join(runDir, 'run.json');
  const state = await readJson(statePath);
  if (state.schema_version !== 2 || state.current_stage !== 'visual'
    || !Number.isInteger(state.stages?.visual?.attempt) || state.stages.visual.attempt < 1) {
    throw Object.assign(new Error('BackendLease requires a current visual attempt.'), {
      issues: [blocker('backend_lease_stage_mismatch', 'backend configuration inaccessible')]
    });
  }

  if (command === 'validate') {
    const validation = await validateBackendLeaseFile(runDir, state);
    emitJson({
      status: validation.issues.length ? 'BLOCKED' : 'PASS',
      backend_kind: validation.value?.backend_kind || null,
      backend_context: validation.value?.backend_context || null,
      issues: validation.issues
    }, validation.issues.length ? 2 : 0);
  } else if (command === 'record') {
    if (!args.outcome) throw new Error('record requires --outcome pass|quality-failure|transient-error|irrecoverable-execution-error');
    const validation = await validateBackendLeaseFile(runDir, state);
    if (validation.issues.length) {
      emitJson({ status: 'BLOCKED', issues: validation.issues }, 2);
    } else {
      const result = classifyBackendOutcome(args.outcome, validation.value.backend_kind);
      if (result.block_attempt) {
        if (state.stages.visual.status !== 'running') {
          throw new Error('Only a running visual attempt can be blocked by an irrecoverable backend error.');
        }
        const now = new Date().toISOString();
        state.stages.visual = {
          ...state.stages.visual,
          status: 'blocked',
          error: `${validation.value.backend_kind} irrecoverable execution error`,
          completed_at: null,
          updated_at: now
        };
        state.status = 'blocked';
        state.current_stage = 'visual';
        state.updated_at = now;
        state.resume = { next_stage: 'visual', reason: 'stage_blocked' };
        state.history = [
          ...(state.history || []),
          {
            at: now,
            event: 'backend_attempt_blocked',
            stage: 'visual',
            attempt: state.stages.visual.attempt,
            backend_kind: validation.value.backend_kind
          }
        ];
        await writeJson(statePath, state);
      }
      emitJson({ status: result.block_attempt ? 'BLOCKED' : 'PASS', ...result }, result.block_attempt ? 2 : 0);
    }
  } else {
    if (state.status !== 'running' || state.stages.visual.status !== 'running') {
      throw Object.assign(new Error('BackendLease creation requires a running visual attempt.'), {
        issues: [blocker('backend_lease_stage_mismatch', 'backend configuration inaccessible')]
      });
    }
    const coverage = await validateVisualCoverageSet(runDir, state);
    if (coverage.issues.length) {
      throw Object.assign(new Error('BackendLease requires current policy and coverage.'), { issues: coverage.issues });
    }
    const attempt = state.stages.visual.attempt;
    const suffix = attempt === 1 ? '' : `.v${String(attempt).padStart(3, '0')}`;
    const late = platforms.some((platform) => [
      `07-visual/${platform}/illustration-plan${suffix}.request.json`,
      `07-visual/${platform}/illustration-plan${suffix}.result.json`,
      `07-visual/${platform}/plan${suffix}.json`
    ].some((path) => fileExists(join(runDir, path))));
    const leasePath = backendLeasePathForAttempt(state);
    const existing = fileExists(join(runDir, leasePath));
    if (late && !existing) {
      throw Object.assign(new Error('BackendLease cannot be created after current plan artifacts.'), {
        issues: [blocker('backend_lease_created_too_late', 'backend configuration inaccessible')]
      });
    }
    if (existing) {
      const validation = await validateBackendLeaseFile(runDir, state);
      const requestedKind = args.backend || (args.native_status === 'available' ? 'runtime-native' : null);
      if (validation.issues.length || requestedKind && requestedKind !== validation.value?.backend_kind) {
        throw Object.assign(new Error('Current BackendLease cannot be replaced or switched.'), {
          issues: validation.issues.length ? validation.issues
            : [blocker('backend_switch_forbidden', 'backend endpoint mismatch')]
        });
      }
      emitJson({
        status: 'PASS', backend_kind: validation.value.backend_kind,
        backend_context: validation.value.backend_context, idempotent: true
      });
    } else {
      const backendKind = selectBackendKind({
        explicitBackend: args.backend || null,
        nativeStatus: args.native_status
      });
      let resolved;
      if (backendKind === 'runtime-native') {
        resolved = resolveNativeBackend({ nativeStatus: args.native_status });
      } else {
        const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
        resolved = await resolveConfiguredBackend({
          configPath: expandPath(args.config || join(codexHome, 'config.toml')),
          authPath: expandPath(args.auth || join(codexHome, 'auth.json')),
          adapterPath: expandPath(args.adapter || join(codexHome, 'skills', '.system', 'imagegen', 'scripts', 'image_gen.py')),
          explicitBaseUrl: typeof args.base_url === 'string' ? args.base_url : null,
          model: typeof args.model === 'string' ? args.model : null,
          outputRoot: join(runDir, '07-visual')
        });
      }
      if (resolved.issues.length) {
        emitJson({ status: 'BLOCKED', issues: resolved.issues }, 2);
      } else {
        const lease = createBackendLease({ state, resolved });
        await writeJson(join(runDir, leasePath), lease);
        emitJson({
          status: 'PASS', backend_kind: lease.backend_kind,
          backend_context: lease.backend_context, idempotent: false
        });
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

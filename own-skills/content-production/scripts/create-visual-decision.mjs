#!/usr/bin/env node

import { join } from 'node:path';
import { validateIllustrationPlans } from './illustration-contracts.mjs';
import { emitJson, expandPath, fileExists, parseArgs, readJson, writeJson } from './lib.mjs';
import {
  buildVisualPlatformRows,
  createVisualDecision,
  decisionPathForAttempt,
  validateVisualCoverageSet
} from './visual-cardinality.mjs';

const args = parseArgs(process.argv.slice(2));
const [runInput, ...extra] = args._;

try {
  if (!runInput || extra.length || Object.keys(args).some((key) => !['_'].includes(key))) {
    throw new Error('Usage: create-visual-decision.mjs <run-dir>');
  }
  const runDir = expandPath(runInput);
  const state = await readJson(join(runDir, 'run.json'));
  const issues = [];
  if (state.schema_version !== 2 || state.status !== 'running' || state.current_stage !== 'visual'
    || state.stages?.visual?.status !== 'running' || state.gates?.titles?.status !== 'approved'
    || state.gates?.visual?.status === 'approved') {
    issues.push({
      code: 'visual_decision_stage_mismatch',
      message: 'Visual decision requires a running, not-yet-approved current visual attempt.',
      resume_from: 'visual'
    });
  }
  const coverage = await validateVisualCoverageSet(runDir, state);
  const plans = await validateIllustrationPlans(runDir, state);
  issues.push(...coverage.issues, ...plans.issues);
  const rows = issues.length ? [] : await buildVisualPlatformRows(runDir, plans.tasks, coverage.coverages);
  const decision = createVisualDecision({
    state,
    policyRef: coverage.policyRef,
    titleBinding: state.gates?.titles?.decision_ref,
    platformRows: rows,
    createdAt: new Date().toISOString()
  });
  issues.push(...decision.issues);
  if (issues.length) {
    emitJson({ status: 'BLOCKED', run_dir: runDir, issues }, 2);
  } else {
    const relativePath = decisionPathForAttempt(state);
    const path = join(runDir, relativePath);
    if (fileExists(path)) {
      const existing = await readJson(path);
      const expected = createVisualDecision({
        state,
        policyRef: coverage.policyRef,
        titleBinding: state.gates.titles.decision_ref,
        platformRows: rows,
        createdAt: existing.created_at
      });
      if (JSON.stringify(existing) !== JSON.stringify(expected)) {
        throw new Error('Refusing to overwrite a different current visual decision.');
      }
      emitJson({ status: 'PROPOSED', run_dir: runDir, decision_path: path, idempotent: true });
    } else {
      await writeJson(path, decision);
      emitJson({ status: 'PROPOSED', run_dir: runDir, decision_path: path, idempotent: false });
    }
  }
} catch (error) {
  emitJson({ status: 'BLOCKED', message: error.message, issues: error.issues || [] }, 2);
}

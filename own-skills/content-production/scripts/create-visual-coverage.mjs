#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  emitJson,
  expandPath,
  fileExists,
  fileSha256,
  parseArgs,
  platforms,
  readJson,
  skillDir,
  writeJson
} from './lib.mjs';
import {
  coveragePathForAttempt,
  createPolicySnapshot,
  deriveCoverageContract,
  evaluateCrossPlatformCardinality,
  policyPathForAttempt,
  validateVisualCoverageSet
} from './visual-cardinality.mjs';

const args = parseArgs(process.argv.slice(2));
const [runInput, ...extra] = args._;

function add(issues, code, message, extraFields = {}) {
  issues.push({ code, message, resume_from: 'visual', ...extraFields });
}

try {
  const selectedPlatforms = args.all === true ? platforms
    : typeof args.platform === 'string' && platforms.includes(args.platform) ? [args.platform] : null;
  const unknown = Object.keys(args).filter((key) => !['_', 'all', 'platform'].includes(key));
  if (!runInput || extra.length || !selectedPlatforms || unknown.length || args.all && args.platform) {
    throw new Error('Usage: create-visual-coverage.mjs <run-dir> (--all | --platform <id>)');
  }
  const runDir = expandPath(runInput);
  const state = await readJson(join(runDir, 'run.json'));
  const issues = [];
  if (state.schema_version !== 2 || state.status !== 'running'
    || state.stages?.visual?.status !== 'running' || state.current_stage !== 'visual') {
    add(issues, 'visual_coverage_stage_mismatch', 'Coverage requires a running current visual stage.');
  }
  if (state.gates?.titles?.status !== 'approved') {
    add(issues, 'visual_coverage_titles_gate_missing', 'Coverage requires the approved titles gate.');
  }

  const attempt = state.stages?.visual?.attempt;
  const suffix = attempt === 1 ? '' : `.v${String(attempt).padStart(3, '0')}`;
  for (const platform of selectedPlatforms) {
    const base = `07-visual/${platform}`;
    for (const path of [
      `${base}/illustration-plan${suffix}.request.json`,
      `${base}/illustration-plan${suffix}.result.json`,
      `${base}/plan${suffix}.json`
    ]) {
      if (fileExists(join(runDir, path)) && !fileExists(join(runDir, coveragePathForAttempt(state, platform)))) {
        add(issues, 'visual_coverage_created_too_late', `Coverage cannot be created after current plan artifacts exist for ${platform}.`, { platform, path });
      }
    }
  }

  const policySourcePath = join(skillDir, 'references', 'visual-cardinality-policy.json');
  const policy = await readJson(policySourcePath);
  const policySource = {
    path: 'references/visual-cardinality-policy.json',
    sha256: await fileSha256(policySourcePath)
  };
  const policyPath = policyPathForAttempt(state);
  const existingCoverage = selectedPlatforms.every((platform) =>
    fileExists(join(runDir, coveragePathForAttempt(state, platform))));
  if (!issues.length && fileExists(join(runDir, policyPath)) && existingCoverage) {
    const current = await validateVisualCoverageSet(runDir, state);
    if (!current.issues.length || args.platform && current.coverages.has(args.platform)) {
      emitJson({
        status: 'READY', run_dir: runDir, policy_path: join(runDir, policyPath),
        coverage_paths: selectedPlatforms.map((platform) => join(runDir, coveragePathForAttempt(state, platform))),
        idempotent: true
      });
      process.exit(0);
    }
    issues.push(...current.issues);
  }

  const titleBinding = state.gates?.titles?.decision_ref;
  const titlePath = titleBinding?.path ? join(runDir, titleBinding.path) : null;
  const titleDecision = titlePath && fileExists(titlePath) ? await readJson(titlePath) : null;
  if (!titlePath || await fileSha256(titlePath) !== titleBinding.sha256
    || !Array.isArray(titleDecision?.selections)) {
    add(issues, 'visual_coverage_invalid', 'Approved title selection is missing or stale.');
  }
  const profile = state.snapshots?.platform_profiles;
  const profileBinding = profile?.snapshot_path && profile?.sha256
    ? { path: profile.snapshot_path, sha256: profile.sha256 } : null;
  const profilePath = profileBinding ? join(runDir, profileBinding.path) : null;
  if (!profilePath || !fileExists(profilePath) || await fileSha256(profilePath) !== profileBinding.sha256) {
    add(issues, 'visual_coverage_invalid', 'Platform profile snapshot is missing or stale.');
  }

  const createdAt = new Date().toISOString();
  const snapshot = createPolicySnapshot({ state, policy, policySource, createdAt });
  const policyRef = { path: policyPath, sha256: null };
  const contracts = new Map();
  if (!issues.length) {
    policyRef.sha256 = fileExists(join(runDir, policyPath))
      ? await fileSha256(join(runDir, policyPath))
      : null;
    if (!policyRef.sha256) {
      const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
      policyRef.sha256 = createHash('sha256').update(serialized).digest('hex');
    }
    for (const platform of selectedPlatforms) {
      const selection = titleDecision.selections.find((item) => item.platform === platform);
      const sourcePath = selection?.draft_path ? join(runDir, selection.draft_path) : null;
      if (!selection || !sourcePath || !fileExists(sourcePath)
        || await fileSha256(sourcePath) !== selection.draft_sha256) {
        add(issues, 'visual_coverage_stale', `Selected source is missing or stale for ${platform}.`, { platform });
        continue;
      }
      const sourceText = await readFile(sourcePath, 'utf8');
      const value = deriveCoverageContract({
        state, platform, selection, titleBinding, profileBinding, policyRef, policy, sourceText, createdAt
      });
      issues.push(...value.issues);
      contracts.set(platform, value.contract);
    }
    if (args.all && contracts.size === platforms.length) {
      issues.push(...evaluateCrossPlatformCardinality([...contracts].map(([platform, value]) => ({
        platform, minimum: value.cardinality.minimum, target: value.cardinality.target
      })), { phase: 'pre-plan' }));
    }
  }

  if (issues.length) {
    emitJson({ status: 'BLOCKED', run_dir: runDir, issues }, 2);
  } else {
    if (!fileExists(join(runDir, policyPath))) await writeJson(join(runDir, policyPath), snapshot);
    for (const [platform, contract] of contracts) {
      const path = join(runDir, coveragePathForAttempt(state, platform));
      if (fileExists(path)) {
        const existing = await readJson(path);
        if (JSON.stringify(existing) !== JSON.stringify(contract)) {
          throw new Error(`Refusing to overwrite a different current coverage contract for ${platform}.`);
        }
      } else {
        await writeJson(path, contract);
      }
    }
    emitJson({
      status: 'READY', run_dir: runDir, policy_path: join(runDir, policyPath),
      coverage_paths: selectedPlatforms.map((platform) => join(runDir, coveragePathForAttempt(state, platform))),
      idempotent: false
    });
  }
} catch (error) {
  emitJson({ status: 'BLOCKED', message: error.message, issues: error.issues || [] }, 2);
}

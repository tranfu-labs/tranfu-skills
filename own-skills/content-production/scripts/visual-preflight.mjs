#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as backendRuntime from './backend-runtime.mjs';
import { emitJson, expandPath, parseArgs, readJson, skillDir, writeJson } from './lib.mjs';
import { bodyVisualAttempt, wechatCoverAttempt } from './visual-state.mjs';
import {
  readPngSize,
  validateInstalledRegistry
} from '../skills/post-illustration-images/scripts/validate-style-bundle.mjs';

const ILLUSTRATION_ROOT = join(skillDir, 'skills', 'post-illustration-images');
const COVER_ROOT = join(skillDir, 'skills', 'wechat-sketch-cover');

function issue(code, message, extra = {}) {
  return { code, message, resume_from: 'visual', ...extra };
}

function run(executable, args) {
  return new Promise((resolveResult) => {
    execFile(executable, args, { timeout: 30_000 }, (error, stdout, stderr) => {
      resolveResult({ code: error?.code && Number.isInteger(error.code) ? error.code : error ? null : 0, stdout, stderr });
    });
  });
}

async function regularReadable(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function executableCheck(id, executable, args, acceptedCodes, issues, execute = run) {
  const result = await execute(executable, args);
  const passed = acceptedCodes.includes(result.code);
  if (!passed) issues.push(issue(`visual_preflight_${id}_unavailable`, `${id} is unavailable or not executable.`));
  return { id, status: passed ? 'PASS' : 'BLOCKED' };
}

function appendIssues(target, values) {
  if (Array.isArray(values)) target.push(...values);
}

export async function validateBackendPreflight(runDir, state, {
  runtime = backendRuntime,
  consumers = ['body_visual', 'wechat_cover']
} = {}) {
  const issues = [];
  if (typeof runtime.loadBackendProfile !== 'function'
    || typeof runtime.loadBackendLease !== 'function') {
    issues.push(issue('visual_preflight_backend_contract_unavailable', 'BackendProfile validation helpers are unavailable.'));
    return { issues, checks: [] };
  }
  const profile = await runtime.loadBackendProfile(runDir, state);
  appendIssues(issues, profile?.issues);
  const checks = [{ id: 'backend_profile', status: profile?.issues?.length ? 'BLOCKED' : 'PASS' }];
  for (const consumer of consumers) {
    const lease = await runtime.loadBackendLease(runDir, state, consumer);
    appendIssues(issues, lease?.issues);
    checks.push({ id: `${consumer}_lease`, status: lease?.issues?.length ? 'BLOCKED' : 'PASS' });
  }
  return { issues, checks };
}

export async function validateVisualPreflight(runDir, state, {
  runtime = backendRuntime,
  execute = run,
  validateRegistry = validateInstalledRegistry,
  decodePng = readPngSize,
  consumers = ['body_visual', 'wechat_cover']
} = {}) {
  const issues = [];
  const checks = [];
  let registeredStyles = [];
  try {
    const registry = validateRegistry({ skillRoot: ILLUSTRATION_ROOT });
    const registryValue = await readJson(registry.registryPath);
    registeredStyles = registryValue.styles;
    checks.push({ id: 'illustration_style_registry', status: 'PASS', registered_styles: registry.styles });
  } catch {
    issues.push(issue('visual_preflight_style_registry_invalid', 'Registered illustration style specs or references are invalid.'));
    checks.push({ id: 'illustration_style_registry', status: 'BLOCKED' });
  }

  const compiler = join(ILLUSTRATION_ROOT, 'scripts', 'compile-generation-prompt.mjs');
  if (!await regularReadable(compiler)) {
    issues.push(issue('visual_preflight_prompt_compiler_unavailable', 'prompt_compiler is unavailable or not executable.'));
    checks.push({ id: 'prompt_compiler', status: 'BLOCKED' });
  } else {
    checks.push(await executableCheck(
      'prompt_compiler', process.execPath, [compiler, '--help'], [0], issues, execute
    ));
  }

  const renderer = join(ILLUSTRATION_ROOT, 'scripts', 'apply-brand-overlay.mjs');
  checks.push(await executableCheck(
    'brand_renderer', process.execPath, [renderer, '--self-test'], [0], issues, execute
  ));

  const geometry = join(ILLUSTRATION_ROOT, 'scripts', 'resolve-generation-geometry.mjs');
  const geometryProfile = join(ILLUSTRATION_ROOT, 'references', 'gpt-image-2-geometry.spec.json');
  let geometryPassed = registeredStyles.length > 0;
  for (const style of registeredStyles) {
    const result = await execute(process.execPath, [
      geometry, '--style-spec', join(ILLUSTRATION_ROOT, style.specFile),
      '--model-profile', geometryProfile, '--model', 'gpt-image-2'
    ]);
    if (result.code !== 0) geometryPassed = false;
  }
  if (!geometryPassed) {
    issues.push(issue('visual_preflight_geometry_profile_unavailable', 'geometry_profile is unavailable or does not support every registered style.'));
  }
  checks.push({ id: 'geometry_profile', status: geometryPassed ? 'PASS' : 'BLOCKED' });

  const coverStyle = join(COVER_ROOT, 'references', 'style-spec.md');
  const coverReference = join(COVER_ROOT, 'assets', 'style-reference.png');
  if (!await regularReadable(coverStyle)) {
    issues.push(issue('visual_preflight_cover_style_invalid', 'WeChat cover style specification is missing or unreadable.'));
    checks.push({ id: 'cover_style', status: 'BLOCKED' });
  } else {
    try {
      const dimensions = decodePng(coverReference, 'WeChat cover style reference');
      if (dimensions.width < 1 || dimensions.height < 1) throw new Error('invalid dimensions');
      checks.push({ id: 'cover_style', status: 'PASS' });
    } catch {
      issues.push(issue('visual_preflight_cover_reference_invalid', 'WeChat cover reference does not fully decode as a valid PNG.'));
      checks.push({ id: 'cover_style', status: 'BLOCKED' });
    }
  }

  const normalizer = join(COVER_ROOT, 'scripts', 'normalize_cover.py');
  checks.push(await executableCheck(
    'cover_normalizer', process.env.PYTHON || 'python3', [normalizer], [2], issues, execute
  ));
  const provider = join(COVER_ROOT, 'scripts', 'provider-contract.mjs');
  checks.push(await executableCheck(
    'cover_provider', process.execPath, [provider], [2], issues, execute
  ));

  const backend = await validateBackendPreflight(runDir, state, { runtime, consumers });
  issues.push(...backend.issues);
  checks.push(...backend.checks);
  return { status: issues.length ? 'BLOCKED' : 'PASS', checks, issues };
}

export function visualPreflightPath(state) {
  return `07-visual/preflight.body-v${String(bodyVisualAttempt(state)).padStart(3, '0')}.cover-v${String(wechatCoverAttempt(state)).padStart(3, '0')}.json`;
}

export async function ensureVisualPreflight(runDir, state, options = {}) {
  const report = await validateVisualPreflight(runDir, state, options);
  const value = {
    schema_version: 1,
    artifact: 'VisualPreflight',
    run_id: state.run_id,
    body_attempt: bodyVisualAttempt(state),
    cover_attempt: wechatCoverAttempt(state),
    checked_at: new Date().toISOString(),
    consumers: options.consumers || ['body_visual', 'wechat_cover'],
    checks: report.checks,
    issues: report.issues,
    status: report.status
  };
  const path = visualPreflightPath(state);
  await writeJson(join(runDir, path), value);
  return { ...report, path, value };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [runInput, ...extra] = args._;
  if (!runInput || extra.length || Object.keys(args).some((key) => key !== '_')) {
    throw new Error('Usage: visual-preflight.mjs <run-dir>');
  }
  const runDir = expandPath(runInput);
  const state = await readJson(join(runDir, 'run.json'));
  const report = await ensureVisualPreflight(runDir, state);
  emitJson({
    status: report.status,
    run_id: state.run_id,
    preflight_path: report.path,
    checks: report.checks,
    issues: report.issues
  }, report.status === 'PASS' ? 0 : 2);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((error) => emitJson({
    status: 'BLOCKED',
    issues: [issue('visual_preflight_failed', error.message)]
  }, 2));
}

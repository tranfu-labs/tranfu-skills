#!/usr/bin/env node
import { isAbsolute, relative } from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import {
  capabilityDefinitions,
  emitJson,
  expandPath,
  fileExists,
  fileSha256,
  parseArgs,
  readJson
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const [requestInput, resultInput] = args._;
const issues = [];

function add(code, message, extra = {}) {
  issues.push({ code, message, ...extra });
}

function isInside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

try {
  if (!requestInput || !resultInput) throw new Error('Usage: check-provider-result.mjs <request.json> <result.json>');
  const requestPath = expandPath(requestInput);
  const resultPath = expandPath(resultInput);
  if (!fileExists(requestPath) || !fileExists(resultPath)) throw new Error('Request and result JSON files must exist.');
  if ((await lstat(requestPath)).isSymbolicLink() || (await lstat(resultPath)).isSymbolicLink()) {
    throw new Error('Request and result JSON files must not be symbolic links.');
  }

  const request = await readJson(requestPath);
  const result = await readJson(resultPath);
  const definition = capabilityDefinitions[request.capability];
  if (!definition) add('unknown_capability', `Unknown capability: ${request.capability}`);
  if (request.schema_version !== 1 || request.contract !== 'content-production-provider/v1') add('invalid_provider_request', 'Request contract must be content-production-provider/v1 schema 1.');
  if (!request.task_id || !request.run_dir || !request.output_dir || !Array.isArray(request.inputs) || !Array.isArray(request.expected_artifacts)) add('incomplete_provider_request', 'Request is missing task_id, run_dir, output_dir, inputs, or expected_artifacts.');
  if (definition && request.provider_contract !== definition.contract) add('provider_contract_mismatch', `Request must use ${definition.contract}.`);
  if (request.interaction_policy !== 'return_to_orchestrator') add('invalid_interaction_policy', 'Provider interaction policy must return decisions to the orchestrator.');

  if (result.schema_version !== 1 || result.contract !== 'content-production-provider/v1') add('invalid_provider_result', 'Result contract must be content-production-provider/v1 schema 1.');
  if (result.task_id !== request.task_id) add('provider_task_mismatch', 'Result task_id does not match request.');
  if (result.provider_contract !== request.provider_contract) add('provider_contract_mismatch', 'Result provider_contract does not match request.');
  if (!['PASS', 'BLOCKED', 'FAILED'].includes(result.status)) add('invalid_provider_status', `Invalid provider status: ${result.status}`);
  if (!Array.isArray(result.artifacts) || !Array.isArray(result.issues) || !Array.isArray(result.warnings)) add('incomplete_provider_result', 'Result artifacts, issues, and warnings must be arrays.');

  const runDir = expandPath(request.run_dir);
  const outputDir = expandPath(request.output_dir, runDir);
  let runRealDir = null;
  let outputRealDir = null;
  if (!fileExists(runDir)) {
    add('invalid_run_dir', 'Provider run_dir does not exist.');
  } else {
    const stat = await lstat(runDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) add('invalid_run_dir', 'Provider run_dir must be a real directory.');
    else runRealDir = await realpath(runDir);
  }
  if (!isInside(runDir, outputDir)) add('provider_output_escape', 'Authorized output_dir escapes run_dir.');
  else if (!fileExists(outputDir)) add('missing_provider_output_dir', 'Authorized output_dir does not exist.');
  else {
    const stat = await lstat(outputDir);
    if (stat.isSymbolicLink()) add('provider_output_symlink', 'Authorized output_dir must not be a symbolic link.');
    else {
      outputRealDir = await realpath(outputDir);
      if (!runRealDir || !isInside(runRealDir, outputRealDir)) add('provider_output_escape', 'Resolved output_dir escapes run_dir.');
    }
  }

  const artifactPaths = new Set();
  for (const artifact of result.artifacts || []) {
    if (!artifact?.role || !artifact?.path || !/^[a-f0-9]{64}$/.test(artifact?.sha256 || '')) {
      add('invalid_provider_artifact', 'Every provider artifact needs role, path, and SHA-256.');
      continue;
    }
    const path = expandPath(artifact.path, runDir);
    if (!isInside(outputDir, path)) add('provider_artifact_escape', `Provider artifact escapes output_dir: ${artifact.path}`, { path: artifact.path });
    if (!fileExists(path)) add('missing_provider_artifact', `Provider artifact does not exist: ${artifact.path}`, { path: artifact.path });
    else {
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) add('provider_artifact_symlink', `Provider artifact must not be a symbolic link: ${artifact.path}`, { path: artifact.path });
      else {
        const real = await realpath(path);
        if (!outputRealDir || !isInside(outputRealDir, real)) add('provider_artifact_escape', `Resolved provider artifact escapes output_dir: ${artifact.path}`, { path: artifact.path });
        else if (artifact.sha256 !== await fileSha256(path)) add('provider_artifact_drift', `Provider artifact hash is stale: ${artifact.path}`, { path: artifact.path });
      }
    }
    artifactPaths.add(artifact.path);
  }

  if (result.status === 'PASS') {
    for (const path of request.expected_artifacts || []) {
      if (!artifactPaths.has(path)) add('missing_expected_provider_artifact', `PASS result omitted expected artifact: ${path}`, { path });
    }
    if ((result.issues || []).length) add('pass_result_has_issues', 'PASS provider result cannot contain blocking issues.');
  } else if (!(result.issues || []).length) {
    add('missing_provider_issue', `${result.status} provider result must include at least one issue.`);
  }

  for (const issue of result.issues || []) {
    if (!issue?.code || !issue?.message || !issue?.resume_from) add('invalid_provider_issue', 'Provider issues require code, message, and resume_from.');
  }

  const contractStatus = issues.length ? 'BLOCKED' : 'PASS';
  const providerStatus = ['PASS', 'BLOCKED', 'FAILED'].includes(result.status) ? result.status : null;
  const status = issues.length ? 'BLOCKED' : providerStatus;
  emitJson({
    status,
    contract_status: contractStatus,
    provider_status: providerStatus,
    task_id: request.task_id,
    issues: issues.length ? issues : providerStatus === 'PASS' ? [] : result.issues,
    warnings: result.warnings || []
  }, issues.length || providerStatus !== 'PASS' ? 2 : 0);
} catch (error) {
  emitJson({ status: 'BLOCKED', issues: [{ code: 'provider_result_check_failed', message: error.message }] }, 2);
}

#!/usr/bin/env node

import { lstat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative } from 'node:path';
import {
  executeConfiguredGeneration,
  validateBackendLeaseFile
} from './backend-runtime.mjs';
import { emitJson, expandPath, fileExists, parseArgs, readJson } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const [runInput, ...extra] = args._;

function inside(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..'
    && !value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

async function hasSymlinkComponent(root, path) {
  let current = root;
  for (const part of relative(root, path).split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    if (fileExists(current) && (await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

try {
  const allowed = new Set(['_', 'prompt_file', 'output', 'size', 'output_format', 'verify_existing']);
  if (!runInput || extra.length || Object.keys(args).some((key) => !allowed.has(key))
    || !args.prompt_file || !args.output) {
    throw new Error('Usage: run-image-generation.mjs <run-dir> --prompt-file <path> --output <path> [--size WxH] [--output-format png] [--verify-existing]');
  }
  const runDir = expandPath(runInput);
  const state = await readJson(join(runDir, 'run.json'));
  const promptPath = expandPath(args.prompt_file, runDir);
  const outputPath = expandPath(args.output, runDir);
  if (!inside(runDir, promptPath) || !inside(runDir, outputPath) || !fileExists(promptPath)) {
    throw new Error('Prompt and output must remain inside run-dir.');
  }
  if (await hasSymlinkComponent(runDir, promptPath) || await hasSymlinkComponent(runDir, outputPath)) {
    throw new Error('Prompt and output cannot be symbolic links.');
  }
  const lease = await validateBackendLeaseFile(runDir, state);
  if (lease.issues.length) {
    emitJson({ status: 'BLOCKED', issues: lease.issues }, 2);
  } else if (args.output_format && args.output_format !== lease.value.backend_context.artifact_format
    || extname(outputPath).slice(1).replace('jpg', 'jpeg')
      !== lease.value.backend_context.artifact_format.replace('jpg', 'jpeg')
    || args.size && !/^[1-9][0-9]*x[1-9][0-9]*$/.test(args.size)) {
    emitJson({
      status: 'BLOCKED',
      issues: [{ code: 'backend_output_contract_mismatch', message: 'backend model channel unavailable', resume_from: 'visual' }]
    }, 2);
  } else if (args.verify_existing) {
    emitJson({
      status: fileExists(outputPath) ? 'PASS' : 'BLOCKED',
      backend_kind: lease.value.backend_kind,
      output: relative(runDir, outputPath)
    }, fileExists(outputPath) ? 0 : 2);
  } else if (lease.value.backend_kind === 'runtime-native') {
    emitJson({
      status: 'NATIVE_TOOL_CALL_REQUIRED',
      backend_kind: 'runtime-native',
      backend_context_sha256: lease.value.backend_context_sha256,
      prompt_file: relative(runDir, promptPath),
      output: relative(runDir, outputPath),
      model: lease.value.model
    });
  } else {
    const format = args.output_format || lease.value.backend_context.artifact_format;
    const adapterArgs = [
      'generate', '--prompt-file', promptPath, '--out', outputPath,
      '--model', lease.value.model, '--output-format', format
    ];
    if (args.size) adapterArgs.push('--size', args.size);
    const resolved = {
      kind: lease.value.backend_kind,
      context: lease.value.backend_context,
      adapter: { ...lease.value.adapter },
      configuration: lease.value.configuration,
      preflight: lease.value.preflight,
      issues: []
    };
    const result = await executeConfiguredGeneration({ resolved, adapterArgs });
    if (result.status === 'PASS' && !fileExists(outputPath)) {
      emitJson({ status: 'BLOCKED', issues: [{ code: 'backend_output_missing', message: 'backend model channel unavailable', resume_from: 'visual' }] }, 2);
    } else {
      emitJson({
        status: result.status,
        backend_kind: lease.value.backend_kind,
        backend_context_sha256: lease.value.backend_context_sha256,
        output: result.status === 'PASS' ? relative(runDir, outputPath) : null,
        issues: result.issues
      }, result.status === 'PASS' ? 0 : 2);
    }
  }
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    issues: [{ code: 'backend_wrapper_invalid', message: 'backend configuration inaccessible', resume_from: 'visual' }]
  }, 2);
}

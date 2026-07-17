#!/usr/bin/env node

import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { buildCompressionPlan, compressionPlanPath } from './package-contracts.mjs';
import {
  emitJson,
  ensureDir,
  expandPath,
  parseArgs,
  readJson,
  writeJson
} from './lib.mjs';

function inside(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..'
    && !value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

async function pathPresent(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function hasSymlinkComponent(root, path, includeLeaf = true) {
  if (!inside(root, path)) return true;
  let current = root;
  const parts = relative(root, path).split(/[\\/]/).filter(Boolean);
  const count = includeLeaf ? parts.length : Math.max(0, parts.length - 1);
  for (const part of parts.slice(0, count)) {
    current = join(current, part);
    if (await pathPresent(current) && (await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

function blocker(code, message, extra = {}) {
  return { code, message, resume_from: 'package', ...extra };
}

const args = parseArgs(process.argv.slice(2));
const [runInput, ...extra] = args._;

try {
  if (!runInput || extra.length || Object.keys(args).some((key) => key !== '_')) {
    throw new Error('Usage: create-compression-requests.mjs <run-dir>');
  }
  const runDir = expandPath(runInput);
  const stat = await lstat(runDir);
  const runReal = await realpath(runDir);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('run-dir must be a real directory.');
  const statePath = resolve(runDir, 'run.json');
  if (!await pathPresent(statePath) || (await lstat(statePath)).isSymbolicLink()
    || await hasSymlinkComponent(runDir, statePath) || !inside(runReal, await realpath(statePath))) {
    throw new Error('run.json must be a real file inside run-dir.');
  }
  const state = await readJson(statePath);
  const stage = state.stages?.package;
  if (state.status !== 'running' || state.current_stage !== 'package'
    || stage?.status !== 'running' || !Number.isInteger(stage?.attempt) || stage.attempt < 1) {
    throw Object.assign(new Error('Compression requests require the current positive package attempt to be running.'), {
      blockers: [blocker('compression_stage_mismatch', 'Compression requests require the current positive package attempt to be running.')]
    });
  }

  const built = await buildCompressionPlan(runDir, state);
  if (built.issues.length) throw Object.assign(new Error('Compression task planning is blocked.'), { blockers: built.issues });

  for (const task of built.tasks) {
    const outputDir = resolve(runDir, task.paths.base);
    if (!inside(runDir, outputDir) || await hasSymlinkComponent(runDir, outputDir, false)) {
      throw new Error(`Unsafe compression output directory: ${task.paths.base}`);
    }
    await ensureDir(outputDir);
    if ((await lstat(outputDir)).isSymbolicLink() || !inside(runReal, await realpath(outputDir))) {
      throw new Error(`Unsafe compression output directory: ${task.paths.base}`);
    }
    for (const relativePath of [task.paths.request, task.paths.result, task.paths.candidate]) {
      const path = resolve(runDir, relativePath);
      if (!inside(outputDir, path) || await hasSymlinkComponent(runDir, path, false)
        || await pathPresent(path) && (await lstat(path)).isSymbolicLink()) {
        throw new Error(`Unsafe compression artifact path: ${relativePath}`);
      }
    }
  }

  const planRelative = compressionPlanPath(state);
  const planAbsolute = resolve(runDir, planRelative);
  if (!inside(runDir, planAbsolute) || await hasSymlinkComponent(runDir, planAbsolute, false)
    || await pathPresent(planAbsolute) && (await lstat(planAbsolute)).isSymbolicLink()) {
    throw new Error(`Unsafe compression plan path: ${planRelative}`);
  }

  for (const task of built.tasks) {
    const requestPath = resolve(runDir, task.paths.request);
    if (await pathPresent(requestPath)) {
      if (JSON.stringify(await readJson(requestPath)) !== JSON.stringify(task.request)) {
        throw new Error(`Refusing to overwrite a different current-attempt request: ${task.paths.request}`);
      }
    } else {
      if (await pathPresent(resolve(runDir, task.paths.result))
        || await pathPresent(resolve(runDir, task.paths.candidate))) {
        throw new Error(`Compression outputs exist without their canonical request: ${task.platform}/${task.asset_id}`);
      }
      await writeJson(requestPath, task.request);
    }
  }

  if (await pathPresent(planAbsolute)) {
    if (JSON.stringify(await readJson(planAbsolute)) !== JSON.stringify(built.plan)) {
      throw new Error(`Refusing to overwrite a different current-attempt compression plan: ${planRelative}`);
    }
  } else {
    await writeJson(planAbsolute, built.plan);
  }

  emitJson({
    status: 'PASS',
    plan_path: planAbsolute,
    request_paths: built.tasks.map((task) => resolve(runDir, task.paths.request)),
    task_count: built.tasks.length
  });
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    blockers: error.blockers || [blocker('compression_request_build_failed', error.message)]
  }, 2);
}

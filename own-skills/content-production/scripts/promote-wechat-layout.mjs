#!/usr/bin/env node

import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  buildWechatLayoutDelivery,
  validateWechatLayoutDelivery
} from './wechat-layout-contracts.mjs';
import {
  emitJson,
  ensureDir,
  expandPath,
  parseArgs,
  readJson
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

function packageIssue(code, message, extra = {}) {
  return { code, message, resume_from: 'package', ...extra };
}

async function sameBytes(path, expected) {
  return await pathPresent(path) && (await readFile(path)).equals(expected);
}

const args = parseArgs(process.argv.slice(2));
const [runInput, ...extra] = args._;

try {
  if (!runInput || extra.length || Object.keys(args).some((key) => key !== '_')) {
    throw new Error('Usage: promote-wechat-layout.mjs <run-dir>');
  }
  const runDir = expandPath(runInput);
  const runStat = await lstat(runDir);
  const runReal = await realpath(runDir);
  if (runStat.isSymbolicLink() || !runStat.isDirectory()) throw new Error('run-dir must be a real directory.');
  const statePath = resolve(runDir, 'run.json');
  if (!await pathPresent(statePath) || await hasSymlinkComponent(runDir, statePath)
    || !inside(runReal, await realpath(statePath))) {
    throw new Error('run.json must be a real file inside run-dir.');
  }
  const state = await readJson(statePath);
  const stage = state.stages?.package;
  if (state.status !== 'running' || state.current_stage !== 'package'
    || stage?.status !== 'running' || !Number.isInteger(stage?.attempt) || stage.attempt < 1) {
    throw Object.assign(new Error('Layout promotion requires the current positive package attempt to be running.'), {
      issues: [packageIssue('layout_stage_mismatch', 'Layout promotion requires the current positive package attempt to be running.')]
    });
  }

  const built = await buildWechatLayoutDelivery(runDir, state);
  if (built.issues.length || !built.descriptors.length) {
    throw Object.assign(new Error('WeChat layout staging artifacts are not ready for promotion.'), { issues: built.issues });
  }
  for (const descriptor of built.descriptors) {
    const target = resolve(runDir, descriptor.path);
    if (!inside(runDir, target) || await hasSymlinkComponent(runDir, target, false)
      || await pathPresent(target) && (await lstat(target)).isSymbolicLink()) {
      throw new Error(`Unsafe layout delivery path: ${descriptor.path}`);
    }
    await ensureDir(dirname(target));
    if (await hasSymlinkComponent(runDir, target, false)) {
      throw new Error(`Unsafe layout delivery parent path: ${descriptor.path}`);
    }
    if (await pathPresent(target) && !await sameBytes(target, descriptor.content)) {
      throw new Error(`Refusing to overwrite a different current-attempt layout artifact: ${descriptor.path}`);
    }
  }
  for (const descriptor of built.descriptors) {
    const target = resolve(runDir, descriptor.path);
    if (!await pathPresent(target)) await writeFile(target, descriptor.content, { flag: 'wx' });
  }

  const validation = await validateWechatLayoutDelivery(runDir, state);
  if (validation.issues.length) {
    throw Object.assign(new Error('Promoted WeChat layout failed its delivery contract.'), { issues: validation.issues });
  }
  emitJson({
    status: 'PASS',
    package_attempt: stage.attempt,
    artifacts: built.artifacts,
    layout_result: resolve(runDir, built.paths.finalResult)
  });
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    issues: error.issues?.length
      ? error.issues
      : [packageIssue('wechat_layout_promotion_failed', error.message)]
  }, 2);
}

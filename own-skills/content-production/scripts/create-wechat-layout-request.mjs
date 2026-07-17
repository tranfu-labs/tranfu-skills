#!/usr/bin/env node

import { lstat, realpath } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { buildWechatLayoutRequest } from './wechat-layout-contracts.mjs';
import {
  emitJson,
  ensureDir,
  expandPath,
  filesUnder,
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
    throw new Error('Usage: create-wechat-layout-request.mjs <run-dir>');
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
  const built = await buildWechatLayoutRequest(runDir, state);
  if (built.issues.length || !built.request) {
    throw Object.assign(new Error('WeChat layout request planning is blocked.'), { blockers: built.issues });
  }

  for (const relativePath of [built.paths.root, built.paths.staging]) {
    const path = resolve(runDir, relativePath);
    if (!inside(runDir, path) || await hasSymlinkComponent(runDir, path, false)) {
      throw new Error(`Unsafe layout directory: ${relativePath}`);
    }
    await ensureDir(path);
    if ((await lstat(path)).isSymbolicLink() || !inside(runReal, await realpath(path))) {
      throw new Error(`Unsafe layout directory: ${relativePath}`);
    }
  }

  for (const relativePath of [
    built.paths.request, built.paths.result,
    built.paths.stagedClean, built.paths.stagedPreview
  ]) {
    const path = resolve(runDir, relativePath);
    if (!inside(resolve(runDir, built.paths.root), path)
      || await hasSymlinkComponent(runDir, path, false)
      || await pathPresent(path) && (await lstat(path)).isSymbolicLink()) {
      throw new Error(`Unsafe layout artifact path: ${relativePath}`);
    }
  }

  const requestPath = resolve(runDir, built.paths.request);
  if (await pathPresent(requestPath)) {
    if (!isDeepStrictEqual(await readJson(requestPath), built.request)) {
      throw new Error(`Refusing to overwrite a different current-attempt request: ${built.paths.request}`);
    }
  } else {
    const present = [];
    for (const path of [built.paths.result, built.paths.stagedClean, built.paths.stagedPreview]) {
      if (await pathPresent(resolve(runDir, path))) present.push(path);
    }
    if (present.length) {
      throw new Error(`Layout outputs exist without their canonical request: ${present.join(', ')}`);
    }
    await writeJson(requestPath, built.request);
  }

  const allowed = new Set([
    relative(resolve(runDir, built.paths.root), requestPath).replaceAll('\\', '/'),
    relative(resolve(runDir, built.paths.root), resolve(runDir, built.paths.result)).replaceAll('\\', '/'),
    relative(resolve(runDir, built.paths.root), resolve(runDir, built.paths.stagedClean)).replaceAll('\\', '/'),
    relative(resolve(runDir, built.paths.root), resolve(runDir, built.paths.stagedPreview)).replaceAll('\\', '/')
  ]);
  const undeclared = (await filesUnder(resolve(runDir, built.paths.root))).filter((path) => !allowed.has(path));
  if (undeclared.length) {
    throw new Error(`Current layout attempt contains undeclared files: ${undeclared.join(', ')}`);
  }

  emitJson({
    status: 'PASS',
    package_attempt: built.paths.attempt,
    request_path: requestPath,
    output_dir: resolve(runDir, built.paths.staging),
    expected_artifacts: built.request.expected_artifacts
  });
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    blockers: error.blockers?.length
      ? error.blockers
      : [blocker('wechat_layout_request_build_failed', error.message)]
  }, 2);
}

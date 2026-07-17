#!/usr/bin/env node

import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  buildPublishPackage,
  packagePaths,
  validatePublishPackages
} from './package-contracts.mjs';
import {
  emitJson,
  ensureDir,
  expandPath,
  fileExists,
  filesUnder,
  parseArgs,
  platforms,
  readJson
} from './lib.mjs';

function inside(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..'
    && !value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

async function hasSymlinkComponent(root, path, includeLeaf = true) {
  if (!inside(root, path)) return true;
  let current = root;
  const parts = relative(root, path).split(/[\\/]/).filter(Boolean);
  const count = includeLeaf ? parts.length : Math.max(0, parts.length - 1);
  for (const part of parts.slice(0, count)) {
    current = join(current, part);
    if (fileExists(current) && (await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

function packageIssue(code, message, extra = {}) {
  return { code, message, resume_from: 'package', ...extra };
}

async function sameBytes(path, expected) {
  if (!fileExists(path)) return false;
  const actual = await readFile(path);
  return actual.equals(expected);
}

const args = parseArgs(process.argv.slice(2));
const [runInput, ...extra] = args._;

try {
  if (!runInput || extra.length || Object.keys(args).some((key) => key !== '_')) {
    throw new Error('Usage: assemble-publish-packs.mjs <run-dir>');
  }
  const runDir = expandPath(runInput);
  const runStat = await lstat(runDir);
  const runReal = await realpath(runDir);
  if (runStat.isSymbolicLink() || !runStat.isDirectory()) throw new Error('run-dir must be a real directory.');
  const statePath = resolve(runDir, 'run.json');
  if (!fileExists(statePath) || (await lstat(statePath)).isSymbolicLink()
    || await hasSymlinkComponent(runDir, statePath) || !inside(runReal, await realpath(statePath))) {
    throw new Error('run.json must be a real file inside run-dir.');
  }
  const state = await readJson(statePath);
  const stage = state.stages?.package;
  if (state.status !== 'running' || state.current_stage !== 'package'
    || stage?.status !== 'running' || !Number.isInteger(stage?.attempt) || stage.attempt < 1) {
    throw Object.assign(new Error('Publish-pack assembly requires the current positive package attempt to be running.'), {
      issues: [packageIssue('package_stage_mismatch', 'Publish-pack assembly requires the current positive package attempt to be running.')]
    });
  }

  const built = await buildPublishPackage(runDir, state);
  if (built.issues.length) throw Object.assign(new Error('Compression outputs are not ready for assembly.'), { issues: built.issues });

  for (const platform of platforms) {
    const paths = packagePaths(state, platform);
    const expected = built.descriptors
      .map((item) => item.path)
      .filter((path) => path.startsWith(`${paths.imagesDir}/`))
      .map((path) => path.slice(paths.imagesDir.length + 1));
    const actual = await filesUnder(resolve(runDir, paths.imagesDir));
    if (actual.some((path) => !expected.includes(path))) {
      throw Object.assign(new Error(`Active publish image directory contains undeclared files for ${platform}.`), {
        issues: [packageIssue('untracked_publish_image', `Active publish image directory contains undeclared files for ${platform}.`, {
          expected,
          actual
        })]
      });
    }
  }

  for (const descriptor of built.descriptors) {
    const target = resolve(runDir, descriptor.path);
    if (!inside(runDir, target) || await hasSymlinkComponent(runDir, target, false)
      || fileExists(target) && (await lstat(target)).isSymbolicLink()) {
      throw new Error(`Unsafe publish package path: ${descriptor.path}`);
    }
    await ensureDir(dirname(target));
    if (await hasSymlinkComponent(runDir, target, false)) {
      throw new Error(`Unsafe publish package parent path: ${descriptor.path}`);
    }
    if (fileExists(target) && !await sameBytes(target, descriptor.content)) {
      throw new Error(`Refusing to overwrite a different current-attempt package artifact: ${descriptor.path}`);
    }
  }

  for (const descriptor of built.descriptors) {
    const target = resolve(runDir, descriptor.path);
    if (!fileExists(target)) await writeFile(target, descriptor.content, { flag: 'wx' });
  }

  const validation = await validatePublishPackages(runDir, state);
  if (validation.issues.length) {
    throw Object.assign(new Error('Assembled publish packs failed their contract validation.'), { issues: validation.issues });
  }
  emitJson({
    status: 'PASS',
    package_attempt: stage.attempt,
    artifacts: built.artifacts
  });
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    issues: error.issues || [packageIssue('publish_pack_assembly_failed', error.message)]
  }, 2);
}

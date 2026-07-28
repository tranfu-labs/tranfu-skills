#!/usr/bin/env node

import { homedir } from 'node:os';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { emitJson, expandPath, parseArgs } from './lib.mjs';

const patterns = [
  { kind: 'macos_user_path', pattern: /\/Users\/[^/<\s]+/ },
  { kind: 'linux_user_path', pattern: /\/home\/[^/<\s]+/ },
  { kind: 'windows_user_path', pattern: /[A-Za-z]:[\\/]Users[\\/][^\\/<\s]+/ }
];
const textExtensions = new Set(['.json', '.md', '.html', '.txt', '.yaml', '.yml']);

export function findPathLeaks(value, { currentHome = homedir(), location = '$' } = {}) {
  const leaks = [];
  const visit = (child, path) => {
    if (typeof child === 'string') {
      const matched = patterns.find(({ pattern }) => pattern.test(child));
      if (matched || currentHome && child.includes(currentHome)) {
        leaks.push({ location: path, kind: matched?.kind || 'current_home_path' });
      }
      return;
    }
    if (Array.isArray(child)) child.forEach((item, index) => visit(item, `${path}[${index}]`));
    else if (child && typeof child === 'object') {
      for (const [key, item] of Object.entries(child)) visit(item, `${path}.${key}`);
    }
  };
  visit(value, location);
  return leaks;
}

async function scannableFiles(root, current = root) {
  const output = [];
  for (const entry of await readdir(current)) {
    const path = join(current, entry);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) output.push(...await scannableFiles(root, path));
    else if (stat.isFile() && textExtensions.has(extname(entry).toLowerCase())) output.push(path);
  }
  return output;
}

export async function scanPathLeaks(runDir, { currentHome = homedir() } = {}) {
  const files = await scannableFiles(runDir);
  const leaks = [];
  for (const path of files) {
    const location = relative(runDir, path).replaceAll('\\', '/');
    const text = await readFile(path, 'utf8');
    if (extname(path).toLowerCase() === '.json') {
      try {
        leaks.push(...findPathLeaks(JSON.parse(text), { currentHome, location }));
        continue;
      } catch {}
    }
    leaks.push(...findPathLeaks(text, { currentHome, location }));
  }
  return { files, leaks };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [runInput, ...extra] = args._;
  if (!runInput || extra.length || Object.keys(args).some((key) => key !== '_')) {
    throw new Error('Usage: scan-path-leaks.mjs <run-dir>');
  }
  const runDir = expandPath(runInput);
  const report = await scanPathLeaks(runDir);
  emitJson({
    status: report.leaks.length ? 'BLOCKED' : 'PASS',
    run_id: resolve(runDir).split(/[\\/]/).at(-1),
    checked_files: report.files.length,
    leaks: report.leaks
  }, report.leaks.length ? 2 : 0);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => emitJson({ status: 'BLOCKED', leaks: [], message: error.message }, 2));
}

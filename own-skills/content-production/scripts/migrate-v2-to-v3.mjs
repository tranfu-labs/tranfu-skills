#!/usr/bin/env node

import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  emitJson,
  expandPath,
  fileExists,
  fileSha256,
  inspectCapabilities,
  parseArgs,
  readJson,
  skillDir,
  writeJson
} from './lib.mjs';
import { initialVisualComponent } from './visual-state.mjs';

const args = parseArgs(process.argv.slice(2));
const [sourceInput, ...extra] = args._;

function issue(code, message) {
  return { code, message, resume_from: 'migration' };
}

function safeRelative(path) {
  return path && !isAbsolute(path) && !path.includes('\\') && path !== '..' && !path.startsWith('../');
}

async function copyTree(source, target, relativePath = '') {
  const current = join(source, relativePath);
  const stat = await lstat(current);
  if (stat.isSymbolicLink()) throw new Error(`Migration refuses symbolic links: ${relativePath || '.'}`);
  if (stat.isDirectory()) {
    await mkdir(join(target, relativePath), { recursive: true });
    for (const entry of await readdir(current)) await copyTree(source, target, join(relativePath, entry));
  } else if (stat.isFile()) {
    await mkdir(dirname(join(target, relativePath)), { recursive: true });
    await copyFile(current, join(target, relativePath));
  }
}

async function sanitizeJsonTree(root, sourceRoot, relativePath = '') {
  const current = join(root, relativePath);
  const stat = await lstat(current);
  if (stat.isDirectory()) {
    for (const entry of await readdir(current)) await sanitizeJsonTree(root, sourceRoot, join(relativePath, entry));
    return;
  }
  if (!stat.isFile() || !relativePath.endsWith('.json')) return;
  try {
    const value = await readJson(current);
    await writeJson(current, sanitize(value, sourceRoot));
  } catch {}
}

function sanitize(value, sourceRoot) {
  if (Array.isArray(value)) return value.map((item) => sanitize(item, sourceRoot));
  if (!value || typeof value !== 'object') {
    if (typeof value !== 'string' || !isAbsolute(value)) return value;
    const rel = relative(sourceRoot, value).replaceAll('\\', '/');
    return safeRelative(rel) ? rel : basename(value);
  }
  const removed = new Set([
    'source_path', 'original_path', 'run_dir', 'skill_path', 'config_path',
    'auth_path', 'adapter_path'
  ]);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !removed.has(key))
    .map(([key, child]) => [key, sanitize(child, sourceRoot)]));
}

function validTextContent(value) {
  return value?.primary?.headline && Array.isArray(value.primary.labels) && value.primary.labels.length >= 2
    && value?.compact?.headline && Array.isArray(value.compact.labels) && value.compact.labels.length >= 2;
}

async function importedPassAssets(sourceRoot) {
  const imported = [];
  for (const platform of ['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao']) {
    const root = join(sourceRoot, '07-visual', platform);
    if (!fileExists(root)) continue;
    for (const name of await readdir(root)) {
      if (!/^bundle(?:\.v\d{3})?\.json$/.test(name)) continue;
      let bundle;
      try { bundle = await readJson(join(root, name)); } catch { continue; }
      const planPath = bundle?.plan?.path;
      if (bundle?.status !== 'PASS' || !safeRelative(planPath) || !fileExists(join(sourceRoot, planPath))) continue;
      let plan;
      try { plan = await readJson(join(sourceRoot, planPath)); } catch { continue; }
      const anchors = new Map((plan?.anchors || []).map((anchor) => [anchor.image_id, anchor]));
      for (const image of bundle.images || []) {
        const anchor = anchors.get(image.image_id);
        if (!validTextContent(anchor?.text_content) || !safeRelative(image.file)
          || !fileExists(join(sourceRoot, image.file))) continue;
        const actual = await fileSha256(join(sourceRoot, image.file));
        if (actual !== image.file_sha256) continue;
        imported.push({
          platform,
          image_id: image.image_id,
          path: image.file,
          sha256: actual,
          text_policy: 'allowlist'
        });
      }
    }
  }
  return imported;
}

async function migrate() {
  if (!sourceInput || extra.length || Object.keys(args).some((key) => !['_', 'apply', 'output_root'].includes(key))) {
    throw new Error('Usage: migrate-v2-to-v3.mjs <v2-run> [--apply --output-root <dir>]');
  }
  const sourceRoot = expandPath(sourceInput);
  const stat = await lstat(sourceRoot);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('Source run must be a real directory.');
  }
  const state = await readJson(join(sourceRoot, 'run.json'));
  const visualStatus = state.stages?.visual?.status;
  const upstreamReady = state.stages?.titles?.status === 'completed'
    && state.gates?.titles?.status === 'approved';
  const issues = [];
  if (state.schema_version !== 2) issues.push(issue('migration_source_schema_invalid', 'Only schema v2 runs are supported.'));
  if (!['pending', 'running', 'blocked'].includes(visualStatus)) {
    issues.push(issue('migration_visual_status_unsupported', 'Only visual pending/running/blocked runs are supported.'));
  }
  if (!upstreamReady) issues.push(issue('migration_upstream_incomplete', 'Titles and the titles gate must already be complete.'));
  const imported = issues.length ? [] : await importedPassAssets(sourceRoot);
  const outputRunId = `${state.run_id}-v3`;
  if (!args.apply) {
    return {
      status: issues.length ? 'BLOCKED' : 'DRY_RUN',
      source_run_id: state.run_id,
      output_run_id: outputRunId,
      imported_pass_images: imported.length,
      issues
    };
  }
  if (args.apply !== true || !args.output_root || issues.length) {
    return { status: 'BLOCKED', source_run_id: state.run_id, output_run_id: outputRunId, issues };
  }
  const outputRoot = expandPath(args.output_root);
  const outputRun = join(outputRoot, outputRunId);
  if (fileExists(outputRun)) throw new Error(`Output run already exists: ${outputRunId}`);
  await mkdir(outputRoot, { recursive: true });
  await copyTree(sourceRoot, outputRun);
  await sanitizeJsonTree(outputRun, sourceRoot);

  const capabilityReport = await inspectCapabilities(join(skillDir, 'capabilities.yaml'));
  const now = new Date().toISOString();
  const migrated = sanitize(state, sourceRoot);
  migrated.schema_version = 3;
  migrated.run_id = outputRunId;
  migrated.updated_at = now;
  migrated.status = 'running';
  migrated.current_stage = 'visual';
  migrated.capabilities = {
    config_ref: capabilityReport.config_ref,
    config_sha256: await fileSha256(join(skillDir, 'capabilities.yaml')),
    status: capabilityReport.status,
    providers: Object.fromEntries(capabilityReport.capabilities.map((item) => [item.id, {
      skill_ref: item.skill_ref,
      skill_sha256: item.skill_sha256,
      status: item.status,
      required: item.required,
      contract: item.contract,
      profile: item.profile,
      ...(item.adapter_contract ? { adapter_contract: item.adapter_contract } : {}),
      ...(item.resources?.length ? { resources: item.resources } : {})
    }]))
  };
  migrated.stages.visual = {
    status: 'pending', revision: 0, artifacts: [], error: null,
    body_visual: initialVisualComponent(),
    wechat_cover: initialVisualComponent(),
    updated_at: now
  };
  for (const stage of ['package', 'final_qa']) {
    migrated.stages[stage] = {
      status: 'pending', attempt: migrated.stages[stage]?.attempt || 0,
      artifacts: [], error: null, invalidated_by: 'v2_to_v3_migration', updated_at: now
    };
  }
  migrated.gates.visual = {
    status: 'pending', revision: migrated.gates.visual?.revision || 0,
    decision_ref: null, bound_artifacts: [], approval_mode: null,
    approved_at: null, invalidated_by: 'v2_to_v3_migration', updated_at: now
  };
  migrated.gates.final = {
    status: 'pending', revision: migrated.gates.final?.revision || 0,
    decision_ref: null, bound_artifacts: [], approval_mode: null,
    approved_at: null, invalidated_by: 'v2_to_v3_migration', updated_at: now
  };
  migrated.resume = { next_stage: 'visual', reason: 'v2_to_v3_migration' };
  await writeJson(join(outputRun, 'run.json'), migrated);
  await writeJson(join(outputRun, '07-visual', 'migration-receipt.json'), {
    schema_version: 1,
    artifact: 'MigrationReceipt',
    source_run_id: state.run_id,
    output_run_id: outputRunId,
    source_schema_version: 2,
    target_schema_version: 3,
    migrated_at: now,
    source_run_json_sha256: await fileSha256(join(sourceRoot, 'run.json')),
    imported_pass_images: imported,
    rejected_policy: 'icons_only and ungrounded text are not reusable',
    source_unchanged: true
  });
  return {
    status: 'PASS',
    run_id: outputRunId,
    migration_receipt: '07-visual/migration-receipt.json',
    imported_pass_images: imported.length,
    issues: []
  };
}

migrate().then((value) => emitJson(value, value.status === 'BLOCKED' ? 2 : 0)).catch((error) => {
  emitJson({ status: 'BLOCKED', issues: [issue('migration_failed', error.message)] }, 2);
});

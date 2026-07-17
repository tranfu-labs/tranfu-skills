#!/usr/bin/env node

import { lstat, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  collectTitleProviderTasks,
  renderTitleMatrix,
  selectTitleWinners,
  titleAggregatePaths,
  validateTitleGenerationStage
} from './contracts.mjs';
import {
  emitJson,
  ensureDir,
  expandPath,
  fileExists,
  fileSha256,
  parseArgs,
  platforms,
  readJson,
  relativeTo,
  variants,
  writeJson
} from './lib.mjs';

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..'
    && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
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

function fail(message, issues = []) {
  throw Object.assign(new Error(message), { issues });
}

async function validateOutputPaths(runDir, runRealDir, paths) {
  const selectionDir = join(runDir, '06-selection');
  await ensureDir(selectionDir);
  const directoryStat = await lstat(selectionDir);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()
    || await hasSymlinkComponent(runDir, selectionDir)
    || !inside(runRealDir, await realpath(selectionDir))) {
    fail('06-selection must be a real directory inside run_dir.');
  }

  const outputs = {};
  for (const [key, value] of Object.entries(paths)) {
    if (key === 'revision') continue;
    if (typeof value !== 'string' || !value || isAbsolute(value)) {
      fail(`Invalid title aggregate path: ${key}.`);
    }
    const absolute = resolve(runDir, value);
    if (!inside(runDir, absolute) || dirname(absolute) !== selectionDir
      || await hasSymlinkComponent(runDir, absolute, false)) {
      fail(`Title aggregate output escapes 06-selection: ${value}.`);
    }
    if (fileExists(absolute)) {
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink() || !stat.isFile()
        || !inside(runRealDir, await realpath(absolute))) {
        fail(`Title aggregate output must be a real file inside run_dir: ${value}.`);
      }
    }
    outputs[key] = absolute;
  }
  return outputs;
}

async function writeMatrix(path, markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) fail('Title matrix renderer returned empty output.');
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
  await rename(temp, path);
}

const args = parseArgs(process.argv.slice(2));
const [runInput, ...extraPositionals] = args._;

try {
  if (!runInput || extraPositionals.length || Object.keys(args).some((key) => key !== '_')) {
    throw new Error('Usage: aggregate-titles.mjs <run-dir>');
  }

  const runDir = expandPath(runInput);
  const runStat = await lstat(runDir);
  if (runStat.isSymbolicLink() || !runStat.isDirectory()) {
    throw new Error('run-dir must be a real directory.');
  }
  const runRealDir = await realpath(runDir);
  const statePath = join(runDir, 'run.json');
  if (!fileExists(statePath)) throw new Error(`Missing run.json: ${statePath}`);
  const stateStat = await lstat(statePath);
  if (stateStat.isSymbolicLink() || !stateStat.isFile()
    || await hasSymlinkComponent(runDir, statePath)
    || !inside(runRealDir, await realpath(statePath))) {
    throw new Error('run.json must be a real file inside run-dir.');
  }
  const state = await readJson(statePath);
  const titleStage = state.stages?.titles;
  if (state.schema_version !== 2 || state.status !== 'running'
    || state.current_stage !== 'titles' || titleStage?.status !== 'running'
    || !Number.isInteger(titleStage.attempt) || titleStage.attempt < 1) {
    fail('Run titles stage must be running with a positive attempt.', [{
      code: 'title_aggregate_stage_mismatch',
      message: 'Run titles stage must be running with a positive attempt.',
      resume_from: 'titles'
    }]);
  }

  const collected = await collectTitleProviderTasks(runDir, state);
  if (collected.issues?.length) fail('Title provider tasks are incomplete or invalid.', collected.issues);
  if (!Array.isArray(collected.tasks) || collected.tasks.length !== platforms.length * variants.length) {
    fail('Title aggregation requires exactly ten provider tasks.', [{
      code: 'incorrect_title_task_count',
      message: `Expected 10 title provider tasks, found ${collected.tasks?.length ?? 0}.`,
      resume_from: 'titles'
    }]);
  }

  const byTarget = new Map();
  for (const task of collected.tasks) {
    const { request } = task.validation;
    const key = `${request.platform}:${request.variant}`;
    if (byTarget.has(key)) {
      fail(`Duplicate title provider task: ${key}.`, [{
        code: 'duplicate_title_provider_task',
        message: `Duplicate title provider task: ${key}.`,
        resume_from: 'titles'
      }]);
    }
    byTarget.set(key, task.validation);
  }

  const titles = {
    schema_version: 1,
    provider_contract: 'title-generation-v1',
    attempt: titleStage.attempt,
    platforms: {}
  };
  let total = 0;
  for (const platform of platforms) {
    titles.platforms[platform] = {};
    for (const variant of variants) {
      const validation = byTarget.get(`${platform}:${variant}`);
      if (!validation) fail(`Missing title provider task: ${platform}/${variant}.`);
      const { request, payload } = validation;
      const draft = request.inputs[0];
      titles.platforms[platform][variant] = {
        task_id: request.task_id,
        request_path: relativeTo(runDir, validation.requestPath),
        request_sha256: await fileSha256(validation.requestPath),
        result_path: relativeTo(runDir, validation.resultPath),
        result_sha256: await fileSha256(validation.resultPath),
        candidate_path: relativeTo(runDir, validation.payloadPath),
        candidate_sha256: await fileSha256(validation.payloadPath),
        draft_path: draft.path,
        draft_sha256: draft.sha256,
        candidates: payload.candidates
      };
      total += payload.candidates.length;
    }
  }
  if (total !== 34) {
    fail(`Expected exactly 34 title candidates, found ${total}.`, [{
      code: 'incorrect_title_total',
      message: `Expected exactly 34 title candidates, found ${total}.`,
      resume_from: 'titles'
    }]);
  }

  const aggregatePaths = titleAggregatePaths(state);
  const outputPaths = await validateOutputPaths(runDir, runRealDir, aggregatePaths);
  await writeJson(outputPaths.titles_path, titles);
  const titlesSha256 = await fileSha256(outputPaths.titles_path);

  const selections = selectTitleWinners(titles);
  if (!Array.isArray(selections) || selections.length !== platforms.length) {
    fail('Title selection must return exactly five platform winners.');
  }
  const decisionRule = selections[0]?.decision_rule;
  if (!decisionRule || selections.some((item) => item.decision_rule !== decisionRule)) {
    fail('Every selected title must use the same deterministic decision rule.');
  }
  const selection = {
    schema_version: 1,
    revision: aggregatePaths.revision,
    status: 'PROPOSED',
    titles_path: aggregatePaths.titles_path,
    titles_sha256: titlesSha256,
    decision_rule: decisionRule,
    selections: selections.map((item) => ({
      platform: item.platform,
      variant: item.variant,
      title_id: item.title_id,
      title: item.title,
      topic_phrase: item.topic_phrase,
      draft_path: item.draft_path,
      draft_sha256: item.draft_sha256,
      decision_rule: item.decision_rule
    }))
  };
  await writeJson(outputPaths.selection_path, selection);
  await writeMatrix(outputPaths.matrix_path, renderTitleMatrix(titles, selection));

  const validation = await validateTitleGenerationStage(runDir, state);
  if (validation.issues?.length) fail('Generated title aggregate failed self-validation.', validation.issues);
  if (validation.total !== 34) fail(`Title self-validation found ${validation.total ?? 0} candidates instead of 34.`);

  emitJson({
    status: 'PASS',
    run_dir: runDir,
    attempt: titleStage.attempt,
    total_candidates: 34,
    titles_path: outputPaths.titles_path,
    selection_path: outputPaths.selection_path,
    matrix_path: outputPaths.matrix_path
  });
} catch (error) {
  emitJson({
    status: 'BLOCKED',
    issues: error.issues?.length ? error.issues : [{
      code: 'title_aggregation_failed',
      message: error.message,
      resume_from: 'titles'
    }]
  }, 2);
}

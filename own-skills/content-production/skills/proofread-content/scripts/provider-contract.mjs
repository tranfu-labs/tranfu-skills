#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { analyzeClaimRegression, ENGINE_VERSION } from './claim-regression.mjs';

const CONTRACT = 'content-production-provider/v1';
const PROVIDER = 'proofreading-v1';
const PLATFORMS = new Set(['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao']);
const VARIANTS = new Set(['A', 'B']);
const STRATEGIES = new Set(['parallel_subagents', 'sequential_fallback']);
const ROLES = ['logic_checkpoint', 'humanized_checkpoint', 'final', 'logic_review', 'humanize_review', 'detail_review', 'proofread_result'];
const HARD_GATES = [
  'title', 'heading_structure', 'frontmatter', 'protected_literals',
  'markdown_semantics', 'no_fabrication', 'humanizer_ledger', 'platform_register'
];

function emit(value, code = 0) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exitCode = code;
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameItems(left, right) {
  return Array.isArray(left) && left.length === right.length
    && new Set(left).size === right.length && right.every((item) => left.includes(item));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function runRelative(runDir, path) {
  return relative(runDir, path).replaceAll('\\', '/');
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function hasSymlinkComponent(root, path, includeLeaf = true) {
  if (!inside(root, path)) return true;
  let current = root;
  const parts = relative(root, path).split(/[\\/]/).filter(Boolean);
  const count = includeLeaf ? parts.length : Math.max(0, parts.length - 1);
  for (const part of parts.slice(0, count)) {
    current = join(current, part);
    if (existsSync(current) && (await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

function add(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: 'editing', ...extra });
}

function definition(platform, variant) {
  const base = `05-platforms/${platform}/${variant}`;
  return {
    base,
    request: `${base}/reviews/proofreading.request.json`,
    result: `${base}/reviews/proofreading.result.json`,
    expected: [
      `${base}/logic-final.md`, `${base}/humanized.md`, `${base}/final.md`,
      `${base}/reviews/logic.md`, `${base}/reviews/humanize.md`, `${base}/reviews/detail.md`,
      `${base}/reviews/proofread-result.json`
    ]
  };
}

async function safeRealFile(runDir, runRealDir, path, issues, code, { mustExist = true } = {}) {
  if (!path || !inside(runDir, path) || (mustExist && !existsSync(path))) {
    add(issues, code, `Missing or unsafe file: ${path || '(missing)'}.`);
    return null;
  }
  if (!existsSync(path)) return path;
  try {
    const stat = await lstat(path);
    const real = await realpath(path);
    if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(runDir, path) || !inside(runRealDir, real)) {
      add(issues, code, `File must be real and remain inside run_dir: ${runRelative(runDir, path)}.`);
      return null;
    }
    return path;
  } catch (error) {
    add(issues, code, error.message);
    return null;
  }
}

async function validateRequest(input) {
  const issues = [];
  const requestPath = resolve(input || '');
  let request = null;
  let runDir = null;
  let runRealDir = null;
  let outputDir = null;
  let outputRealDir = null;
  let spec = null;
  let requestSha256 = null;

  if (!input || !existsSync(requestPath)) {
    add(issues, 'missing_provider_request', `Missing request: ${requestPath}.`);
    return { issues, requestPath, request, requestSha256, runDir, runRealDir, outputDir, outputRealDir, spec };
  }
  try {
    const stat = await lstat(requestPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Request must be a real file.');
    request = JSON.parse(await readFile(requestPath, 'utf8'));
    requestSha256 = await sha256(requestPath);
  } catch (error) {
    add(issues, 'invalid_provider_request', error.message);
    return { issues, requestPath, request, requestSha256, runDir, runRealDir, outputDir, outputRealDir, spec };
  }

  runDir = resolve(request.run_dir || '');
  try {
    const stat = await lstat(runDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('run_dir must be a real directory.');
    runRealDir = await realpath(runDir);
    if (!inside(runDir, requestPath) || await hasSymlinkComponent(runDir, requestPath)) throw new Error('Request must remain inside run_dir.');
  } catch (error) {
    add(issues, 'invalid_provider_run_dir', error.message);
  }

  if (!PLATFORMS.has(request.platform) || !VARIANTS.has(request.variant)) {
    add(issues, 'invalid_provider_target', 'Unsupported proofreading platform or variant.');
  } else {
    spec = definition(request.platform, request.variant);
  }
  if (spec) {
    outputDir = resolve(runDir, spec.base);
    try {
      const stat = await lstat(outputDir);
      outputRealDir = await realpath(outputDir);
      if (stat.isSymbolicLink() || !stat.isDirectory() || await hasSymlinkComponent(runDir, outputDir)
        || !inside(runRealDir, outputRealDir)) throw new Error('output_dir must be a real directory inside run_dir.');
    } catch (error) {
      add(issues, 'invalid_provider_output_dir', error.message);
    }
  }

  const options = request.options;
  const validOptions = plainObject(options)
    && sameItems(Object.keys(options), ['execution_strategy', 'model', 'parameters'])
    && STRATEGIES.has(options.execution_strategy)
    && typeof options.model === 'string' && Boolean(options.model.trim())
    && plainObject(options.parameters);
  if (request.schema_version !== 1 || request.contract !== CONTRACT
    || request.capability !== 'proofreading' || request.provider_contract !== PROVIDER
    || request.mode !== 'proofread' || !['autonomous', 'reviewed'].includes(request.run_mode)
    || request.output_dir !== spec?.base || request.interaction_policy !== 'return_to_orchestrator'
    || typeof request.task_id !== 'string' || !request.task_id
    || !sameItems(request.expected_artifacts, spec?.expected || []) || !validOptions
    || !isAbsolute(request.run_dir || '') || resolve(request.run_dir || '') !== runDir
    || (spec && requestPath !== resolve(runDir, spec.request))) {
    add(issues, 'invalid_provider_request', 'Request does not match proofreading-v1.');
  }

  const expectedDraft = spec ? `${spec.base}/draft.md` : null;
  if (!Array.isArray(request.inputs) || request.inputs.length !== 1
    || request.inputs[0]?.role !== 'draft' || request.inputs[0]?.path !== expectedDraft
    || !/^[a-f0-9]{64}$/.test(request.inputs[0]?.sha256 || '')) {
    add(issues, 'invalid_provider_inputs', 'Proofreading request must authorize exactly its canonical draft input.');
  } else if (runRealDir) {
    const draftPath = resolve(runDir, request.inputs[0].path);
    const safe = await safeRealFile(runDir, runRealDir, draftPath, issues, 'invalid_provider_input');
    if (safe && request.inputs[0].sha256 !== await sha256(safe)) {
      add(issues, 'provider_input_drift', 'Draft input hash no longer matches request.', { path: request.inputs[0].path });
    }
  }

  return { issues, requestPath, request, requestSha256, runDir, runRealDir, outputDir, outputRealDir, spec };
}

function frontmatter(text) {
  return text.match(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/)?.[0] || '';
}

function frontmatterValue(text, key) {
  const block = frontmatter(text);
  return block.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))?.[1] || null;
}

function fencedBlocks(text) {
  const blocks = [];
  let active = null;
  for (const line of text.replaceAll('\r\n', '\n').split('\n')) {
    if (active) {
      active.lines.push(line);
      const close = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (close && close[1][0] === active.marker && close[1].length >= active.length) {
        blocks.push(active.lines.join('\n'));
        active = null;
      }
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,}).*$/);
    if (open) active = { marker: open[1][0], length: open[1].length, lines: [line] };
  }
  if (active) blocks.push(active.lines.join('\n'));
  return blocks;
}

function withoutFencedCode(text) {
  let active = null;
  return text.replaceAll('\r\n', '\n').split('\n').map((line) => {
    if (active) {
      const close = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (close && close[1][0] === active.marker && close[1].length >= active.length) active = null;
      return '';
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,}).*$/);
    if (open) {
      active = { marker: open[1][0], length: open[1].length };
      return '';
    }
    return /^(?: {4,}|\t)/.test(line) ? '' : line;
  }).join('\n');
}

function withoutMarkdownCode(text) {
  return withoutFencedCode(text).replace(/(`+)([\s\S]*?)\1/g, '');
}

function headings(text) {
  return withoutFencedCode(text).match(/^#{1,6}\s+\S.*$/gm) || [];
}

function protectedLiterals(text) {
  const pattern = /\d{4}年\d{1,2}月\d{1,2}日|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|v?\d+(?:\.\d+){1,}|\d+(?:\.\d+)?(?:%|％|元|万元|亿元|天|日|周|月|年|小时|分钟|秒|倍|GB|MB|人|个)?/gi;
  return (text.match(pattern) || []).sort();
}

function targets(text) {
  const prose = withoutMarkdownCode(text);
  const found = [...prose.matchAll(/(!?)\[[^\]]*\]\(\s*(?:<([^>\n]+)>|([^)\s]+))(?:\s+["'][^"']*["'])?\s*\)/g)]
    .map((match) => `${match[1] ? 'image' : 'link'}:${match[2] || match[3]}`);
  const definitions = new Set();
  for (const match of prose.matchAll(/^ {0,3}\[([^\]]+)\]:[ \t]*(?:<([^>\n]+)>|(\S+))(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/gm)) {
    const label = match[1].trim().replace(/\s+/g, ' ').toLowerCase();
    definitions.add(label);
    found.push(`definition:${label}:${match[2] || match[3]}`);
  }
  for (const match of prose.matchAll(/(!?)\[([^\]]*)\]\[([^\]]*)\]/g)) {
    const label = (match[3] || match[2]).trim().replace(/\s+/g, ' ').toLowerCase();
    found.push(`reference-${match[1] ? 'image' : 'link'}:${label}`);
  }
  for (const match of prose.matchAll(/(?<!\])(!?)\[([^\]\n]+)\](?![[(]|[ \t]*:)/g)) {
    const label = match[2].trim().replace(/\s+/g, ' ').toLowerCase();
    if (definitions.has(label)) found.push(`shortcut-${match[1] ? 'image' : 'link'}:${label}`);
  }
  for (const match of prose.matchAll(/<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)>/g)) {
    found.push(`autolink:${match[1]}`);
  }
  return found.sort();
}

function containsScore(value) {
  if (Array.isArray(value)) return value.some(containsScore);
  if (typeof value === 'string') return /(?:\bscore\b|rating|grade|评分|得分|评级|分值|内部诊断)\s*[:：=]?\s*\d|\b\d+(?:\.\d+)?\s*(?:\/\s*(?:5|10|100)\b|分)/i.test(value);
  if (!plainObject(value)) return false;
  return Object.entries(value).some(([key, child]) => /score|rating|grade|评级|分值/i.test(key) || containsScore(child));
}

function inlineCode(text) {
  const stripped = withoutFencedCode(text);
  return [...stripped.matchAll(/(`+)([\s\S]*?)\1/g)].map((match) => `${match[1].length}:${match[2]}`).sort();
}

function indentedCode(text) {
  return text.replaceAll('\r\n', '\n').split('\n').filter((line) => /^(?: {4,}|\t)/.test(line));
}

function listSignature(text) {
  return withoutFencedCode(text).split('\n').flatMap((line) => {
    const match = line.match(/^(\s*)([-+*]|\d+\.)\s+/);
    return match ? [`${match[1].length}:${/\d/.test(match[2]) ? 'ordered' : 'bullet'}`] : [];
  });
}

function placeholder(text) {
  const prose = withoutMarkdownCode(text);
  return /\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b|待补(?:充|写)?|待确认|\{\{[^{}]+\}\}/i.test(prose);
}

function preservationIssues(source, output, path, issues) {
  if (frontmatter(source) !== frontmatter(output)) add(issues, 'frontmatter_drift', `Frontmatter changed in ${path}.`, { path });
  if (!sameJson(headings(source), headings(output))) add(issues, 'heading_structure_drift', `Heading text or order changed in ${path}.`, { path });
  if (!sameJson(protectedLiterals(source), protectedLiterals(output))) add(issues, 'protected_literal_drift', `Protected literals changed in ${path}.`, { path });
  if (!sameJson(targets(source), targets(output)) || !sameJson(fencedBlocks(source), fencedBlocks(output))
    || !sameJson(indentedCode(source), indentedCode(output)) || !sameJson(inlineCode(source), inlineCode(output))
    || !sameJson(listSignature(source), listSignature(output))) {
    add(issues, 'markdown_semantic_drift', `Markdown semantics changed in ${path}.`, { path });
  }
  const sourceTags = (source.match(/#[\p{L}\p{N}_-]+/gu) || []).sort();
  const outputTags = (output.match(/#[\p{L}\p{N}_-]+/gu) || []).sort();
  if (!sameJson(sourceTags, outputTags)) add(issues, 'markdown_semantic_drift', `Markdown semantics changed in ${path}.`, { path });
}

async function collectArtifacts(context, issues) {
  const artifacts = [];
  for (let index = 0; index < context.spec.expected.length; index += 1) {
    const relativePath = context.spec.expected[index];
    const path = resolve(context.runDir, relativePath);
    const safe = await safeRealFile(context.runDir, context.runRealDir, path, issues, 'provider_artifact_symlink');
    if (!safe || !inside(context.outputDir, path)) continue;
    artifacts.push({ role: ROLES[index], path: relativePath, sha256: await sha256(path) });
  }
  return artifacts;
}

async function validateArtifacts(context) {
  const issues = [];
  const artifacts = await collectArtifacts(context, issues);
  if (artifacts.length !== context.spec.expected.length) return { issues, artifacts };
  const sourcePath = resolve(context.runDir, context.request.inputs[0].path);
  const source = await readFile(sourcePath, 'utf8');
  const checkpointPaths = context.spec.expected.slice(0, 3);
  const checkpoints = [];
  for (const relativePath of checkpointPaths) {
    const text = await readFile(resolve(context.runDir, relativePath), 'utf8');
    checkpoints.push(text);
    if (!text.trim() || placeholder(text)) add(issues, 'invalid_proofread_checkpoint', `Checkpoint is empty or unresolved: ${relativePath}.`, { path: relativePath });
    if (headings(text).filter((line) => /^#\s+/.test(line)).length !== 1) add(issues, 'invalid_h1_count', `Checkpoint must contain exactly one H1: ${relativePath}.`, { path: relativePath });
    preservationIssues(source, text, relativePath, issues);
  }
  for (const [phase, checkpointIndex] of [['humanize', 1], ['final', 2]]) {
    const regression = analyzeClaimRegression(source, checkpoints[checkpointIndex]);
    for (const blocker of regression.blockers) {
      add(issues, `claim_regression_${phase}_${blocker.code}`, blocker.message, {
        platform: context.request.platform,
        variant: context.request.variant,
        phase,
        blocker
      });
    }
  }

  const chain = {
    logic: { source: context.request.inputs[0].path, output: checkpointPaths[0], review: context.spec.expected[3] },
    humanize: { source: checkpointPaths[0], output: checkpointPaths[1], review: context.spec.expected[4] },
    detail: { source: checkpointPaths[1], output: checkpointPaths[2], review: context.spec.expected[5] }
  };
  for (const phase of ['logic', 'humanize', 'detail']) {
    const review = await readFile(resolve(context.runDir, chain[phase].review), 'utf8');
    const reviewBody = withoutMarkdownCode(review.replace(frontmatter(review), ''))
      .replace(/^#{1,6}\s+.*$/gm, '').replace(/[#>*_\[\](){}|\\-]/g, '').replace(/\s+/g, '');
    const valid = review.trim() && reviewBody.length > 0 && !placeholder(review)
      && frontmatterValue(review, 'artifact') === 'ProofreadReview'
      && frontmatterValue(review, 'status') === 'PASS'
      && frontmatterValue(review, 'phase') === phase
      && frontmatterValue(review, 'source_path') === chain[phase].source
      && frontmatterValue(review, 'source_sha256') === await sha256(resolve(context.runDir, chain[phase].source))
      && frontmatterValue(review, 'output_path') === chain[phase].output
      && frontmatterValue(review, 'output_sha256') === await sha256(resolve(context.runDir, chain[phase].output))
      && headings(review).filter((line) => /^#\s+/.test(line)).length === 1;
    if (!valid) add(issues, 'invalid_proofread_review', `Review does not bind the ${phase} checkpoint.`, { path: chain[phase].review });
  }

  const reportPath = context.spec.expected[6];
  let report = null;
  try { report = JSON.parse(await readFile(resolve(context.runDir, reportPath), 'utf8')); } catch (error) {
    add(issues, 'invalid_proofread_result', error.message, { path: reportPath });
  }
  if (report) {
    const ledger = report.humanizer_ledger;
    const ledgerValid = Array.isArray(ledger) && ledger.length === 24
      && ledger.every((item, index) => item?.id === index + 1
        && plainObject(item) && sameItems(Object.keys(item), ['id', 'status', 'reason'])
        && ['no_hit', 'changed', 'kept_with_reason'].includes(item.status)
        && (item.status !== 'kept_with_reason' || typeof item.reason === 'string' && Boolean(item.reason.trim())));
    if (!ledgerValid) add(issues, 'invalid_humanizer_ledger', 'Humanizer ledger must contain exact entries 1-24 with valid statuses.', { path: reportPath });
    const gatesValid = plainObject(report.hard_gates)
      && sameItems(Object.keys(report.hard_gates), HARD_GATES)
      && HARD_GATES.every((key) => report.hard_gates[key] === 'PASS');
    const changesValid = plainObject(report.changes)
      && sameItems(Object.keys(report.changes), ['pass_1', 'pass_2', 'pass_3'])
      && Object.values(report.changes).every((value) => typeof value === 'string' && Boolean(value.trim()));
    const checkpointValid = plainObject(report.checkpoints)
      && sameItems(Object.keys(report.checkpoints), ['logic', 'humanize', 'detail'])
      && ['logic', 'humanize', 'detail'].every((phase) => {
        const item = report.checkpoints[phase];
        return plainObject(item) && sameItems(Object.keys(item), ['path', 'sha256', 'review_path', 'review_sha256'])
          && item.path === chain[phase].output
          && item?.sha256 === artifacts.find((artifact) => artifact.path === chain[phase].output)?.sha256
          && item?.review_path === chain[phase].review
          && item?.review_sha256 === artifacts.find((artifact) => artifact.path === chain[phase].review)?.sha256;
      });
    const exactReport = plainObject(report) && sameItems(Object.keys(report), [
      'schema_version', 'task_id', 'status', 'platform', 'variant', 'source', 'checkpoints',
      'hard_gates', 'humanizer_ledger', 'changes'
    ]);
    if (!exactReport || report.schema_version !== 1 || report.task_id !== context.request.task_id || report.status !== 'PASS'
      || report.platform !== context.request.platform || report.variant !== context.request.variant
      || !sameJson(report.source, context.request.inputs[0]) || !checkpointValid || !gatesValid || !changesValid
      || containsScore(report)) {
      add(issues, 'invalid_proofread_result', 'Proofread result does not bind the task, source, checkpoints, reviews, and hard gates.', { path: reportPath });
    }
  }
  return { issues, artifacts };
}

function makeResult(context, status, artifacts, issues, requestValid = true) {
  return {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER,
    task_id: context.request?.task_id || 'unknown',
    request_sha256: context.requestSha256,
    status,
    artifacts,
    checks: {
      request_valid: requestValid,
      mode: context.request?.mode || null,
      claim_regression_engine: ENGINE_VERSION
    },
    issues,
    warnings: []
  };
}

function resultPath(context) {
  return context.spec && context.runDir ? resolve(context.runDir, context.spec.result) : null;
}

async function safeResultTarget(context) {
  const path = resultPath(context);
  if (!path || !context.outputDir || !inside(context.outputDir, path) || await hasSymlinkComponent(context.runDir, path, false)) return false;
  if (!existsSync(path)) return true;
  const stat = await lstat(path);
  return !stat.isSymbolicLink() && stat.isFile() && inside(context.outputRealDir, await realpath(path));
}

async function writeResult(context, status, artifacts, issues, requestValid = true) {
  if (!await safeResultTarget(context)) throw new Error('Unsafe canonical proofreading result target.');
  const value = makeResult(context, status, artifacts, issues, requestValid);
  await writeFile(resultPath(context), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return value;
}

async function requestFailure(context) {
  if (context.request && await safeResultTarget(context)) {
    const value = await writeResult(context, 'BLOCKED', [], context.issues, false);
    emit({ ...value, result_path: runRelative(context.runDir, resultPath(context)) }, 2);
  } else {
    emit(makeResult(context, 'BLOCKED', [], context.issues, false), 2);
  }
}

async function main() {
  const [command, requestInput, detail] = process.argv.slice(2);
  const validBlock = command !== 'block' || typeof detail === 'string' && Boolean(detail.trim());
  if (!['validate-request', 'finalize', 'block'].includes(command) || !requestInput || !validBlock) {
    emit({ status: 'BLOCKED', issues: [{
      code: 'invalid_provider_command',
      message: 'Usage: provider-contract.mjs validate-request <request.json> | finalize <request.json> | block <request.json> <reason>',
      resume_from: 'editing'
    }] }, 2);
    return;
  }
  const context = await validateRequest(requestInput);
  if (context.issues.length) {
    await requestFailure(context);
    return;
  }
  if (command === 'validate-request') {
    emit({ status: 'PASS', task_id: context.request.task_id, run_dir: context.runDir, output_dir: context.spec.base,
      inputs: { draft: context.request.inputs[0].path }, issues: [] });
    return;
  }
  if (command === 'block') {
    const issues = [];
    add(issues, 'proofreading_author_input_required', detail.trim());
    const value = await writeResult(context, 'BLOCKED', [], issues);
    emit({ ...value, result_path: runRelative(context.runDir, resultPath(context)) }, 2);
    return;
  }
  const validation = await validateArtifacts(context);
  const status = validation.issues.length ? 'FAILED' : 'PASS';
  const value = await writeResult(context, status, validation.artifacts, validation.issues);
  emit({ ...value, result_path: runRelative(context.runDir, resultPath(context)) }, status === 'PASS' ? 0 : 2);
}

main().catch((error) => emit({
  status: 'FAILED',
  issues: [{ code: 'proofreading_provider_failed', message: error.message, resume_from: 'editing' }]
}, 2));

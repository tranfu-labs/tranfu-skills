#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const CONTRACT = 'content-production-provider/v1';
const PROVIDER_CONTRACT = 'source-research-v1';
const CAPABILITY = 'source_research';
const OUTPUT_DIR = '02-research';
const RESULT_FILE = 'provider-result.json';
const EXPECTED_ARTIFACTS = [
  '02-research/brief.md',
  '02-research/source-log.md',
  '02-research/claims.json',
  '02-research/evidence-map.md'
];
const ARTIFACT_ROLES = {
  '02-research/brief.md': 'research_brief',
  '02-research/source-log.md': 'source_log',
  '02-research/claims.json': 'claims',
  '02-research/evidence-map.md': 'evidence_map'
};
const CANONICAL_INPUTS = {
  research_subject: '01-discovery/research-subject.json',
  brief: '00-intake/brief.md',
  materials: '00-intake/materials.json',
  core_audience: '00-intake/core-audience.md',
  article_audience: '00-intake/article-audience.md'
};
const CLAIM_STATUSES = new Set(['verified', 'conflicted', 'unverified', 'rejected']);
const RISKS = new Set(['none', 'low', 'medium', 'high']);
const EVIDENCE_LEVELS = new Set(['L0', 'L1', 'L2', 'L3']);
const USE_GATES = new Set(['ready', 'caveat', 'do_not_use']);
const INPUT_MODES = new Set(['brief', 'topic', 'outline']);

function addIssue(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: 'research', ...extra });
}

function addWarning(warnings, code, message, extra = {}) {
  warnings.push({ code, message, resume_from: 'research', ...extra });
}

function emit(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = exitCode;
}

function inside(root, path) {
  if (!root || !path) return false;
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function runRelative(runDir, path) {
  return relative(runDir, path).split('\\').join('/');
}

function sameItems(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && new Set(actual).size === expected.length
    && expected.every((item) => actual.includes(item));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function validateRequest(requestInput) {
  const issues = [];
  const requestPath = resolve(requestInput);
  let request = null;

  if (!existsSync(requestPath)) {
    addIssue(issues, 'missing_provider_request', `Request file does not exist: ${requestPath}`);
    return { issues, requestPath, request, runDir: null, inputs: new Map() };
  }

  const requestStat = await lstat(requestPath);
  if (requestStat.isSymbolicLink() || !requestStat.isFile()) {
    addIssue(issues, 'invalid_provider_request_path', 'Request must be a real regular file, not a symbolic link.');
    return { issues, requestPath, request, runDir: null, inputs: new Map() };
  }

  try {
    request = await readJson(requestPath);
  } catch (error) {
    addIssue(issues, 'invalid_provider_request_json', error.message);
    return { issues, requestPath, request, runDir: null, inputs: new Map() };
  }

  if (request.schema_version !== 1 || request.contract !== CONTRACT) {
    addIssue(issues, 'invalid_provider_request', `Request must use ${CONTRACT} schema 1.`);
  }
  if (!request.task_id || request.capability !== CAPABILITY || request.provider_contract !== PROVIDER_CONTRACT) {
    addIssue(issues, 'provider_contract_mismatch', `Request must target ${CAPABILITY} with ${PROVIDER_CONTRACT}.`);
  }
  if (request.mode !== 'research') addIssue(issues, 'invalid_provider_mode', 'Source research request mode must be research.');
  if (!['autonomous', 'reviewed'].includes(request.run_mode)) {
    addIssue(issues, 'invalid_run_mode', 'run_mode must be autonomous or reviewed.');
  }
  if (request.interaction_policy !== 'return_to_orchestrator') {
    addIssue(issues, 'invalid_interaction_policy', 'interaction_policy must be return_to_orchestrator.');
  }
  if (!request.options || typeof request.options !== 'object' || Array.isArray(request.options)) {
    addIssue(issues, 'invalid_provider_options', 'options must be an object.');
  }

  const inputMode = request.options?.input_mode;
  if (!INPUT_MODES.has(inputMode)) {
    addIssue(issues, 'invalid_research_input_mode', 'options.input_mode must be brief, topic, or outline.');
  }

  const runDir = typeof request.run_dir === 'string' && isAbsolute(request.run_dir)
    ? resolve(request.run_dir)
    : null;
  let runRealDir = null;
  if (!runDir || !existsSync(runDir)) {
    addIssue(issues, 'invalid_run_dir', 'run_dir must be an existing absolute directory.');
  } else {
    const stat = await lstat(runDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      addIssue(issues, 'invalid_run_dir', 'run_dir must be a real directory, not a symbolic link.');
    } else {
      runRealDir = await realpath(runDir);
    }
  }

  const canonicalOutputDir = runDir ? join(runDir, OUTPUT_DIR) : null;
  let canonicalOutputSafe = false;
  let canonicalOutputRealDir = null;
  if (runRealDir && canonicalOutputDir && existsSync(canonicalOutputDir)) {
    const stat = await lstat(canonicalOutputDir);
    if (!stat.isSymbolicLink() && stat.isDirectory()) {
      canonicalOutputRealDir = await realpath(canonicalOutputDir);
      canonicalOutputSafe = inside(runRealDir, canonicalOutputRealDir);
    }
  }

  const outputDir = runDir && typeof request.output_dir === 'string'
    ? resolve(runDir, request.output_dir)
    : null;
  let outputRealDir = null;
  let outputSafe = false;
  if (!outputDir || !inside(runDir, outputDir)) {
    addIssue(issues, 'provider_output_escape', 'Authorized output_dir must stay inside run_dir.');
  } else if (request.output_dir !== OUTPUT_DIR || runRelative(runDir, outputDir) !== OUTPUT_DIR) {
    addIssue(issues, 'invalid_provider_output_dir', `output_dir must be ${OUTPUT_DIR}.`);
  } else if (!existsSync(outputDir)) {
    addIssue(issues, 'missing_provider_output_dir', `output_dir must already exist: ${OUTPUT_DIR}.`);
  } else {
    const stat = await lstat(outputDir);
    if (stat.isSymbolicLink()) {
      addIssue(issues, 'provider_output_symlink', 'output_dir must not be a symbolic link.');
    } else if (!stat.isDirectory()) {
      addIssue(issues, 'invalid_provider_output_dir', 'output_dir must be a directory.');
    } else {
      outputRealDir = await realpath(outputDir);
      if (!runRealDir || !inside(runRealDir, outputRealDir)) {
        addIssue(issues, 'provider_output_escape', 'Resolved output_dir escapes run_dir.');
      } else {
        outputSafe = true;
      }
    }
  }

  if (!sameItems(request.expected_artifacts, EXPECTED_ARTIFACTS)) {
    addIssue(issues, 'invalid_expected_artifacts', `expected_artifacts must be exactly: ${EXPECTED_ARTIFACTS.join(', ')}.`);
  }

  if (runDir && outputSafe) {
    const requestRealPath = await realpath(requestPath);
    if (!inside(outputRealDir, requestRealPath) || dirname(requestPath) !== outputDir) {
      addIssue(issues, 'provider_request_escape', 'Request must be a direct child file of output_dir.');
    }
  }

  const inputs = new Map();
  if (!Array.isArray(request.inputs)) {
    addIssue(issues, 'invalid_provider_inputs', 'inputs must be an array.');
  } else if (runDir) {
    for (const input of request.inputs) {
      if (!input?.role || typeof input.path !== 'string' || !input.path || !/^[a-f0-9]{64}$/.test(input?.sha256 || '')) {
        addIssue(issues, 'invalid_provider_input', 'Every input needs role, run-relative path, and SHA-256.');
        continue;
      }
      if (inputs.has(input.role)) {
        addIssue(issues, 'duplicate_provider_input', `Duplicate input role: ${input.role}.`, { role: input.role });
        continue;
      }
      if (isAbsolute(input.path)) {
        addIssue(issues, 'noncanonical_provider_input_path', `Input path must be run-relative: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      const path = resolve(runDir, input.path);
      if (!inside(runDir, path)) {
        addIssue(issues, 'provider_input_escape', `Input escapes run_dir: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      if (runRelative(runDir, path) !== input.path.split('\\').join('/')) {
        addIssue(issues, 'noncanonical_provider_input_path', `Input path is not canonical: ${input.path}.`, { role: input.role, path: input.path });
      }
      if (!existsSync(path)) {
        addIssue(issues, 'missing_provider_input', `Input does not exist: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        addIssue(issues, 'provider_input_symlink', `Input must be a real file: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      const real = await realpath(path);
      if (!runRealDir || !inside(runRealDir, real)) {
        addIssue(issues, 'provider_input_escape', `Resolved input escapes run_dir: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      if (await sha256(path) !== input.sha256) {
        addIssue(issues, 'provider_input_drift', `Input hash is stale: ${input.path}.`, { role: input.role, path: input.path });
      }
      inputs.set(input.role, { ...input, absolutePath: path });
    }
  }

  for (const [role, canonicalPath] of Object.entries(CANONICAL_INPUTS)) {
    const input = inputs.get(role);
    if (!input) {
      addIssue(issues, 'missing_required_input', `Missing required input role: ${role}.`, { role });
    } else if (runRelative(runDir, input.absolutePath) !== canonicalPath) {
      addIssue(issues, 'noncanonical_input_path', `${role} must use ${canonicalPath}.`, { role, path: input.path });
    }
  }

  for (const role of ['brief', 'core_audience', 'article_audience']) {
    const input = inputs.get(role);
    if (input && !(await readFile(input.absolutePath, 'utf8')).trim()) {
      addIssue(issues, `empty_${role}`, `${role} input must not be empty.`);
    }
  }

  let materialsManifest = null;
  if (inputs.has('materials')) {
    try {
      materialsManifest = await readJson(inputs.get('materials').absolutePath);
      if (!Array.isArray(materialsManifest.items)) {
        addIssue(issues, 'invalid_materials_manifest', 'materials input must contain an items array.');
      }
    } catch (error) {
      addIssue(issues, 'invalid_materials_manifest', error.message);
    }
  }

  const materialRoles = new Set();
  const materialPaths = new Set();
  if (Array.isArray(materialsManifest?.items)) {
    const manifestDir = dirname(inputs.get('materials').absolutePath);
    const rawDir = join(manifestDir, 'raw');
    const ids = new Set();
    for (const item of materialsManifest.items) {
      if (!item?.id || ids.has(item.id) || !item?.snapshot_path || !/^[a-f0-9]{64}$/.test(item?.sha256 || '')) {
        addIssue(issues, 'invalid_material_manifest_item', 'Each material item needs a unique id, snapshot_path, and SHA-256.');
        continue;
      }
      ids.add(item.id);
      const role = `material:${item.id}`;
      materialRoles.add(role);
      const input = inputs.get(role);
      if (!input) {
        addIssue(issues, 'missing_material_snapshot_input', `Material ${item.id} must be authorized as input role ${role}.`, { role });
        continue;
      }
      const expectedPath = resolve(manifestDir, item.snapshot_path);
      if (!inside(rawDir, expectedPath) || input.absolutePath !== expectedPath) {
        addIssue(issues, 'material_snapshot_path_mismatch', `Input ${role} must match an authorized 00-intake/raw snapshot.`, { role, path: input.path });
      }
      if (input.sha256 !== item.sha256) {
        addIssue(issues, 'material_snapshot_hash_mismatch', `Input ${role} must match the material manifest SHA-256.`, { role, path: input.path });
      }
      materialPaths.add(await realpath(input.absolutePath));
    }
  }

  const optionalRolePaths = {
    discovery_skip: /^01-discovery\/skip\.json$/,
    topic_discovery: /^01-discovery\/discovery(?:\.v\d{3})?\.md$/,
    topic_decision: /^01-discovery\/topic-decision(?:\.v\d{3})?\.json$/,
    topic_candidates: /^01-discovery\/topic-candidates(?:\.v\d{3})?\.json$/,
    provided_outline: /^03-outline\/provided-outline\.md$/
  };
  for (const [role, pattern] of Object.entries(optionalRolePaths)) {
    const input = inputs.get(role);
    if (input && !pattern.test(runRelative(runDir, input.absolutePath))) {
      addIssue(issues, 'noncanonical_input_path', `Input ${role} uses an invalid canonical path.`, { role, path: input.path });
    }
  }

  const modeRoles = {
    brief: ['topic_discovery', 'topic_decision', 'topic_candidates'],
    topic: ['discovery_skip'],
    outline: ['discovery_skip', 'provided_outline']
  }[inputMode] || [];
  if (inputMode === 'brief') {
    for (const role of modeRoles) {
      if (!inputs.has(role)) addIssue(issues, 'missing_research_authority_input', `Brief research requires ${role}.`, { role });
    }
  } else if (inputMode === 'topic') {
    if (!inputs.has('discovery_skip')) addIssue(issues, 'missing_research_authority_input', 'Topic research requires discovery_skip.', { role: 'discovery_skip' });
  } else if (inputMode === 'outline') {
    for (const role of ['discovery_skip', 'provided_outline']) {
      if (!inputs.has(role)) addIssue(issues, 'missing_research_authority_input', `Outline research requires ${role}.`, { role });
    }
  }

  const subjectInput = inputs.get('research_subject');
  if (subjectInput) {
    try {
      const subject = await readJson(subjectInput.absolutePath);
      const topicIsValid = inputMode === 'outline'
        ? subject.topic === null
        : typeof subject.topic === 'string' && subject.topic.trim();
      if (subject.schema_version !== 1 || subject.input_mode !== inputMode || !topicIsValid) {
        addIssue(issues, 'invalid_research_subject', 'research_subject must use schema 1, match input_mode, and contain a valid topic value.');
      }
      const authority = subject.authority;
      const authorityRole = { brief: 'topic_decision', topic: 'brief', outline: 'provided_outline' }[inputMode];
      const authorityKind = { brief: 'topic_decision', topic: 'user_topic', outline: 'user_outline' }[inputMode];
      const authorityInput = inputs.get(authorityRole);
      if (!authority || authority.kind !== authorityKind
        || authority.path !== authorityInput?.path
        || authority.sha256 !== authorityInput?.sha256) {
        addIssue(issues, 'invalid_research_subject_authority', `research_subject authority must bind ${authorityKind} to ${authorityRole}.`);
      }

      if (inputMode === 'brief' && inputs.has('topic_decision') && inputs.has('topic_candidates')) {
        const decision = await readJson(inputs.get('topic_decision').absolutePath);
        const candidates = await readJson(inputs.get('topic_candidates').absolutePath);
        const selected = candidates.candidates?.find((item) => item.id === decision.topic_id);
        if (!selected?.topic || subject.topic !== selected.topic) {
          addIssue(issues, 'research_subject_topic_mismatch', 'Brief research topic must match the approved topic decision and candidates.');
        }
      }
      if (inputMode === 'topic' && inputs.has('discovery_skip')) {
        const skip = await readJson(inputs.get('discovery_skip').absolutePath);
        if (skip.mode !== 'topic_provided' || skip.input_sha256 !== sha256Text(subject.topic)) {
          addIssue(issues, 'research_subject_topic_mismatch', 'Topic research subject must match the discovery skip authority.');
        }
      }
      if (inputMode === 'outline' && inputs.has('discovery_skip') && inputs.has('provided_outline')) {
        const skip = await readJson(inputs.get('discovery_skip').absolutePath);
        if (skip.mode !== 'outline_provided' || skip.input_sha256 !== inputs.get('provided_outline').sha256) {
          addIssue(issues, 'research_subject_topic_mismatch', 'Outline research subject must match the provided outline authority.');
        }
      }
    } catch (error) {
      addIssue(issues, 'invalid_research_subject', error.message);
    }
  }

  const allowedRoles = new Set([
    ...Object.keys(CANONICAL_INPUTS),
    ...modeRoles,
    ...materialRoles
  ]);
  for (const role of inputs.keys()) {
    if (!allowedRoles.has(role)) {
      addIssue(issues, 'unauthorized_provider_input_role', `Unsupported input role: ${role}.`, { role });
    }
  }

  return {
    issues,
    requestPath,
    request,
    runDir,
    runRealDir,
    outputDir,
    outputRealDir,
    outputSafe,
    canonicalOutputDir,
    canonicalOutputRealDir,
    canonicalOutputSafe,
    inputs,
    materialPaths
  };
}

function frontmatterValue(content, key) {
  return content.match(new RegExp(`^${key}:\\s*([^\\n]+?)\\s*$`, 'm'))?.[1] || null;
}

function validateMarkdown(content, artifact, headings, issues, path) {
  if (frontmatterValue(content, 'artifact') !== artifact) {
    addIssue(issues, 'invalid_markdown_artifact', `${path} must declare artifact: ${artifact}.`, { path });
  }
  for (const heading of headings) {
    if (!content.includes(heading)) {
      addIssue(issues, 'missing_markdown_section', `${path} is missing ${heading}.`, { path });
    }
  }
  if (/(?:^|\n)\s*(?:TODO|TBD|FIXME)\b|\[(?:待填写|占位|列出|填写|补充|替换|TODO|TBD)[^\]]*\]/i.test(content)) {
    addIssue(issues, 'placeholder_in_provider_artifact', `${path} contains unresolved placeholders.`, { path });
  }
}

async function collectArtifact(context, relativePath, artifacts, issues, required = true) {
  const path = join(context.runDir, relativePath);
  if (!existsSync(path)) {
    if (required) addIssue(issues, 'missing_provider_artifact', `Missing ${relativePath}.`, { path: relativePath });
    return false;
  }
  if (!inside(context.outputDir, path)) {
    addIssue(issues, 'provider_artifact_escape', `Artifact escapes output_dir: ${relativePath}.`, { path: relativePath });
    return false;
  }
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    addIssue(issues, 'provider_artifact_symlink', `Artifact must be a real file: ${relativePath}.`, { path: relativePath });
    return false;
  }
  const real = await realpath(path);
  if (!context.outputRealDir || !inside(context.outputRealDir, real)) {
    addIssue(issues, 'provider_artifact_escape', `Resolved artifact escapes output_dir: ${relativePath}.`, { path: relativePath });
    return false;
  }
  artifacts.push({ role: ARTIFACT_ROLES[relativePath], path: relativePath, sha256: await sha256(path) });
  return true;
}

function sectionsById(markdown, prefix) {
  const pattern = new RegExp(`^##\\s+(${prefix}-[a-z0-9][a-z0-9-]*)\\s*$`, 'gmi');
  const matches = [...markdown.matchAll(pattern)];
  const sections = new Map();
  const duplicates = new Set();
  for (let index = 0; index < matches.length; index += 1) {
    const id = matches[index][1];
    const start = matches[index].index;
    const end = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
    if (sections.has(id)) duplicates.add(id);
    else sections.set(id, markdown.slice(start, end));
  }
  return { sections, duplicates };
}

async function validateLocalOrWebLocator(locator, context, issues, sourceId) {
  if (/^https?:\/\//i.test(locator)) {
    try {
      const url = new URL(locator);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('unsupported URL');
    } catch {
      addIssue(issues, 'invalid_source_locator', `Source ${sourceId} has an invalid public URL.`, { source_id: sourceId });
    }
    return;
  }

  const path = isAbsolute(locator) ? resolve(locator) : resolve(context.runDir, locator);
  const real = existsSync(path) ? await realpath(path) : null;
  if (!real || !context.materialPaths.has(real)) {
    addIssue(issues, 'unauthorized_local_source', `Source ${sourceId} must point to an authorized material snapshot.`, { source_id: sourceId, locator });
  }
}

async function validateArtifacts(context) {
  const issues = [];
  const businessIssues = [];
  const warnings = [];
  const artifacts = [];
  const checks = {
    request_valid: true,
    research_completeness: null,
    claim_count: 0,
    critical_claim_count: 0,
    critical_verified_count: 0,
    source_count: 0
  };

  const briefRelative = EXPECTED_ARTIFACTS[0];
  const briefPath = join(context.runDir, briefRelative);
  if (!await collectArtifact(context, briefRelative, artifacts, issues)) {
    return { issues, businessIssues, warnings, artifacts, checks, failureStatus: 'FAILED' };
  }

  const brief = await readFile(briefPath, 'utf8');
  validateMarkdown(brief, 'ResearchBrief', ['# 研究简报'], issues, briefRelative);
  const briefStatus = frontmatterValue(brief, 'status');
  const researchStatus = frontmatterValue(brief, 'research_status')?.toLowerCase() || null;
  checks.research_completeness = researchStatus;

  if (briefStatus === 'BLOCKED' || researchStatus === 'blocked') {
    if (briefStatus !== 'BLOCKED' || researchStatus !== 'blocked') {
      addIssue(issues, 'inconsistent_research_status', 'A blocked research brief must declare status BLOCKED and research_status blocked.');
    }
    if (!brief.includes('恢复条件')) {
      addIssue(issues, 'missing_recovery_condition', 'Blocked research must state 恢复条件.');
    }
    for (const relativePath of EXPECTED_ARTIFACTS.slice(1)) {
      await collectArtifact(context, relativePath, artifacts, issues, false);
    }
    addIssue(businessIssues, 'source_research_blocked', 'Research could not produce downstream-safe evidence from the authorized inputs.');
    return { issues, businessIssues, warnings, artifacts, checks, failureStatus: issues.length ? 'FAILED' : 'BLOCKED' };
  }

  if (briefStatus !== 'PASS' || !['complete', 'partial'].includes(researchStatus)) {
    addIssue(issues, 'invalid_research_status', 'Research brief must declare PASS with research_status complete or partial, or a valid blocked diagnostic.');
  }
  validateMarkdown(
    brief,
    'ResearchBrief',
    ['## 研究对象与边界', '## 核心结论', '## 关键事实', '## 限制与未知', '## 下游写作约束'],
    issues,
    briefRelative
  );

  for (const relativePath of EXPECTED_ARTIFACTS.slice(1)) {
    await collectArtifact(context, relativePath, artifacts, issues);
  }
  if (artifacts.length !== EXPECTED_ARTIFACTS.length) {
    return { issues, businessIssues, warnings, artifacts, checks, failureStatus: 'FAILED' };
  }

  const sourceRelative = EXPECTED_ARTIFACTS[1];
  const claimsRelative = EXPECTED_ARTIFACTS[2];
  const evidenceRelative = EXPECTED_ARTIFACTS[3];
  const sourceLog = await readFile(join(context.runDir, sourceRelative), 'utf8');
  const evidenceMap = await readFile(join(context.runDir, evidenceRelative), 'utf8');
  validateMarkdown(sourceLog, 'SourceLog', ['# 来源日志'], issues, sourceRelative);
  validateMarkdown(evidenceMap, 'EvidenceMap', ['# 证据映射'], issues, evidenceRelative);

  for (const [content, path] of [[sourceLog, sourceRelative], [evidenceMap, evidenceRelative]]) {
    if (frontmatterValue(content, 'status') !== 'PASS') {
      addIssue(issues, 'invalid_research_artifact_status', `${path} must declare status PASS.`, { path });
    }
    if (frontmatterValue(content, 'research_status')?.toLowerCase() !== researchStatus) {
      addIssue(issues, 'inconsistent_research_status', `${path} research_status must match brief.md.`, { path });
    }
  }

  const sourceIndex = sectionsById(sourceLog, 's');
  for (const id of sourceIndex.duplicates) {
    addIssue(issues, 'duplicate_source_id', `Duplicate source id: ${id}.`, { source_id: id });
  }
  checks.source_count = sourceIndex.sections.size;
  if (!sourceIndex.sections.size) addIssue(issues, 'missing_source_records', 'source-log.md must define at least one source record.');
  for (const [sourceId, section] of sourceIndex.sections) {
    const locator = section.match(/^- 来源定位：\s*(.+?)\s*$/m)?.[1];
    if (!locator) {
      addIssue(issues, 'invalid_source_record', `Source ${sourceId} is missing 来源定位.`, { source_id: sourceId });
    } else {
      await validateLocalOrWebLocator(locator, context, issues, sourceId);
    }
    for (const label of [
      '来源类型', '标题', '发布者/作者', '发布/更新日期', '访问日期', '来源定位',
      '语言', '独立来源组', '抓取状态', '支持主张', '证据摘录', '中文释义', '核实限制'
    ]) {
      if (!section.includes(`- ${label}：`)) {
        addIssue(issues, 'invalid_source_record', `Source ${sourceId} is missing ${label}.`, { source_id: sourceId });
      }
    }
  }

  let claimsData = null;
  try {
    claimsData = await readJson(join(context.runDir, claimsRelative));
  } catch (error) {
    addIssue(issues, 'invalid_claims_json', error.message, { path: claimsRelative });
    return { issues, businessIssues, warnings, artifacts, checks, failureStatus: 'FAILED' };
  }
  if (claimsData.schema_version !== 1 || claimsData.research_status !== researchStatus || !Array.isArray(claimsData.claims)) {
    addIssue(issues, 'invalid_claims_root', 'claims.json must use schema_version 1, match research_status, and contain a claims array.');
    return { issues, businessIssues, warnings, artifacts, checks, failureStatus: 'FAILED' };
  }

  const claims = claimsData.claims;
  checks.claim_count = claims.length;
  if (!claims.length) addIssue(issues, 'invalid_claim_schema', 'claims.json must contain at least one claim.');
  const claimIds = new Set();
  const claimById = new Map();
  const evidenceIndex = sectionsById(evidenceMap, 'c');
  for (const id of evidenceIndex.duplicates) {
    addIssue(issues, 'duplicate_evidence_claim_id', `Duplicate evidence-map claim id: ${id}.`, { claim_id: id });
  }

  for (const claim of claims) {
    const requiredStrings = ['id', 'text', 'status', 'scope', 'risk', 'evidence_level', 'use_gate', 'as_of'];
    const missing = requiredStrings.filter((field) => typeof claim?.[field] !== 'string' || !claim[field].trim());
    const arraysValid = Array.isArray(claim?.source_ids)
      && claim.source_ids.every((id) => typeof id === 'string' && id)
      && Array.isArray(claim?.limitations)
      && claim.limitations.every((item) => typeof item === 'string' && item.trim());
    if (missing.length || typeof claim?.critical !== 'boolean' || !arraysValid) {
      addIssue(issues, 'invalid_claim_schema', `Claim ${claim?.id || '(missing id)'} is incomplete.`, { claim_id: claim?.id || null, missing });
      continue;
    }
    if (!/^c-[a-z0-9][a-z0-9-]*$/i.test(claim.id)) {
      addIssue(issues, 'invalid_claim_schema', `Claim id is invalid: ${claim.id}.`, { claim_id: claim.id });
    }
    if (claimIds.has(claim.id)) addIssue(issues, 'duplicate_claim_id', `Duplicate claim id: ${claim.id}.`, { claim_id: claim.id });
    claimIds.add(claim.id);
    claimById.set(claim.id, claim);
    if (new Set(claim.source_ids).size !== claim.source_ids.length) {
      addIssue(issues, 'duplicate_claim_source_id', `Claim ${claim.id} repeats a source id.`, { claim_id: claim.id });
    }
    if (!CLAIM_STATUSES.has(claim.status) || !RISKS.has(claim.risk)
      || !EVIDENCE_LEVELS.has(claim.evidence_level) || !USE_GATES.has(claim.use_gate)) {
      addIssue(issues, 'invalid_claim_schema', `Claim ${claim.id} contains an invalid enum.`, { claim_id: claim.id });
    }
    if (claim.status === 'verified' && (claim.evidence_level !== 'L3' || claim.use_gate !== 'ready' || !claim.source_ids.length)) {
      addIssue(issues, 'invalid_verified_claim', `Verified claim ${claim.id} must be L3/ready with at least one source.`, { claim_id: claim.id });
    }
    if (claim.status !== 'verified' && claim.use_gate === 'ready') {
      addIssue(issues, 'invalid_claim_gate', `Non-verified claim ${claim.id} cannot use the ready gate.`, { claim_id: claim.id });
    }
    if (claim.status === 'rejected' && claim.use_gate !== 'do_not_use') {
      addIssue(issues, 'invalid_claim_gate', `Rejected claim ${claim.id} must use do_not_use.`, { claim_id: claim.id });
    }
    for (const sourceId of claim.source_ids) {
      if (!sourceIndex.sections.has(sourceId)) {
        addIssue(issues, 'dangling_claim_source', `Claim ${claim.id} references undefined source ${sourceId}.`, { claim_id: claim.id, source_id: sourceId });
      }
    }
    const evidenceSection = evidenceIndex.sections.get(claim.id);
    if (!evidenceSection) {
      addIssue(issues, 'claim_missing_from_evidence_map', `Claim ${claim.id} is absent from evidence-map.md.`, { claim_id: claim.id });
    } else {
      const evidenceSources = evidenceSection.match(/^- 来源：\s*(.+?)\s*$/m)?.[1]
        ?.match(/s-[a-z0-9][a-z0-9-]*/gi) || [];
      if (evidenceSources.length !== claim.source_ids.length
        || new Set(evidenceSources).size !== evidenceSources.length
        || claim.source_ids.some((sourceId) => !evidenceSources.includes(sourceId))) {
        addIssue(issues, 'evidence_source_set_mismatch', `Evidence map sources do not exactly match claim ${claim.id}.`, {
          claim_id: claim.id,
          expected_source_ids: claim.source_ids,
          actual_source_ids: evidenceSources
        });
      }
      const expectedDownstream = claim.status === 'verified' && claim.use_gate === 'ready' ? 'yes' : 'no';
      if (!evidenceSection.includes(`- 状态：${claim.status}`)
        || !evidenceSection.includes(`- 范围：${claim.scope}`)
        || !evidenceSection.includes('- 限制：')
        || !evidenceSection.includes(`- 可进入下游：${expectedDownstream}`)) {
        addIssue(issues, 'evidence_claim_mismatch', `Evidence map fields do not match claim ${claim.id}.`, { claim_id: claim.id });
      }
    }
    for (const sourceId of claim.source_ids) {
      const sourceSection = sourceIndex.sections.get(sourceId);
      const supported = sourceSection?.match(/^- 支持主张：\s*(.+?)\s*$/m)?.[1] || '';
      if (sourceSection && !(supported.match(/c-[a-z0-9][a-z0-9-]*/gi) || []).includes(claim.id)) {
        addIssue(issues, 'claim_missing_from_source_log', `Source ${sourceId} does not declare support for ${claim.id}.`, { claim_id: claim.id, source_id: sourceId });
      }
    }
    if (claim.critical) {
      checks.critical_claim_count += 1;
      if (claim.status === 'verified') checks.critical_verified_count += 1;
      else addIssue(businessIssues, 'critical_claim_unverified', `Critical claim ${claim.id} is ${claim.status}.`, { claim_id: claim.id });
      if (!brief.includes(claim.id)) {
        addIssue(issues, 'critical_claim_missing_from_brief', `Critical claim ${claim.id} is absent from brief.md.`, { claim_id: claim.id });
      }
    }
  }

  for (const [sourceId, section] of sourceIndex.sections) {
    const supported = section.match(/^- 支持主张：\s*(.+?)\s*$/m)?.[1] || '';
    for (const claimId of supported.match(/c-[a-z0-9][a-z0-9-]*/gi) || []) {
      if (!claimIds.has(claimId)) {
        addIssue(issues, 'dangling_source_claim', `Source ${sourceId} references undefined claim ${claimId}.`, { source_id: sourceId, claim_id: claimId });
      } else if (!claimById.get(claimId)?.source_ids.includes(sourceId)) {
        addIssue(issues, 'source_claim_mismatch', `Source ${sourceId} declares ${claimId}, but the claim does not list that source.`, { source_id: sourceId, claim_id: claimId });
      }
    }
  }

  if (!checks.critical_claim_count) {
    addIssue(businessIssues, 'missing_critical_claim', 'Research must identify at least one critical claim before drafting.');
  }
  if (researchStatus === 'partial' && !businessIssues.length) {
    addWarning(warnings, 'partial_research_noncritical_gaps', 'Research is partial, but every critical claim is verified; downstream writing must preserve the recorded gaps.');
  }

  return {
    issues,
    businessIssues,
    warnings,
    artifacts,
    checks,
    failureStatus: issues.length ? 'FAILED' : businessIssues.length ? 'BLOCKED' : 'PASS'
  };
}

function makeResult(context, status, artifacts, checks, issues, warnings = []) {
  return {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER_CONTRACT,
    task_id: context.request?.task_id || 'unknown',
    status,
    artifacts,
    checks,
    issues,
    warnings
  };
}

function canonicalResultPath(context) {
  return context.runDir && context.canonicalOutputSafe
    ? join(context.canonicalOutputDir, RESULT_FILE)
    : null;
}

async function resultTargetIsSafe(context, path) {
  if (!path || !context.canonicalOutputSafe || dirname(path) !== context.canonicalOutputDir) return false;
  if (!existsSync(path)) return true;
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile()) return false;
  const real = await realpath(path);
  return inside(context.canonicalOutputRealDir, real);
}

async function writeResult(path, context, status, artifacts, checks, issues, warnings = []) {
  if (!await resultTargetIsSafe(context, path)) throw new Error('Unsafe provider result target.');
  const result = makeResult(context, status, artifacts, checks, issues, warnings);
  await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

function emptyChecks(requestValid) {
  return {
    request_valid: requestValid,
    research_completeness: null,
    claim_count: 0,
    critical_claim_count: 0,
    critical_verified_count: 0,
    source_count: 0
  };
}

async function emitRequestFailure(context) {
  const checks = emptyChecks(false);
  const path = canonicalResultPath(context);
  if (path && context.request && await resultTargetIsSafe(context, path)) {
    const result = await writeResult(path, context, 'BLOCKED', [], checks, context.issues);
    emit({ ...result, result_path: runRelative(context.runDir, path) }, 2);
    return;
  }
  emit(makeResult(context, 'BLOCKED', [], checks, context.issues), 2);
}

async function emitFinalizeFailure(context, code, message, requestedPath = null) {
  const issues = [];
  addIssue(issues, code, message);
  const checks = emptyChecks(true);
  const canonicalPath = canonicalResultPath(context);
  if (canonicalPath && canonicalPath !== requestedPath && await resultTargetIsSafe(context, canonicalPath)) {
    const result = await writeResult(canonicalPath, context, 'FAILED', [], checks, issues);
    emit({ ...result, result_path: runRelative(context.runDir, canonicalPath) }, 2);
    return;
  }
  emit(makeResult(context, 'FAILED', [], checks, issues), 2);
}

async function finalize(context, resultInput) {
  const canonicalPath = canonicalResultPath(context);
  const requestedPath = resultInput
    ? (isAbsolute(resultInput) ? resolve(resultInput) : resolve(context.runDir, resultInput))
    : canonicalPath;
  const requestedIsSymlink = requestedPath && existsSync(requestedPath) && (await lstat(requestedPath)).isSymbolicLink();
  if (!canonicalPath || requestedPath !== canonicalPath || !await resultTargetIsSafe(context, requestedPath)) {
    await emitFinalizeFailure(
      context,
      requestedIsSymlink ? 'provider_result_symlink' : 'provider_result_escape',
      'result.json must be the real canonical 02-research/provider-result.json file.',
      requestedPath
    );
    return;
  }

  try {
    const validation = await validateArtifacts(context);
    const status = validation.failureStatus;
    const resultIssues = status === 'BLOCKED' ? validation.businessIssues : validation.issues;
    const result = await writeResult(
      requestedPath,
      context,
      status,
      validation.artifacts,
      validation.checks,
      resultIssues,
      validation.warnings
    );
    emit(
      {
        status,
        task_id: context.request.task_id,
        result_path: runRelative(context.runDir, requestedPath),
        issues: result.issues,
        warnings: result.warnings
      },
      status === 'PASS' ? 0 : 2
    );
  } catch (error) {
    await emitFinalizeFailure(context, 'source_research_provider_failed', error.message, null);
  }
}

async function main() {
  const [command, requestInput, resultInput] = process.argv.slice(2);
  if (!['validate-request', 'finalize'].includes(command) || !requestInput) {
    emit({
      status: 'BLOCKED',
      issues: [{
        code: 'invalid_provider_command',
        message: 'Usage: provider-contract.mjs validate-request <request.json> | finalize <request.json> [result.json]',
        resume_from: 'research'
      }]
    }, 2);
    return;
  }

  const context = await validateRequest(requestInput);
  if (context.issues.length) {
    await emitRequestFailure(context);
    return;
  }
  if (command === 'validate-request') {
    emit({
      status: 'PASS',
      task_id: context.request.task_id,
      run_dir: context.runDir,
      output_dir: OUTPUT_DIR,
      inputs: Object.fromEntries([...context.inputs].map(([role, input]) => [role, runRelative(context.runDir, input.absolutePath)])),
      issues: []
    });
    return;
  }
  await finalize(context, resultInput);
}

main().catch((error) => {
  emit({
    status: 'FAILED',
    issues: [{ code: 'source_research_provider_failed', message: error.message, resume_from: 'research' }]
  }, 2);
});

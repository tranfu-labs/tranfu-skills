#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const CONTRACT = 'content-production-provider/v1';
const PROVIDER_CONTRACT = 'drafting-v1';
const CAPABILITY = 'drafting';
const PLATFORMS = new Set(['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao']);
const VARIANTS = new Set(['A', 'B']);
const INPUT_MODES = new Set(['brief', 'topic', 'outline']);
const EXECUTION_STRATEGIES = new Set(['parallel_subagents', 'sequential_fallback']);

function definitionFor(mode, options = {}) {
  const { platform, variant, revision } = options;
  if (mode === 'outline') {
    const suffix = revision === 1 ? '' : `.v${String(revision).padStart(3, '0')}`;
    return {
      stage: 'outline',
      outputDir: '03-outline',
      requestFile: `drafting-outline${suffix}.request.json`,
      resultFile: `drafting-outline${suffix}.result.json`,
      expected: [
        `03-outline/control-outline${suffix}.md`,
        `03-outline/A-structure${suffix}.md`,
        `03-outline/B-structure${suffix}.md`
      ],
      artifactRoles: ['control_outline', 'structure_a', 'structure_b']
    };
  }
  if (mode === 'master' && VARIANTS.has(variant)) {
    const base = `04-masters/${variant}`;
    return {
      stage: 'masters',
      outputDir: base,
      requestFile: 'drafting-master.request.json',
      resultFile: 'drafting-master.result.json',
      expected: [`${base}/final.md`, `${base}/review.md`, `${base}/provenance.json`],
      artifactRoles: ['final', 'review', 'provenance']
    };
  }
  if (mode === 'adapt' && PLATFORMS.has(platform) && VARIANTS.has(variant)) {
    const base = `05-platforms/${platform}/${variant}`;
    return {
      stage: 'platforms',
      outputDir: base,
      requestFile: 'drafting-adapt.request.json',
      resultFile: 'drafting-adapt.result.json',
      expected: [
        `${base}/draft.md`,
        `${base}/audience-snapshot.md`,
        `${base}/audience-snapshot.json`,
        `${base}/provenance.json`
      ],
      artifactRoles: ['draft', 'audience_snapshot', 'audience_snapshot_json', 'provenance']
    };
  }
  return null;
}

function addIssue(issues, code, message, extra = {}) {
  issues.push({ code, message, resume_from: 'drafting', ...extra });
}

function emit(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = exitCode;
}

function inside(root, target) {
  if (!root || !target) return false;
  const rel = relative(root, target);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function runRelative(runDir, target) {
  return relative(runDir, target).split('\\').join('/');
}

function sameItems(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && new Set(actual).size === expected.length
    && expected.every((item) => actual.includes(item));
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function hasSymlinkComponent(root, target, includeTarget = true) {
  const rel = relative(root, target);
  if (!inside(root, target)) return true;
  const parts = rel.split(/[\\/]/).filter(Boolean);
  const limit = includeTarget ? parts.length : Math.max(0, parts.length - 1);
  let cursor = root;
  for (let index = 0; index < limit; index += 1) {
    cursor = join(cursor, parts[index]);
    if (!existsSync(cursor) || (await lstat(cursor)).isSymbolicLink()) return true;
  }
  return false;
}

function canonicalRolePatterns(mode, options, inputMode) {
  if (mode === 'outline') {
    const roles = {
      research_subject: /^01-discovery\/research-subject\.json$/,
      research_brief: /^02-research\/brief\.md$/,
      source_log: /^02-research\/source-log\.md$/,
      claims: /^02-research\/claims\.json$/,
      evidence_map: /^02-research\/evidence-map\.md$/,
      brief: /^00-intake\/brief\.md$/,
      core_audience: /^00-intake\/core-audience\.md$/,
      platform_profiles: /^00-intake\/platform-profiles\.json$/,
      article_audience: /^00-intake\/article-audience\.md$/
    };
    if (inputMode === 'brief') {
      roles.topic_candidates = /^01-discovery\/topic-candidates(?:\.v\d{3})?\.json$/;
      roles.topic_decision = /^01-discovery\/topic-decision(?:\.v\d{3})?\.json$/;
    } else {
      roles.discovery_skip = /^01-discovery\/skip\.json$/;
      if (inputMode === 'outline') roles.provided_outline = /^03-outline\/provided-outline\.md$/;
    }
    return roles;
  }

  if (mode === 'master') {
    const roles = {
      research_brief: /^02-research\/brief\.md$/,
      claims: /^02-research\/claims\.json$/,
      evidence_map: /^02-research\/evidence-map\.md$/,
      control_outline: /^03-outline\/control-outline(?:\.v\d{3})?\.md$/,
      structure: new RegExp(`^03-outline/${options.variant}-structure(?:\\.v\\d{3})?\\.md$`),
      core_audience: /^00-intake\/core-audience\.md$/,
      article_audience: /^00-intake\/article-audience\.md$/
    };
    if (options.variant === 'B') roles.style_b = /^00-intake\/style-b\.md$/;
    return roles;
  }

  const roles = {
    source_master: new RegExp(`^04-masters/${options.variant}/final\\.md$`),
    master_provenance: new RegExp(`^04-masters/${options.variant}/provenance\\.json$`),
    core_audience: /^00-intake\/core-audience\.md$/,
    platform_profiles: /^00-intake\/platform-profiles\.json$/,
    article_audience: /^00-intake\/article-audience\.md$/,
    audience_snapshot: new RegExp(`^05-platforms/${options.platform}/${options.variant}/audience-snapshot\\.md$`),
    audience_manifest: new RegExp(`^05-platforms/${options.platform}/${options.variant}/audience-snapshot\\.json$`)
  };
  if (options.variant === 'B') roles.style_b = /^00-intake\/style-b\.md$/;
  return roles;
}

async function validateClaims(input, issues) {
  if (!input) return null;
  let data;
  try {
    data = await readJson(input.absolutePath);
  } catch (error) {
    addIssue(issues, 'invalid_claims_json', error.message, { path: input.path });
    return null;
  }
  if (data.schema_version !== 1 || !['complete', 'partial'].includes(data.research_status) || !Array.isArray(data.claims)) {
    addIssue(issues, 'invalid_claims_root', 'claims.json must use schema_version 1, have complete|partial research_status, and contain claims.');
    return null;
  }
  const ids = new Set();
  const critical = [];
  for (const claim of data.claims) {
    if (!claim?.id || ids.has(claim.id)) {
      addIssue(issues, 'invalid_claim_schema', `Claim id is missing or duplicated: ${claim?.id || '(missing)'}.`);
      continue;
    }
    ids.add(claim.id);
    if (claim.critical) {
      critical.push(claim);
      if (claim.status !== 'verified' || claim.evidence_level !== 'L3' || claim.use_gate !== 'ready'
        || !Array.isArray(claim.source_ids) || !claim.source_ids.length) {
        addIssue(issues, 'critical_claim_not_ready', `Critical claim ${claim.id} is not verified L3/ready with a source.`, { claim_id: claim.id });
      }
    }
  }
  if (!critical.length) addIssue(issues, 'missing_critical_claim', 'At least one critical claim is required before drafting.');
  return { data, ids, critical };
}

async function validateRequest(requestInput) {
  const issues = [];
  const requestPath = resolve(requestInput);
  let request = null;

  if (!existsSync(requestPath)) {
    addIssue(issues, 'missing_provider_request', `Request file does not exist: ${requestPath}`);
    return { issues, requestPath, request, runDir: null, inputs: new Map(), definition: null };
  }
  const requestStat = await lstat(requestPath);
  if (requestStat.isSymbolicLink() || !requestStat.isFile()) {
    addIssue(issues, 'invalid_provider_request_path', 'Request must be a real regular file, not a symbolic link.');
    return { issues, requestPath, request, runDir: null, inputs: new Map(), definition: null };
  }
  try {
    request = await readJson(requestPath);
  } catch (error) {
    addIssue(issues, 'invalid_provider_request_json', error.message);
    return { issues, requestPath, request, runDir: null, inputs: new Map(), definition: null };
  }

  if (request.schema_version !== 1 || request.contract !== CONTRACT) {
    addIssue(issues, 'invalid_provider_request', `Request must use ${CONTRACT} schema 1.`);
  }
  if (!request.task_id || request.capability !== CAPABILITY || request.provider_contract !== PROVIDER_CONTRACT) {
    addIssue(issues, 'provider_contract_mismatch', `Request must target ${CAPABILITY} with ${PROVIDER_CONTRACT}.`);
  }
  if (!['outline', 'master', 'adapt'].includes(request.mode)) {
    addIssue(issues, 'invalid_provider_mode', 'Drafting request mode must be outline, master, or adapt.');
  }
  if (!['autonomous', 'reviewed'].includes(request.run_mode)) {
    addIssue(issues, 'invalid_run_mode', 'run_mode must be autonomous or reviewed.');
  }
  if (request.interaction_policy !== 'return_to_orchestrator') {
    addIssue(issues, 'invalid_interaction_policy', 'interaction_policy must be return_to_orchestrator.');
  }
  if (!plainObject(request.options)) addIssue(issues, 'invalid_provider_options', 'options must be an object.');

  const options = plainObject(request.options) ? request.options : {};
  if (!INPUT_MODES.has(options.input_mode)) {
    addIssue(issues, 'invalid_drafting_input_mode', 'options.input_mode must be brief, topic, or outline.');
  }
  if (!EXECUTION_STRATEGIES.has(options.execution_strategy)) {
    addIssue(issues, 'invalid_execution_strategy', 'options.execution_strategy must be parallel_subagents or sequential_fallback.');
  }
  if (typeof options.model !== 'string' || !options.model.trim()) {
    addIssue(issues, 'invalid_model_binding', 'options.model must be a non-empty string.');
  }
  if (!plainObject(options.parameters)) {
    addIssue(issues, 'invalid_parameter_binding', 'options.parameters must be an object.');
  }
  const allowedOptionKeys = new Set([
    'input_mode', 'execution_strategy', 'model', 'parameters',
    ...(request.mode === 'outline' ? ['revision'] : []),
    ...(request.mode === 'master' || request.mode === 'adapt' ? ['variant'] : []),
    ...(request.mode === 'adapt' ? ['platform'] : [])
  ]);
  for (const key of Object.keys(options)) {
    if (!allowedOptionKeys.has(key)) addIssue(issues, 'unauthorized_provider_option', `Unsupported drafting option: ${key}.`, { option: key });
  }
  if (request.mode === 'outline') {
    if (!Number.isInteger(options.revision) || options.revision < 1 || options.revision > 999) {
      addIssue(issues, 'invalid_outline_revision', 'options.revision must be an integer from 1 through 999.');
    }
    if (options.variant != null || options.platform != null) addIssue(issues, 'invalid_outline_scope', 'Outline mode must not select a variant or platform.');
  } else {
    if (!VARIANTS.has(options.variant)) addIssue(issues, 'invalid_variant', 'options.variant must be A or B.');
    if (request.variant != null && request.variant !== options.variant) addIssue(issues, 'variant_binding_mismatch', 'Top-level variant must match options.variant.');
  }
  if (request.mode === 'adapt') {
    if (!PLATFORMS.has(options.platform)) addIssue(issues, 'invalid_platform', 'options.platform must be a supported platform id.');
    if (request.platform != null && request.platform !== options.platform) addIssue(issues, 'platform_binding_mismatch', 'Top-level platform must match options.platform.');
  } else if (options.platform != null) {
    addIssue(issues, 'invalid_platform_scope', 'Only adapt mode may select a platform.');
  }

  const definition = definitionFor(request.mode, options);
  const runDir = typeof request.run_dir === 'string' && isAbsolute(request.run_dir) ? resolve(request.run_dir) : null;
  let runRealDir = null;
  if (!runDir || !existsSync(runDir)) {
    addIssue(issues, 'invalid_run_dir', 'run_dir must be an existing absolute directory.');
  } else {
    const stat = await lstat(runDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) addIssue(issues, 'invalid_run_dir', 'run_dir must be a real directory, not a symlink.');
    else runRealDir = await realpath(runDir);
  }

  const canonicalOutputDir = runDir && definition ? join(runDir, definition.outputDir) : null;
  const outputDir = runDir && typeof request.output_dir === 'string' ? resolve(runDir, request.output_dir) : null;
  let outputRealDir = null;
  let outputSafe = false;
  if (!definition) {
    addIssue(issues, 'invalid_provider_scope', 'Mode, variant, and platform do not identify one drafting task.');
  } else if (!outputDir || !inside(runDir, outputDir)) {
    addIssue(issues, 'provider_output_escape', 'Authorized output_dir must stay inside run_dir.');
  } else if (request.output_dir !== definition.outputDir || runRelative(runDir, outputDir) !== definition.outputDir) {
    addIssue(issues, 'invalid_provider_output_dir', `output_dir must be ${definition.outputDir}.`);
  } else if (!existsSync(outputDir)) {
    addIssue(issues, 'missing_provider_output_dir', `output_dir must already exist: ${definition.outputDir}.`);
  } else {
    const stat = await lstat(outputDir);
    if (stat.isSymbolicLink() || await hasSymlinkComponent(runDir, outputDir)) {
      addIssue(issues, 'provider_output_symlink', 'output_dir and its run-relative ancestors must not be symbolic links.');
    } else if (!stat.isDirectory()) {
      addIssue(issues, 'invalid_provider_output_dir', 'output_dir must be a directory.');
    } else {
      outputRealDir = await realpath(outputDir);
      if (!runRealDir || !inside(runRealDir, outputRealDir)) addIssue(issues, 'provider_output_escape', 'Resolved output_dir escapes run_dir.');
      else outputSafe = true;
    }
  }

  if (definition && !sameItems(request.expected_artifacts, definition.expected)) {
    addIssue(issues, 'invalid_expected_artifacts', `expected_artifacts must be exactly: ${definition.expected.join(', ')}.`);
  }
  if (definition && outputSafe) {
    const requestRealPath = await realpath(requestPath);
    if (dirname(requestPath) !== outputDir || !inside(outputRealDir, requestRealPath)
      || await hasSymlinkComponent(runDir, requestPath)) {
      addIssue(issues, 'provider_request_escape', 'Request must be a real direct child of output_dir.');
    }
    if (requestPath !== join(outputDir, definition.requestFile)) {
      addIssue(issues, 'invalid_provider_request_name', `Request filename must be ${definition.requestFile}.`);
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
      const absolutePath = resolve(runDir, input.path);
      if (!inside(runDir, absolutePath)) {
        addIssue(issues, 'provider_input_escape', `Input escapes run_dir: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      if (runRelative(runDir, absolutePath) !== input.path.split('\\').join('/')) {
        addIssue(issues, 'noncanonical_provider_input_path', `Input path is not canonical: ${input.path}.`, { role: input.role, path: input.path });
      }
      if (!existsSync(absolutePath)) {
        addIssue(issues, 'missing_provider_input', `Input does not exist: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      const stat = await lstat(absolutePath);
      if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(runDir, absolutePath)) {
        addIssue(issues, 'provider_input_symlink', `Input must be a real file with no symlink ancestor: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      const real = await realpath(absolutePath);
      if (!runRealDir || !inside(runRealDir, real)) {
        addIssue(issues, 'provider_input_escape', `Resolved input escapes run_dir: ${input.path}.`, { role: input.role, path: input.path });
        continue;
      }
      if (await sha256(absolutePath) !== input.sha256) {
        addIssue(issues, 'provider_input_drift', `Input hash is stale: ${input.path}.`, { role: input.role, path: input.path });
      }
      inputs.set(input.role, { ...input, absolutePath });
    }
  }

  if (definition && INPUT_MODES.has(options.input_mode)) {
    const patterns = canonicalRolePatterns(request.mode, options, options.input_mode);
    for (const [role, pattern] of Object.entries(patterns)) {
      const input = inputs.get(role);
      if (!input) addIssue(issues, 'missing_required_input', `Missing required input role: ${role}.`, { role });
      else if (!pattern.test(input.path)) addIssue(issues, 'noncanonical_input_path', `Input ${role} has a noncanonical path: ${input.path}.`, { role, path: input.path });
    }
    for (const role of inputs.keys()) {
      if (!Object.hasOwn(patterns, role)) {
        const code = role === 'style_b' && options.variant === 'A' ? 'forbidden_style_input' : 'unauthorized_provider_input_role';
        addIssue(issues, code, `Unsupported input role for ${request.mode}/${options.variant || 'shared'}: ${role}.`, { role });
      }
    }
  }

  let claims = null;
  if (['outline', 'master'].includes(request.mode)) claims = await validateClaims(inputs.get('claims'), issues);
  let platformProfiles = null;
  if (inputs.has('platform_profiles')) {
    try {
      platformProfiles = await readJson(inputs.get('platform_profiles').absolutePath);
      if (!plainObject(platformProfiles.platforms)) addIssue(issues, 'invalid_platform_profiles', 'platform-profiles.json must contain a platforms object.');
      if (request.mode === 'adapt' && !platformProfiles.platforms?.[options.platform]) {
        addIssue(issues, 'missing_platform_profile', `No profile is defined for ${options.platform}.`, { platform: options.platform });
      }
    } catch (error) {
      addIssue(issues, 'invalid_platform_profiles', error.message);
    }
  }

  if (request.mode === 'adapt' && inputs.has('source_master') && inputs.has('master_provenance')) {
    try {
      const provenance = await readJson(inputs.get('master_provenance').absolutePath);
      const sourceMaster = inputs.get('source_master');
      if (provenance.schema_version !== 1 || provenance.mode !== 'master' || provenance.variant !== options.variant
        || provenance.output_path !== sourceMaster.path || provenance.output_sha256 !== sourceMaster.sha256
        || provenance.model !== options.model || !sameJson(provenance.parameters, options.parameters)) {
        addIssue(issues, 'master_provenance_mismatch', 'Adapt inputs must bind the matching current master and generation settings.');
      }
      const styleInput = inputs.get('style_b');
      if ((options.variant === 'A' && (provenance.input_paths?.style_b !== null
          || provenance.input_hashes?.style_b !== null
          || provenance.style_b_path != null || provenance.style_b_sha256 != null))
        || (options.variant === 'B' && (provenance.input_paths?.style_b !== styleInput?.path
          || provenance.input_hashes?.style_b !== styleInput?.sha256
          || provenance.style_b_path !== styleInput?.path || provenance.style_b_sha256 !== styleInput?.sha256))) {
        addIssue(issues, 'master_style_lineage_mismatch', 'Master provenance violates the selected A/B style boundary.');
      }
    } catch (error) {
      addIssue(issues, 'invalid_master_provenance', error.message);
    }
  }

  return {
    issues, requestPath, request, options, definition, runDir, runRealDir,
    canonicalOutputDir, outputDir, outputRealDir, outputSafe, inputs, claims, platformProfiles
  };
}

function frontmatterValue(content, key) {
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/)?.[1] || '';
  return frontmatter.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))?.[1] || null;
}

function validateMarkdown(content, relativePath, issues, { artifact = null, status = null } = {}) {
  if (!content.trim()) addIssue(issues, 'empty_provider_artifact', `${relativePath} must not be empty.`, { path: relativePath });
  const structural = withoutMarkdownCodeBlocks(content);
  const h1 = structural.match(/^#(?!#)\s+\S.*$/gm) || [];
  if (h1.length !== 1) addIssue(issues, 'invalid_h1_count', `${relativePath} must contain exactly one non-empty H1.`, { path: relativePath });
  if (artifact && frontmatterValue(content, 'artifact') !== artifact) {
    addIssue(issues, 'invalid_markdown_artifact', `${relativePath} must declare artifact: ${artifact}.`, { path: relativePath });
  }
  if (status && frontmatterValue(content, 'status') !== status) {
    addIssue(issues, 'invalid_artifact_status', `${relativePath} must declare status: ${status}.`, { path: relativePath });
  }
  if (/(?:^|\n)\s*(?:TODO|TBD|FIXME)\b|待补(?:充|写)?|待确认|\[(?:待填写|占位|填写|补充|替换|TODO|TBD)[^\]]*\]/i.test(content)) {
    addIssue(issues, 'placeholder_in_provider_artifact', `${relativePath} contains an unresolved placeholder.`, { path: relativePath });
  }
}

function validateDraftMarkdown(content, relativePath, issues) {
  validateMarkdown(content, relativePath, issues);
  if (/!\[[^\]]*\]\([^)]*\)|<img\b|\[(?:图片|配图|插图)[^\]]*\]/i.test(content)) {
    addIssue(issues, 'image_placeholder_in_draft', `${relativePath} must not contain images or image placeholders.`, { path: relativePath });
  }
  if (/<\/?[a-z][^>]*>/i.test(content)) addIssue(issues, 'html_in_draft', `${relativePath} must remain Markdown, not HTML.`, { path: relativePath });
  if (/(?:标题池|备选标题|候选标题|发布步骤|发布说明|已发布|审校报告|已审校)/i.test(content)) {
    addIssue(issues, 'downstream_content_in_draft', `${relativePath} contains title, publishing, or proofreading output.`, { path: relativePath });
  }
}

function withoutMarkdownCodeBlocks(content) {
  let fence = null;
  return content.replaceAll('\r\n', '\n').split('\n').map((line) => {
    if (fence) {
      const closing = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) fence = null;
      return '';
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,}).*$/);
    if (opening) {
      fence = { marker: opening[1][0], length: opening[1].length };
      return '';
    }
    return /^(?: {4,}|\t)/.test(line) ? '' : line;
  }).join('\n');
}

function visibleProseLength(content) {
  const withoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, '');
  return [...withoutMarkdownCodeBlocks(withoutFrontmatter)
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/[#>*_`\[\](){}|\\-]/g, '')
    .replace(/\s+/g, '')].length;
}

function validateCompleteBody(content, relativePath, issues, { minCharacters, minH2 }) {
  const structural = withoutMarkdownCodeBlocks(content);
  const characters = visibleProseLength(structural);
  const h2 = [...structural.matchAll(/^##(?!#)\s+\S.*$/gm)];
  const nonEmptyH2Count = h2.filter((heading, index) => {
    const start = heading.index + heading[0].length;
    const end = h2[index + 1]?.index ?? structural.length;
    return visibleProseLength(structural.slice(start, end)) > 0;
  }).length;
  if (characters < minCharacters || h2.length < minH2 || nonEmptyH2Count < minH2) {
    addIssue(
      issues,
      'incomplete_drafting_body',
      `${relativePath} is too small to be a complete draft.`,
      {
        path: relativePath,
        characters,
        minimum_characters: minCharacters,
        h2_count: h2.length,
        non_empty_h2_count: nonEmptyH2Count,
        minimum_h2: minH2
      }
    );
  }
}

async function collectArtifacts(context, issues) {
  const artifacts = [];
  for (let index = 0; index < context.definition.expected.length; index += 1) {
    const relativePath = context.definition.expected[index];
    const path = join(context.runDir, relativePath);
    if (!existsSync(path)) {
      addIssue(issues, 'missing_provider_artifact', `Missing ${relativePath}.`, { path: relativePath });
      continue;
    }
    if (!inside(context.outputDir, path)) {
      addIssue(issues, 'provider_artifact_escape', `Artifact escapes output_dir: ${relativePath}.`, { path: relativePath });
      continue;
    }
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(context.runDir, path)) {
      addIssue(issues, 'provider_artifact_symlink', `Artifact must be a real file with no symlink ancestor: ${relativePath}.`, { path: relativePath });
      continue;
    }
    const real = await realpath(path);
    if (!context.outputRealDir || !inside(context.outputRealDir, real)) {
      addIssue(issues, 'provider_artifact_escape', `Resolved artifact escapes output_dir: ${relativePath}.`, { path: relativePath });
      continue;
    }
    artifacts.push({ role: context.definition.artifactRoles[index], path: relativePath, sha256: await sha256(path) });
  }
  return artifacts;
}

function validateInputBindings(provenance, context, issues) {
  if (!plainObject(provenance.input_paths) || !plainObject(provenance.input_hashes)) {
    addIssue(issues, 'invalid_provenance_inputs', 'Master provenance must contain input_paths and input_hashes objects.');
    return;
  }
  for (const [role, input] of context.inputs) {
    if (provenance.input_paths[role] !== input.path || provenance.input_hashes[role] !== input.sha256) {
      addIssue(issues, 'provenance_input_mismatch', `Master provenance does not bind input ${role}.`, { role });
    }
  }
  const allowed = new Set(context.inputs.keys());
  for (const field of ['input_paths', 'input_hashes']) {
    for (const [role, value] of Object.entries(provenance[field])) {
      if (!allowed.has(role) && !(role === 'style_b' && context.options.variant === 'A' && value === null)) {
        addIssue(issues, 'unauthorized_provenance_input', `Master provenance contains unauthorized ${field}.${role}.`, { role });
      }
    }
  }
}

async function validateOutlineArtifacts(context, issues) {
  const controlRel = context.definition.expected[0];
  const controlPath = join(context.runDir, controlRel);
  if (!existsSync(controlPath) || (await lstat(controlPath)).isSymbolicLink()) return {};
  const control = await readFile(controlPath, 'utf8');
  const structuralControl = withoutMarkdownCodeBlocks(control);
  validateMarkdown(control, controlRel, issues, { artifact: 'ControlOutline', status: 'PASS' });
  for (const heading of ['## 写作目标', '## 证据结构', '## 事实边界', '## 平台适配约束']) {
    if (!structuralControl.includes(heading)) addIssue(issues, 'missing_outline_section', `${controlRel} is missing ${heading}.`, { path: controlRel });
  }
  for (const claim of context.claims?.critical || []) {
    if (!structuralControl.includes(claim.id)) addIssue(issues, 'critical_claim_missing_from_outline', `Critical claim ${claim.id} is absent from the control outline.`, { claim_id: claim.id });
  }
  const controlHash = await sha256(controlPath);
  for (const [index, variant] of [...VARIANTS].entries()) {
    const relativePath = context.definition.expected[index + 1];
    const path = join(context.runDir, relativePath);
    if (!existsSync(path) || (await lstat(path)).isSymbolicLink()) continue;
    const content = await readFile(path, 'utf8');
    validateMarkdown(content, relativePath, issues, { artifact: 'BranchStructure', status: 'PASS' });
    if (frontmatterValue(content, 'variant') !== variant
      || frontmatterValue(content, 'control_outline_path') !== controlRel
      || frontmatterValue(content, 'control_outline_sha256') !== controlHash) {
      addIssue(issues, 'branch_structure_lineage_mismatch', `${relativePath} must bind the current control outline and its own variant.`, { path: relativePath, variant });
    }
  }
  return { critical_claim_count: context.claims?.critical.length || 0 };
}

async function validateMasterArtifacts(context, issues) {
  const [finalRel, reviewRel, provenanceRel] = context.definition.expected;
  const finalPath = join(context.runDir, finalRel);
  const reviewPath = join(context.runDir, reviewRel);
  const provenancePath = join(context.runDir, provenanceRel);
  if (existsSync(finalPath) && !(await lstat(finalPath)).isSymbolicLink()) {
    const content = await readFile(finalPath, 'utf8');
    validateDraftMarkdown(content, finalRel, issues);
    validateCompleteBody(content, finalRel, issues, { minCharacters: 500, minH2: 3 });
  }
  if (existsSync(reviewPath) && !(await lstat(reviewPath)).isSymbolicLink()) {
    const review = await readFile(reviewPath, 'utf8');
    const structuralReview = withoutMarkdownCodeBlocks(review);
    validateMarkdown(review, reviewRel, issues, { artifact: 'DraftingReview', status: 'PASS' });
    for (const heading of ['## 事实边界', '## 结构检查', '## 越界检查']) {
      if (!structuralReview.includes(heading)) addIssue(issues, 'missing_review_section', `${reviewRel} is missing ${heading}.`, { path: reviewRel });
    }
  }
  if (!existsSync(provenancePath) || (await lstat(provenancePath)).isSymbolicLink()) return {};

  let provenance;
  try {
    provenance = await readJson(provenancePath);
  } catch (error) {
    addIssue(issues, 'invalid_master_provenance', error.message, { path: provenanceRel });
    return {};
  }
  if (provenance.schema_version !== 1 || provenance.task_id !== context.request.task_id
    || provenance.mode !== 'master' || provenance.variant !== context.options.variant
    || provenance.model !== context.options.model || !sameJson(provenance.parameters, context.options.parameters)) {
    addIssue(issues, 'invalid_master_provenance', 'Master provenance identity or generation settings do not match the request.', { path: provenanceRel });
  }
  validateInputBindings(provenance, context, issues);
  const styleInput = context.inputs.get('style_b');
  if ((context.options.variant === 'A' && (provenance.input_paths?.style_b !== null
      || provenance.input_hashes?.style_b !== null
      || provenance.style_b_path != null || provenance.style_b_sha256 != null))
    || (context.options.variant === 'B' && (provenance.style_b_path !== styleInput?.path || provenance.style_b_sha256 !== styleInput?.sha256))) {
    addIssue(issues, 'master_style_lineage_mismatch', 'Master provenance violates the selected A/B style boundary.');
  }
  if (!Array.isArray(provenance.claim_ids) || new Set(provenance.claim_ids).size !== provenance.claim_ids.length
    || provenance.claim_ids.some((id) => !context.claims?.ids.has(id))) {
    addIssue(issues, 'invalid_master_claim_lineage', 'Master provenance claim_ids must be a unique subset of claims.json.');
  } else {
    for (const claim of context.claims?.critical || []) {
      if (!provenance.claim_ids.includes(claim.id)) addIssue(issues, 'critical_claim_missing_from_master', `Master provenance omits critical claim ${claim.id}.`, { claim_id: claim.id });
    }
  }
  if (provenance.output_path !== finalRel || !existsSync(finalPath) || provenance.output_sha256 !== await sha256(finalPath)) {
    addIssue(issues, 'master_output_lineage_mismatch', 'Master provenance must bind the current final.md bytes.');
  }
  return { claim_count: Array.isArray(provenance.claim_ids) ? provenance.claim_ids.length : 0 };
}

async function validateAdaptArtifacts(context, issues) {
  const [draftRel, audienceRel, audienceJsonRel, provenanceRel] = context.definition.expected;
  const draftPath = join(context.runDir, draftRel);
  const audiencePath = join(context.runDir, audienceRel);
  const audienceJsonPath = join(context.runDir, audienceJsonRel);
  const provenancePath = join(context.runDir, provenanceRel);
  if (existsSync(draftPath) && !(await lstat(draftPath)).isSymbolicLink()) {
    const draft = await readFile(draftPath, 'utf8');
    validateDraftMarkdown(draft, draftRel, issues);
    if (context.options.platform === 'weibo') {
      validateCompleteBody(draft, draftRel, issues, { minCharacters: 80, minH2: 0 });
    } else if (context.options.platform !== 'xiaohongshu') {
      validateCompleteBody(draft, draftRel, issues, { minCharacters: 350, minH2: 3 });
    }
    if (context.options.platform === 'xiaohongshu') {
      const structuralDraft = withoutMarkdownCodeBlocks(draft);
      if (!structuralDraft.includes('## 发布正文') || !structuralDraft.includes('## 标签')) {
        addIssue(issues, 'invalid_xiaohongshu_structure', 'Xiaohongshu draft must contain ## 发布正文 and ## 标签.', { path: draftRel });
      }
      const pageNumbers = [...structuralDraft.matchAll(/^### 第 (\d+) 页\s*$/gm)].map((match) => Number(match[1]));
      const sequential = pageNumbers.every((number, index) => number === index + 1);
      if (pageNumbers.length < 6 || pageNumbers.length > 9 || !sequential) {
        addIssue(issues, 'invalid_xiaohongshu_pages', 'Xiaohongshu draft must contain 6-9 sequential ### 第 N 页 sections.', { path: draftRel });
      }
      const publishBody = structuralDraft.match(/^## 发布正文\s*$([\s\S]*?)(?=^## 卡片文案\s*$)/m)?.[1] || '';
      if (visibleProseLength(publishBody) < 180) {
        addIssue(issues, 'incomplete_xiaohongshu_publish_body', 'Xiaohongshu 发布正文 must contain at least 180 visible characters.', { path: draftRel });
      }
      for (const page of structuralDraft.matchAll(/^### 第 (\d+) 页\s*$([\s\S]*?)(?=^### 第 \d+ 页\s*$|^## 标签\s*$)/gm)) {
        if (visibleProseLength(page[2]) < 20) {
          addIssue(issues, 'incomplete_xiaohongshu_page', `Xiaohongshu card page ${page[1]} is too short.`, { path: draftRel, page: Number(page[1]) });
        }
      }
      const tagSection = structuralDraft.match(/(?:^|\n)## 标签[^\n]*\n([\s\S]*?)(?=\n## |\s*$)/)?.[1] || '';
      const tags = tagSection.match(/#[\p{L}\p{N}_-]+/gu) || [];
      if (tags.length < 5 || tags.length > 8 || new Set(tags).size !== tags.length) {
        addIssue(issues, 'invalid_xiaohongshu_tags', 'Xiaohongshu draft must contain 5-8 unique hashtags in ## 标签.', { path: draftRel });
      }
    }
  }
  if (existsSync(audiencePath) && !(await lstat(audiencePath)).isSymbolicLink()) validateMarkdown(await readFile(audiencePath, 'utf8'), audienceRel, issues);

  let audience = null;
  try {
    if (existsSync(audienceJsonPath) && !(await lstat(audienceJsonPath)).isSymbolicLink()) audience = await readJson(audienceJsonPath);
  } catch (error) {
    addIssue(issues, 'invalid_audience_snapshot', error.message, { path: audienceJsonRel });
  }
  const coreInput = context.inputs.get('core_audience');
  const profileInput = context.inputs.get('platform_profiles');
  const articleInput = context.inputs.get('article_audience');
  const renderedAudienceInput = context.inputs.get('audience_snapshot');
  const renderedManifestInput = context.inputs.get('audience_manifest');
  if (audience) {
    const valid = audience.schema_version === 1
      && audience.platform === context.options.platform
      && audience.variant === context.options.variant
      && sameJson(audience.merge_order, ['core_audience', 'platform_overlay', 'article_segment'])
      && audience.sources?.core_audience?.path === coreInput.path
      && audience.sources?.core_audience?.sha256 === coreInput.sha256
      && audience.sources?.platform_profiles?.path === profileInput.path
      && audience.sources?.platform_profiles?.sha256 === profileInput.sha256
      && audience.sources?.platform_profiles?.profile_set_version === context.platformProfiles?.profile_set?.version
      && audience.sources?.platform_profiles?.platform_id === context.options.platform
      && audience.sources?.article_audience?.path === articleInput.path
      && audience.sources?.article_audience?.sha256 === articleInput.sha256
      && typeof audience.sources?.article_audience?.empty === 'boolean'
      && audience.merged_snapshot?.path === audienceRel
      && existsSync(audiencePath)
      && audience.merged_snapshot?.sha256 === await sha256(audiencePath)
      && renderedAudienceInput?.path === audienceRel
      && renderedAudienceInput?.sha256 === await sha256(audiencePath)
      && renderedManifestInput?.path === audienceJsonRel
      && renderedManifestInput?.sha256 === await sha256(audienceJsonPath);
    if (!valid) addIssue(issues, 'audience_snapshot_contract_mismatch', 'audience-snapshot.json does not bind the requested audience layers and merged snapshot.');
  }

  let provenance = null;
  try {
    if (existsSync(provenancePath) && !(await lstat(provenancePath)).isSymbolicLink()) provenance = await readJson(provenancePath);
  } catch (error) {
    addIssue(issues, 'invalid_platform_provenance', error.message, { path: provenanceRel });
  }
  if (provenance) {
    const masterInput = context.inputs.get('source_master');
    const masterProvenanceInput = context.inputs.get('master_provenance');
    const styleInput = context.inputs.get('style_b');
    const valid = provenance.schema_version === 1
      && provenance.task_id === context.request.task_id
      && provenance.mode === 'adapt'
      && provenance.platform === context.options.platform
      && provenance.variant === context.options.variant
      && provenance.model === context.options.model
      && sameJson(provenance.parameters, context.options.parameters)
      && provenance.source_master_path === masterInput.path
      && provenance.source_master_sha256 === masterInput.sha256
      && provenance.master_provenance_path === masterProvenanceInput.path
      && provenance.master_provenance_sha256 === masterProvenanceInput.sha256
      && provenance.audience_snapshot_path === audienceRel
      && existsSync(audiencePath)
      && provenance.audience_snapshot_sha256 === await sha256(audiencePath)
      && provenance.output_path === draftRel
      && existsSync(draftPath)
      && provenance.output_sha256 === await sha256(draftPath)
      && (context.options.variant === 'A'
        ? provenance.style_b_path == null && provenance.style_b_sha256 == null
        : provenance.style_b_path === styleInput?.path && provenance.style_b_sha256 === styleInput?.sha256);
    if (!valid) addIssue(issues, 'platform_provenance_mismatch', 'Platform provenance does not bind the request, master, audience, style, and current draft bytes.');
  }
  return { platform: context.options.platform, variant: context.options.variant };
}

async function validateArtifacts(context) {
  const issues = [];
  const artifacts = await collectArtifacts(context, issues);
  let checks = { request_valid: true, mode: context.request.mode };
  if (artifacts.length === context.definition.expected.length) {
    if (context.request.mode === 'outline') checks = { ...checks, ...await validateOutlineArtifacts(context, issues) };
    if (context.request.mode === 'master') checks = { ...checks, ...await validateMasterArtifacts(context, issues) };
    if (context.request.mode === 'adapt') checks = { ...checks, ...await validateAdaptArtifacts(context, issues) };
  }
  return { issues, artifacts, checks };
}

function makeResult(context, status, artifacts, checks, issues) {
  const resumeFrom = context.definition?.stage || ({ outline: 'outline', master: 'masters', adapt: 'platforms' }[context.request?.mode]) || 'drafting';
  return {
    schema_version: 1,
    contract: CONTRACT,
    provider_contract: PROVIDER_CONTRACT,
    task_id: context.request?.task_id || 'unknown',
    status,
    artifacts,
    checks,
    issues: issues.map((issue) => issue.resume_from === 'drafting' ? { ...issue, resume_from: resumeFrom } : issue),
    warnings: []
  };
}

function canonicalResultPath(context) {
  return context.outputSafe && context.definition ? join(context.outputDir, context.definition.resultFile) : null;
}

async function resultTargetIsSafe(context, path) {
  if (!path || !context.outputSafe || dirname(path) !== context.outputDir || path !== canonicalResultPath(context)) return false;
  if (await hasSymlinkComponent(context.runDir, path, false)) return false;
  if (!existsSync(path)) return true;
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile()) return false;
  return inside(context.outputRealDir, await realpath(path));
}

async function writeResult(path, context, status, artifacts, checks, issues) {
  if (!await resultTargetIsSafe(context, path)) throw new Error('Unsafe drafting provider result target.');
  const result = makeResult(context, status, artifacts, checks, issues);
  await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

async function emitRequestFailure(context) {
  const checks = { request_valid: false, mode: context.request?.mode || null };
  const path = canonicalResultPath(context);
  if (path && context.request && await resultTargetIsSafe(context, path)) {
    const result = await writeResult(path, context, 'BLOCKED', [], checks, context.issues);
    emit({ ...result, result_path: runRelative(context.runDir, path) }, 2);
    return;
  }
  emit(makeResult(context, 'BLOCKED', [], checks, context.issues), 2);
}

async function finalize(context, resultInput) {
  const canonicalPath = canonicalResultPath(context);
  const requestedPath = resultInput
    ? (isAbsolute(resultInput) ? resolve(resultInput) : resolve(context.runDir, resultInput))
    : canonicalPath;
  if (!canonicalPath || requestedPath !== canonicalPath || !await resultTargetIsSafe(context, requestedPath)) {
    const issues = [];
    const symlink = requestedPath && existsSync(requestedPath) && (await lstat(requestedPath)).isSymbolicLink();
    addIssue(issues, symlink ? 'provider_result_symlink' : 'provider_result_escape', `Result must be the real canonical ${context.definition.resultFile} file.`);
    emit(makeResult(context, 'FAILED', [], { request_valid: true, mode: context.request.mode }, issues), 2);
    return;
  }

  try {
    const validation = await validateArtifacts(context);
    const status = validation.issues.length ? 'FAILED' : 'PASS';
    const result = await writeResult(requestedPath, context, status, validation.artifacts, validation.checks, validation.issues);
    emit({
      status,
      task_id: context.request.task_id,
      result_path: runRelative(context.runDir, requestedPath),
      artifacts: result.artifacts,
      checks: result.checks,
      issues: result.issues,
      warnings: result.warnings
    }, status === 'PASS' ? 0 : 2);
  } catch (error) {
    const issues = [];
    addIssue(issues, 'drafting_provider_failed', error.message);
    emit(makeResult(context, 'FAILED', [], { request_valid: true, mode: context.request.mode }, issues), 2);
  }
}

async function block(context, reason) {
  const path = canonicalResultPath(context);
  if (!path || !await resultTargetIsSafe(context, path)) {
    const issues = [];
    addIssue(issues, 'provider_result_escape', `Result must be the real canonical ${context.definition.resultFile} file.`);
    emit(makeResult(context, 'FAILED', [], { request_valid: true, mode: context.request.mode }, issues), 2);
    return;
  }
  const issues = [];
  addIssue(issues, 'drafting_input_insufficient', reason.trim());
  const checks = { request_valid: true, mode: context.request.mode };
  const result = await writeResult(path, context, 'BLOCKED', [], checks, issues);
  emit({ ...result, result_path: runRelative(context.runDir, path) }, 2);
}

async function main() {
  const [command, requestInput, resultInput] = process.argv.slice(2);
  const validCommand = ['validate-request', 'finalize', 'block'].includes(command);
  const validBlock = command !== 'block' || (typeof resultInput === 'string' && Boolean(resultInput.trim()));
  if (!validCommand || !requestInput || !validBlock) {
    emit({
      status: 'BLOCKED',
      issues: [{
        code: 'invalid_provider_command',
        message: 'Usage: provider-contract.mjs validate-request <request.json> | finalize <request.json> [result.json] | block <request.json> <reason>',
        resume_from: 'drafting'
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
      output_dir: context.definition.outputDir,
      inputs: Object.fromEntries([...context.inputs].map(([role, input]) => [role, input.path])),
      issues: []
    });
    return;
  }
  if (command === 'block') {
    await block(context, resultInput);
    return;
  }
  await finalize(context, resultInput);
}

main().catch((error) => {
  emit({
    status: 'FAILED',
    issues: [{ code: 'drafting_provider_failed', message: error.message, resume_from: 'drafting' }]
  }, 2);
});

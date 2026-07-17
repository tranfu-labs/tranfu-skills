import { lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  expandPath,
  fileExists,
  fileSha256,
  platforms,
  readJson,
  readText,
  relativeTo,
  titleCounts,
  variants
} from './lib.mjs';

function issue(code, message, extra = {}) {
  return { code, message, ...extra };
}

const researchArtifacts = [
  '02-research/brief.md',
  '02-research/source-log.md',
  '02-research/claims.json',
  '02-research/evidence-map.md'
];
const claimStatuses = new Set(['verified', 'conflicted', 'unverified', 'rejected']);
const claimRisks = new Set(['none', 'low', 'medium', 'high']);
const evidenceLevels = new Set(['L0', 'L1', 'L2', 'L3']);
const useGates = new Set(['ready', 'caveat', 'do_not_use']);

function researchIssue(code, message, extra = {}) {
  return issue(code, message, { resume_from: 'research', ...extra });
}

function frontmatterValue(text, key) {
  const frontmatter = text.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/)?.[1];
  if (!frontmatter) return null;
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  return match?.[1]?.trim() || null;
}

function indexedSections(text, prefix) {
  const pattern = new RegExp(`^##\\s+(${prefix}-[a-z0-9][a-z0-9-]*)\\s*$`, 'gim');
  const matches = [...text.matchAll(pattern)];
  const sections = new Map();
  const duplicates = new Set();
  for (const [index, match] of matches.entries()) {
    const id = match[1];
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    if (sections.has(id)) duplicates.add(id);
    else sections.set(id, text.slice(start, end));
  }
  return { sections, duplicates };
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

async function hasSymlinkComponent(root, path) {
  if (!inside(root, path)) return true;
  let current = root;
  for (const part of relative(root, path).split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    if (fileExists(current) && (await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

function hasResearchPlaceholder(text) {
  return /(?:^|\n)\s*(?:TODO|TBD|FIXME)\b|\[(?:待填写|占位|列出|填写|补充|替换|TODO|TBD)[^\]]*\]/i.test(text);
}

function sameItems(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && new Set(actual).size === expected.length
    && expected.every((item) => actual.includes(item));
}

export async function validateResearchPackage(runDir) {
  const issues = [];
  const contents = new Map();
  const researchDir = join(runDir, '02-research');
  let runRealDir;
  let researchRealDir;

  try {
    const runStat = await lstat(runDir);
    const researchStat = await lstat(researchDir);
    if (runStat.isSymbolicLink() || !runStat.isDirectory()
      || researchStat.isSymbolicLink() || !researchStat.isDirectory()) {
      return { issues: [researchIssue('research_output_symlink', 'Run and 02-research must be real directories, not symbolic links.')] };
    }
    runRealDir = await realpath(runDir);
    researchRealDir = await realpath(researchDir);
    if (!inside(runRealDir, researchRealDir)) {
      return { issues: [researchIssue('research_output_symlink', 'Resolved 02-research directory escapes run_dir.')] };
    }
  } catch (error) {
    return { issues: [researchIssue('missing_research_output', error.message)] };
  }

  for (const path of researchArtifacts) {
    const absolute = join(runDir, path);
    if (!fileExists(absolute)) {
      issues.push(researchIssue('missing_research_artifact', `Missing canonical research artifact: ${path}.`, { path }));
      continue;
    }
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      issues.push(researchIssue('research_artifact_symlink', `Research artifact must be a real file inside 02-research: ${path}.`, { path }));
      continue;
    }
    const real = await realpath(absolute);
    if (!inside(researchRealDir, real)) {
      issues.push(researchIssue('research_artifact_symlink', `Resolved research artifact escapes 02-research: ${path}.`, { path }));
      continue;
    }
    if (path.endsWith('.md')) {
      const text = await readText(absolute);
      contents.set(path, text);
      if (!text.trim() || hasResearchPlaceholder(text)) {
        issues.push(researchIssue('incomplete_research_artifact', `Research artifact is empty or contains a placeholder: ${path}.`, { path }));
      }
    }
  }

  if (issues.some((item) => ['missing_research_artifact', 'research_artifact_symlink'].includes(item.code))) return { issues };

  const brief = contents.get(researchArtifacts[0]);
  const sourceLog = contents.get(researchArtifacts[1]);
  const evidenceMap = contents.get(researchArtifacts[3]);
  const researchStatus = frontmatterValue(brief, 'research_status')?.toLowerCase();
  const markdownContracts = [
    [researchArtifacts[0], brief, 'ResearchBrief'],
    [researchArtifacts[1], sourceLog, 'SourceLog'],
    [researchArtifacts[3], evidenceMap, 'EvidenceMap']
  ];
  for (const [path, text, artifact] of markdownContracts) {
    if (frontmatterValue(text, 'artifact') !== artifact
      || frontmatterValue(text, 'status') !== 'PASS'
      || frontmatterValue(text, 'research_status')?.toLowerCase() !== researchStatus) {
      issues.push(researchIssue('invalid_research_markdown_contract', `${path} has invalid or inconsistent frontmatter.`, { path }));
    }
  }
  if (!['complete', 'partial'].includes(researchStatus)) {
    issues.push(researchIssue('invalid_research_status', 'Research status must be complete or partial.'));
  }

  let data;
  try {
    data = await readJson(join(runDir, researchArtifacts[2]));
  } catch (error) {
    issues.push(researchIssue('invalid_claims_json', error.message, { path: researchArtifacts[2] }));
    return { issues };
  }
  if (!data || Array.isArray(data) || data.schema_version !== 1
    || data.research_status !== researchStatus || !Array.isArray(data.claims)) {
    issues.push(researchIssue(
      'invalid_claims_root',
      'claims.json must use schema_version 1, match the research status, and contain a claims array.',
      { path: researchArtifacts[2] }
    ));
    return { issues };
  }

  const sourceIndex = indexedSections(sourceLog, 's');
  const evidenceIndex = indexedSections(evidenceMap, 'c');
  for (const sourceId of sourceIndex.duplicates) {
    issues.push(researchIssue('duplicate_source_id', `Duplicate source id: ${sourceId}.`, { source_id: sourceId }));
  }
  for (const claimId of evidenceIndex.duplicates) {
    issues.push(researchIssue('duplicate_evidence_claim_id', `Duplicate evidence-map claim id: ${claimId}.`, { claim_id: claimId }));
  }
  if (!sourceIndex.sections.size) {
    issues.push(researchIssue('missing_source_records', 'source-log.md must define at least one source ID.'));
  }

  const claimIds = new Set();
  const claimById = new Map();
  let criticalCount = 0;
  if (!data.claims.length) {
    issues.push(researchIssue('missing_claims', 'claims.json must contain at least one claim.'));
  }
  for (const claim of data.claims) {
    const requiredStrings = ['id', 'text', 'status', 'scope', 'risk', 'evidence_level', 'use_gate', 'as_of'];
    const missing = requiredStrings.filter((field) => typeof claim?.[field] !== 'string' || !claim[field].trim());
    const sourceIdsValid = Array.isArray(claim?.source_ids)
      && claim.source_ids.every((id) => typeof id === 'string' && /^s-[a-z0-9][a-z0-9-]*$/i.test(id));
    const limitationsValid = Array.isArray(claim?.limitations)
      && claim.limitations.every((item) => typeof item === 'string' && item.trim());
    if (missing.length || typeof claim?.critical !== 'boolean' || !sourceIdsValid || !limitationsValid) {
      issues.push(researchIssue('invalid_claim_schema', `Claim ${claim?.id || '(missing id)'} is incomplete.`, {
        claim_id: claim?.id || null,
        missing
      }));
      continue;
    }
    if (!/^c-[a-z0-9][a-z0-9-]*$/i.test(claim.id)) {
      issues.push(researchIssue('invalid_claim_id', `Invalid claim id: ${claim.id}.`, { claim_id: claim.id }));
    }
    if (claimIds.has(claim.id)) {
      issues.push(researchIssue('duplicate_claim_id', `Duplicate claim id: ${claim.id}.`, { claim_id: claim.id }));
    }
    claimIds.add(claim.id);
    claimById.set(claim.id, claim);
    if (new Set(claim.source_ids).size !== claim.source_ids.length) {
      issues.push(researchIssue('duplicate_claim_source_id', `Claim ${claim.id} repeats a source id.`, { claim_id: claim.id }));
    }
    if (!claimStatuses.has(claim.status) || !claimRisks.has(claim.risk)
      || !evidenceLevels.has(claim.evidence_level) || !useGates.has(claim.use_gate)) {
      issues.push(researchIssue('invalid_claim_enum', `Claim ${claim.id} contains an invalid enum.`, { claim_id: claim.id }));
    }
    if (claim.status === 'verified'
      && (claim.evidence_level !== 'L3' || claim.use_gate !== 'ready' || !claim.source_ids.length)) {
      issues.push(researchIssue('invalid_verified_claim', `Verified claim ${claim.id} must be L3/ready with at least one source.`, { claim_id: claim.id }));
    }
    if (claim.status !== 'verified' && claim.use_gate === 'ready') {
      issues.push(researchIssue('invalid_claim_gate', `Non-verified claim ${claim.id} cannot use the ready gate.`, { claim_id: claim.id }));
    }
    if (claim.status === 'rejected' && claim.use_gate !== 'do_not_use') {
      issues.push(researchIssue('invalid_claim_gate', `Rejected claim ${claim.id} must use do_not_use.`, { claim_id: claim.id }));
    }
    for (const sourceId of claim.source_ids) {
      if (!sourceIndex.sections.has(sourceId)) {
        issues.push(researchIssue('dangling_claim_source', `Claim ${claim.id} references undefined source ${sourceId}.`, {
          claim_id: claim.id,
          source_id: sourceId
        }));
      }
    }
    const evidence = evidenceIndex.sections.get(claim.id);
    if (!evidence) {
      issues.push(researchIssue('claim_missing_from_evidence_map', `Claim ${claim.id} is absent from evidence-map.md.`, { claim_id: claim.id }));
    } else {
      const evidenceSources = evidence.match(/^- 来源：\s*(.+?)\s*$/m)?.[1]
        ?.match(/s-[a-z0-9][a-z0-9-]*/gi) || [];
      if (evidenceSources.length !== claim.source_ids.length
        || new Set(evidenceSources).size !== evidenceSources.length
        || claim.source_ids.some((sourceId) => !evidenceSources.includes(sourceId))) {
        issues.push(researchIssue('evidence_source_set_mismatch', `Evidence map sources do not exactly match claim ${claim.id}.`, {
          claim_id: claim.id,
          expected_source_ids: claim.source_ids,
          actual_source_ids: evidenceSources
        }));
      }
      const expectedDownstream = claim.status === 'verified' && claim.use_gate === 'ready' ? 'yes' : 'no';
      if (!evidence.includes(`- 状态：${claim.status}`)
        || !evidence.includes(`- 范围：${claim.scope}`)
        || !evidence.includes('- 限制：')
        || !evidence.includes(`- 可进入下游：${expectedDownstream}`)) {
        issues.push(researchIssue('evidence_claim_mismatch', `Evidence map fields do not match claim ${claim.id}.`, { claim_id: claim.id }));
      }
    }
    for (const sourceId of claim.source_ids) {
      const sourceSection = sourceIndex.sections.get(sourceId);
      const supported = sourceSection?.match(/^- 支持主张：\s*(.+?)\s*$/m)?.[1] || '';
      if (sourceSection && !(supported.match(/c-[a-z0-9][a-z0-9-]*/gi) || []).includes(claim.id)) {
        issues.push(researchIssue('claim_missing_from_source_log', `Source ${sourceId} does not declare support for ${claim.id}.`, {
          claim_id: claim.id,
          source_id: sourceId
        }));
      }
    }
    if (claim.critical) {
      criticalCount += 1;
      if (claim.status !== 'verified') {
        issues.push(researchIssue('critical_claim_unverified', `Critical claim ${claim.id} is ${claim.status}.`, { claim_id: claim.id }));
      } else if (claim.evidence_level !== 'L3' || claim.use_gate !== 'ready' || !claim.source_ids.length) {
        issues.push(researchIssue('critical_claim_not_ready', `Critical claim ${claim.id} must be verified and L3/ready with a source.`, { claim_id: claim.id }));
      }
    }
  }

  if (!criticalCount) {
    issues.push(researchIssue('missing_critical_claim', 'Research must identify at least one critical claim before drafting.'));
  }
  for (const claimId of evidenceIndex.sections.keys()) {
    if (!claimIds.has(claimId)) {
      issues.push(researchIssue('dangling_evidence_claim', `evidence-map.md references undefined claim ${claimId}.`, { claim_id: claimId }));
    }
  }
  for (const [sourceId, section] of sourceIndex.sections) {
    const supported = section.match(/^- 支持主张：\s*(.+?)\s*$/m)?.[1] || '';
    for (const claimId of supported.match(/c-[a-z0-9][a-z0-9-]*/gi) || []) {
      if (!claimIds.has(claimId)) {
        issues.push(researchIssue('dangling_source_claim', `Source ${sourceId} references undefined claim ${claimId}.`, {
          source_id: sourceId,
          claim_id: claimId
        }));
      } else if (!claimById.get(claimId)?.source_ids.includes(sourceId)) {
        issues.push(researchIssue('source_claim_mismatch', `Source ${sourceId} declares ${claimId}, but the claim does not list that source.`, {
          source_id: sourceId,
          claim_id: claimId
        }));
      }
    }
  }

  return {
    issues,
    research_status: researchStatus,
    claim_count: data.claims.length,
    critical_claim_count: criticalCount,
    source_count: sourceIndex.sections.size
  };
}

export async function validateResearchProviderResult(runDir) {
  const issues = [];
  const requestRelative = '02-research/source-research.request.json';
  const resultRelative = '02-research/provider-result.json';
  const expected = researchArtifacts;
  let runRealDir;
  let researchRealDir;

  try {
    const runStat = await lstat(runDir);
    const researchDir = join(runDir, '02-research');
    const researchStat = await lstat(researchDir);
    if (runStat.isSymbolicLink() || !runStat.isDirectory()
      || researchStat.isSymbolicLink() || !researchStat.isDirectory()) {
      return { issues: [researchIssue('research_provider_control_symlink', 'Run and 02-research must be real directories.')] };
    }
    runRealDir = await realpath(runDir);
    researchRealDir = await realpath(researchDir);
    if (!inside(runRealDir, researchRealDir)) {
      return { issues: [researchIssue('research_provider_control_symlink', 'Resolved 02-research escapes run_dir.')] };
    }
  } catch (error) {
    return { issues: [researchIssue('missing_research_provider_result', error.message)] };
  }

  const controls = new Map();
  for (const [kind, path, missingCode] of [
    ['request', requestRelative, 'missing_research_provider_request'],
    ['result', resultRelative, 'missing_research_provider_result']
  ]) {
    const absolute = join(runDir, path);
    if (!fileExists(absolute)) {
      issues.push(researchIssue(missingCode, `Missing canonical research provider ${kind}: ${path}.`, { path }));
      continue;
    }
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      issues.push(researchIssue('research_provider_control_symlink', `Research provider ${kind} must be a real file: ${path}.`, { path }));
      continue;
    }
    const real = await realpath(absolute);
    if (!inside(researchRealDir, real)) {
      issues.push(researchIssue('research_provider_control_symlink', `Resolved research provider ${kind} escapes 02-research.`, { path }));
      continue;
    }
    try {
      controls.set(kind, await readJson(absolute));
    } catch (error) {
      issues.push(researchIssue('invalid_research_provider_json', error.message, { path }));
    }
  }
  if (!controls.has('request') || !controls.has('result')) return { issues };

  const request = controls.get('request');
  const result = controls.get('result');
  if (request.schema_version !== 1 || request.contract !== 'content-production-provider/v1'
    || request.capability !== 'source_research' || request.provider_contract !== 'source-research-v1'
    || resolve(request.run_dir || '') !== resolve(runDir) || request.mode !== 'research'
    || request.output_dir !== '02-research' || request.interaction_policy !== 'return_to_orchestrator'
    || !sameItems(request.expected_artifacts, expected)) {
    issues.push(researchIssue('invalid_research_provider_request', 'Canonical source research request does not match this run or contract.'));
  }
  if (result.schema_version !== 1 || result.contract !== 'content-production-provider/v1'
    || result.provider_contract !== 'source-research-v1' || result.task_id !== request.task_id) {
    issues.push(researchIssue('invalid_research_provider_result', 'Canonical source research result does not match its request.'));
  }
  if (result.status !== 'PASS') {
    issues.push(researchIssue('research_provider_not_pass', `Source research provider status is ${result.status || 'missing'}.`, {
      provider_status: result.status || null,
      provider_issues: Array.isArray(result.issues) ? result.issues : []
    }));
    return { issues };
  }
  if (!Array.isArray(result.issues) || result.issues.length || !Array.isArray(result.artifacts)) {
    issues.push(researchIssue('invalid_research_provider_result', 'PASS source research result must have artifacts and no issues.'));
    return { issues };
  }

  const paths = result.artifacts.map((artifact) => artifact?.path);
  if (!sameItems(paths, expected)) {
    issues.push(researchIssue('invalid_research_provider_artifacts', 'PASS source research result must bind exactly the canonical four-file package.'));
    return { issues };
  }
  for (const artifact of result.artifacts) {
    const absolute = join(runDir, artifact.path);
    if (!artifact?.role || !/^[a-f0-9]{64}$/.test(artifact?.sha256 || '')
      || !fileExists(absolute) || artifact.sha256 !== await fileSha256(absolute)) {
      issues.push(researchIssue('research_provider_artifact_drift', `Provider result artifact is invalid or stale: ${artifact?.path || 'missing'}.`, { path: artifact?.path || null }));
    }
  }

  return { issues, request, result, run_real_dir: runRealDir };
}

function draftingOutlineRevision(state) {
  return Math.max(1, (state?.gates?.outline?.revision || 0) + 1);
}

function draftingOutlineArtifacts(revision = 1) {
  const suffix = revision === 1 ? '' : `.v${String(revision).padStart(3, '0')}`;
  return [
    `03-outline/control-outline${suffix}.md`,
    `03-outline/A-structure${suffix}.md`,
    `03-outline/B-structure${suffix}.md`
  ];
}
const draftingMasterArtifacts = variants.flatMap((variant) => [
  `04-masters/${variant}/final.md`,
  `04-masters/${variant}/review.md`,
  `04-masters/${variant}/provenance.json`
]);
const draftingPlatformArtifacts = platforms.flatMap((platform) => variants.flatMap((variant) => [
  `05-platforms/${platform}/${variant}/draft.md`,
  `05-platforms/${platform}/${variant}/audience-snapshot.md`,
  `05-platforms/${platform}/${variant}/audience-snapshot.json`,
  `05-platforms/${platform}/${variant}/provenance.json`
]));

export function expectedDraftingStageArtifacts(stage, state = null) {
  const expected = {
    outline: draftingOutlineArtifacts(draftingOutlineRevision(state)),
    masters: draftingMasterArtifacts,
    platforms: draftingPlatformArtifacts
  }[stage];
  return expected ? [...expected] : null;
}

function draftingIssue(stage, code, message, extra = {}) {
  return issue(code, message, { resume_from: stage, ...extra });
}

function draftingTask(mode, variant = null, platform = null, revision = 1) {
  if (mode === 'outline') {
    const suffix = revision === 1 ? '' : `.v${String(revision).padStart(3, '0')}`;
    return {
      stage: 'outline',
      outputDir: '03-outline',
      request: `03-outline/drafting-outline${suffix}.request.json`,
      result: `03-outline/drafting-outline${suffix}.result.json`,
      expected: draftingOutlineArtifacts(revision),
      roles: ['control_outline', 'structure_a', 'structure_b']
    };
  }
  if (mode === 'master' && variants.includes(variant)) {
    const outputDir = `04-masters/${variant}`;
    return {
      stage: 'masters', variant, outputDir,
      request: `${outputDir}/drafting-master.request.json`,
      result: `${outputDir}/drafting-master.result.json`,
      expected: draftingMasterArtifacts.filter((path) => path.startsWith(`${outputDir}/`)),
      roles: ['final', 'review', 'provenance']
    };
  }
  if (mode === 'adapt' && platforms.includes(platform) && variants.includes(variant)) {
    const outputDir = `05-platforms/${platform}/${variant}`;
    return {
      stage: 'platforms', platform, variant, outputDir,
      request: `${outputDir}/drafting-adapt.request.json`,
      result: `${outputDir}/drafting-adapt.result.json`,
      expected: draftingPlatformArtifacts.filter((path) => path.startsWith(`${outputDir}/`)),
      roles: ['draft', 'audience_snapshot', 'audience_snapshot_json', 'provenance']
    };
  }
  return null;
}

async function draftingRealFile(runDir, runRealDir, allowedDir, relativePath, issues, stage, kind) {
  const absolute = resolve(runDir, relativePath);
  if (!inside(runDir, absolute) || !inside(allowedDir, absolute) || !fileExists(absolute)) {
    issues.push(draftingIssue(stage, `missing_drafting_${kind}`, `Missing canonical drafting ${kind}: ${relativePath}.`, { path: relativePath }));
    return null;
  }
  try {
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      issues.push(draftingIssue(stage, 'drafting_provider_control_symlink', `Drafting ${kind} must be a real file: ${relativePath}.`, { path: relativePath }));
      return null;
    }
    const real = await realpath(absolute);
    if (!inside(runRealDir, real) || !inside(await realpath(allowedDir), real)) {
      issues.push(draftingIssue(stage, 'drafting_provider_control_escape', `Resolved drafting ${kind} escapes its canonical output directory.`, { path: relativePath }));
      return null;
    }
    return absolute;
  } catch (error) {
    issues.push(draftingIssue(stage, `invalid_drafting_${kind}`, error.message, { path: relativePath }));
    return null;
  }
}

function draftingRolePolicy(mode, variant) {
  if (mode === 'outline') {
    return {
      required: ['research_subject', 'research_brief', 'source_log', 'claims', 'evidence_map', 'brief', 'core_audience', 'platform_profiles', 'article_audience'],
      allowed: new Set([
        'research_subject', 'research_brief', 'source_log', 'claims', 'evidence_map',
        'brief', 'core_audience', 'platform_profiles', 'article_audience',
        'topic_candidates', 'topic_decision', 'discovery_skip', 'provided_outline'
      ])
    };
  }
  if (mode === 'master') {
    const roles = ['research_brief', 'claims', 'evidence_map', 'control_outline', 'structure', 'core_audience', 'article_audience'];
    if (variant === 'B') roles.push('style_b');
    return { required: roles, allowed: new Set(roles) };
  }
  const roles = [
    'source_master', 'master_provenance', 'core_audience', 'platform_profiles', 'article_audience',
    'audience_snapshot', 'audience_manifest'
  ];
  if (variant === 'B') roles.push('style_b');
  return { required: roles, allowed: new Set(roles) };
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function draftingTaskId(state, mode, variant, platform, revision = 1) {
  if (!state?.run_id) return null;
  if (mode === 'outline') return `drafting:outline:${state.run_id}:v${String(revision).padStart(3, '0')}`;
  const stage = mode === 'master' ? 'masters' : 'platforms';
  const attempt = state.stages?.[stage]?.attempt;
  if (!Number.isInteger(attempt) || attempt < 1) return null;
  const attemptSuffix = `attempt-${String(attempt).padStart(3, '0')}`;
  if (mode === 'master') return `drafting:master:${state.run_id}:${variant}:${attemptSuffix}`;
  return `drafting:adapt:${state.run_id}:${platform}:${variant}:${attemptSuffix}`;
}

async function validateDraftingProviderTask(runDir, mode, { variant = null, platform = null, state = null } = {}) {
  const revision = mode === 'outline' ? draftingOutlineRevision(state) : 1;
  const spec = draftingTask(mode, variant, platform, revision);
  if (!spec) return { issues: [draftingIssue('outline', 'invalid_drafting_task', 'Unknown drafting provider task.')] };
  const issues = [];
  let runRealDir;
  let outputRealDir;
  const outputDir = resolve(runDir, spec.outputDir);

  try {
    const runStat = await lstat(runDir);
    const outputStat = await lstat(outputDir);
    if (runStat.isSymbolicLink() || !runStat.isDirectory()
      || outputStat.isSymbolicLink() || !outputStat.isDirectory()
      || await hasSymlinkComponent(runDir, outputDir)) {
      return { issues: [draftingIssue(spec.stage, 'drafting_provider_directory_symlink', 'Run and drafting output directories must be real directories.')] };
    }
    runRealDir = await realpath(runDir);
    outputRealDir = await realpath(outputDir);
    if (!inside(runRealDir, outputRealDir)) {
      return { issues: [draftingIssue(spec.stage, 'drafting_provider_output_escape', `Resolved ${spec.outputDir} escapes run_dir.`)] };
    }
  } catch (error) {
    return { issues: [draftingIssue(spec.stage, 'missing_drafting_provider_output', error.message, { path: spec.outputDir })] };
  }

  const requestPath = await draftingRealFile(runDir, runRealDir, outputDir, spec.request, issues, spec.stage, 'provider_request');
  const resultPath = await draftingRealFile(runDir, runRealDir, outputDir, spec.result, issues, spec.stage, 'provider_result');
  let request;
  let result;
  if (requestPath) {
    try { request = await readJson(requestPath); } catch (error) {
      issues.push(draftingIssue(spec.stage, 'invalid_drafting_provider_request', error.message, { path: spec.request }));
    }
  }
  if (resultPath) {
    try { result = await readJson(resultPath); } catch (error) {
      issues.push(draftingIssue(spec.stage, 'invalid_drafting_provider_result', error.message, { path: spec.result }));
    }
  }
  if (!request || !result) return { issues, request, result, spec };

  const optionKeys = ['input_mode', 'execution_strategy', 'model', 'parameters'];
  if (mode === 'outline') optionKeys.push('revision');
  if (mode !== 'outline') optionKeys.push('variant');
  if (mode === 'adapt') optionKeys.push('platform');
  const validOptions = plainObject(request.options)
    && sameItems(Object.keys(request.options), optionKeys)
    && ['brief', 'topic', 'outline'].includes(request.options.input_mode)
    && (!state || request.options.input_mode === state.input_mode)
    && ['parallel_subagents', 'sequential_fallback'].includes(request.options.execution_strategy)
    && typeof request.options.model === 'string' && Boolean(request.options.model.trim())
    && plainObject(request.options.parameters)
    && (mode !== 'outline' || request.options.revision === revision)
    && (mode === 'outline' || request.options.variant === variant)
    && (mode !== 'adapt' || request.options.platform === platform);
  const expectedTaskId = draftingTaskId(state, mode, variant, platform, revision);
  if (request.schema_version !== 1 || request.contract !== 'content-production-provider/v1'
    || request.capability !== 'drafting' || request.provider_contract !== 'drafting-v1'
    || resolve(request.run_dir || '') !== resolve(runDir) || request.mode !== mode
    || (state && request.run_mode !== state.run_mode)
    || request.output_dir !== spec.outputDir || request.interaction_policy !== 'return_to_orchestrator'
    || !sameItems(request.expected_artifacts, spec.expected) || !validOptions
    || (state ? request.task_id !== expectedTaskId : typeof request.task_id !== 'string' || !request.task_id)) {
    issues.push(draftingIssue(spec.stage, 'invalid_drafting_provider_request', `Canonical ${mode} request does not match this run, task, or contract.`, { path: spec.request }));
  }

  const inputs = new Map();
  const policy = draftingRolePolicy(mode, variant);
  if (!Array.isArray(request.inputs)) {
    issues.push(draftingIssue(spec.stage, 'invalid_drafting_provider_request', 'Drafting request inputs must be an array.', { path: spec.request }));
  } else {
    for (const input of request.inputs) {
      if (typeof input?.role !== 'string' || !input.role
        || typeof input?.path !== 'string' || !input.path
        || !/^[a-f0-9]{64}$/.test(input?.sha256 || '') || inputs.has(input.role)) {
        issues.push(draftingIssue(spec.stage, 'invalid_drafting_provider_input', 'Every drafting input needs a unique role, path, and SHA-256.', { role: input?.role || null }));
        continue;
      }
      if (!policy.allowed.has(input.role)) {
        issues.push(draftingIssue(spec.stage, 'unauthorized_drafting_input_role', `Unauthorized ${mode} input role: ${input.role}.`, { role: input.role }));
      }
      if (variant === 'A' && input.role === 'style_b') {
        issues.push(draftingIssue(spec.stage, 'a_style_contamination', 'Variant A must not receive the B style snapshot.'));
      }
      inputs.set(input.role, input);
      const absolute = resolve(runDir, input.path);
      if (!inside(runDir, absolute) || !fileExists(absolute)) {
        issues.push(draftingIssue(spec.stage, 'missing_drafting_provider_input', `Missing drafting input: ${input.path}.`, { role: input.role, path: input.path }));
        continue;
      }
      try {
        const stat = await lstat(absolute);
        const real = await realpath(absolute);
        if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(runDir, absolute) || !inside(runRealDir, real)) {
          issues.push(draftingIssue(spec.stage, 'drafting_provider_input_symlink', `Drafting input must be a real file inside run_dir: ${input.path}.`, { role: input.role, path: input.path }));
        } else if (input.sha256 !== await fileSha256(absolute)) {
          issues.push(draftingIssue(spec.stage, 'drafting_provider_input_drift', `Drafting input hash is stale: ${input.path}.`, { role: input.role, path: input.path }));
        }
      } catch (error) {
        issues.push(draftingIssue(spec.stage, 'invalid_drafting_provider_input', error.message, { role: input.role, path: input.path }));
      }
    }
  }
  for (const role of policy.required) {
    if (!inputs.has(role)) issues.push(draftingIssue(spec.stage, 'missing_drafting_provider_input_role', `Drafting ${mode} request is missing input role ${role}.`, { role }));
  }

  if (result.schema_version !== 1 || result.contract !== 'content-production-provider/v1'
    || result.provider_contract !== 'drafting-v1' || result.task_id !== request.task_id
    || !plainObject(result.checks) || result.checks.request_valid !== true || result.checks.mode !== mode) {
    issues.push(draftingIssue(spec.stage, 'invalid_drafting_provider_result', `Canonical ${mode} result does not match its request.`, { path: spec.result }));
  }
  if (result.status !== 'PASS') {
    issues.push(draftingIssue(spec.stage, 'drafting_provider_not_pass', `Drafting provider status is ${result.status || 'missing'}.`, {
      provider_status: result.status || null,
      provider_issues: Array.isArray(result.issues) ? result.issues : []
    }));
  }
  if (!Array.isArray(result.issues) || result.issues.length
    || !Array.isArray(result.warnings) || !Array.isArray(result.artifacts)) {
    issues.push(draftingIssue(spec.stage, 'invalid_drafting_provider_result', 'PASS drafting result must have artifacts, warnings, and no issues.', { path: spec.result }));
  } else {
    const resultPaths = result.artifacts.map((artifact) => artifact?.path);
    const resultRoles = result.artifacts.map((artifact) => artifact?.role);
    if (!sameItems(resultPaths, spec.expected) || !sameItems(resultRoles, spec.roles)) {
      issues.push(draftingIssue(spec.stage, 'invalid_drafting_provider_artifacts', `PASS ${mode} result must bind exactly its canonical artifacts.`, {
        expected: spec.expected,
        actual: resultPaths,
        expected_roles: spec.roles,
        actual_roles: resultRoles
      }));
    }
    for (const artifact of result.artifacts) {
      const absolute = resolve(runDir, artifact?.path || '');
      const expectedRole = spec.roles[spec.expected.indexOf(artifact?.path)];
      if (!expectedRole || artifact?.role !== expectedRole || !/^[a-f0-9]{64}$/.test(artifact?.sha256 || '')
        || !inside(outputDir, absolute) || dirname(absolute) !== outputDir || !fileExists(absolute)) {
        issues.push(draftingIssue(spec.stage, 'drafting_provider_artifact_drift', `Provider result artifact is invalid or missing: ${artifact?.path || 'missing'}.`, { path: artifact?.path || null }));
        continue;
      }
      try {
        const stat = await lstat(absolute);
        const real = await realpath(absolute);
        if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(runDir, absolute) || !inside(outputRealDir, real)) {
          issues.push(draftingIssue(spec.stage, 'drafting_provider_artifact_symlink', `Drafting artifact must be a real file inside ${spec.outputDir}: ${artifact.path}.`, { path: artifact.path }));
        } else if (artifact.sha256 !== await fileSha256(absolute)) {
          issues.push(draftingIssue(spec.stage, 'drafting_provider_artifact_drift', `Drafting artifact hash is stale: ${artifact.path}.`, { path: artifact.path }));
        }
      } catch (error) {
        issues.push(draftingIssue(spec.stage, 'drafting_provider_artifact_drift', error.message, { path: artifact?.path || null }));
      }
    }
  }

  return { issues, request, result, inputs, spec };
}

function activeDraftingPath(state, variant = null) {
  if (!variant) return state.gates?.outline?.decision_ref?.path || '03-outline/control-outline.md';
  const pattern = new RegExp(`(?:^|/)${variant}-structure(?:\\.v\\d{3})?\\.md$`);
  const matches = (state.gates?.outline?.bound_artifacts || []).filter((binding) => pattern.test(binding.path));
  return matches.at(-1)?.path || `03-outline/${variant}-structure.md`;
}

function draftingTextIssues(text, path, stage) {
  const issues = [];
  const prose = withoutDraftingMarkdownCode(text || '');
  if (!text?.trim() || hasResearchPlaceholder(prose)) {
    issues.push(draftingIssue(stage, 'incomplete_drafting_artifact', `Drafting artifact is empty or contains a placeholder: ${path}.`, { path }));
  }
  const h1Count = (withoutDraftingCodeBlocks(text || '').match(/^#\s+\S.*$/gm) || []).length;
  if (h1Count !== 1) {
    issues.push(draftingIssue(stage, 'invalid_drafting_heading_count', `Drafting artifact must contain exactly one H1: ${path}.`, { path, actual: h1Count }));
  }
  return issues;
}

function withoutDraftingCodeBlocks(text) {
  let fence = null;
  return text.replaceAll('\r\n', '\n').split('\n').map((line) => {
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

function withoutDraftingMarkdownCode(text) {
  return withoutDraftingCodeBlocks(text).replace(/(`+)([\s\S]*?)\1/g, '');
}

function visibleDraftingLength(text) {
  const withoutFrontmatter = text.replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, '');
  return [...withoutDraftingCodeBlocks(withoutFrontmatter)
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/[#>*_`\[\](){}|\\-]/g, '')
    .replace(/\s+/g, '')].length;
}

function draftingCompletenessIssues(text, path, stage, { minCharacters, minH2 }) {
  const issues = [];
  const structural = withoutDraftingCodeBlocks(text);
  const characters = visibleDraftingLength(structural);
  const h2 = [...structural.matchAll(/^##(?!#)\s+\S.*$/gm)];
  const nonEmptyH2Count = h2.filter((heading, index) => {
    const start = heading.index + heading[0].length;
    const end = h2[index + 1]?.index ?? structural.length;
    return visibleDraftingLength(structural.slice(start, end)) > 0;
  }).length;
  if (characters < minCharacters || h2.length < minH2 || nonEmptyH2Count < minH2) {
    issues.push(draftingIssue(stage, 'incomplete_drafting_body', `Drafting body is too small to be complete: ${path}.`, {
      path,
      characters,
      minimum_characters: minCharacters,
      h2_count: h2.length,
      non_empty_h2_count: nonEmptyH2Count,
      minimum_h2: minH2
    }));
  }
  return issues;
}

function draftingBodyIssues(text, path, stage, platform = null) {
  const issues = draftingTextIssues(text, path, stage);
  if (/!\[[^\]]*\]\([^)]*\)|<img\b|\[(?:图片|配图|插图)[^\]]*\]/i.test(text)) {
    issues.push(draftingIssue(stage, 'image_placeholder_in_draft', `Drafting body must not contain images or image placeholders: ${path}.`, { path }));
  }
  if (/<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?\/?>/i.test(text)) {
    issues.push(draftingIssue(stage, 'html_in_draft', `Drafting body must remain Markdown, not HTML: ${path}.`, { path }));
  }
  if (/(?:标题池|备选标题|候选标题|发布步骤|发布说明|已发布|审校报告|已审校)/i.test(text)) {
    issues.push(draftingIssue(stage, 'downstream_content_in_draft', `Drafting body contains title, publishing, or proofreading output: ${path}.`, { path }));
  }
  if (platform === 'xiaohongshu') {
    const structural = withoutDraftingCodeBlocks(text);
    if (!structural.includes('## 发布正文') || !structural.includes('## 标签')) {
      issues.push(draftingIssue(stage, 'invalid_xiaohongshu_structure', 'Xiaohongshu draft must contain ## 发布正文 and ## 标签.', { path }));
    }
    const pageNumbers = [...structural.matchAll(/^### 第 (\d+) 页\s*$/gm)].map((match) => Number(match[1]));
    if (pageNumbers.length < 6 || pageNumbers.length > 9
      || !pageNumbers.every((number, index) => number === index + 1)) {
      issues.push(draftingIssue(stage, 'invalid_xiaohongshu_pages', 'Xiaohongshu draft must contain 6-9 sequential card pages.', { path }));
    }
    const publishBody = structural.match(/^## 发布正文\s*$([\s\S]*?)(?=^## 卡片文案\s*$)/m)?.[1] || '';
    if (visibleDraftingLength(publishBody) < 180) {
      issues.push(draftingIssue(stage, 'incomplete_xiaohongshu_publish_body', 'Xiaohongshu 发布正文 must contain at least 180 visible characters.', { path }));
    }
    for (const page of structural.matchAll(/^### 第 (\d+) 页\s*$([\s\S]*?)(?=^### 第 \d+ 页\s*$|^## 标签\s*$)/gm)) {
      if (visibleDraftingLength(page[2]) < 20) {
        issues.push(draftingIssue(stage, 'incomplete_xiaohongshu_page', `Xiaohongshu card page ${page[1]} is too short.`, { path, page: Number(page[1]) }));
      }
    }
    const tagSection = structural.match(/(?:^|\n)## 标签[^\n]*\n([\s\S]*?)(?=\n## |\s*$)/)?.[1] || '';
    const tags = tagSection.match(/#[\p{L}\p{N}_-]+/gu) || [];
    if (tags.length < 5 || tags.length > 8 || new Set(tags).size !== tags.length) {
      issues.push(draftingIssue(stage, 'invalid_xiaohongshu_tags', 'Xiaohongshu draft must contain 5-8 unique hashtags in ## 标签.', { path }));
    }
  } else if (platform === 'weibo') {
    issues.push(...draftingCompletenessIssues(text, path, stage, { minCharacters: 80, minH2: 0 }));
  } else if (platform) {
    issues.push(...draftingCompletenessIssues(text, path, stage, { minCharacters: 350, minH2: 3 }));
  }
  return issues;
}

async function draftingJson(runDir, path, issues, stage, code) {
  try {
    const absolute = resolve(runDir, path || '');
    if (!path || !inside(runDir, absolute) || !fileExists(absolute)) throw new Error(`Missing or unsafe JSON path: ${path || '(missing)'}.`);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(runDir, absolute)) {
      throw new Error(`JSON input must be a real file inside run_dir: ${path}.`);
    }
    return await readJson(absolute);
  } catch (error) {
    issues.push(draftingIssue(stage, code, error.message, { path }));
    return null;
  }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function validateDraftingTaskInputs(runDir, validation, expected, issues, stage) {
  if (!validation.request || !validation.inputs) return;
  const actualRoles = [...validation.inputs.keys()];
  const expectedRoles = Object.keys(expected);
  if (!sameItems(actualRoles, expectedRoles)) {
    issues.push(draftingIssue(stage, 'drafting_input_role_set_mismatch', 'Drafting request input roles do not exactly match the active run inputs.', {
      expected: expectedRoles,
      actual: actualRoles
    }));
  }
  for (const [role, path] of Object.entries(expected)) {
    const input = validation.inputs.get(role);
    const absolute = path ? resolve(runDir, path) : null;
    let actualHash = null;
    if (absolute && inside(runDir, absolute) && fileExists(absolute)) {
      try {
        const stat = await lstat(absolute);
        if (!stat.isSymbolicLink() && stat.isFile()) actualHash = await fileSha256(absolute);
      } catch {
        actualHash = null;
      }
    }
    if (!input || !path || !actualHash || input.path !== path || input.sha256 !== actualHash) {
      issues.push(draftingIssue(stage, 'drafting_input_lineage_mismatch', `Drafting request does not bind the active ${role} input.`, { role, path }));
    }
  }
}

export async function validateDraftingOutlineStage(runDir, state) {
  const validation = await validateDraftingProviderTask(runDir, 'outline', { state });
  const issues = [...validation.issues];
  if (state.capabilities?.providers?.drafting?.status !== 'PASS'
    || state.capabilities?.providers?.drafting?.contract !== 'drafting-v1') {
    issues.push(draftingIssue('outline', 'drafting_provider_unavailable', 'The drafting provider snapshot is not PASS for drafting-v1.'));
  }
  if (validation.request && (validation.request.run_mode !== state.run_mode
    || validation.request.options?.input_mode !== state.input_mode)) {
    issues.push(draftingIssue('outline', 'invalid_drafting_provider_request', 'Outline request mode metadata does not match the active run.'));
  }
  const expectedInputs = {
    research_subject: '01-discovery/research-subject.json',
    research_brief: '02-research/brief.md',
    source_log: '02-research/source-log.md',
    claims: '02-research/claims.json',
    evidence_map: '02-research/evidence-map.md',
    brief: state.snapshots?.brief?.snapshot_path,
    core_audience: state.snapshots?.core_audience?.snapshot_path,
    platform_profiles: state.snapshots?.platform_profiles?.snapshot_path,
    article_audience: state.snapshots?.article_audience?.snapshot_path
  };
  if (state.input_mode === 'brief') {
    expectedInputs.topic_candidates = (state.gates?.topic?.bound_artifacts || [])
      .find((binding) => /(?:^|\/)topic-candidates(?:\.v\d{3})?\.json$/.test(binding.path))?.path;
    expectedInputs.topic_decision = state.gates?.topic?.decision_ref?.path;
  } else {
    expectedInputs.discovery_skip = '01-discovery/skip.json';
    if (state.input_mode === 'outline') expectedInputs.provided_outline = '03-outline/provided-outline.md';
  }
  await validateDraftingTaskInputs(runDir, validation, expectedInputs, issues, 'outline');
  if (validation.issues.length) return { issues };
  const outlineArtifacts = draftingOutlineArtifacts(draftingOutlineRevision(state));
  const controlPath = outlineArtifacts[0];
  let control = null;
  try { control = await readText(join(runDir, controlPath)); } catch (error) {
    issues.push(draftingIssue('outline', 'missing_control_outline', error.message, { path: controlPath }));
  }
  if (control) {
    const structuralControl = withoutDraftingCodeBlocks(control);
    issues.push(...draftingTextIssues(control, controlPath, 'outline'));
    if (frontmatterValue(control, 'artifact') !== 'ControlOutline' || frontmatterValue(control, 'status') !== 'PASS') {
      issues.push(draftingIssue('outline', 'invalid_control_outline_contract', 'control-outline.md must declare artifact ControlOutline and status PASS.', { path: controlPath }));
    }
    for (const heading of ['## 写作目标', '## 证据结构', '## 事实边界', '## 平台适配约束']) {
      if (!structuralControl.includes(heading)) {
        issues.push(draftingIssue('outline', 'missing_outline_section', `control-outline.md is missing ${heading}.`, { path: controlPath, heading }));
      }
    }
  }
  const claims = await draftingJson(runDir, '02-research/claims.json', issues, 'outline', 'invalid_drafting_claims');
  const structuralControl = control ? withoutDraftingCodeBlocks(control) : null;
  for (const claim of claims?.claims || []) {
    if (claim.critical && claim.id && structuralControl && !structuralControl.includes(claim.id)) {
      issues.push(draftingIssue('outline', 'claim_missing_from_outline', `Critical claim ${claim.id} is absent from the control outline.`, { claim_id: claim.id }));
    }
  }
  if (control) {
    const controlHash = await fileSha256(join(runDir, controlPath));
    for (const variant of variants) {
      const path = outlineArtifacts[variant === 'A' ? 1 : 2];
      let structure = null;
      try { structure = await readText(join(runDir, path)); } catch (error) {
        issues.push(draftingIssue('outline', 'missing_branch_structure', error.message, { path, variant }));
      }
      if (!structure) continue;
      issues.push(...draftingTextIssues(structure, path, 'outline'));
      if (frontmatterValue(structure, 'artifact') !== 'BranchStructure'
        || frontmatterValue(structure, 'status') !== 'PASS'
        || frontmatterValue(structure, 'variant') !== variant
        || frontmatterValue(structure, 'control_outline_path') !== controlPath
        || frontmatterValue(structure, 'control_outline_sha256') !== controlHash) {
        issues.push(draftingIssue('outline', 'drafting_structure_binding_mismatch', `${variant} structure does not bind the canonical control outline.`, { path, variant }));
      }
    }
  }
  return { issues };
}

export async function validateDraftingMastersStage(runDir, state) {
  const issues = [];
  if (state.capabilities?.providers?.drafting?.status !== 'PASS'
    || state.capabilities?.providers?.drafting?.contract !== 'drafting-v1') {
    issues.push(draftingIssue('masters', 'drafting_provider_unavailable', 'The drafting provider snapshot is not PASS for drafting-v1.'));
  }
  const claimsPath = '02-research/claims.json';
  const claims = await draftingJson(runDir, claimsPath, issues, 'masters', 'invalid_drafting_claims');
  const criticalIds = (claims?.claims || []).filter((claim) => claim.critical).map((claim) => claim.id);
  const allClaimIds = new Set((claims?.claims || []).map((claim) => claim.id));
  const controlPath = activeDraftingPath(state);
  const provenances = {};
  const requests = {};

  for (const variant of variants) {
    const validation = await validateDraftingProviderTask(runDir, 'master', { variant, state });
    issues.push(...validation.issues);
    requests[variant] = validation.request;
    if (validation.issues.length) continue;
    const base = `04-masters/${variant}`;
    const finalPath = `${base}/final.md`;
    const reviewPath = `${base}/review.md`;
    let finalText = null;
    let reviewText = null;
    try { finalText = await readText(join(runDir, finalPath)); } catch (error) {
      issues.push(draftingIssue('masters', 'missing_master_draft', error.message, { path: finalPath, variant }));
    }
    try { reviewText = await readText(join(runDir, reviewPath)); } catch (error) {
      issues.push(draftingIssue('masters', 'missing_master_review', error.message, { path: reviewPath, variant }));
    }
    if (finalText) {
      issues.push(...draftingBodyIssues(finalText, finalPath, 'masters'));
      issues.push(...draftingCompletenessIssues(finalText, finalPath, 'masters', { minCharacters: 500, minH2: 3 }));
    }
    if (reviewText) {
      const structuralReview = withoutDraftingCodeBlocks(reviewText);
      issues.push(...draftingTextIssues(reviewText, reviewPath, 'masters'));
      if (frontmatterValue(reviewText, 'artifact') !== 'DraftingReview' || frontmatterValue(reviewText, 'status') !== 'PASS') {
        issues.push(draftingIssue('masters', 'invalid_master_review_contract', `${variant} review must declare DraftingReview PASS.`, { path: reviewPath, variant }));
      }
      for (const heading of ['## 事实边界', '## 结构检查', '## 越界检查']) {
        if (!structuralReview.includes(heading)) {
          issues.push(draftingIssue('masters', 'missing_review_section', `${variant} review is missing ${heading}.`, { path: reviewPath, variant, heading }));
        }
      }
    }
    const provenance = await draftingJson(runDir, `${base}/provenance.json`, issues, 'masters', 'invalid_master_provenance');
    provenances[variant] = provenance;
    const structurePath = activeDraftingPath(state, variant);
    const expectedStyle = variant === 'B' ? state.snapshots?.style_b : null;
    await validateDraftingTaskInputs(runDir, validation, {
      research_brief: '02-research/brief.md',
      claims: claimsPath,
      evidence_map: '02-research/evidence-map.md',
      control_outline: controlPath,
      structure: structurePath,
      core_audience: state.snapshots?.core_audience?.snapshot_path,
      article_audience: state.snapshots?.article_audience?.snapshot_path,
      ...(variant === 'B' ? { style_b: expectedStyle?.snapshot_path } : {})
    }, issues, 'masters');
    if (validation.request && (validation.request.run_mode !== state.run_mode
      || validation.request.options?.input_mode !== state.input_mode)) {
      issues.push(draftingIssue('masters', 'invalid_drafting_provider_request', `${variant} master request mode metadata does not match the active run.`, { variant }));
    }
    if (!provenance || !validation.request) continue;
    const inputMap = new Map((validation.request.inputs || []).map((input) => [input.role, input]));
    const validRoot = provenance.schema_version === 1 && provenance.task_id === validation.request.task_id
      && provenance.mode === 'master' && provenance.variant === variant
      && provenance.model === validation.request.options?.model
      && sameJson(provenance.parameters, validation.request.options?.parameters)
      && provenance.output_path === finalPath
      && fileExists(join(runDir, finalPath))
      && provenance.output_sha256 === await fileSha256(join(runDir, finalPath));
    if (!validRoot) issues.push(draftingIssue('masters', 'invalid_master_provenance', `${variant} master provenance does not bind its request and output.`, { variant }));
    for (const input of validation.request.inputs || []) {
      if (provenance.input_paths?.[input.role] !== input.path || provenance.input_hashes?.[input.role] !== input.sha256) {
        issues.push(draftingIssue('masters', 'master_input_lineage_mismatch', `${variant} provenance does not bind input ${input.role}.`, { variant, role: input.role }));
      }
    }
    for (const [role, path] of [['claims', claimsPath], ['control_outline', controlPath], ['structure', structurePath]]) {
      const absolute = join(runDir, path);
      if (!fileExists(absolute) || inputMap.get(role)?.path !== path || inputMap.get(role)?.sha256 !== await fileSha256(absolute)) {
        issues.push(draftingIssue('masters', `master_${role}_lineage_mismatch`, `${variant} master request does not bind the active ${role}.`, { variant, role, path }));
      }
    }
    if (!Array.isArray(provenance.claim_ids)
      || criticalIds.some((id) => !provenance.claim_ids.includes(id))
      || provenance.claim_ids.some((id) => !allClaimIds.has(id))) {
      issues.push(draftingIssue('masters', 'master_claim_set_mismatch', `${variant} provenance claim_ids are incomplete or unauthorized.`, { variant }));
    }
    if (variant === 'A') {
      if (inputMap.has('style_b') || provenance.style_b_path !== null || provenance.style_b_sha256 !== null
        || ![undefined, null].includes(provenance.input_paths?.style_b)
        || ![undefined, null].includes(provenance.input_hashes?.style_b)) {
        issues.push(draftingIssue('masters', 'a_style_contamination', 'A master must not bind the B style snapshot.'));
      }
    } else if (!expectedStyle || inputMap.get('style_b')?.path !== expectedStyle.snapshot_path
      || inputMap.get('style_b')?.sha256 !== expectedStyle.sha256
      || provenance.style_b_path !== expectedStyle.snapshot_path
      || provenance.style_b_sha256 !== expectedStyle.sha256) {
      issues.push(draftingIssue('masters', 'b_style_missing', 'B master must bind the current style-B snapshot.'));
    }
  }

  if (provenances.A && provenances.B
    && (provenances.A.model !== provenances.B.model || !sameJson(provenances.A.parameters, provenances.B.parameters))) {
    issues.push(draftingIssue('masters', 'ab_parameter_mismatch', 'A and B masters must use the same model and parameters.'));
  }
  if (requests.A && requests.B
    && (requests.A.options?.model !== requests.B.options?.model || !sameJson(requests.A.options?.parameters, requests.B.options?.parameters))) {
    issues.push(draftingIssue('masters', 'ab_request_parameter_mismatch', 'A and B master requests must use the same model and parameters.'));
  }
  return { issues };
}

export async function validateDraftingPlatformsStage(runDir, state) {
  const issues = [];
  if (state.capabilities?.providers?.drafting?.status !== 'PASS'
    || state.capabilities?.providers?.drafting?.contract !== 'drafting-v1') {
    issues.push(draftingIssue('platforms', 'drafting_provider_unavailable', 'The drafting provider snapshot is not PASS for drafting-v1.'));
  }
  const profilesPath = state.snapshots?.platform_profiles?.snapshot_path;
  const profiles = profilesPath
    ? await draftingJson(runDir, profilesPath, issues, 'platforms', 'invalid_platform_profiles_snapshot') : null;
  for (const platform of platforms) {
    const audienceHashes = {};
    const provenances = {};
    const requests = {};
    for (const variant of variants) {
      const validation = await validateDraftingProviderTask(runDir, 'adapt', { platform, variant, state });
      issues.push(...validation.issues);
      requests[variant] = validation.request;
      if (validation.issues.length) continue;
      const base = `05-platforms/${platform}/${variant}`;
      const draftPath = `${base}/draft.md`;
      const audiencePath = `${base}/audience-snapshot.md`;
      let draft = null;
      let audienceText = null;
      try { draft = await readText(join(runDir, draftPath)); } catch (error) {
        issues.push(draftingIssue('platforms', 'missing_platform_draft', error.message, { platform, variant, path: draftPath }));
      }
      if (draft) issues.push(...draftingBodyIssues(draft, draftPath, 'platforms', platform));
      try { audienceText = await readText(join(runDir, audiencePath)); } catch (error) {
        issues.push(draftingIssue('platforms', 'missing_audience_snapshot', error.message, { platform, variant, path: audiencePath }));
      }
      if (audienceText) {
        issues.push(...draftingTextIssues(audienceText, audiencePath, 'platforms'));
        audienceHashes[variant] = await fileSha256(join(runDir, audiencePath));
      }
      const audience = await draftingJson(runDir, `${base}/audience-snapshot.json`, issues, 'platforms', 'invalid_audience_snapshot');
      const expectedAudience = {
        core_audience: state.snapshots?.core_audience,
        platform_profiles: state.snapshots?.platform_profiles,
        article_audience: state.snapshots?.article_audience
      };
      const audienceValid = audience && audience.schema_version === 1
        && audience.platform === platform && audience.variant === variant
        && sameJson(audience.merge_order, ['core_audience', 'platform_overlay', 'article_segment'])
        && audience.sources?.core_audience?.path === expectedAudience.core_audience?.snapshot_path
        && audience.sources?.core_audience?.sha256 === expectedAudience.core_audience?.sha256
        && audience.sources?.platform_profiles?.path === expectedAudience.platform_profiles?.snapshot_path
        && audience.sources?.platform_profiles?.sha256 === expectedAudience.platform_profiles?.sha256
        && audience.sources?.platform_profiles?.profile_set_version === profiles?.profile_set?.version
        && audience.sources?.platform_profiles?.platform_id === platform
        && audience.sources?.article_audience?.path === expectedAudience.article_audience?.snapshot_path
        && audience.sources?.article_audience?.sha256 === expectedAudience.article_audience?.sha256
        && audience.sources?.article_audience?.empty === Boolean(expectedAudience.article_audience?.empty)
        && audience.merged_snapshot?.path === audiencePath
        && audience.merged_snapshot?.sha256 === audienceHashes[variant];
      if (!audienceValid) {
        issues.push(draftingIssue('platforms', 'audience_snapshot_contract_mismatch', `Audience snapshot is stale or incomplete for ${platform}/${variant}.`, { platform, variant }));
      }
      const provenance = await draftingJson(runDir, `${base}/provenance.json`, issues, 'platforms', 'invalid_platform_provenance');
      provenances[variant] = provenance;
      const masterPath = `04-masters/${variant}/final.md`;
      const masterProvenancePath = `04-masters/${variant}/provenance.json`;
      const expectedStyle = variant === 'B' ? state.snapshots?.style_b : null;
      await validateDraftingTaskInputs(runDir, validation, {
        source_master: masterPath,
        master_provenance: masterProvenancePath,
        core_audience: state.snapshots?.core_audience?.snapshot_path,
        platform_profiles: state.snapshots?.platform_profiles?.snapshot_path,
        article_audience: state.snapshots?.article_audience?.snapshot_path,
        audience_snapshot: audiencePath,
        audience_manifest: `${base}/audience-snapshot.json`,
        ...(variant === 'B' ? { style_b: expectedStyle?.snapshot_path } : {})
      }, issues, 'platforms');
      if (validation.request && (validation.request.run_mode !== state.run_mode
        || validation.request.options?.input_mode !== state.input_mode)) {
        issues.push(draftingIssue('platforms', 'invalid_drafting_provider_request', `${platform}/${variant} request mode metadata does not match the active run.`, { platform, variant }));
      }
      if (!provenance || !validation.request) continue;
      const inputMap = new Map((validation.request.inputs || []).map((input) => [input.role, input]));
      const masterExists = fileExists(join(runDir, masterPath));
      const masterProvenanceExists = fileExists(join(runDir, masterProvenancePath));
      const draftExists = fileExists(join(runDir, draftPath));
      const valid = masterExists && masterProvenanceExists && draftExists
        && provenance.schema_version === 1 && provenance.task_id === validation.request.task_id
        && provenance.mode === 'adapt' && provenance.platform === platform && provenance.variant === variant
        && provenance.model === validation.request.options?.model
        && sameJson(provenance.parameters, validation.request.options?.parameters)
        && inputMap.get('source_master')?.path === masterPath
        && inputMap.get('source_master')?.sha256 === await fileSha256(join(runDir, masterPath))
        && inputMap.get('master_provenance')?.path === masterProvenancePath
        && inputMap.get('master_provenance')?.sha256 === await fileSha256(join(runDir, masterProvenancePath))
        && provenance.source_master_path === masterPath
        && provenance.source_master_sha256 === inputMap.get('source_master')?.sha256
        && provenance.master_provenance_path === masterProvenancePath
        && provenance.master_provenance_sha256 === inputMap.get('master_provenance')?.sha256
        && provenance.audience_snapshot_path === audiencePath
        && provenance.audience_snapshot_sha256 === audienceHashes[variant]
        && provenance.output_path === draftPath
        && provenance.output_sha256 === await fileSha256(join(runDir, draftPath));
      if (!valid) issues.push(draftingIssue('platforms', 'platform_provenance_lineage_mismatch', `${platform}/${variant} provenance does not bind its request, master, audience, and output.`, { platform, variant }));
      if (variant === 'A') {
        if (inputMap.has('style_b') || provenance.style_b_path !== null || provenance.style_b_sha256 !== null) {
          issues.push(draftingIssue('platforms', 'a_style_contamination', `${platform}/A must not bind the B style snapshot.`, { platform }));
        }
      } else if (!expectedStyle || inputMap.get('style_b')?.path !== expectedStyle.snapshot_path
        || inputMap.get('style_b')?.sha256 !== expectedStyle.sha256
        || provenance.style_b_path !== expectedStyle.snapshot_path
        || provenance.style_b_sha256 !== expectedStyle.sha256) {
        issues.push(draftingIssue('platforms', 'b_style_missing', `${platform}/B must bind the current style-B snapshot.`, { platform }));
      }
    }
    if (audienceHashes.A && audienceHashes.B && audienceHashes.A !== audienceHashes.B) {
      issues.push(draftingIssue('platforms', 'ab_audience_snapshot_mismatch', `${platform} A/B audience snapshot bytes must be identical.`, { platform }));
    }
    if (provenances.A && provenances.B
      && (provenances.A.model !== provenances.B.model || !sameJson(provenances.A.parameters, provenances.B.parameters))) {
      issues.push(draftingIssue('platforms', 'ab_parameter_mismatch', `${platform} A/B adaptations must use the same model and parameters.`, { platform }));
    }
    if (requests.A && requests.B
      && (requests.A.options?.model !== requests.B.options?.model || !sameJson(requests.A.options?.parameters, requests.B.options?.parameters))) {
      issues.push(draftingIssue('platforms', 'ab_request_parameter_mismatch', `${platform} A/B adaptation requests must use the same model and parameters.`, { platform }));
    }
  }
  return { issues };
}

const proofreadingRoles = [
  'logic_checkpoint', 'humanized_checkpoint', 'final',
  'logic_review', 'humanize_review', 'detail_review', 'proofread_result'
];
const proofreadingHardGates = [
  'title', 'heading_structure', 'frontmatter', 'protected_literals',
  'markdown_semantics', 'no_fabrication', 'humanizer_ledger', 'platform_register'
];

function proofreadingIssue(code, message, extra = {}) {
  return issue(code, message, { resume_from: 'editing', ...extra });
}

function proofreadingDefinition(platform, variant) {
  const base = `05-platforms/${platform}/${variant}`;
  return {
    base,
    request: `${base}/reviews/proofreading.request.json`,
    result: `${base}/reviews/proofreading.result.json`,
    expected: [
      `${base}/logic-final.md`, `${base}/humanized.md`, `${base}/final.md`,
      `${base}/reviews/logic.md`, `${base}/reviews/humanize.md`, `${base}/reviews/detail.md`,
      `${base}/reviews/proofread-result.json`
    ],
    regressions: [
      `${base}/reviews/claim-regression-humanize.json`,
      `${base}/reviews/claim-regression-final.json`
    ]
  };
}

export function expectedProofreadingStageArtifacts() {
  return platforms.flatMap((platform) => variants.flatMap((variant) => {
    const spec = proofreadingDefinition(platform, variant);
    return [...spec.expected, ...spec.regressions];
  }));
}

function proofreadingTaskId(state, platform, variant) {
  const attempt = state?.stages?.editing?.attempt;
  if (!state?.run_id || !Number.isInteger(attempt) || attempt < 1) return null;
  return `proofread:${state.run_id}:${platform}:${variant}:attempt-${String(attempt).padStart(3, '0')}`;
}

async function proofreadingRealFile(runDir, runRealDir, allowedDir, relativePath, issues, kind) {
  const absolute = resolve(runDir, relativePath || '');
  if (!relativePath || !inside(runDir, absolute) || !inside(allowedDir, absolute) || !fileExists(absolute)) {
    issues.push(proofreadingIssue(`missing_proofreading_${kind}`, `Missing canonical proofreading ${kind}: ${relativePath}.`, { path: relativePath }));
    return null;
  }
  try {
    const stat = await lstat(absolute);
    const real = await realpath(absolute);
    if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(runDir, absolute)
      || !inside(runRealDir, real) || !inside(await realpath(allowedDir), real)) {
      issues.push(proofreadingIssue(`proofreading_${kind}_symlink`, `Proofreading ${kind} must be a real file in its canonical directory.`, { path: relativePath }));
      return null;
    }
    return absolute;
  } catch (error) {
    issues.push(proofreadingIssue(`invalid_proofreading_${kind}`, error.message, { path: relativePath }));
    return null;
  }
}

async function validateProofreadingProviderTask(runDir, state, platform, variant) {
  const spec = proofreadingDefinition(platform, variant);
  const issues = [];
  const outputDir = resolve(runDir, spec.base);
  const reviewsDir = join(outputDir, 'reviews');
  let runRealDir;
  try {
    const runStat = await lstat(runDir);
    const outputStat = await lstat(outputDir);
    const reviewsStat = await lstat(reviewsDir);
    runRealDir = await realpath(runDir);
    if (runStat.isSymbolicLink() || !runStat.isDirectory() || outputStat.isSymbolicLink() || !outputStat.isDirectory()
      || reviewsStat.isSymbolicLink() || !reviewsStat.isDirectory() || await hasSymlinkComponent(runDir, reviewsDir)
      || !inside(runRealDir, await realpath(outputDir))) {
      throw new Error('Run and proofreading output directories must be real directories.');
    }
  } catch (error) {
    return { issues: [proofreadingIssue('invalid_proofreading_output_dir', error.message, { platform, variant })], spec };
  }

  const requestPath = await proofreadingRealFile(runDir, runRealDir, reviewsDir, spec.request, issues, 'provider_request');
  const resultPath = await proofreadingRealFile(runDir, runRealDir, reviewsDir, spec.result, issues, 'provider_result');
  let request = null;
  let result = null;
  try { if (requestPath) request = await readJson(requestPath); } catch (error) {
    issues.push(proofreadingIssue('invalid_proofreading_provider_request', error.message, { path: spec.request }));
  }
  try { if (resultPath) result = await readJson(resultPath); } catch (error) {
    issues.push(proofreadingIssue('invalid_proofreading_provider_result', error.message, { path: spec.result }));
  }
  if (!request || !result) return { issues, request, result, spec };

  const expectedTaskId = proofreadingTaskId(state, platform, variant);
  const options = request.options;
  const validOptions = plainObject(options)
    && sameItems(Object.keys(options), ['execution_strategy', 'model', 'parameters'])
    && ['parallel_subagents', 'sequential_fallback'].includes(options.execution_strategy)
    && typeof options.model === 'string' && Boolean(options.model.trim())
    && plainObject(options.parameters);
  if (request.schema_version !== 1 || request.contract !== 'content-production-provider/v1'
    || request.capability !== 'proofreading' || request.provider_contract !== 'proofreading-v1'
    || request.task_id !== expectedTaskId || !isAbsolute(request.run_dir || '') || resolve(request.run_dir || '') !== resolve(runDir)
    || request.run_mode !== state.run_mode || request.mode !== 'proofread'
    || request.platform !== platform || request.variant !== variant
    || request.output_dir !== spec.base || request.interaction_policy !== 'return_to_orchestrator'
    || !sameItems(request.expected_artifacts, spec.expected) || !validOptions) {
    issues.push(proofreadingIssue('invalid_proofreading_provider_request', `Canonical proofreading request does not match ${platform}/${variant} or the current editing attempt.`, { path: spec.request, platform, variant }));
  }

  const draftRelative = `${spec.base}/draft.md`;
  const input = Array.isArray(request.inputs) && request.inputs.length === 1 ? request.inputs[0] : null;
  const platformBinding = (state.stages?.platforms?.artifacts || []).find((item) => item.path === draftRelative);
  const draftPath = join(runDir, draftRelative);
  if (!input || input.role !== 'draft' || input.path !== draftRelative || !/^[a-f0-9]{64}$/.test(input.sha256 || '')
    || !platformBinding || platformBinding.sha256 !== input.sha256 || !fileExists(draftPath)) {
    issues.push(proofreadingIssue('invalid_proofreading_provider_input', `Proofreading must bind only the completed ${platform}/${variant} draft.`, { path: draftRelative, platform, variant }));
  } else {
    const safe = await proofreadingRealFile(runDir, runRealDir, outputDir, draftRelative, issues, 'input');
    if (safe && await fileSha256(safe) !== input.sha256) {
      issues.push(proofreadingIssue('proofreading_provider_input_drift', `Proofreading draft input hash is stale: ${draftRelative}.`, { path: draftRelative }));
    }
  }

  if (result.schema_version !== 1 || result.contract !== 'content-production-provider/v1'
    || result.provider_contract !== 'proofreading-v1' || result.task_id !== request.task_id
    || result.request_sha256 !== await fileSha256(requestPath)
    || result.status !== 'PASS' || !plainObject(result.checks)
    || result.checks.request_valid !== true || result.checks.mode !== 'proofread'
    || !Array.isArray(result.issues) || result.issues.length
    || !Array.isArray(result.warnings) || !Array.isArray(result.artifacts)) {
    issues.push(proofreadingIssue('invalid_proofreading_provider_result', `Canonical proofreading result is not a matching PASS for ${platform}/${variant}.`, { path: spec.result, platform, variant }));
  }
  const resultPaths = (result.artifacts || []).map((artifact) => artifact?.path);
  const resultRoles = (result.artifacts || []).map((artifact) => artifact?.role);
  if (!sameItems(resultPaths, spec.expected) || !sameItems(resultRoles, proofreadingRoles)) {
    issues.push(proofreadingIssue('invalid_proofreading_provider_artifacts', `PASS result must bind exactly seven canonical proofreading artifacts for ${platform}/${variant}.`, { platform, variant }));
  }
  for (const artifact of result.artifacts || []) {
    const index = spec.expected.indexOf(artifact?.path);
    const expectedRole = proofreadingRoles[index];
    const absolute = resolve(runDir, artifact?.path || '');
    if (index < 0 || artifact.role !== expectedRole || !/^[a-f0-9]{64}$/.test(artifact.sha256 || '')
      || !inside(outputDir, absolute) || !fileExists(absolute)) {
      issues.push(proofreadingIssue('proofreading_provider_artifact_drift', `Invalid proofreading artifact: ${artifact?.path || '(missing)'}.`, { path: artifact?.path || null }));
      continue;
    }
    const safe = await proofreadingRealFile(runDir, runRealDir, outputDir, artifact.path, issues, 'artifact');
    if (safe && await fileSha256(safe) !== artifact.sha256) {
      issues.push(proofreadingIssue('proofreading_provider_artifact_drift', `Proofreading artifact hash is stale: ${artifact.path}.`, { path: artifact.path }));
    }
  }
  return { issues, request, result, spec, input };
}

function proofFrontmatter(text) {
  return text.match(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/)?.[0] || '';
}

function proofFencedBlocks(text) {
  const blocks = [];
  let active = null;
  for (const line of text.replaceAll('\r\n', '\n').split('\n')) {
    if (active) {
      active.lines.push(line);
      const closing = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (closing && closing[1][0] === active.marker && closing[1].length >= active.length) {
        blocks.push(active.lines.join('\n'));
        active = null;
      }
      continue;
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,}).*$/);
    if (opening) active = { marker: opening[1][0], length: opening[1].length, lines: [line] };
  }
  if (active) blocks.push(active.lines.join('\n'));
  return blocks;
}

function proofProtectedLiterals(text) {
  const pattern = /\d{4}年\d{1,2}月\d{1,2}日|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|v?\d+(?:\.\d+){1,}|\d+(?:\.\d+)?(?:%|％|元|万元|亿元|天|日|周|月|年|小时|分钟|秒|倍|GB|MB|人|个)?/gi;
  return (text.match(pattern) || []).sort();
}

function proofTargets(text) {
  const prose = withoutDraftingMarkdownCode(text);
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

function proofContainsScore(value) {
  if (Array.isArray(value)) return value.some(proofContainsScore);
  if (typeof value === 'string') return /(?:\bscore\b|rating|grade|评分|得分|评级|分值|内部诊断)\s*[:：=]?\s*\d|\b\d+(?:\.\d+)?\s*(?:\/\s*(?:5|10|100)\b|分)/i.test(value);
  if (!plainObject(value)) return false;
  return Object.entries(value).some(([key, child]) => /score|rating|grade|评级|分值/i.test(key) || proofContainsScore(child));
}

function proofPlaceholder(text) {
  const prose = withoutDraftingMarkdownCode(text);
  return /\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b|待补(?:充|写)?|待确认|\{\{[^{}]+\}\}/i.test(prose);
}

function proofInlineCode(text) {
  return [...withoutDraftingCodeBlocks(text).matchAll(/(`+)([\s\S]*?)\1/g)]
    .map((match) => `${match[1].length}:${match[2]}`).sort();
}

function proofIndentedCode(text) {
  return text.replaceAll('\r\n', '\n').split('\n').filter((line) => /^(?: {4,}|\t)/.test(line));
}

function proofListSignature(text) {
  return withoutDraftingCodeBlocks(text).split('\n').flatMap((line) => {
    const match = line.match(/^(\s*)([-+*]|\d+\.)\s+/);
    return match ? [`${match[1].length}:${/\d/.test(match[2]) ? 'ordered' : 'bullet'}`] : [];
  });
}

function proofreadingPreservationIssues(source, output, path, platform) {
  const issues = [];
  const sourceHeadings = withoutDraftingCodeBlocks(source).match(/^#{1,6}\s+\S.*$/gm) || [];
  const outputHeadings = withoutDraftingCodeBlocks(output).match(/^#{1,6}\s+\S.*$/gm) || [];
  if (proofFrontmatter(source) !== proofFrontmatter(output)) issues.push(proofreadingIssue('proofreading_frontmatter_drift', `Frontmatter changed in ${path}.`, { path }));
  if (!sameJson(sourceHeadings, outputHeadings)) issues.push(proofreadingIssue('proofreading_heading_drift', `Heading text or order changed in ${path}.`, { path }));
  if (!sameJson(proofProtectedLiterals(source), proofProtectedLiterals(output))) issues.push(proofreadingIssue('proofreading_protected_literal_drift', `Protected literals changed in ${path}.`, { path }));
  const sourceTags = source.match(/#[\p{L}\p{N}_-]+/gu) || [];
  const outputTags = output.match(/#[\p{L}\p{N}_-]+/gu) || [];
  if (!sameJson(proofTargets(source), proofTargets(output)) || !sameJson(proofFencedBlocks(source), proofFencedBlocks(output))
    || !sameJson(proofIndentedCode(source), proofIndentedCode(output)) || !sameJson(proofInlineCode(source), proofInlineCode(output))
    || !sameJson(proofListSignature(source), proofListSignature(output))
    || !sameJson(sourceTags.sort(), outputTags.sort())) {
    issues.push(proofreadingIssue('proofreading_markdown_semantic_drift', `Markdown semantics changed in ${path}.`, { path }));
  }
  issues.push(...draftingBodyIssues(output, path, 'editing', platform));
  if (proofPlaceholder(output)) issues.push(proofreadingIssue('incomplete_proofreading_artifact', `Proofreading artifact contains an unresolved placeholder: ${path}.`, { path }));
  return issues;
}

async function validateProofreadingRegression(runDir, spec, phase, afterRelative, issues) {
  const reportRelative = `${spec.base}/reviews/claim-regression-${phase}.json`;
  const reportPath = join(runDir, reportRelative);
  let report = null;
  try {
    const runRealDir = await realpath(runDir);
    const stat = await lstat(reportPath);
    const real = await realpath(reportPath);
    if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(runDir, reportPath) || !inside(runRealDir, real)) {
      issues.push(proofreadingIssue('proofreading_regression_symlink', `Regression report must be a real file inside run_dir: ${reportRelative}.`, { path: reportRelative }));
      return;
    }
    report = await readJson(reportPath);
  } catch (error) {
    issues.push(proofreadingIssue('invalid_proofreading_regression', error.message, { path: reportRelative }));
    return;
  }
  const before = join(runDir, `${spec.base}/draft.md`);
  const after = join(runDir, afterRelative);
  const claims = join(runDir, '02-research/claims.json');
  const expected = {
    before_sha256: await fileSha256(before),
    after_sha256: await fileSha256(after),
    claims_sha256: await fileSha256(claims)
  };
  const semantic = report.semantic_review;
  const semanticChecks = ['new_conclusion', 'scope_change', 'causal_strength', 'factual_addition', 'factual_omission', 'proper_noun_drift'];
  const reviewedAt = Date.parse(semantic?.reviewed_at || '');
  if (report.status !== 'PASS' || report.automatic_status !== 'PASS' || report.phase !== phase
    || resolve(report.before || '') !== before || resolve(report.after || '') !== after || resolve(report.claims || '') !== claims
    || !Array.isArray(report.blockers) || report.blockers.length
    || Object.entries(expected).some(([key, value]) => report[key] !== value)
    || semantic?.status !== 'PASS' || semantic.recorded_by !== 'set-semantic-review.mjs'
    || typeof semantic.reviewer !== 'string' || !semantic.reviewer.trim() || !Number.isFinite(reviewedAt)
    || semanticChecks.some((check) => semantic.checks?.[check] !== 'PASS')
    || Object.entries(expected).some(([key, value]) => semantic?.[key] !== value)) {
    issues.push(proofreadingIssue('invalid_proofreading_regression', `Claim regression is missing, blocked, or stale for ${spec.base}/${phase}.`, { path: reportRelative }));
  }
}

export async function validateProofreadingStage(runDir, state) {
  const issues = [];
  if (state.capabilities?.providers?.proofreading?.status !== 'PASS'
    || state.capabilities?.providers?.proofreading?.contract !== 'proofreading-v1') {
    issues.push(proofreadingIssue('proofreading_provider_unavailable', 'The proofreading provider snapshot is not PASS for proofreading-v1.'));
  }
  if (state.stages?.editing?.status === 'completed') {
    const expectedEditing = expectedProofreadingStageArtifacts();
    const editingBindings = state.stages.editing.artifacts || [];
    const editingPaths = editingBindings.map((item) => item?.path);
    const exact = editingBindings.length === expectedEditing.length
      && new Set(editingPaths).size === expectedEditing.length
      && expectedEditing.every((path) => editingPaths.includes(path))
      && editingBindings.every((item) => /^[a-f0-9]{64}$/.test(item?.sha256 || ''));
    if (!exact) {
      issues.push(proofreadingIssue('invalid_proofreading_editing_binding', 'Completed editing stage must retain the exact canonical 90-file binding.'));
    } else {
      const runRealDir = await realpath(runDir);
      for (const binding of editingBindings) {
        const absolute = resolve(runDir, binding.path);
        let valid = inside(runDir, absolute) && fileExists(absolute);
        if (valid) {
          const stat = await lstat(absolute);
          valid = !stat.isSymbolicLink() && stat.isFile() && !await hasSymlinkComponent(runDir, absolute)
            && inside(runRealDir, await realpath(absolute)) && await fileSha256(absolute) === binding.sha256;
        }
        if (!valid) {
          issues.push(proofreadingIssue('proofreading_editing_binding_drift', `Completed editing artifact is missing, unsafe, or stale: ${binding.path}.`, { path: binding.path }));
        }
      }
    }
  }
  const expectedPlatforms = expectedDraftingStageArtifacts('platforms', state);
  const platformBindings = state.stages?.platforms?.artifacts || [];
  const platformPaths = platformBindings.map((item) => item?.path);
  if (state.stages?.platforms?.status !== 'completed' || platformBindings.length !== expectedPlatforms.length
    || new Set(platformPaths).size !== expectedPlatforms.length || !expectedPlatforms.every((path) => platformPaths.includes(path))) {
    issues.push(proofreadingIssue('invalid_proofreading_platform_binding', 'Proofreading requires the exact completed 40-file platform package.'));
  }

  for (const platform of platforms) {
    const platformRequests = {};
    for (const variant of variants) {
      const validation = await validateProofreadingProviderTask(runDir, state, platform, variant);
      issues.push(...validation.issues);
      if (validation.request) platformRequests[variant] = validation.request;
      if (validation.issues.length || !validation.request) continue;
      const spec = validation.spec;
      const sourcePath = `${spec.base}/draft.md`;
      const source = await readText(join(runDir, sourcePath));
      const checkpointPaths = spec.expected.slice(0, 3);
      for (const path of checkpointPaths) {
        const output = await readText(join(runDir, path));
        issues.push(...proofreadingPreservationIssues(source, output, path, platform));
      }

      const chain = {
        logic: { source: sourcePath, output: checkpointPaths[0], review: spec.expected[3] },
        humanize: { source: checkpointPaths[0], output: checkpointPaths[1], review: spec.expected[4] },
        detail: { source: checkpointPaths[1], output: checkpointPaths[2], review: spec.expected[5] }
      };
      for (const phase of ['logic', 'humanize', 'detail']) {
        const review = await readText(join(runDir, chain[phase].review));
        const reviewBody = withoutDraftingMarkdownCode(review.replace(proofFrontmatter(review), ''))
          .replace(/^#{1,6}\s+.*$/gm, '').replace(/[#>*_\[\](){}|\\-]/g, '').replace(/\s+/g, '');
        const valid = review.trim() && reviewBody.length > 0 && !proofPlaceholder(review)
          && frontmatterValue(review, 'artifact') === 'ProofreadReview'
          && frontmatterValue(review, 'status') === 'PASS'
          && frontmatterValue(review, 'phase') === phase
          && frontmatterValue(review, 'source_path') === chain[phase].source
          && frontmatterValue(review, 'source_sha256') === await fileSha256(join(runDir, chain[phase].source))
          && frontmatterValue(review, 'output_path') === chain[phase].output
          && frontmatterValue(review, 'output_sha256') === await fileSha256(join(runDir, chain[phase].output))
          && (withoutDraftingCodeBlocks(review).match(/^#\s+\S.*$/gm) || []).length === 1;
        if (!valid) issues.push(proofreadingIssue('invalid_proofreading_review', `Review does not bind ${spec.base}/${phase}.`, { path: chain[phase].review }));
      }

      const reportPath = spec.expected[6];
      let report = null;
      try { report = await readJson(join(runDir, reportPath)); } catch (error) {
        issues.push(proofreadingIssue('invalid_proofread_result', error.message, { path: reportPath }));
      }
      if (report) {
        const ledger = report.humanizer_ledger;
        const ledgerValid = Array.isArray(ledger) && ledger.length === 24
          && ledger.every((item, index) => item?.id === index + 1
            && plainObject(item) && sameItems(Object.keys(item), ['id', 'status', 'reason'])
            && ['no_hit', 'changed', 'kept_with_reason'].includes(item.status)
            && (item.status !== 'kept_with_reason' || typeof item.reason === 'string' && Boolean(item.reason.trim())));
        const gatesValid = plainObject(report.hard_gates) && sameItems(Object.keys(report.hard_gates), proofreadingHardGates)
          && proofreadingHardGates.every((key) => report.hard_gates[key] === 'PASS');
        const exactCheckpointBindings = plainObject(report.checkpoints)
          && sameItems(Object.keys(report.checkpoints), ['logic', 'humanize', 'detail']);
        let bindingValid = exactCheckpointBindings;
        if (bindingValid) {
          for (const phase of ['logic', 'humanize', 'detail']) {
            const item = report.checkpoints[phase];
            bindingValid &&= plainObject(item) && sameItems(Object.keys(item), ['path', 'sha256', 'review_path', 'review_sha256'])
              && item.path === chain[phase].output
              && item.sha256 === await fileSha256(join(runDir, chain[phase].output))
              && item.review_path === chain[phase].review
              && item.review_sha256 === await fileSha256(join(runDir, chain[phase].review));
          }
        }
        const changesValid = plainObject(report.changes) && sameItems(Object.keys(report.changes), ['pass_1', 'pass_2', 'pass_3'])
          && Object.values(report.changes).every((value) => typeof value === 'string' && Boolean(value.trim()));
        const exactReport = plainObject(report) && sameItems(Object.keys(report), [
          'schema_version', 'task_id', 'status', 'platform', 'variant', 'source', 'checkpoints',
          'hard_gates', 'humanizer_ledger', 'changes'
        ]);
        if (!exactReport || report.schema_version !== 1 || report.task_id !== validation.request.task_id || report.status !== 'PASS'
          || report.platform !== platform || report.variant !== variant || !sameJson(report.source, validation.request.inputs[0])
          || !ledgerValid || !gatesValid || !bindingValid || !changesValid || proofContainsScore(report)) {
          issues.push(proofreadingIssue('invalid_proofread_result', `Proofread result is incomplete or stale for ${platform}/${variant}.`, { path: reportPath }));
        }
      }
      await validateProofreadingRegression(runDir, spec, 'humanize', checkpointPaths[1], issues);
      await validateProofreadingRegression(runDir, spec, 'final', checkpointPaths[2], issues);
    }
    if (platformRequests.A && platformRequests.B
      && (platformRequests.A.options?.model !== platformRequests.B.options?.model
        || !sameJson(platformRequests.A.options?.parameters, platformRequests.B.options?.parameters))) {
      issues.push(proofreadingIssue('ab_proofreading_request_parameter_mismatch', `${platform} A/B proofreading requests must use the same model and parameters.`, { platform }));
    }
  }
  return { issues };
}

export async function validateTopicDecision(runDir, decisionInput, candidatesInput) {
  const issues = [];
  const decisionPath = expandPath(decisionInput, runDir);
  const candidatesPath = expandPath(candidatesInput, runDir);
  if (!fileExists(decisionPath) || !fileExists(candidatesPath)) return { issues: [issue('missing_topic_artifact', 'Topic approval requires decision and candidates JSON files.')] };
  let decision;
  let data;
  try {
    decision = await readJson(decisionPath);
    data = await readJson(candidatesPath);
  } catch (error) {
    return { issues: [issue('invalid_topic_json', error.message)] };
  }
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  if (candidates.length !== 5) issues.push(issue('incorrect_topic_count', `Expected exactly 5 topic candidates, found ${candidates.length}.`));
  const required = ['id', 'topic', 'reader_problem', 'core_promise', 'material_fit', 'timeliness', 'differentiation', 'evidence_availability', 'risk'];
  const ids = new Set();
  const ranks = new Set();
  let recommendations = 0;
  for (const candidate of candidates) {
    const missing = required.filter((field) => candidate?.[field] === undefined || candidate[field] === null || candidate[field] === '');
    if (missing.length || !Number.isInteger(candidate?.rank) || candidate.rank < 1 || typeof candidate?.recommended !== 'boolean') issues.push(issue('incomplete_topic_candidate', `Topic candidate ${candidate?.id || '(missing id)'} is incomplete.`, { missing }));
    if (ids.has(candidate?.id)) issues.push(issue('duplicate_topic_id', `Duplicate topic id: ${candidate.id}`));
    if (ranks.has(candidate?.rank)) issues.push(issue('duplicate_topic_rank', `Duplicate topic rank: ${candidate.rank}`));
    ids.add(candidate?.id);
    ranks.add(candidate?.rank);
    if (candidate?.recommended) recommendations += 1;
  }
  if (recommendations !== 1) issues.push(issue('invalid_topic_recommendation_count', `Expected exactly one recommended topic, found ${recommendations}.`));
  if (!decision.topic_id || !ids.has(decision.topic_id)) issues.push(issue('topic_decision_mismatch', 'topic-decision topic_id must reference one of the five candidates.'));
  return { issues, candidates, decision };
}

const titleStrategies = new Set([
  'ENTITY_CHANGE', 'IMPACT_SCOPE', 'PROBLEM_ANSWER', 'VALUE_FIRST', 'MECHANISM',
  'CONTRAST', 'EVIDENCE_LED', 'DECISION_GUIDE', 'STRUCTURED_LIST', 'TENSION_GAP',
  'PERSPECTIVE', 'BOUNDARY_CLARITY', 'SEARCH_EXACT', 'UNCERTAINTY_EXPLAINER'
]);
const titleRisks = new Set(['none', 'low', 'medium', 'high']);
const titleCandidateKeys = [
  'id', 'title', 'rank', 'strategy_id', 'recommended', 'promise_map',
  'promise_status', 'risk', 'topic_phrase'
];
const titleResultKeys = [
  'schema_version', 'task_id', 'status', 'platform', 'variant', 'source',
  'target_count', 'recommendation_count', 'candidates'
];
const titleSelectionKeys = [
  'schema_version', 'revision', 'status', 'titles_path', 'titles_sha256',
  'decision_rule', 'selections'
];
const titleSelectionItemKeys = [
  'platform', 'variant', 'title_id', 'title', 'topic_phrase', 'draft_path',
  'draft_sha256', 'decision_rule'
];
const titleDecisionRule = 'promise_status=PASS,risk,recommended,rank,variant=A';

function titleIssue(code, message, extra = {}) {
  return issue(code, message, { resume_from: 'titles', ...extra });
}

function titleDefinition(platform, variant) {
  const base = `06-selection/providers/${platform}/${variant}`;
  return {
    base,
    request: `${base}/title-generation.request.json`,
    result: `${base}/title-generation.result.json`,
    candidate: `${base}/candidates.json`
  };
}

export function titleAggregatePaths(state) {
  const revision = Number.isInteger(state?.stages?.titles?.attempt) && state.stages.titles.attempt > 0
    ? state.stages.titles.attempt : 1;
  const suffix = revision === 1 ? '' : `.v${String(revision).padStart(3, '0')}`;
  return {
    revision,
    titles_path: `06-selection/titles${suffix}.json`,
    matrix_path: `06-selection/title-matrix${suffix}.md`,
    selection_path: `06-selection/selection.v${String(revision).padStart(3, '0')}.json`
  };
}

export function expectedTitleStageArtifacts(state) {
  const aggregate = titleAggregatePaths(state);
  return [
    ...platforms.flatMap((platform) => variants.map((variant) => titleDefinition(platform, variant).candidate)),
    aggregate.titles_path,
    aggregate.matrix_path
  ];
}

function titleTaskId(state, platform, variant) {
  const attempt = state?.stages?.titles?.attempt;
  if (!state?.run_id || !Number.isInteger(attempt) || attempt < 1) return null;
  return `title:${state.run_id}:${platform}:${variant}:attempt-${String(attempt).padStart(3, '0')}`;
}

function validTitleTopicPhrase(value) {
  const match = typeof value === 'string' ? value.match(/^#([^#\r\n]+)#$/u) : null;
  const length = match ? [...match[1].replace(/\s/g, '')].length : 0;
  return Boolean(match) && length >= 4 && length <= 32;
}

async function titleRealFile(runDir, runRealDir, allowedDir, relativePath, issues, kind) {
  const absolute = resolve(runDir, relativePath || '');
  if (!relativePath || !inside(runDir, absolute) || !inside(allowedDir, absolute) || !fileExists(absolute)) {
    issues.push(titleIssue(`missing_title_${kind}`, `Missing canonical title ${kind}: ${relativePath}.`, { path: relativePath }));
    return null;
  }
  try {
    const stat = await lstat(absolute);
    const real = await realpath(absolute);
    if (stat.isSymbolicLink() || !stat.isFile() || await hasSymlinkComponent(runDir, absolute)
      || !inside(runRealDir, real) || !inside(await realpath(allowedDir), real)) {
      issues.push(titleIssue(`title_${kind}_symlink`, `Title ${kind} must be a real file in its canonical directory.`, { path: relativePath }));
      return null;
    }
    return absolute;
  } catch (error) {
    issues.push(titleIssue(`invalid_title_${kind}`, error.message, { path: relativePath }));
    return null;
  }
}

function validateTitleCandidatePayload(payload, request, sourceText, issues) {
  if (!plainObject(payload) || !sameItems(Object.keys(payload), titleResultKeys)
    || payload.schema_version !== 1 || payload.task_id !== request.task_id || payload.status !== 'PASS'
    || payload.platform !== request.platform || payload.variant !== request.variant
    || !sameJson(payload.source, request.inputs[0]) || payload.target_count !== request.options.count
    || payload.recommendation_count !== Math.min(3, request.options.count)
    || !Array.isArray(payload.candidates)) {
    issues.push(titleIssue('invalid_title_candidates', `Candidate result does not bind ${request.platform}/${request.variant} or its exact schema.`));
  }
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  if (candidates.length !== request.options.count) {
    issues.push(titleIssue('invalid_title_candidate_count', `${request.platform}/${request.variant} must contain exactly ${request.options.count} PASS candidates.`, {
      platform: request.platform, variant: request.variant, actual: candidates.length
    }));
  }
  const titles = new Set();
  let recommendationCount = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const rank = index + 1;
    if (!plainObject(candidate) || !sameItems(Object.keys(candidate), titleCandidateKeys)
      || candidate.id !== `${request.platform}-${request.variant}-${rank}` || candidate.rank !== rank
      || typeof candidate.title !== 'string' || !candidate.title.trim()
      || candidate.title !== candidate.title.trim() || /[\r\n]/.test(candidate.title)
      || !titleStrategies.has(candidate.strategy_id) || typeof candidate.recommended !== 'boolean'
      || !Array.isArray(candidate.promise_map) || !candidate.promise_map.length
      || candidate.promise_status !== 'PASS' || !titleRisks.has(candidate.risk)) {
      issues.push(titleIssue('invalid_title_candidate', `Invalid title candidate at ${request.platform}/${request.variant}/${rank}.`, {
        platform: request.platform, variant: request.variant, rank
      }));
      continue;
    }
    if (titles.has(candidate.title)) {
      issues.push(titleIssue('duplicate_title_text', `Duplicate title text within ${request.platform}/${request.variant}: ${candidate.title}`));
    }
    titles.add(candidate.title);
    if (candidate.recommended) recommendationCount += 1;
    const anchors = new Set();
    for (const anchor of candidate.promise_map) {
      if (typeof anchor !== 'string' || !anchor.trim() || anchor !== anchor.trim()
        || anchors.has(anchor) || !sourceText.includes(anchor)) {
        issues.push(titleIssue('unsupported_title_promise', `Candidate ${candidate.id} has a promise anchor absent from its final draft.`, {
          platform: request.platform, variant: request.variant, title_id: candidate.id
        }));
      }
      anchors.add(anchor);
    }
    if (request.platform === 'weibo') {
      if (!validTitleTopicPhrase(candidate.topic_phrase) || candidate.title.includes('#')) {
        issues.push(titleIssue('invalid_weibo_title_structure', `Candidate ${candidate.id} must keep a single-line hook and separate 4-32 character topic phrase.`));
      }
    } else if (candidate.topic_phrase !== null) {
      issues.push(titleIssue('invalid_title_candidate', `Non-Weibo candidate ${candidate.id} must use topic_phrase=null.`));
    }
    if (request.platform === 'wechat') {
      const length = [...candidate.title.replace(/\s/g, '')].length;
      if (!/[\u3400-\u9fff]/u.test(candidate.title) || length < 2 || length > 35) {
        issues.push(titleIssue('invalid_wechat_title', `Candidate ${candidate.id} is incompatible with the WeChat cover title contract.`));
      }
    }
  }
  if (recommendationCount !== Math.min(3, request.options.count)) {
    issues.push(titleIssue('invalid_title_recommendation_count', `${request.platform}/${request.variant} must recommend exactly min(3, count) candidates.`));
  }
}

async function validateTitleProviderTask(runDir, state, platform, variant) {
  const spec = titleDefinition(platform, variant);
  const issues = [];
  const outputDir = resolve(runDir, spec.base);
  let runRealDir;
  try {
    const runStat = await lstat(runDir);
    const outputStat = await lstat(outputDir);
    runRealDir = await realpath(runDir);
    if (runStat.isSymbolicLink() || !runStat.isDirectory() || outputStat.isSymbolicLink()
      || !outputStat.isDirectory() || await hasSymlinkComponent(runDir, outputDir)
      || !inside(runRealDir, await realpath(outputDir))) {
      throw new Error('Run and title output directories must be real directories.');
    }
  } catch (error) {
    return { issues: [titleIssue('invalid_title_output_dir', error.message, { platform, variant })], spec };
  }

  const requestPath = await titleRealFile(runDir, runRealDir, outputDir, spec.request, issues, 'provider_request');
  const resultPath = await titleRealFile(runDir, runRealDir, outputDir, spec.result, issues, 'provider_result');
  const payloadPath = await titleRealFile(runDir, runRealDir, outputDir, spec.candidate, issues, 'candidate_artifact');
  let request = null;
  let result = null;
  let payload = null;
  try { if (requestPath) request = await readJson(requestPath); } catch (error) {
    issues.push(titleIssue('invalid_title_provider_request', error.message, { path: spec.request }));
  }
  try { if (resultPath) result = await readJson(resultPath); } catch (error) {
    issues.push(titleIssue('invalid_title_provider_result', error.message, { path: spec.result }));
  }
  try { if (payloadPath) payload = await readJson(payloadPath); } catch (error) {
    issues.push(titleIssue('invalid_title_candidates', error.message, { path: spec.candidate }));
  }
  if (!request || !result || !payload) {
    return { issues, request, result, payload, spec, requestPath, resultPath, payloadPath };
  }

  const options = request.options;
  const validOptions = plainObject(options)
    && sameItems(Object.keys(options), [
      'count', 'language', 'titles_only', 'old_title', 'brand_reference',
      'verification_scope', 'execution_strategy', 'model', 'parameters'
    ])
    && options.count === titleCounts[platform] && options.language === 'zh-CN'
    && options.titles_only === true && options.old_title === null && options.brand_reference === null
    && options.verification_scope === 'none'
    && ['parallel_subagents', 'sequential_fallback'].includes(options.execution_strategy)
    && typeof options.model === 'string' && Boolean(options.model.trim()) && plainObject(options.parameters);
  const requestKeys = [
    'schema_version', 'contract', 'task_id', 'capability', 'provider_contract', 'run_dir',
    'run_mode', 'mode', 'platform', 'variant', 'inputs', 'output_dir', 'expected_artifacts',
    'options', 'interaction_policy'
  ];
  if (!plainObject(request) || !sameItems(Object.keys(request), requestKeys)
    || request.schema_version !== 1 || request.contract !== 'content-production-provider/v1'
    || request.capability !== 'title_generation' || request.provider_contract !== 'title-generation-v1'
    || request.task_id !== titleTaskId(state, platform, variant) || !isAbsolute(request.run_dir || '')
    || resolve(request.run_dir || '') !== resolve(runDir) || request.run_mode !== state.run_mode
    || request.mode !== 'generate_titles' || request.platform !== platform || request.variant !== variant
    || request.output_dir !== spec.base || request.interaction_policy !== 'return_to_orchestrator'
    || !sameItems(request.expected_artifacts, [spec.candidate]) || !validOptions) {
    issues.push(titleIssue('invalid_title_provider_request', `Canonical title request does not match ${platform}/${variant} or the current titles attempt.`, { path: spec.request }));
  }

  const sourceRelative = `05-platforms/${platform}/${variant}/final.md`;
  const input = Array.isArray(request.inputs) && request.inputs.length === 1 ? request.inputs[0] : null;
  const editingBinding = (state.stages?.editing?.artifacts || []).find((item) => item.path === sourceRelative);
  const sourcePath = join(runDir, sourceRelative);
  if (!input || input.role !== 'final_draft' || input.path !== sourceRelative
    || !/^[a-f0-9]{64}$/.test(input.sha256 || '') || !editingBinding
    || editingBinding.sha256 !== input.sha256 || !fileExists(sourcePath)) {
    issues.push(titleIssue('invalid_title_provider_input', `Title generation must bind only the completed ${platform}/${variant} final draft.`, { path: sourceRelative }));
  } else {
    const safe = await titleRealFile(runDir, runRealDir, resolve(runDir, `05-platforms/${platform}/${variant}`), sourceRelative, issues, 'input');
    if (safe && await fileSha256(safe) !== input.sha256) {
      issues.push(titleIssue('title_provider_input_drift', `Final draft input hash is stale: ${sourceRelative}.`, { path: sourceRelative }));
    }
  }

  const resultKeys = [
    'schema_version', 'contract', 'provider_contract', 'task_id', 'request_sha256',
    'status', 'artifacts', 'checks', 'issues', 'warnings'
  ];
  if (!plainObject(result) || !sameItems(Object.keys(result), resultKeys)
    || result.schema_version !== 1 || result.contract !== 'content-production-provider/v1'
    || result.provider_contract !== 'title-generation-v1' || result.task_id !== request.task_id
    || result.request_sha256 !== await fileSha256(requestPath) || result.status !== 'PASS'
    || !plainObject(result.checks) || result.checks.request_valid !== true
    || result.checks.mode !== 'generate_titles' || !Array.isArray(result.issues) || result.issues.length
    || !Array.isArray(result.warnings) || !Array.isArray(result.artifacts)
    || result.artifacts.length !== 1 || result.artifacts[0]?.role !== 'title_candidates'
    || result.artifacts[0]?.path !== spec.candidate
    || result.artifacts[0]?.sha256 !== await fileSha256(payloadPath)) {
    issues.push(titleIssue('invalid_title_provider_result', `Canonical title result is not a matching PASS for ${platform}/${variant}.`, { path: spec.result }));
  }

  const sourceText = fileExists(sourcePath) ? await readText(sourcePath) : '';
  validateTitleCandidatePayload(payload, request, sourceText, issues);
  return { issues, request, result, payload, spec, requestPath, resultPath, payloadPath };
}

export async function collectTitleProviderTasks(runDir, state) {
  const issues = [];
  const tasks = [];
  if (state.capabilities?.providers?.title_generation?.status !== 'PASS'
    || state.capabilities?.providers?.title_generation?.contract !== 'title-generation-v1') {
    issues.push(titleIssue('title_provider_unavailable', 'The title provider snapshot is not PASS for title-generation-v1.'));
  }
  if (state.stages?.editing?.status !== 'completed') {
    issues.push(titleIssue('title_prerequisite_missing', 'Title generation requires completed editing.'));
  } else {
    const expectedEditing = expectedProofreadingStageArtifacts();
    const editingPaths = (state.stages.editing.artifacts || []).map((item) => item?.path);
    if (editingPaths.length !== expectedEditing.length
      || new Set(editingPaths).size !== expectedEditing.length
      || !expectedEditing.every((path) => editingPaths.includes(path))) {
      issues.push(titleIssue('title_prerequisite_binding_invalid', 'Title generation requires the exact completed 90-file proofreading package.'));
    }
    const proofreading = await validateProofreadingStage(runDir, state);
    issues.push(...proofreading.issues);
  }
  for (const platform of platforms) {
    const platformTasks = {};
    for (const variant of variants) {
      const validation = await validateTitleProviderTask(runDir, state, platform, variant);
      issues.push(...validation.issues);
      tasks.push({ platform, variant, validation });
      if (validation.request) platformTasks[variant] = validation.request;
    }
    if (platformTasks.A && platformTasks.B
      && (platformTasks.A.options?.model !== platformTasks.B.options?.model
        || !sameJson(platformTasks.A.options?.parameters, platformTasks.B.options?.parameters))) {
      issues.push(titleIssue('ab_title_request_parameter_mismatch', `${platform} A/B title requests must use the same model and parameters.`, { platform }));
    }
  }
  return { issues, tasks };
}

export function selectTitleWinners(titles) {
  const riskOrder = { none: 0, low: 1, medium: 2, high: 3 };
  const selections = [];
  for (const platform of platforms) {
    const candidates = variants.flatMap((variant) => {
      const source = titles?.platforms?.[platform]?.[variant];
      return (source?.candidates || []).map((candidate) => ({ candidate, source, variant }));
    }).filter((item) => item.candidate.promise_status === 'PASS');
    candidates.sort((left, right) => riskOrder[left.candidate.risk] - riskOrder[right.candidate.risk]
      || Number(right.candidate.recommended) - Number(left.candidate.recommended)
      || left.candidate.rank - right.candidate.rank
      || left.variant.localeCompare(right.variant)
      || left.candidate.id.localeCompare(right.candidate.id));
    const winner = candidates[0];
    if (!winner) continue;
    selections.push({
      platform,
      variant: winner.variant,
      title_id: winner.candidate.id,
      title: winner.candidate.title,
      topic_phrase: winner.candidate.topic_phrase,
      draft_path: winner.source.draft_path,
      draft_sha256: winner.source.draft_sha256,
      decision_rule: titleDecisionRule
    });
  }
  return selections;
}

export function renderTitleMatrix(titles, selection) {
  const lines = [
    '---', 'artifact: TitleMatrix', 'status: PASS', 'provider_contract: title-generation-v1',
    `attempt: ${titles.attempt}`, '---', '', '# 标题矩阵', ''
  ];
  for (const platform of platforms) {
    lines.push(`## ${platform}`, '');
    for (const variant of variants) {
      lines.push(`### ${variant}`, '');
      for (const candidate of titles.platforms?.[platform]?.[variant]?.candidates || []) {
        lines.push(`- ${candidate.id} | rank=${candidate.rank} | risk=${candidate.risk} | recommended=${candidate.recommended} | strategy=${candidate.strategy_id}`);
        lines.push(`  - ${candidate.title}`);
        if (candidate.topic_phrase) lines.push(`  - ${candidate.topic_phrase}`);
      }
      lines.push('');
    }
  }
  lines.push('## 入选结果', '');
  for (const item of selection.selections || []) {
    lines.push(`- ${item.platform}: ${item.title_id} | ${item.title}${item.topic_phrase ? ` | ${item.topic_phrase}` : ''}`);
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export async function validateTitleGenerationStage(runDir, state) {
  const collected = await collectTitleProviderTasks(runDir, state);
  const issues = [...collected.issues];
  const paths = titleAggregatePaths(state);
  const selectionDir = resolve(runDir, '06-selection');
  let runRealDir = null;
  try {
    const runStat = await lstat(runDir);
    const selectionStat = await lstat(selectionDir);
    runRealDir = await realpath(runDir);
    if (runStat.isSymbolicLink() || !runStat.isDirectory() || selectionStat.isSymbolicLink()
      || !selectionStat.isDirectory() || await hasSymlinkComponent(runDir, selectionDir)
      || !inside(runRealDir, await realpath(selectionDir))) {
      throw new Error('06-selection must be a real directory inside run_dir.');
    }
  } catch (error) {
    issues.push(titleIssue('invalid_title_selection_dir', error.message));
  }
  const titlesPath = runRealDir
    ? await titleRealFile(runDir, runRealDir, selectionDir, paths.titles_path, issues, 'aggregate') : null;
  const matrixPath = runRealDir
    ? await titleRealFile(runDir, runRealDir, selectionDir, paths.matrix_path, issues, 'aggregate') : null;
  const selectionPath = runRealDir
    ? await titleRealFile(runDir, runRealDir, selectionDir, paths.selection_path, issues, 'selection') : null;
  let titles = null;
  let selection = null;
  try { if (titlesPath) titles = await readJson(titlesPath); } catch (error) {
    issues.push(titleIssue('invalid_titles_aggregate', error.message, { path: paths.titles_path }));
  }
  try { if (selectionPath) selection = await readJson(selectionPath); } catch (error) {
    issues.push(titleIssue('invalid_title_selection', error.message, { path: paths.selection_path }));
  }
  let matrix = null;
  try { if (matrixPath) matrix = await readText(matrixPath); } catch (error) {
    issues.push(titleIssue('invalid_title_matrix', error.message, { path: paths.matrix_path }));
  }

  const expectedPlatforms = {};
  for (const platform of platforms) expectedPlatforms[platform] = {};
  for (const task of collected.tasks) {
    const value = task.validation;
    if (!value.request || !value.result || !value.payload || !value.requestPath || !value.resultPath || !value.payloadPath) continue;
    expectedPlatforms[task.platform][task.variant] = {
      task_id: value.request.task_id,
      request_path: value.spec.request,
      request_sha256: await fileSha256(value.requestPath),
      result_path: value.spec.result,
      result_sha256: await fileSha256(value.resultPath),
      candidate_path: value.spec.candidate,
      candidate_sha256: await fileSha256(value.payloadPath),
      draft_path: value.request.inputs[0].path,
      draft_sha256: value.request.inputs[0].sha256,
      candidates: value.payload.candidates
    };
  }
  const expectedTitles = {
    schema_version: 1,
    provider_contract: 'title-generation-v1',
    attempt: paths.revision,
    platforms: expectedPlatforms
  };
  if (titles && !sameJson(titles, expectedTitles)) {
    issues.push(titleIssue('title_aggregate_drift', 'titles aggregate does not exactly mirror the ten current provider tasks.', { path: paths.titles_path }));
  }
  const expectedSelections = titles ? selectTitleWinners(titles) : [];
  const expectedSelection = titles && titlesPath ? {
    schema_version: 1,
    revision: paths.revision,
    status: 'PROPOSED',
    titles_path: paths.titles_path,
    titles_sha256: await fileSha256(titlesPath),
    decision_rule: titleDecisionRule,
    selections: expectedSelections
  } : null;
  const reviewedDecision = state.run_mode === 'reviewed' && state.stages?.titles?.status === 'completed';
  if (!reviewedDecision && selection && expectedSelection && !sameJson(selection, expectedSelection)) {
    issues.push(titleIssue('title_selection_policy_mismatch', 'Proposed selection does not follow the deterministic title decision rule.', { path: paths.selection_path }));
  }
  if (titles && expectedSelection && matrix !== renderTitleMatrix(titles, expectedSelection)) {
    issues.push(titleIssue('title_matrix_drift', 'Title matrix does not exactly render the active aggregate and selection.', { path: paths.matrix_path }));
  }
  if (titles && selection) {
    const validation = await validateTitlesAndSelection(runDir, paths.selection_path, paths.titles_path, { autonomous: !reviewedDecision });
    issues.push(...validation.issues.map((item) => ({ ...item, resume_from: 'titles' })));
  }
  if (state.stages?.titles?.status === 'completed') {
    const expected = expectedTitleStageArtifacts(state);
    const bindings = state.stages.titles.artifacts || [];
    const bindingPaths = bindings.map((item) => item?.path);
    if (bindings.length !== expected.length || new Set(bindingPaths).size !== expected.length
      || !expected.every((path) => bindingPaths.includes(path))) {
      issues.push(titleIssue('invalid_title_stage_binding', 'Completed titles stage must retain the exact canonical 12-file binding.'));
    } else {
      let runRealDir = null;
      try { runRealDir = await realpath(runDir); } catch (error) {
        issues.push(titleIssue('invalid_title_stage_binding', error.message));
      }
      for (const binding of bindings) {
        const absolute = resolve(runDir, binding.path);
        try {
          const stat = await lstat(absolute);
          const real = await realpath(absolute);
          if (!inside(runDir, absolute) || stat.isSymbolicLink() || !stat.isFile()
            || await hasSymlinkComponent(runDir, absolute) || !runRealDir || !inside(runRealDir, real)) {
            issues.push(titleIssue('title_stage_artifact_symlink', `Completed title artifact must be a real file inside run_dir: ${binding.path}.`, { path: binding.path }));
          } else if (!/^[a-f0-9]{64}$/.test(binding.sha256 || '')
            || await fileSha256(absolute) !== binding.sha256) {
            issues.push(titleIssue('title_stage_artifact_drift', `Completed title artifact changed: ${binding.path}.`, { path: binding.path }));
          }
        } catch (error) {
          issues.push(titleIssue('title_stage_artifact_missing', `Completed title artifact is unavailable: ${binding.path}.`, { path: binding.path }));
        }
      }
    }
  }
  return { issues, total: titles ? platforms.reduce((sum, platform) => sum
    + variants.reduce((count, variant) => count + (titles.platforms?.[platform]?.[variant]?.candidates?.length || 0), 0), 0) : 0 };
}

export async function validateTitlesAndSelection(runDir, selectionInput = '06-selection/selection.v001.json', titlesInput = '06-selection/titles.json', { autonomous = false } = {}) {
  const issues = [];
  const titlesPath = expandPath(titlesInput, runDir);
  const selectionPath = expandPath(selectionInput, runDir);
  if (!fileExists(titlesPath)) return { issues: [issue('missing_titles', `Missing titles artifact: ${titlesInput}`)], total: 0, selections: [] };
  if (!fileExists(selectionPath)) return { issues: [issue('missing_selection', `Missing selection decision: ${selectionInput}`)], total: 0, selections: [] };

  let titles;
  let decision;
  try {
    titles = await readJson(titlesPath);
    decision = await readJson(selectionPath);
  } catch (error) {
    return { issues: [issue('invalid_selection_json', error.message)], total: 0, selections: [] };
  }

  const selectionRelative = relativeTo(runDir, selectionPath);
  const titlesRelative = relativeTo(runDir, titlesPath);
  const revision = Number(selectionRelative.match(/selection\.v(\d{3})\.json$/)?.[1]);
  const validDecision = plainObject(decision) && sameItems(Object.keys(decision), titleSelectionKeys)
    && decision.schema_version === 1 && Number.isInteger(revision) && revision > 0
    && decision.revision === revision && decision.status === 'PROPOSED'
    && decision.titles_path === titlesRelative
    && decision.titles_sha256 === await fileSha256(titlesPath)
    && typeof decision.decision_rule === 'string' && Boolean(decision.decision_rule.trim())
    && Array.isArray(decision.selections);
  if (!validDecision) {
    issues.push(issue('title_selection_lineage_mismatch', 'Selection must bind the active titles path/hash, revision, status, and exact schema.'));
  }

  let total = 0;
  const ids = new Set();
  const indexed = new Map();
  for (const platform of platforms) {
    for (const variant of variants) {
      const source = titles?.platforms?.[platform]?.[variant];
      const candidates = source?.candidates;
      if (!Array.isArray(candidates) || candidates.length !== titleCounts[platform]) {
        issues.push(issue('incorrect_title_count', `${platform}/${variant} must have exactly ${titleCounts[platform]} titles.`, { platform, variant, actual: candidates?.length ?? null }));
        continue;
      }
      total += candidates.length;
      const groupTitleTexts = new Set();
      const groupRanks = new Set();
      let recommendationCount = 0;
      let sourceText = '';
      const expectedDraft = `05-platforms/${platform}/${variant}/final.md`;
      if (source.draft_path !== expectedDraft) {
        issues.push(issue('title_draft_path_mismatch', `${platform}/${variant} titles must bind ${expectedDraft}.`, { platform, variant }));
      } else {
        const absoluteDraft = join(runDir, expectedDraft);
        if (!fileExists(absoluteDraft)) {
          issues.push(issue('missing_title_source_draft', `Missing title source draft: ${expectedDraft}`, { platform, variant }));
        } else {
          sourceText = await readText(absoluteDraft);
          if (source.draft_sha256 !== await fileSha256(absoluteDraft)) {
            issues.push(issue('title_source_drift', `Title source draft changed for ${platform}/${variant}.`, { platform, variant }));
          }
        }
      }
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const expectedRank = index + 1;
        if (!plainObject(candidate) || !sameItems(Object.keys(candidate), titleCandidateKeys)
          || candidate.id !== `${platform}-${variant}-${expectedRank}` || candidate.rank !== expectedRank
          || typeof candidate.title !== 'string' || !candidate.title.trim()
          || candidate.title !== candidate.title.trim() || /[\r\n]/.test(candidate.title)
          || !titleStrategies.has(candidate.strategy_id) || typeof candidate.recommended !== 'boolean'
          || !Array.isArray(candidate.promise_map) || !candidate.promise_map.length
          || candidate.promise_status !== 'PASS' || !titleRisks.has(candidate.risk)) {
          issues.push(issue('invalid_title_candidate', `Invalid title candidate at ${platform}/${variant}/${expectedRank}.`, { platform, variant, rank: expectedRank }));
          continue;
        }
        if (ids.has(candidate.id)) issues.push(issue('duplicate_title_id', `Duplicate title id: ${candidate.id}`));
        if (groupTitleTexts.has(candidate.title)) issues.push(issue('duplicate_title_text', `Duplicate title text within ${platform}/${variant}: ${candidate.title}`));
        if (groupRanks.has(candidate.rank)) issues.push(issue('duplicate_title_rank', `Duplicate title rank within ${platform}/${variant}: ${candidate.rank}`));
        groupRanks.add(candidate.rank);
        if (candidate.recommended) recommendationCount += 1;
        const anchors = new Set();
        for (const anchor of candidate.promise_map) {
          if (typeof anchor !== 'string' || !anchor.trim() || anchor !== anchor.trim()
            || anchors.has(anchor) || !sourceText.includes(anchor)) {
            issues.push(issue('unsupported_title_promise', `Candidate ${candidate.id} has a promise anchor absent from its final draft.`, { platform, variant, title_id: candidate.id }));
          }
          anchors.add(anchor);
        }
        if (platform === 'weibo') {
          if (!validTitleTopicPhrase(candidate.topic_phrase) || candidate.title.includes('#')) {
            issues.push(issue('invalid_weibo_title_structure', `Candidate ${candidate.id} must keep a single-line hook and separate 4-32 character topic phrase.`, { platform, variant }));
          }
        } else if (candidate.topic_phrase !== null) {
          issues.push(issue('invalid_title_candidate', `Non-Weibo candidate ${candidate.id} must use topic_phrase=null.`, { platform, variant }));
        }
        if (platform === 'wechat') {
          const length = [...candidate.title.replace(/\s/g, '')].length;
          if (!/[\u3400-\u9fff]/u.test(candidate.title) || length < 2 || length > 35) {
            issues.push(issue('invalid_wechat_title', `Candidate ${candidate.id} is incompatible with the WeChat cover title contract.`, { platform, variant }));
          }
        }
        ids.add(candidate.id);
        groupTitleTexts.add(candidate.title);
        indexed.set(candidate.id, { ...candidate, platform, variant, source });
      }
      if (recommendationCount !== Math.min(3, titleCounts[platform])) {
        issues.push(issue('invalid_title_recommendation_count', `${platform}/${variant} must recommend exactly min(3, count) candidates.`, { platform, variant, actual: recommendationCount }));
      }
    }
  }
  if (total !== 34) issues.push(issue('incorrect_title_total', `Expected exactly 34 titles, found ${total}.`, { actual: total }));

  const selections = Array.isArray(decision?.selections) ? decision.selections : [];
  if (selections.length !== platforms.length) {
    issues.push(issue('incorrect_selection_count', `Selection decision must contain exactly ${platforms.length} entries.`, { actual: selections.length }));
  }
  const selectedPlatforms = new Set();
  for (const selection of selections) {
    if (!plainObject(selection) || !sameItems(Object.keys(selection), titleSelectionItemKeys)
      || selection.decision_rule !== decision?.decision_rule) {
      issues.push(issue('invalid_title_selection', 'Every selection must use the exact schema and top-level decision rule.', { platform: selection?.platform }));
      continue;
    }
    if (!platforms.includes(selection.platform) || selectedPlatforms.has(selection.platform)) {
      issues.push(issue('invalid_selection_platform', `Invalid or duplicate selection platform: ${selection.platform}`));
      continue;
    }
    selectedPlatforms.add(selection.platform);
    if (!variants.includes(selection.variant)) {
      issues.push(issue('invalid_selection_variant', `Invalid variant for ${selection.platform}: ${selection.variant}`));
      continue;
    }
    const candidate = indexed.get(selection.title_id);
    if (!candidate || candidate.platform !== selection.platform || candidate.variant !== selection.variant) {
      issues.push(issue('title_selection_mismatch', `Selected title does not belong to ${selection.platform}/${selection.variant}.`, { platform: selection.platform, title_id: selection.title_id }));
      continue;
    }
    if (candidate.promise_status !== 'PASS') {
      issues.push(issue('title_promise_unverified', `Selected title promise is not supported by the body: ${selection.title_id}`, { platform: selection.platform, title_id: selection.title_id }));
    }
    if (selection.title !== candidate.title) {
      issues.push(issue('selection_title_mismatch', `Selected title text does not match ${selection.title_id}.`, { platform: selection.platform }));
    }
    if (selection.topic_phrase !== candidate.topic_phrase) {
      issues.push(issue('selection_topic_mismatch', `Selected topic phrase does not match ${selection.title_id}.`, { platform: selection.platform }));
    }
    const expectedPath = `05-platforms/${selection.platform}/${selection.variant}/final.md`;
    const draftPath = expandPath(selection.draft_path, runDir);
    if (selection.draft_path !== expectedPath || !fileExists(draftPath)) {
      issues.push(issue('selection_draft_mismatch', `Selection must bind ${expectedPath}.`, { platform: selection.platform }));
    } else {
      const actual = await fileSha256(draftPath);
      if (selection.draft_sha256 !== actual || selection.draft_sha256 !== candidate.source.draft_sha256) {
        issues.push(issue('selection_draft_drift', `Selected draft hash is stale for ${selection.platform}.`, { platform: selection.platform }));
      }
    }
  }
  for (const platform of platforms) {
    if (!selectedPlatforms.has(platform)) issues.push(issue('missing_platform_selection', `Missing selection for ${platform}.`, { platform }));
  }
  if (autonomous) {
    if (decision?.decision_rule !== titleDecisionRule) {
      issues.push(issue('title_selection_policy_mismatch', 'Autonomous selection must record the canonical title decision rule.'));
    }
    const expected = selectTitleWinners(titles);
    for (const winner of expected) {
      const actual = selections.find((item) => item.platform === winner.platform);
      if (!actual || actual.variant !== winner.variant || actual.title_id !== winner.title_id) {
        issues.push(issue('title_selection_policy_mismatch', `Autonomous selection does not follow the deterministic rule for ${winner.platform}.`, { platform: winner.platform }));
      }
    }
  }

  return {
    issues,
    total,
    selections,
    titles_path: relativeTo(runDir, titlesPath),
    selection_path: relativeTo(runDir, selectionPath)
  };
}

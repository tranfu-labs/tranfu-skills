#!/usr/bin/env node
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import {
  validateProofreadingStage,
  validateTitleGenerationStage,
  validateTitlesAndSelection,
  validateTopicDecision
} from './contracts.mjs';
import {
  illustrationPaths,
  validateIllustrationGeneration
} from './illustration-contracts.mjs';
import {
  coverPaths,
  validateWechatCover
} from './wechat-cover-contracts.mjs';
import { recountGeneratedVisualAssets } from './visual-cardinality.mjs';
import {
  compressionPlanPath,
  compressionProviderRequired,
  packagePaths,
  validatePublishPackages
} from './package-contracts.mjs';
import {
  validateWechatLayoutDelivery,
  wechatLayoutPaths,
  wechatLayoutProviderRequired
} from './wechat-layout-contracts.mjs';
import {
  artifactBinding,
  emitJson,
  expandPath,
  fileExists,
  fileSha256,
  filesUnder,
  gateIntegrity,
  hasPlaceholder,
  htmlImageRefs,
  isLocalRef,
  markdownImageRefs,
  parseArgs,
  platforms,
  pngDimensions,
  requiredCapabilities,
  readJson,
  readText,
  relativeTo,
  variants,
  verifyQaFingerprints,
  writeJson,
  writeText
} from './lib.mjs';
import { ENGINE_VERSION as CLAIM_ENGINE_VERSION } from '../skills/proofread-content/scripts/claim-regression.mjs';

const args = parseArgs(process.argv.slice(2));
const runDir = expandPath(args._[0]);
const issues = [];
let state = null;

function add(code, message, extra = {}) {
  issues.push({ code, message, ...extra });
}

function activeBinding(state, gate, pattern, fallback, label) {
  const matches = (state.gates?.[gate]?.bound_artifacts || []).filter((binding) => pattern.test(binding.path));
  if (matches.length > 1) add('ambiguous_active_artifact', `Gate ${gate} binds multiple ${label} artifacts.`, { gate, paths: matches.map((item) => item.path) });
  if (!matches.length && state.gates?.[gate]?.status === 'approved') add('active_artifact_not_bound', `Approved gate ${gate} does not bind ${label}.`, { gate });
  return matches.at(-1)?.path || fallback;
}

function normalizeVisibleText(text) {
  return text
    .replace(/&nbsp;|&#160;/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/[\s`*_#>\[\](){}|:：;；,.，。!！?？、\-—]/g, '');
}

function markdownBodySegments(markdown) {
  const withoutFirstHeading = markdown.replace(/^#\s+[^\n]+\n?/, '');
  return withoutFirstHeading
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n+/)
    .map((line) => normalizeVisibleText(line.replace(/^\s*(?:#{1,6}|[-+*]|\d+[.)])\s*/, '')))
    .filter((line) => line.length >= 2);
}

function htmlVisibleText(html) {
  return normalizeVisibleText(html
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '')
    .replace(/<[^>]+>/g, ' '));
}

async function requiredText(path, code = 'missing_artifact', placeholderOptions = {}) {
  if (!fileExists(path)) {
    add(code, `Missing required artifact: ${relativeTo(runDir, path)}`, { path: relativeTo(runDir, path) });
    return null;
  }
  const content = await readText(path);
  if (!content.trim() || hasPlaceholder(content, placeholderOptions)) add('incomplete_artifact', `Artifact is empty or contains a placeholder: ${relativeTo(runDir, path)}`, { path: relativeTo(runDir, path) });
  return content;
}

async function requiredJson(path, code = 'missing_artifact') {
  if (!fileExists(path)) {
    add(code, `Missing required artifact: ${relativeTo(runDir, path)}`, { path: relativeTo(runDir, path) });
    return null;
  }
  try {
    return await readJson(path);
  } catch (error) {
    add('invalid_json', `Invalid JSON at ${relativeTo(runDir, path)}: ${error.message}`, { path: relativeTo(runDir, path) });
    return null;
  }
}

async function checkImageRefs(documentPath, refs, code = 'missing_image_reference') {
  if (!refs.length) add('missing_image_manifest', `No image references found in ${relativeTo(runDir, documentPath)}.`, { path: relativeTo(runDir, documentPath) });
  for (const ref of refs) {
    if (!isLocalRef(ref)) {
      add('nonlocal_image_reference', `Final package must use local image references: ${ref}`, { path: relativeTo(runDir, documentPath) });
      continue;
    }
    const path = expandPath(ref, dirname(documentPath));
    const fromDocument = relative(dirname(documentPath), path);
    if (isAbsolute(ref) || fromDocument === '..' || fromDocument.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
      add('image_path_escape', `Image reference escapes the publish pack: ${ref}`, { path: relativeTo(runDir, documentPath), ref });
      continue;
    }
    if (!fileExists(path)) add(code, `Image reference does not resolve: ${ref}`, { path: relativeTo(runDir, documentPath), ref });
  }
}

async function regression(path, beforePath, afterPath, claimsPath, phase) {
  const report = await requiredJson(path, 'missing_claim_regression');
  if (!report) return;
  if (report.status !== 'PASS' || report.blockers?.length) add('claim_regression_blocked', `Claim regression is not PASS: ${relativeTo(runDir, path)}`, { path: relativeTo(runDir, path) });
  const expected = {
    before_sha256: await fileSha256(beforePath),
    after_sha256: await fileSha256(afterPath),
    claims_sha256: await fileSha256(claimsPath)
  };
  for (const [field, value] of Object.entries(expected)) {
    if (report[field] !== value) add('claim_regression_stale', `${field} is stale in ${relativeTo(runDir, path)}.`, { path: relativeTo(runDir, path), field });
  }
  if (report.phase !== phase) add('claim_regression_phase_mismatch', `Expected phase ${phase} in ${relativeTo(runDir, path)}.`, { path: relativeTo(runDir, path) });
  if (state.capabilities?.providers?.proofreading?.profile === 'markdown-alignment'
    && (report.engine_version !== CLAIM_ENGINE_VERSION || !['IDENTICAL', 'ALIGNED'].includes(report.alignment_status))) {
    add('claim_regression_engine_mismatch', `Claim regression does not use ${CLAIM_ENGINE_VERSION}: ${relativeTo(runDir, path)}.`, { path: relativeTo(runDir, path) });
  }
  const semantic = report.semantic_review;
  const semanticChecks = ['new_conclusion', 'scope_change', 'causal_strength', 'factual_addition', 'factual_omission', 'proper_noun_drift'];
  if (semantic?.status !== 'PASS' || semantic.recorded_by !== 'set-semantic-review.mjs'
    || typeof semantic.reviewer !== 'string' || !semantic.reviewer.trim() || !Number.isFinite(Date.parse(semantic.reviewed_at || ''))
    || semanticChecks.some((check) => semantic.checks?.[check] !== 'PASS')) {
    add('semantic_review_blocked', `Semantic claim review is not fully PASS: ${relativeTo(runDir, path)}.`, { path: relativeTo(runDir, path) });
  }
  for (const field of ['before_sha256', 'after_sha256', 'claims_sha256']) {
    if (semantic?.[field] !== expected[field]) add('semantic_review_stale', `Semantic review ${field} is stale in ${relativeTo(runDir, path)}.`, { path: relativeTo(runDir, path), field });
  }
}

try {
  if (!runDir || !fileExists(join(runDir, 'run.json'))) throw new Error('Usage: verify-run.mjs <run-dir>');
  const statePath = join(runDir, 'run.json');
  state = await readJson(statePath);
  const integrity = await gateIntegrity(runDir, state);
  issues.push(...integrity.map((item) => ({ ...item, message: item.message || `Approved artifact integrity failed for ${item.path}.` })));
  if (state.capabilities?.status !== 'PASS') add('capability_snapshot_blocked', 'Run capability preflight is not PASS.');
  for (const id of requiredCapabilities) {
    const provider = state.capabilities?.providers?.[id];
    if (!provider || provider.status !== 'PASS' || !/^[a-f0-9]{64}$/.test(provider.skill_sha256 || '')) {
      add('capability_provider_invalid', `Capability provider is missing, blocked, or unhashed: ${id}.`, { capability: id });
    }
  }
  for (const [id, snapshot] of Object.entries(state.snapshots || {})) {
    if (!snapshot?.snapshot_path || !snapshot.sha256) continue;
    const path = join(runDir, snapshot.snapshot_path);
    if (!fileExists(path)) add('input_snapshot_missing', `Input snapshot is missing: ${snapshot.snapshot_path}`, { snapshot: id });
    else if (await fileSha256(path) !== snapshot.sha256) add('input_snapshot_drift', `Input snapshot changed: ${snapshot.snapshot_path}`, { snapshot: id });
  }
  for (const id of ['brief', 'core_audience', 'platform_profiles', 'style_b', 'materials', 'topic_history', 'article_audience']) {
    if (!state.snapshots?.[id]?.snapshot_path || !/^[a-f0-9]{64}$/.test(state.snapshots?.[id]?.sha256 || '')) {
      add('required_snapshot_missing', `Required run snapshot is missing or unhashed: ${id}.`, { snapshot: id });
    }
  }
  const profileSnapshotPath = state.snapshots?.platform_profiles?.snapshot_path
    ? join(runDir, state.snapshots.platform_profiles.snapshot_path) : null;
  const platformProfileConfig = profileSnapshotPath && fileExists(profileSnapshotPath)
    ? await requiredJson(profileSnapshotPath, 'missing_platform_profiles_snapshot') : null;

  if (state.status === 'completed' && state.gates?.final?.status === 'approved' && !issues.length) {
    const existing = await requiredJson(join(runDir, '09-qa', 'qa.json'));
    issues.push(...await verifyQaFingerprints(runDir, existing));
    const ready = existing?.status === 'READY' && Array.isArray(existing.artifact_fingerprints) && existing.artifact_fingerprints.length && !issues.length;
    emitJson(ready ? existing : { status: 'BLOCKED', issues }, ready ? 0 : 2);
    process.exit();
  }

  for (const gate of ['topic', 'outline', 'titles', 'visual']) {
    if (state.gates?.[gate]?.status !== 'approved') add('gate_not_approved', `Gate ${gate} must be approved before final QA.`, { gate });
  }
  for (const stage of ['research', 'outline', 'masters', 'platforms', 'editing', 'titles', 'visual', 'package']) {
    if (state.stages && state.stages[stage]?.status !== 'completed') add('stage_not_completed', `Stage ${stage} must be completed before final QA.`, { stage });
  }

  if (['brief', 'standard'].includes(state.mode)) {
    await requiredText(join(runDir, '01-discovery', 'discovery.md'));
    await requiredText(join(runDir, '01-discovery', 'topic-candidates.md'));
    const candidatesRef = activeBinding(state, 'topic', /(?:^|\/)topic-candidates(?:\.v\d{3})?\.json$/, '01-discovery/topic-candidates.json', 'topic candidates JSON');
    if (!state.gates?.topic?.decision_ref?.path) {
      add('topic_decision_not_bound', 'Standard mode topic gate must bind a versioned topic decision file.');
    } else {
      const topicResult = await validateTopicDecision(runDir, state.gates.topic.decision_ref.path, candidatesRef);
      issues.push(...topicResult.issues);
    }
  } else if (['topic_provided', 'outline_provided'].includes(state.mode)) {
    const skip = await requiredJson(join(runDir, '01-discovery', 'skip.json'), 'missing_discovery_skip');
    if (skip && (skip.status !== 'SKIPPED' || skip.mode !== state.mode || !skip.reason || !/^[a-f0-9]{64}$/.test(skip.input_sha256 || ''))) {
      add('invalid_discovery_skip', 'Fast entry requires a valid discovery skip record matching run.mode.');
    }
  } else {
    add('invalid_run_mode', `Unknown run mode: ${state.mode}`);
  }

  const controlOutlineRel = state.gates?.outline?.decision_ref?.path || '03-outline/control-outline.md';
  const aStructureRel = activeBinding(state, 'outline', /(?:^|\/)A-structure(?:\.v\d{3})?\.md$/, '03-outline/A-structure.md', 'A structure');
  const bStructureRel = activeBinding(state, 'outline', /(?:^|\/)B-structure(?:\.v\d{3})?\.md$/, '03-outline/B-structure.md', 'B structure');

  const researchPlaceholderOptions = { allowUncertaintyLanguage: true };
  await requiredText(join(runDir, '02-research', 'brief.md'), 'missing_artifact', researchPlaceholderOptions);
  const sourceLog = await requiredText(join(runDir, '02-research', 'source-log.md'), 'missing_artifact', researchPlaceholderOptions);
  const evidenceMap = await requiredText(join(runDir, '02-research', 'evidence-map.md'), 'missing_artifact', researchPlaceholderOptions);
  const activeOutline = await requiredText(join(runDir, controlOutlineRel));
  await requiredText(join(runDir, aStructureRel));
  await requiredText(join(runDir, bStructureRel));
  const claimsPath = join(runDir, '02-research', 'claims.json');
  const claims = await requiredJson(claimsPath);
  for (const claim of claims?.claims || []) {
    if (claim.critical && (claim.status !== 'verified' || !claim.source_ids?.length)) {
      add('unverified_critical_claim', `Critical claim ${claim.id || '(missing id)'} is not verified with a source.`, { claim_id: claim.id });
    }
    for (const sourceId of claim.source_ids || []) {
      if (sourceLog && !sourceLog.includes(sourceId)) add('claim_source_missing', `Claim ${claim.id} references source ${sourceId}, but source-log.md does not define it.`, { claim_id: claim.id, source_id: sourceId });
    }
    if (claim.critical && claim.id && evidenceMap && !evidenceMap.includes(claim.id)) add('claim_missing_from_evidence_map', `Critical claim ${claim.id} is absent from evidence-map.md.`, { claim_id: claim.id });
    if (claim.critical && claim.id && activeOutline && !activeOutline.includes(claim.id)) add('claim_missing_from_outline', `Critical claim ${claim.id} is absent from the active control outline.`, { claim_id: claim.id });
  }

  const masterProvenance = {};
  for (const variant of variants) {
    const base = join(runDir, '04-masters', variant);
    await requiredText(join(base, 'final.md'));
    await requiredText(join(base, 'review.md'));
    masterProvenance[variant] = await requiredJson(join(base, 'provenance.json'), 'missing_master_provenance');
  }
  if (masterProvenance.A && masterProvenance.B) {
    if (masterProvenance.A.model !== masterProvenance.B.model || JSON.stringify(masterProvenance.A.parameters) !== JSON.stringify(masterProvenance.B.parameters)) {
      add('ab_parameter_mismatch', 'A and B mother drafts must use the same model and parameters.');
    }
    if (masterProvenance.A.input_hashes?.style_b !== null) add('a_style_contamination', 'A provenance must set input_hashes.style_b to null.');
    if (masterProvenance.B.input_hashes?.style_b !== state.snapshots?.style_b?.sha256) add('b_style_missing', 'B provenance must bind the run style-B snapshot hash.');
    for (const variant of variants) {
      if (fileExists(claimsPath) && (masterProvenance[variant].input_hashes?.claims !== await fileSha256(claimsPath) || masterProvenance[variant].input_paths?.claims !== '02-research/claims.json')) add('master_claims_lineage_mismatch', `${variant} mother draft does not bind the current claims.json.`, { variant });
      const outlinePath = join(runDir, controlOutlineRel);
      if (fileExists(outlinePath) && (masterProvenance[variant].input_hashes?.control_outline !== await fileSha256(outlinePath) || masterProvenance[variant].input_paths?.control_outline !== controlOutlineRel)) add('master_outline_lineage_mismatch', `${variant} mother draft does not bind the approved control outline version.`, { variant });
      const structureRel = variant === 'A' ? aStructureRel : bStructureRel;
      const structurePath = join(runDir, structureRel);
      if (fileExists(structurePath) && (masterProvenance[variant].input_hashes?.structure !== await fileSha256(structurePath) || masterProvenance[variant].input_paths?.structure !== structureRel)) add('master_structure_lineage_mismatch', `${variant} mother draft does not bind its approved structure version.`, { variant });
      const expectedStylePath = variant === 'A' ? null : '00-intake/style-b.md';
      if (masterProvenance[variant].input_paths?.style_b !== expectedStylePath) add('master_style_path_mismatch', `${variant} mother draft style path is invalid.`, { variant });
    }
  }

  const proofreadingValidation = await validateProofreadingStage(runDir, state);
  issues.push(...proofreadingValidation.issues);

  const titleStageValidation = await validateTitleGenerationStage(runDir, state);
  issues.push(...titleStageValidation.issues);

  for (const platform of platforms) {
    for (const variant of variants) {
      const base = join(runDir, '05-platforms', platform, variant);
      const logicPath = join(base, 'logic-final.md');
      const humanizedPath = join(base, 'humanized.md');
      const finalPath = join(base, 'final.md');
      const draftPath = join(base, 'draft.md');
      await requiredText(draftPath);
      await requiredText(logicPath);
      await requiredText(humanizedPath);
      await requiredText(finalPath);
      const audiencePath = join(base, 'audience-snapshot.md');
      await requiredText(audiencePath);
      const audienceData = await requiredJson(join(base, 'audience-snapshot.json'), 'missing_audience_snapshot');
      if (audienceData && fileExists(audiencePath)) {
        const expectedAudiencePath = `05-platforms/${platform}/${variant}/audience-snapshot.md`;
        const expectedMerge = ['core_audience', 'platform_overlay', 'article_segment'];
        const valid = audienceData.schema_version === 1
          && audienceData.platform === platform
          && audienceData.variant === variant
          && JSON.stringify(audienceData.merge_order) === JSON.stringify(expectedMerge)
          && audienceData.sources?.core_audience?.path === state.snapshots?.core_audience?.snapshot_path
          && audienceData.sources?.core_audience?.sha256 === state.snapshots?.core_audience?.sha256
          && audienceData.sources?.platform_profiles?.path === state.snapshots?.platform_profiles?.snapshot_path
          && audienceData.sources?.platform_profiles?.sha256 === state.snapshots?.platform_profiles?.sha256
          && audienceData.sources?.platform_profiles?.profile_set_version === platformProfileConfig?.profile_set?.version
          && audienceData.sources?.platform_profiles?.platform_id === platform
          && audienceData.sources?.article_audience?.path === state.snapshots?.article_audience?.snapshot_path
          && audienceData.sources?.article_audience?.sha256 === state.snapshots?.article_audience?.sha256
          && audienceData.sources?.article_audience?.empty === Boolean(state.snapshots?.article_audience?.empty)
          && audienceData.merged_snapshot?.path === expectedAudiencePath
          && audienceData.merged_snapshot?.sha256 === await fileSha256(audiencePath);
        if (!valid) add('audience_snapshot_contract_mismatch', `Audience snapshot contract is stale or incomplete for ${platform}/${variant}.`, { platform, variant });
      }
      const provenance = await requiredJson(join(base, 'provenance.json'), 'missing_platform_provenance');
      if (provenance && fileExists(audiencePath)) {
        const expectedMasterPath = `04-masters/${variant}/final.md`;
        const masterPath = join(runDir, expectedMasterPath);
        if (!fileExists(masterPath) || provenance.source_master_path !== expectedMasterPath || provenance.source_master_sha256 !== await fileSha256(masterPath)) {
          add('platform_master_lineage_mismatch', `${platform}/${variant} does not bind its own mother draft.`, { platform, variant });
        }
        if (provenance.audience_snapshot_sha256 !== await fileSha256(audiencePath)) {
          add('platform_audience_lineage_mismatch', `${platform}/${variant} audience snapshot hash is stale.`, { platform, variant });
        }
      }
      for (const review of ['logic.md', 'humanize.md', 'detail.md']) await requiredText(join(base, 'reviews', review));
      if (fileExists(draftPath) && fileExists(humanizedPath) && fileExists(finalPath) && fileExists(claimsPath)) {
        await regression(join(base, 'reviews', 'claim-regression-humanize.json'), draftPath, humanizedPath, claimsPath, 'humanize');
        await regression(join(base, 'reviews', 'claim-regression-final.json'), draftPath, finalPath, claimsPath, 'final');
      }
    }
  }

  const selectionRef = state.gates?.titles?.decision_ref?.path || '06-selection/selection.v001.json';
  const titlesRef = activeBinding(state, 'titles', /(?:^|\/)titles(?:\.v\d{3})?\.json$/, '06-selection/titles.json', 'titles JSON');
  const titleMatrixRef = activeBinding(state, 'titles', /(?:^|\/)title-matrix(?:\.v\d{3})?\.md$/, '06-selection/title-matrix.md', 'title matrix');
  await requiredText(join(runDir, titleMatrixRef));
  const revisionOf = (path) => path.match(/\.v(\d{3})\./)?.[1] || '001';
  if (revisionOf(titlesRef) !== revisionOf(titleMatrixRef)) add('title_artifact_revision_mismatch', 'Active titles JSON and title matrix revisions differ.');
  const titleResult = await validateTitlesAndSelection(runDir, selectionRef, titlesRef);
  issues.push(...titleResult.issues);
  const selectionByPlatform = Object.fromEntries(titleResult.selections.map((item) => [item.platform, item]));
  const titles = fileExists(join(runDir, titlesRef)) ? await readJson(join(runDir, titlesRef)) : null;
  const providerVisual = platforms.every((platform) => {
    const paths = illustrationPaths(state, platform);
    return fileExists(join(runDir, paths.planRequest)) && fileExists(join(runDir, paths.planResult))
      && fileExists(join(runDir, paths.generateRequest)) && fileExists(join(runDir, paths.generateResult));
  });
  if (providerVisual) {
    const validation = await validateIllustrationGeneration(runDir, state);
    issues.push(...validation.issues);
  }
  const providerCoverPaths = coverPaths(state);
  const providerCover = [providerCoverPaths.request, providerCoverPaths.result]
    .some((path) => fileExists(join(runDir, path)));
  if (providerCover) {
    const validation = await validateWechatCover(runDir, state);
    issues.push(...validation.issues);
  }
  const providerPackage = compressionProviderRequired(state)
    || fileExists(join(runDir, compressionPlanPath(state)));
  if (providerPackage) {
    const validation = await validatePublishPackages(runDir, state);
    issues.push(...validation.issues);
  }
  const visualRecount = providerVisual && providerPackage
    ? await recountGeneratedVisualAssets(runDir, state) : { issues: [], rows: [], total: null };
  issues.push(...visualRecount.issues);
  const currentLayout = wechatLayoutPaths(state);
  const providerLayout = wechatLayoutProviderRequired(state)
    || [currentLayout.request, currentLayout.result, currentLayout.stagedClean, currentLayout.stagedPreview]
      .some((path) => fileExists(join(runDir, path)));
  if (providerLayout) {
    const validation = await validateWechatLayoutDelivery(runDir, state);
    issues.push(...validation.issues);
  }

  for (const platform of platforms) {
    const selection = selectionByPlatform[platform];
    const selectedCandidate = selection
      ? titles?.platforms?.[platform]?.[selection.variant]?.candidates?.find((item) => item.id === selection.title_id)
      : null;
    const providerPaths = illustrationPaths(state, platform);
    const planRef = providerVisual ? providerPaths.plan
      : activeBinding(state, 'visual', new RegExp(`^07-visual/${platform}/plan(?:\\.v\\d{3})?\\.json$`), `07-visual/${platform}/plan.json`, `${platform} visual plan`);
    const shotListRef = providerVisual ? providerPaths.shotList
      : activeBinding(state, 'visual', new RegExp(`^07-visual/${platform}/shot-list(?:\\.v\\d{3})?\\.md$`), `07-visual/${platform}/shot-list.md`, `${platform} shot list`);
    const planPath = join(runDir, planRef);
    const bundlePath = join(runDir, providerVisual ? providerPaths.bundle : `07-visual/${platform}/bundle.json`);
    const activePackage = packagePaths(state, platform);
    const manifestPath = join(runDir, providerPackage
      ? activePackage.manifest : `07-visual/${platform}/manifest.json`);
    const plan = await requiredJson(planPath, 'missing_visual_plan');
    await requiredText(join(runDir, shotListRef), 'missing_shot_list');
    const bundle = await requiredJson(bundlePath, 'missing_visual_bundle');
    if (providerVisual) await requiredText(join(runDir, providerPaths.manifest), 'missing_visual_native_manifest');
    const manifest = await requiredJson(manifestPath, 'missing_visual_manifest');
    if (!providerVisual && selection && plan) {
      if (plan.platform !== platform || plan.variant !== selection.variant || plan.source_draft_sha256 !== selection.draft_sha256) {
        add('visual_plan_lineage_mismatch', `Visual plan does not bind the selected ${platform} draft.`, { platform });
      }
      if (plan.status !== 'READY') add('visual_plan_not_ready', `Visual plan is not READY for approval: ${platform}.`, { platform });
    }
    if (!providerVisual && selection && bundle) {
      if (bundle.status !== 'PASS' || bundle.platform !== platform || bundle.variant !== selection.variant || bundle.source_draft_sha256 !== selection.draft_sha256) {
        add('visual_bundle_lineage_mismatch', `Visual bundle does not bind the selected ${platform} draft or is not PASS.`, { platform });
      }
      if (!Array.isArray(bundle.images) || !bundle.images.length) add('empty_visual_bundle', `Visual bundle has no images for ${platform}.`, { platform });
      for (const image of bundle.images || []) {
        for (const field of ['content_qa_status', 'style_qa_status', 'brand_qa_status', 'set_qa_status']) {
          if (image[field] !== 'pass') add('image_qa_failed', `${platform}/${image.image_id || image.file} failed ${field}.`, { platform, field });
        }
        if (image.residual_risk !== 'none') add('image_residual_risk', `${platform}/${image.image_id || image.file} has residual risk.`, { platform });
        if (!image.file || !fileExists(join(runDir, '07-visual', platform, image.file))) add('missing_visual_file', `Visual file is missing for ${platform}: ${image.file}`, { platform });
      }
    }
    if (selection && manifest) {
      const manifestLineage = providerPackage
        ? manifest.source?.path === selection.draft_path && manifest.source?.sha256 === selection.draft_sha256
        : manifest.source_draft_sha256 === selection.draft_sha256;
      if (manifest.status !== 'PASS' || manifest.platform !== platform
        || manifest.variant !== selection.variant || !manifestLineage) {
        add('manifest_lineage_mismatch', `Manifest does not bind the selected ${platform} draft or is not PASS.`, { platform });
      }
    }

    const pack = join(runDir, '08-publish-pack', platform);
    const markdownPath = join(runDir, providerPackage ? activePackage.final : `08-publish-pack/${platform}/final.md`);
    const metadataPath = join(runDir, providerPackage ? activePackage.metadata : `08-publish-pack/${platform}/metadata.json`);
    const markdown = await requiredText(markdownPath);
    const metadata = await requiredJson(metadataPath, 'missing_pack_metadata');
    const optimization = await requiredJson(
      join(runDir, providerPackage ? activePackage.optimization : `08-publish-pack/${platform}/optimization.json`),
      'missing_optimization_report'
    );
    const markdownRefs = markdown ? markdownImageRefs(markdown) : [];
    if (markdown) await checkImageRefs(markdownPath, markdownRefs);
    if (manifest && bundle) {
      const items = Array.isArray(manifest.items) ? manifest.items : [];
      const visualPrefix = `07-visual/${platform}/`;
      const bundleFiles = new Set((bundle.images || []).map((image) => providerVisual && image.file?.startsWith(visualPrefix)
        ? image.file.slice(visualPrefix.length) : image.file));
      const manifestBundleFiles = new Set(items.map((item) => item.bundle_file));
      const manifestPublishFiles = new Set(items.map((item) => item.publish_file));
      const manifestMarkdownRefs = new Set(items.map((item) => item.markdown_ref));
      if (!items.length) add('empty_manifest', `Manifest has no items for ${platform}.`, { platform });
      if (bundleFiles.size !== manifestBundleFiles.size || [...bundleFiles].some((file) => !manifestBundleFiles.has(file))) {
        add('manifest_bundle_mismatch', `Manifest and bundle image sets differ for ${platform}.`, { platform });
      }
      const sourceRefs = selection?.draft_path && fileExists(join(runDir, selection.draft_path))
        ? new Set(markdownImageRefs(await readText(join(runDir, selection.draft_path)))) : new Set();
      const generatedMarkdownRefs = markdownRefs.filter((ref) => !sourceRefs.has(ref));
      if (generatedMarkdownRefs.length !== manifestMarkdownRefs.size
        || generatedMarkdownRefs.some((ref) => !manifestMarkdownRefs.has(ref))) {
        add('manifest_markdown_mismatch', `Manifest and Markdown image references differ for ${platform}.`, { platform });
      }
      for (const item of items) {
        const sourcePath = join(runDir, '07-visual', platform, item.bundle_file || '');
        const publishPath = join(pack, item.publish_file || '');
        if (!item.bundle_file?.startsWith('images/') || !fileExists(sourcePath) || item.bundle_sha256 !== await fileSha256(sourcePath)) {
          add('manifest_source_invalid', `Manifest source is missing or stale for ${platform}/${item.image_id || item.bundle_file}.`, { platform });
        }
        if (!item.publish_file?.startsWith('images/') || !fileExists(publishPath) || item.publish_sha256 !== await fileSha256(publishPath)) {
          add('manifest_publish_invalid', `Manifest publish image is missing or stale for ${platform}/${item.image_id || item.publish_file}.`, { platform });
        }
        if (item.markdown_ref !== item.publish_file) add('manifest_reference_mismatch', `Manifest markdown_ref must equal publish_file for ${platform}/${item.image_id}.`, { platform });
      }
      const actualImagesRoot = providerPackage ? join(runDir, activePackage.imagesDir) : join(pack, 'images');
      const actualPackImages = new Set((await filesUnder(actualImagesRoot)).map((path) =>
        providerPackage ? `${activePackage.imagePrefix}${path}` : `images/${path}`));
      if (actualPackImages.size !== manifestPublishFiles.size || [...actualPackImages].some((file) => !manifestPublishFiles.has(file))) {
        add('untracked_publish_image', `Publish-pack images and manifest differ for ${platform}.`, { platform });
      }
      if (optimization && !providerPackage) {
        const optimized = new Map((optimization.items || []).map((item) => [item.file, item]));
        if (optimization.status !== 'PASS' || optimization.platform !== platform || optimized.size !== manifestPublishFiles.size) {
          add('optimization_contract_mismatch', `Optimization report is incomplete for ${platform}.`, { platform });
        }
        for (const item of items) {
          const record = optimized.get(item.publish_file);
          if (!record || record.source_sha256 !== item.bundle_sha256 || record.output_sha256 !== item.publish_sha256 || !['png', 'webp'].includes(record.format)) {
            add('optimization_lineage_mismatch', `Optimization lineage is invalid for ${platform}/${item.publish_file}.`, { platform, file: item.publish_file });
          }
        }
      }
    }
    if (selection && metadata) {
      const expectedBundleHash = fileExists(bundlePath) ? await fileSha256(bundlePath) : null;
      const metadataLineage = providerPackage
        ? metadata.source_draft?.path === selection.draft_path
          && metadata.source_draft?.sha256 === selection.draft_sha256
        : metadata.source_draft_sha256 === selection.draft_sha256;
      if (metadata.platform !== platform || metadata.variant !== selection.variant
        || metadata.title_id !== selection.title_id || !metadataLineage) {
        add('pack_lineage_mismatch', `Publish pack metadata does not match the selected ${platform} draft.`, { platform });
      }
      if (metadata.title !== selectedCandidate?.title) add('pack_title_mismatch', `Publish pack title does not match selected title ${selection.title_id}.`, { platform });
      const metadataBundleHash = providerPackage ? metadata.visual_bundle?.sha256 : metadata.visual_bundle_sha256;
      if (metadataBundleHash !== expectedBundleHash) add('pack_visual_hash_mismatch', `Publish pack visual bundle hash is stale for ${platform}.`, { platform });
      const expectedManifestHash = fileExists(manifestPath) ? await fileSha256(manifestPath) : null;
      const metadataManifestHash = providerPackage ? metadata.manifest?.sha256 : metadata.manifest_sha256;
      if (metadataManifestHash !== expectedManifestHash) add('pack_manifest_hash_mismatch', `Publish pack manifest hash is stale for ${platform}.`, { platform });
      const metadataMarkdownHash = providerPackage ? metadata.final_markdown?.sha256 : metadata.final_md_sha256;
      if (markdown && metadataMarkdownHash !== await fileSha256(markdownPath)) add('pack_markdown_hash_mismatch', `Publish pack Markdown hash is stale for ${platform}.`, { platform });
      const publishedTitle = markdown?.match(/^#\s+(.+)$/m)?.[1]?.trim();
      if (publishedTitle !== metadata.title) add('pack_title_not_applied', `Selected title is not the H1 in ${platform}/final.md.`, { platform });
    }
    if (platform === 'wechat') {
      const htmlPath = join(runDir, providerPackage ? activePackage.article : '08-publish-pack/wechat/article.html');
      const previewPath = join(runDir, providerPackage ? activePackage.preview : '08-publish-pack/wechat/article-preview.html');
      if (!providerLayout) {
        const html = await requiredText(htmlPath, 'missing_wechat_html');
        await requiredText(previewPath, 'missing_wechat_preview');
        const layoutResult = await requiredJson(
          join(runDir, providerPackage ? activePackage.layoutResult : '08-publish-pack/wechat/layout-result.json'),
          'missing_layout_result'
        );
        if (html) {
          if (!/^\s*<section\b[\s\S]*<\/section>\s*$/i.test(html) || /<(?:html|head|body|script)\b/i.test(html)) {
            add('invalid_wechat_clean_html', 'article.html must be the validated clean WeChat section fragment.');
          }
          const refs = htmlImageRefs(html);
          await checkImageRefs(htmlPath, refs, 'missing_html_image_reference');
          if (markdown) {
            const segments = markdownBodySegments(markdown);
            const visible = htmlVisibleText(html);
            const covered = segments.reduce((sum, segment) => sum + (visible.includes(segment) ? segment.length : 0), 0);
            const total = segments.reduce((sum, segment) => sum + segment.length, 0);
            if (!total || covered / total < 0.9) add('html_body_loss', 'WeChat HTML does not preserve enough visible body content from final.md.', { platform, coverage: total ? covered / total : 0 });
          }
          if (manifest) {
            const expected = new Set((manifest.items || []).map((item) => item.markdown_ref));
            for (const ref of expected) if (!refs.includes(ref)) add('html_manifest_image_missing', `WeChat HTML omitted manifest image: ${ref}`, { platform });
          }
        }
        if (layoutResult) {
          const validLayout = layoutResult.status === 'PASS'
            && layoutResult.errors === 0
            && layoutResult.warnings === 0
            && layoutResult.source_markdown_sha256 === (fileExists(markdownPath) ? await fileSha256(markdownPath) : null)
            && layoutResult.clean_file === basename(htmlPath)
            && layoutResult.clean_sha256 === (fileExists(htmlPath) ? await fileSha256(htmlPath) : null)
            && layoutResult.preview_file === basename(previewPath)
            && layoutResult.preview_sha256 === (fileExists(previewPath) ? await fileSha256(previewPath) : null);
          if (!validLayout) add('layout_validation_mismatch', 'WeChat layout result is missing, stale, or has validation diagnostics.');
        }
      }

      const coverSourcePath = join(runDir, providerCover
        ? providerCoverPaths.cover : '07-visual/wechat-cover/cover.png');
      const coverPublishPath = join(runDir, providerPackage ? activePackage.cover : '08-publish-pack/wechat/cover.png');
      const coverResult = providerCover ? null
        : await requiredJson(join(runDir, '07-visual', 'wechat-cover', 'cover.json'), 'missing_wechat_cover_result');
      if (!fileExists(coverSourcePath)) add('missing_wechat_cover', `Missing generated WeChat cover: ${relativeTo(runDir, coverSourcePath)}.`);
      if (!fileExists(coverPublishPath)) add('missing_wechat_cover', 'Missing publish WeChat cover: 08-publish-pack/wechat/cover.png.');
      const sourceDimensions = fileExists(coverSourcePath) ? await pngDimensions(coverSourcePath) : null;
      const publishDimensions = fileExists(coverPublishPath) ? await pngDimensions(coverPublishPath) : null;
      if (sourceDimensions?.width !== 1923 || sourceDimensions?.height !== 818 || publishDimensions?.width !== 1923 || publishDimensions?.height !== 818) {
        add('invalid_wechat_cover_dimensions', 'WeChat cover must be a 1923x818 PNG in both visual and publish locations.');
      }
      const titleText = selectedCandidate?.title || '';
      const titleLength = [...titleText.replace(/\s/g, '')].length;
      if (!/[\u3400-\u9fff]/u.test(titleText) || titleLength < 2 || titleLength > 35) add('wechat_cover_title_unsupported', 'Selected WeChat title must contain Chinese and be 2-35 non-whitespace characters.');
      if (!providerCover && coverResult) {
        const validCover = coverResult.status === 'PASS'
          && coverResult.title_exact === true
          && coverResult.title_id === selection?.title_id
          && coverResult.source_draft_sha256 === selection?.draft_sha256
          && coverResult.source_file === 'cover.png'
          && coverResult.publish_file === '08-publish-pack/wechat/cover.png'
          && coverResult.source_sha256 === (fileExists(coverSourcePath) ? await fileSha256(coverSourcePath) : null)
          && coverResult.publish_sha256 === (fileExists(coverPublishPath) ? await fileSha256(coverPublishPath) : null)
          && coverResult.width === 1923
          && coverResult.height === 818
          && coverResult.format === 'png'
          && coverResult.optimization?.status === 'PASS'
          && coverResult.optimization?.format === 'png';
        if (!validCover) add('wechat_cover_contract_mismatch', 'WeChat cover result is incomplete, stale, non-exact, or unoptimized.');
      }
    }
  }

  const status = issues.length ? 'BLOCKED' : 'READY';
  const now = new Date().toISOString();
  const fingerprintPaths = (await filesUnder(runDir)).filter((path) => path !== 'run.json' && !path.startsWith('09-qa/'));
  const artifactFingerprints = await Promise.all(fingerprintPaths.map(async (path) => ({ path, sha256: await fileSha256(join(runDir, path)) })));
  const qa = {
    schema_version: 2,
    run_id: state.run_id,
    checked_at: now,
    status,
    counts: {
      masters: 2,
      platform_finals: 10,
      title_candidates: titleResult.total,
      platform_image_sets: 5,
      generated_body_images: visualRecount.total,
      selected_packs: 5,
      wechat_cover: 1,
      wechat_html: 1
    },
    visual_recount: visualRecount.rows,
    artifact_fingerprints: artifactFingerprints,
    issues
  };
  const qaDir = join(runDir, '09-qa');
  await writeJson(join(qaDir, 'qa.json'), qa);
  const lines = [
    '# Final QA', '', `- Status: ${status}`, `- Checked at: ${now}`, `- Blockers: ${issues.length}`, '',
    '## Results', '',
    ...(issues.length ? issues.map((item) => `- [${item.code}] ${item.message}`) : ['- All deterministic checks passed.']), ''
  ];
  await writeText(join(qaDir, 'qa.md'), lines.join('\n'));
  const handoffPackages = Object.fromEntries(platforms.map((platform) => [platform, providerPackage
    ? packagePaths(state, platform)
    : {
        final: `08-publish-pack/${platform}/final.md`,
        imagesDir: `08-publish-pack/${platform}/images`,
        cover: platform === 'wechat' ? '08-publish-pack/wechat/cover.png' : null,
        article: platform === 'wechat' ? '08-publish-pack/wechat/article.html' : null
      }]));
  const handoffImages = handoffPackages.wechat.imagesDir.replace('/wechat/', '/<platform>/');
  const handoff = [
    '# 人工发布交接单', '',
    '> 本流程止于人工发布交接。禁止调用平台发布、账号、排期或凭证接口。', '',
    `- QA: ${status}`, '',
    '## 五平台入选', '',
    '| 平台 | 版本 | 标题 ID | 发布包 |', '|---|---|---|---|',
    ...platforms.map((platform) => {
      const item = selectionByPlatform[platform] || {};
      return `| ${platform} | ${item.variant || '-'} | ${item.title_id || '-'} | ${handoffPackages[platform].final} |`;
    }), '',
    '## 完整交付', '',
    '- 10 份终稿：`05-platforms/<platform>/<A|B>/final.md`',
    `- 5 套平台配图：\`${handoffImages}/\``,
    `- 公众号封面：\`${handoffPackages.wechat.cover}\``,
    `- 公众号 HTML：\`${handoffPackages.wechat.article}\``, '',
    '## 发布前人工动作', '',
    '- 在各平台后台预览正文、图片和标题。',
    '- 人工确认后发布；本 Skill 不登录、不排期、不发送。', ''
  ];
  await writeText(join(qaDir, 'handoff.md'), handoff.join('\n'));

  const autonomousReady = status === 'READY' && state.run_mode === 'autonomous';
  state.updated_at = now;
  state.status = autonomousReady ? 'completed' : status === 'READY' ? 'awaiting_approval' : 'blocked';
  state.current_stage = autonomousReady ? 'completed' : status === 'READY' ? 'final_approval' : 'final_qa';
  state.resume = { next_stage: autonomousReady ? null : state.current_stage, reason: autonomousReady ? 'autonomous_qa_complete' : status === 'READY' ? 'awaiting_final_gate' : 'qa_blocked' };
  if (state.stages) {
    const previousStage = state.stages.final_qa || { attempt: 0, artifacts: [] };
    state.stages.final_qa = {
      ...previousStage,
      status: status === 'READY' ? 'completed' : 'blocked',
      error: status === 'READY' ? null : `${issues.length} final QA blocker(s)`,
      completed_at: status === 'READY' ? now : null,
      updated_at: now
    };
  }
  const previousFinal = state.gates?.final || { revision: 0 };
  const finalBindings = await Promise.all(['09-qa/qa.json', '09-qa/qa.md', '09-qa/handoff.md'].map((path) => artifactBinding(runDir, path)));
  state.gates.final = {
    status: autonomousReady ? 'approved' : status === 'READY' ? 'awaiting_approval' : 'blocked',
    revision: Math.max(1, previousFinal.revision || 0),
    decision_ref: autonomousReady ? await artifactBinding(runDir, '09-qa/qa.json') : null,
    bound_artifacts: finalBindings,
    approval_mode: autonomousReady ? 'autonomous' : 'interactive',
    actor: autonomousReady ? 'orchestrator' : null,
    approved_at: autonomousReady ? now : null,
    updated_at: now
  };
  state.history = [...(state.history || []), { at: now, event: 'final_qa', status, blocker_count: issues.length }];
  await writeJson(statePath, state);
  emitJson(qa, status === 'READY' ? 0 : 2);
} catch (error) {
  emitJson({ status: 'BLOCKED', issues: [{ code: 'verification_failed', message: error.message }] }, 2);
}

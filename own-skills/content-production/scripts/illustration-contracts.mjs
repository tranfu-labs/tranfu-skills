import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { readRasterInfo } from '../skills/post-illustration-images/scripts/validate-style-bundle.mjs';
import {
  fileExists,
  fileSha256,
  platforms,
  readJson,
  readText
} from './lib.mjs';
import {
  evaluatePlatformCardinality,
  validateCurrentVisualDecision,
  validateVisualCoverageSet
} from './visual-cardinality.mjs';

const requestKeys = [
  'schema_version', 'contract', 'task_id', 'capability', 'provider_contract', 'run_dir',
  'run_mode', 'mode', 'attempt', 'platform', 'provider_platform', 'variant', 'selection',
  'inputs', 'output_dir', 'expected_artifacts', 'options', 'interaction_policy'
];
const resultKeys = [
  'schema_version', 'contract', 'provider_contract', 'task_id', 'request_sha256', 'status',
  'artifacts', 'checks', 'issues', 'warnings'
];
const optionKeys = [
  'requested_output', 'publishing_path', 'style_id', 'max_images', 'brand_override',
  'backend_hint', 'model_preference', 'execution_strategy'
];
const selectionKeys = [
  'platform', 'variant', 'title_id', 'title', 'topic_phrase', 'draft_path',
  'draft_sha256', 'decision_rule'
];
const planKeys = [
  'schema_version', 'task_id', 'status', 'platform', 'provider_platform', 'variant',
  'source', 'selection', 'options', 'analysis', 'style', 'brand', 'generation_backend',
  'generation_geometry', 'image_count', 'anchors', 'shot_list', 'residual_risk'
];
const anchorKeys = [
  'image_id', 'placement', 'source_excerpt', 'core_meaning', 'structure',
  'visual_metaphor', 'main_action', 'suggested_elements', 'short_labels', 'qa_risk'
];
const boundedAnchorKeys = [...anchorKeys, 'text_mode'];
const bundleKeys = [
  'schema_version', 'task_id', 'status', 'platform', 'provider_platform', 'variant',
  'source', 'selection', 'plan', 'shot_list', 'style', 'brand', 'generation_backend',
  'generation_geometry', 'image_count', 'manifest', 'images', 'residual_risk'
];
const imageKeys = [
  'image_id', 'file', 'file_sha256', 'source_file', 'source_sha256', 'prompt_path',
  'prompt_sha256', 'placement', 'core_meaning', 'structure', 'visual_metaphor',
  'content_qa_status', 'style_qa_status', 'brand_qa_status', 'set_qa_status',
  'brand_overlay_status', 'size_check_status', 'generation_attempt', 'requested_dimensions',
  'source_dimensions', 'source_aspect_ratio', 'source_artifact', 'delivery_dimensions',
  'delivery_artifact', 'native_output_preserved', 'post_generation_actions',
  'geometry_attempts', 'residual_risk'
];
const styleKeys = ['id', 'platform', 'style_file', 'style_spec', 'style_reference'];
const brandKeys = [
  'enabled', 'policy_default_enabled', 'override', 'policy_source', 'disabled_reason'
];
const backendKeys = [
  'kind', 'adapter', 'endpoint_source', 'resolved_model', 'artifact_format',
  'credential_access', 'model_check', 'process_cleanup_plan', 'process_cleanup_status'
];
const boundedBackendKeys = [...backendKeys, 'aspect_control', 'structured_size'];
const geometryKeys = [
  'geometry_profile', 'resolved_model', 'requested_dimensions', 'target_aspect_ratio',
  'design_dimensions', 'delivery_dimensions', 'ratio_tolerance', 'minimum_short_edge',
  'native_output_policy', 'post_generation_resize'
];
const requestedOutput = {
  wechat: 'body_illustrations',
  xiaohongshu: 'carousel',
  zhihu: 'post_illustrations',
  weibo: 'post_illustrations',
  toutiao: 'post_illustrations'
};
const expressions = new Set([
  'Concept explanation', 'Workflow/process', 'Before-after comparison', 'Layered framework',
  'Common mistakes or boundaries', 'Decision tree', 'Checklist or summary', 'Story/state transition'
]);

function issue(code, message, extra = {}) {
  return { code, message, resume_from: 'visual', ...extra };
}

function plain(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return plain(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function nonempty(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function stringList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(nonempty);
}

function stringArray(value) {
  return Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length;
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..'
    && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

async function safeFile(root, rootReal, relativePath, issues, code = 'illustration_artifact_unsafe') {
  if (!nonempty(relativePath) || isAbsolute(relativePath)) {
    issues.push(issue(code, `Illustration artifact path is invalid: ${relativePath || '(missing)'}.`, { path: relativePath || null }));
    return null;
  }
  const absolute = resolve(root, relativePath);
  if (!inside(root, absolute) || !fileExists(absolute)) {
    issues.push(issue(code, `Illustration artifact is missing or escapes its root: ${relativePath}.`, { path: relativePath }));
    return null;
  }
  try {
    let current = root;
    for (const part of relative(root, absolute).split(/[\\/]/).filter(Boolean)) {
      current = join(current, part);
      if ((await lstat(current)).isSymbolicLink()) throw new Error('symbolic link');
    }
    const value = await lstat(absolute);
    const real = await realpath(absolute);
    if (!value.isFile() || !inside(rootReal, real)) throw new Error('not a real file');
    return absolute;
  } catch (error) {
    issues.push(issue(code, `Illustration artifact must be a real file inside its root: ${relativePath}.`, { path: relativePath }));
    return null;
  }
}

function providerPlatform(platform) {
  return platform === 'xiaohongshu' ? 'xhs' : platform;
}

function taskId(state, platform, variant, mode, attempt) {
  return `illustration:${state.run_id}:${platform}:${variant}:${mode}:attempt-${String(attempt).padStart(3, '0')}`;
}

export function illustrationPaths(state, platform) {
  const attempt = Number.isInteger(state?.stages?.visual?.attempt) && state.stages.visual.attempt > 0
    ? state.stages.visual.attempt : 1;
  const version = `v${String(attempt).padStart(3, '0')}`;
  const suffix = attempt === 1 ? '' : `.${version}`;
  const versionDir = attempt === 1 ? '' : `${version}/`;
  const base = `07-visual/${platform}`;
  return {
    attempt,
    version,
    base,
    plan: `${base}/plan${suffix}.json`,
    shotList: `${base}/shot-list${suffix}.md`,
    bundle: `${base}/bundle${suffix}.json`,
    manifest: `${base}/manifest${suffix}.md`,
    planRequest: `${base}/illustration-plan${suffix}.request.json`,
    planResult: `${base}/illustration-plan${suffix}.result.json`,
    generateRequest: `${base}/illustration-generate${suffix}.request.json`,
    generateResult: `${base}/illustration-generate${suffix}.result.json`,
    promptDir: `${base}/prompts/${versionDir}`,
    imageDir: `${base}/images/${versionDir}`,
    sourceImageDir: `${base}/images/unbranded/${versionDir}`,
    brandedImageDir: `${base}/images/branded/${versionDir}`
  };
}

export function expectedVisualStageArtifacts(state) {
  return platforms.flatMap((platform) => {
    const paths = illustrationPaths(state, platform);
    return [paths.plan, paths.shotList, paths.bundle, paths.manifest];
  });
}

async function loadRunContext(runDir, state, issues) {
  let runReal;
  try {
    const value = await lstat(runDir);
    runReal = await realpath(runDir);
    if (value.isSymbolicLink() || !value.isDirectory()) throw new Error('run_dir is not a real directory');
  } catch (error) {
    issues.push(issue('invalid_illustration_run_dir', error.message));
    return null;
  }
  const provider = state?.capabilities?.providers?.illustration;
  const legacyProvider = state.stages?.visual?.status === 'completed' && !provider?.adapter_contract;
  if (provider?.status !== 'PASS' || provider?.contract !== 'illustration-v1'
    || !legacyProvider && (provider?.adapter_contract !== 'illustration-orchestrated-coverage-v1'
      || !Array.isArray(provider?.resources) || provider.resources.length !== 2)
    || !nonempty(provider?.skill_path)) {
    issues.push(issue('illustration_provider_unavailable', 'The illustration provider snapshot is not PASS for illustration-v1.'));
    return { runReal, provider: null };
  }
  const skillPath = resolve(provider.skill_path);
  const skillRoot = dirname(skillPath);
  let skillReal;
  try {
    skillReal = await realpath(skillRoot);
    const skillStat = await lstat(skillPath);
    if (skillStat.isSymbolicLink() || !skillStat.isFile() || !inside(skillReal, await realpath(skillPath))) {
      throw new Error('provider SKILL.md is unsafe');
    }
  } catch (error) {
    issues.push(issue('illustration_provider_unavailable', error.message));
    return { runReal, provider: null };
  }
  for (const resource of provider.resources || []) {
    if (!exactKeys(resource, ['path', 'sha256']) || !nonempty(resource.path)
      || !/^[a-f0-9]{64}$/.test(resource.sha256 || '') || !fileExists(resource.path)
      || await fileSha256(resource.path) !== resource.sha256) {
      issues.push(issue('illustration_provider_unavailable', 'The illustration adapter resource snapshot is missing or stale.'));
    }
  }
  return { runReal, provider: { ...provider, skillRoot, skillReal } };
}

async function approvedSelections(runDir, runReal, state, issues) {
  const gate = state?.gates?.titles;
  const binding = gate?.decision_ref;
  if (gate?.status !== 'approved' || !binding?.path || !/^[a-f0-9]{64}$/.test(binding?.sha256 || '')) {
    issues.push(issue('illustration_title_lineage_invalid', 'Illustration requires one approved title-selection decision.'));
    return { binding, selections: new Map() };
  }
  const path = await safeFile(runDir, runReal, binding.path, issues, 'illustration_title_lineage_invalid');
  if (!path || await fileSha256(path) !== binding.sha256) {
    if (path) issues.push(issue('illustration_title_lineage_invalid', 'Approved title-selection decision hash is stale.', { path: binding.path }));
    return { binding, selections: new Map() };
  }
  let decision;
  try { decision = await readJson(path); } catch (error) {
    issues.push(issue('illustration_title_lineage_invalid', error.message, { path: binding.path }));
    return { binding, selections: new Map() };
  }
  const values = Array.isArray(decision?.selections) ? decision.selections : [];
  const ids = values.map((item) => item?.platform);
  if (values.length !== platforms.length || new Set(ids).size !== platforms.length
    || !platforms.every((platform) => ids.includes(platform))) {
    issues.push(issue('illustration_title_lineage_invalid', 'Approved title decision must contain exactly one selection for every platform.'));
  }
  return { binding, selections: new Map(values.map((item) => [item?.platform, item])) };
}

async function loadStyleContext(provider, request, issues) {
  if (!provider) return null;
  let registryPath;
  let geometryPath;
  try {
    registryPath = await safeFile(provider.skillRoot, provider.skillReal, 'references/style-registry.json', issues, 'illustration_style_registry_invalid');
    geometryPath = await safeFile(provider.skillRoot, provider.skillReal, 'references/gpt-image-2-geometry.spec.json', issues, 'illustration_geometry_profile_invalid');
    if (!registryPath || !geometryPath) return null;
    const registry = await readJson(registryPath);
    const profile = await readJson(geometryPath);
    const target = providerPlatform(request.platform);
    const platform = registry.platforms?.find((item) => item?.id === target);
    const selectedId = request.options?.style_id || platform?.defaultStyleId;
    const style = registry.styles?.find((item) => item?.id === selectedId && item?.platform === target);
    if (!platform || !style || profile?.model !== 'gpt-image-2') {
      throw new Error(`No registered illustration style for ${request.platform}/${selectedId || '(default)'}.`);
    }
    const styleFile = await safeFile(provider.skillRoot, provider.skillReal, style.styleFile, issues, 'illustration_style_invalid');
    const specFile = await safeFile(provider.skillRoot, provider.skillReal, style.specFile, issues, 'illustration_style_invalid');
    const referenceFile = await safeFile(provider.skillRoot, provider.skillReal, style.styleReference, issues, 'illustration_style_invalid');
    if (!styleFile || !specFile || !referenceFile) return null;
    const spec = await readJson(specFile);
    if (spec.id !== style.id || !['wechat', 'xiaohongshu', 'zhihu', 'weibo', 'toutiao'].includes(spec.platform)
      || (target === 'xhs' ? spec.platform !== 'xiaohongshu' : spec.platform !== target)
      || spec.styleFile !== style.styleFile || spec.styleReference?.image !== style.styleReference) {
      throw new Error(`Registered Style Spec is inconsistent for ${style.id}.`);
    }
    return { registry, profile, platform, style, spec };
  } catch (error) {
    issues.push(issue('illustration_style_invalid', error.message));
    return null;
  }
}

function expectedOptions(platform, options, bounded = false) {
  return exactKeys(options, optionKeys)
    && options.requested_output === requestedOutput[platform]
    && options.publishing_path === null
    && (options.style_id === null || nonempty(options.style_id))
    && (options.max_images === null || Number.isInteger(options.max_images)
      && options.max_images > 0 && (!bounded || options.max_images <= 8))
    && [null, 'enabled', 'disabled'].includes(options.brand_override)
    && ['runtime-native', 'configured-api', 'unknown'].includes(options.backend_hint)
    && (options.model_preference === null || nonempty(options.model_preference))
    && options.execution_strategy === (bounded ? 'bounded_per_image' : 'one_image_at_a_time');
}

function expectedStyle(styleContext) {
  const value = styleContext.style;
  return {
    id: value.id,
    platform: value.platform,
    style_file: value.styleFile,
    style_spec: value.specFile,
    style_reference: value.styleReference
  };
}

function expectedBrand(styleContext, override) {
  const policy = styleContext.spec.brandPolicy || { defaultEnabled: true, userOverrideAllowed: true };
  const enabled = override === null ? policy.defaultEnabled : override === 'enabled';
  return {
    enabled,
    policy_default_enabled: policy.defaultEnabled,
    override,
    policy_source: override === null
      ? (styleContext.spec.brandPolicy ? 'style-default' : 'legacy-default') : 'user-override',
    disabled_reason: enabled ? null : override === 'disabled'
      ? 'disabled-by-user' : 'disabled-by-style-default'
  };
}

function expectedGeometry(styleContext) {
  const spec = styleContext.spec;
  const size = styleContext.profile.requestSizesByRatio?.[spec.canvas?.ratio];
  if (!size) return null;
  return {
    geometry_profile: styleContext.profile.id,
    resolved_model: styleContext.profile.model,
    requested_dimensions: { width: size.width, height: size.height },
    target_aspect_ratio: spec.canvas.ratio,
    design_dimensions: { width: spec.canvas.width, height: spec.canvas.height },
    delivery_dimensions: 'source',
    ratio_tolerance: spec.inputHandling?.ratioTolerance,
    minimum_short_edge: spec.inputHandling?.minShortEdge ?? null,
    native_output_policy: 'preserve',
    post_generation_resize: 'forbidden'
  };
}

function validateRequest(request, state, platform, mode, selection, titleBinding, coverageBinding, paths, issues) {
  const attempt = paths.attempt;
  const bounded = state.capabilities?.providers?.illustration?.profile === 'bounded-per-image';
  const legacy = state.stages?.visual?.status === 'completed' && !coverageBinding;
  const expectedInputs = [
    { role: 'final_draft', path: selection?.draft_path, sha256: selection?.draft_sha256 },
    { role: 'title_selection', path: titleBinding?.path, sha256: titleBinding?.sha256 }
  ];
  if (!legacy) expectedInputs.push(
    { role: 'visual_coverage', path: coverageBinding?.path, sha256: coverageBinding?.sha256 }
  );
  if (!exactKeys(request, requestKeys) || request.schema_version !== 1
    || request.contract !== 'content-production-provider/v1' || request.capability !== 'illustration'
    || request.provider_contract !== 'illustration-v1'
    || request.task_id !== taskId(state, platform, selection?.variant, mode, attempt)
    || !isAbsolute(request.run_dir || '') || resolve(request.run_dir || '') !== resolve(state.__runDir)
    || request.run_mode !== state.run_mode || request.mode !== mode || request.attempt !== attempt
    || request.platform !== platform || request.provider_platform !== providerPlatform(platform)
    || request.variant !== selection?.variant || !isDeepStrictEqual(request.selection, selection)
    || !exactKeys(request.selection, selectionKeys)
    || request.output_dir !== paths.base || request.interaction_policy !== 'return_to_orchestrator'
    || !expectedOptions(platform, request.options, bounded)) {
    issues.push(issue('invalid_illustration_request', `Canonical ${mode} request is invalid for ${platform}.`));
  }
  if (mode === 'generate') expectedInputs.push(
    { role: 'illustration_plan', path: paths.plan, sha256: request.inputs?.find((item) => item.role === 'illustration_plan')?.sha256 },
    { role: 'shot_list', path: paths.shotList, sha256: request.inputs?.find((item) => item.role === 'shot_list')?.sha256 }
  );
  if (!Array.isArray(request.inputs) || request.inputs.length !== expectedInputs.length
    || !isDeepStrictEqual(request.inputs, expectedInputs)) {
    issues.push(issue('illustration_lineage_drift', `${platform} ${mode} request does not bind the approved title winner and current coverage.`));
  }
}

async function validateResult(runDir, requestPath, result, request, expectedArtifacts, expectedRoles, issues) {
  const validArtifacts = Array.isArray(result?.artifacts) && result.artifacts.length === expectedArtifacts.length
    && result.artifacts.every((artifact, index) => exactKeys(artifact, ['role', 'path', 'sha256'])
      && artifact.role === expectedRoles[index] && artifact.path === expectedArtifacts[index]
      && /^[a-f0-9]{64}$/.test(artifact.sha256 || ''));
  if (!exactKeys(result, resultKeys) || result.schema_version !== 1
    || result.contract !== 'content-production-provider/v1'
    || result.provider_contract !== 'illustration-v1' || result.task_id !== request?.task_id
    || result.request_sha256 !== await fileSha256(requestPath) || result.status !== 'PASS'
    || !exactKeys(result.checks, ['request_valid', 'mode', 'attempt', 'platform', 'provider_platform'])
    || result.checks.request_valid !== true || result.checks.mode !== request?.mode
    || result.checks.attempt !== request?.attempt || result.checks.platform !== request?.platform
    || result.checks.provider_platform !== request?.provider_platform
    || !Array.isArray(result.issues) || result.issues.length
    || !Array.isArray(result.warnings) || !validArtifacts) {
    issues.push(issue('invalid_illustration_result', `Canonical PASS result is invalid for ${request?.platform || '(unknown)'}/${request?.mode || '(unknown)'}.`));
  }
}

function validateShotList(text, plan, issues, platform) {
  const anchors = Array.isArray(plan.anchors) ? plan.anchors : [];
  if (!text.includes('artifact: IllustrationShotList') || !text.includes('status: READY')
    || !text.includes(`task_id: ${plan.task_id}`)) {
    issues.push(issue('invalid_illustration_shot_list', `${platform} shot list frontmatter is invalid.`));
  }
  const ids = [...text.matchAll(/^##\s+([a-z0-9][a-z0-9-]*)\s*$/gim)].map((match) => match[1]);
  if (!isDeepStrictEqual(ids, anchors.map((anchor) => anchor.image_id))) {
    issues.push(issue('invalid_illustration_shot_list', `${platform} shot list IDs do not exactly match the plan.`));
  }
  const fields = [
    ['Placement or sequence', 'placement'],
    ['One core meaning', 'core_meaning'],
    ['Content expression structure', 'structure'],
    ['Visual metaphor', 'visual_metaphor'],
    ['Main actor/object action', 'main_action'],
    ['QA risk', 'qa_risk']
  ];
  for (const anchor of anchors) {
    for (const [label, key] of fields) {
      if (!text.includes(`- ${label}: ${anchor[key]}`)) {
        issues.push(issue('invalid_illustration_shot_list', `${platform}/${anchor.image_id} shot list omits ${label}.`));
      }
    }
    for (const value of [...anchor.suggested_elements, ...anchor.short_labels]) {
      if (!text.includes(value)) issues.push(issue('invalid_illustration_shot_list', `${platform}/${anchor.image_id} shot list omits ${value}.`));
    }
  }
}

async function currentGeneratedFiles(runDir, paths) {
  const found = [];
  async function walk(relativePath) {
    const absolute = resolve(runDir, relativePath);
    if (!fileExists(absolute) || (await lstat(absolute)).isSymbolicLink()) return;
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const child = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else found.push(child);
    }
  }
  await walk(`${paths.base}/prompts`);
  await walk(`${paths.base}/images`);
  if (paths.attempt === 1) {
    return found.filter((path) => !path.includes('/prompts/v')
      && !/\/images\/(?:unbranded\/|branded\/)?v\d{3}\//.test(path));
  }
  return found.filter((path) => path.includes(`/prompts/${paths.version}/`)
    || path.includes(`/images/${paths.version}/`)
    || path.includes(`/images/unbranded/${paths.version}/`)
    || path.includes(`/images/branded/${paths.version}/`));
}

async function currentBoundedControlFiles(runDir, paths) {
  const found = [];
  async function walk(relativePath) {
    const absolute = resolve(runDir, relativePath);
    if (!fileExists(absolute) || (await lstat(absolute)).isSymbolicLink()) return;
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const child = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else found.push(child);
    }
  }
  const suffix = paths.attempt === 1 ? '' : `/${paths.version}`;
  await walk(`${paths.base}/children${suffix}`);
  await walk(`${paths.base}/set-qa${suffix}`);
  if (paths.attempt !== 1) return found;
  return found.filter((path) => !path.includes('/children/v') && !path.includes('/set-qa/v'));
}

async function validatePlanTask(runDir, context, state, platform, selection, titleBinding, coverageBinding) {
  const issues = [];
  const paths = illustrationPaths(state, platform);
  const requestPath = await safeFile(runDir, context.runReal, paths.planRequest, issues, 'missing_illustration_plan_control');
  const resultPath = await safeFile(runDir, context.runReal, paths.planResult, issues, 'missing_illustration_plan_control');
  const planPath = await safeFile(runDir, context.runReal, paths.plan, issues, 'missing_illustration_plan');
  const shotPath = await safeFile(runDir, context.runReal, paths.shotList, issues, 'missing_illustration_shot_list');
  let request = null;
  let result = null;
  let plan = null;
  try { if (requestPath) request = await readJson(requestPath); } catch (error) {
    issues.push(issue('invalid_illustration_request', error.message, { path: paths.planRequest }));
  }
  try { if (resultPath) result = await readJson(resultPath); } catch (error) {
    issues.push(issue('invalid_illustration_result', error.message, { path: paths.planResult }));
  }
  try { if (planPath) plan = await readJson(planPath); } catch (error) {
    issues.push(issue('invalid_illustration_plan', error.message, { path: paths.plan }));
  }
  if (!request || !result || !plan || !shotPath) return { issues, paths, request, result, plan };
  validateRequest(request, state, platform, 'plan', selection, titleBinding, coverageBinding, paths, issues);
  if (!isDeepStrictEqual(request.expected_artifacts, [paths.plan, paths.shotList])) {
    issues.push(issue('invalid_illustration_request', `${platform} plan request must expect only plan and shot list.`));
  }
  const sourcePath = selection?.draft_path
    ? await safeFile(runDir, context.runReal, selection.draft_path, issues, 'illustration_lineage_drift') : null;
  const sourceText = sourcePath ? await readText(sourcePath) : '';
  if (!sourcePath || await fileSha256(sourcePath) !== selection?.draft_sha256
    || state.platform_selections?.[platform]
      && !isDeepStrictEqual(state.platform_selections[platform], selection)) {
    issues.push(issue('illustration_lineage_drift', `Approved ${platform} draft is missing, stale, or differs from run state.`));
  }
  const styleContext = await loadStyleContext(context.provider, request, issues);
  const expectedStyleValue = styleContext ? expectedStyle(styleContext) : null;
  const expectedBrandValue = styleContext ? expectedBrand(styleContext, request.options.brand_override) : null;
  const expectedGeometryValue = styleContext ? expectedGeometry(styleContext) : null;
  const backend = plan.generation_backend;
  const bounded = state.capabilities?.providers?.illustration?.profile === 'bounded-per-image';
  const validBackend = exactKeys(backend, bounded ? boundedBackendKeys : backendKeys)
    && ['runtime-native', 'configured-api'].includes(backend.kind) && nonempty(backend.adapter)
    && ['runtime-native', 'active-runtime-config', 'user-confirmed-config'].includes(backend.endpoint_source)
    && backend.resolved_model === 'gpt-image-2' && ['png', 'jpeg', 'jpg'].includes(backend.artifact_format)
    && backend.credential_access === 'pass' && backend.model_check === 'pass'
    && nonempty(backend.process_cleanup_plan) && backend.process_cleanup_status === 'not-run'
    && (!bounded || ['hard_parameter', 'prompt_only'].includes(backend.aspect_control)
      && (backend.aspect_control === 'prompt_only' && backend.structured_size === null
        || backend.aspect_control === 'hard_parameter'
          && isDeepStrictEqual(backend.structured_size, plan.generation_geometry?.requested_dimensions)))
    && (request.options.backend_hint === 'unknown' || request.options.backend_hint === backend.kind)
    && (!expectedBrandValue?.enabled || backend.artifact_format === 'png');
  const anchors = Array.isArray(plan.anchors) ? plan.anchors : [];
  const ids = anchors.map((anchor) => anchor?.image_id);
  const meanings = anchors.map((anchor) => anchor?.core_meaning);
  const excerpts = anchors.map((anchor) => anchor?.source_excerpt?.replace(/\s+/g, ' ').trim());
  const validAnchors = anchors.length > 0 && (!bounded || anchors.length <= 8)
    && new Set(ids).size === anchors.length && new Set(excerpts).size === anchors.length
    && new Set(meanings).size === anchors.length && anchors.every((anchor) => exactKeys(anchor, bounded ? boundedAnchorKeys : anchorKeys)
      && /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(anchor.image_id || '')
      && ['placement', 'source_excerpt', 'core_meaning', 'structure', 'visual_metaphor', 'main_action', 'qa_risk'].every((key) => nonempty(anchor[key]))
      && stringList(anchor.suggested_elements) && (bounded
        ? ['icons_only', 'allowlist'].includes(anchor.text_mode)
          && stringArray(anchor.short_labels)
          && (anchor.text_mode !== 'icons_only' || anchor.short_labels.length === 0)
          && (anchor.text_mode !== 'allowlist' || anchor.short_labels.length > 0)
          && (!/(?:workflow|process|checklist)/i.test(anchor.structure) || anchor.text_mode === 'icons_only')
        : stringList(anchor.short_labels))
      && sourceText.includes(anchor.source_excerpt));
  const validPlan = exactKeys(plan, planKeys) && plan.schema_version === 1
    && plan.task_id === request.task_id && plan.status === 'READY' && plan.platform === platform
    && plan.provider_platform === providerPlatform(platform) && plan.variant === selection?.variant
    && isDeepStrictEqual(plan.source, request.inputs[0]) && isDeepStrictEqual(plan.selection, selection)
    && isDeepStrictEqual(plan.options, request.options)
    && exactKeys(plan.analysis, ['main_line', 'content_type', 'expression_need'])
    && nonempty(plan.analysis.main_line) && nonempty(plan.analysis.content_type)
    && expressions.has(plan.analysis.expression_need) && exactKeys(plan.style, styleKeys)
    && (!expectedStyleValue || isDeepStrictEqual(plan.style, expectedStyleValue))
    && exactKeys(plan.brand, brandKeys) && (!expectedBrandValue || isDeepStrictEqual(plan.brand, expectedBrandValue))
    && validBackend && exactKeys(plan.generation_geometry, geometryKeys)
    && (!expectedGeometryValue || isDeepStrictEqual(plan.generation_geometry, expectedGeometryValue))
    && Number.isInteger(plan.image_count) && plan.image_count > 0 && plan.image_count === anchors.length
    && (request.options.max_images === null || plan.image_count <= request.options.max_images)
    && validAnchors && exactKeys(plan.shot_list, ['path', 'sha256'])
    && plan.shot_list.path === paths.shotList && /^[a-f0-9]{64}$/.test(plan.shot_list.sha256 || '')
    && plan.shot_list.sha256 === await fileSha256(shotPath) && plan.residual_risk === 'none';
  if (!validPlan) issues.push(issue('invalid_illustration_plan', `${platform} plan does not match its request, style, geometry, or source anchors.`));
  if (request.options.max_images !== null && plan.image_count > request.options.max_images) {
    issues.push(issue('illustration_count_exceeds_max', `${platform} plan exceeds max_images.`));
  }
  if (coverageBinding?.value) {
    issues.push(...evaluatePlatformCardinality(plan, coverageBinding.value).issues);
  }
  if (state.gates?.visual?.status !== 'approved' && (await currentGeneratedFiles(runDir, paths)).length) {
    issues.push(issue('plan_contains_generated_assets', `${platform} plan phase already contains current-attempt prompts or images.`));
  }
  validateShotList(await readText(shotPath), plan, issues, platform);
  await validateResult(
    runDir,
    requestPath,
    result,
    request,
    [paths.plan, paths.shotList],
    ['illustration_plan', 'shot_list'],
    issues
  );
  if (result.artifacts?.[0]?.sha256 !== await fileSha256(planPath)
    || result.artifacts?.[1]?.sha256 !== await fileSha256(shotPath)) {
    issues.push(issue('illustration_plan_result_drift', `${platform} plan result hashes are stale.`));
  }
  return { issues, paths, request, result, plan, planPath, shotPath, sourceText, styleContext };
}

async function validateVisualGate(runDir, state, tasks, issues) {
  if (state.gates?.visual?.status !== 'approved') return;
  const expected = tasks.flatMap((task) => [task.paths.plan, task.paths.shotList]);
  const bindings = state.gates.visual.bound_artifacts || [];
  const paths = bindings.map((binding) => binding?.path);
  if (bindings.length !== expected.length || new Set(paths).size !== expected.length
    || !expected.every((path) => paths.includes(path))) {
    issues.push(issue('invalid_visual_plan_binding', 'Approved visual gate must bind exactly the five current plans and shot lists.'));
    return;
  }
  for (const binding of bindings) {
    const absolute = nonempty(binding?.path) ? join(runDir, binding.path) : null;
    if (!exactKeys(binding, ['path', 'sha256']) || !absolute || !fileExists(absolute)
      || !/^[a-f0-9]{64}$/.test(binding.sha256 || '')
      || binding.sha256 !== await fileSha256(absolute)) {
      issues.push(issue('invalid_visual_plan_binding', `Approved visual binding is missing or invalid: ${binding?.path || '(missing)'}.`, { path: binding?.path || null }));
    }
  }
}

export async function validateIllustrationPlans(runDir, state) {
  const issues = [];
  const workingState = { ...state, __runDir: resolve(runDir) };
  const context = await loadRunContext(runDir, state, issues);
  if (!context) return { issues, tasks: [] };
  const title = await approvedSelections(runDir, context.runReal, state, issues);
  const coverage = await validateVisualCoverageSet(runDir, state);
  issues.push(...coverage.issues);
  const tasks = [];
  for (const platform of platforms) {
    const task = await validatePlanTask(
      runDir, context, workingState, platform, title.selections.get(platform), title.binding,
      coverage.coverages.get(platform)
    );
    tasks.push({ platform, ...task });
    issues.push(...task.issues);
  }
  await validateVisualGate(runDir, state, tasks, issues);
  return { issues, tasks };
}

function generatedPaths(paths, plan) {
  const anchors = Array.isArray(plan.anchors) ? plan.anchors : [];
  const extension = plan.generation_backend.artifact_format === 'png' ? 'png' : 'jpg';
  const prompts = anchors.map((anchor) => `${paths.promptDir}${anchor.image_id}.md`);
  const sources = plan.brand.enabled
    ? anchors.map((anchor) => `${paths.sourceImageDir}${anchor.image_id}.${extension}`) : [];
  const deliveries = anchors.map((anchor) => plan.brand.enabled
    ? `${paths.brandedImageDir}${anchor.image_id}.${extension}`
    : `${paths.imageDir}${anchor.image_id}.${extension}`);
  return {
    prompts,
    sources,
    deliveries,
    expected: [paths.bundle, paths.manifest, ...prompts, ...sources, ...deliveries],
    roles: [
      'illustration_bundle', 'native_manifest',
      ...prompts.map(() => 'prompt'),
      ...sources.map(() => 'source_image'),
      ...deliveries.map(() => 'delivery_image')
    ]
  };
}

async function rasterInfo(path) {
  try { return readRasterInfo(path); } catch { return null; }
}

function sameDimensions(left, right) {
  return exactKeys(left, ['width', 'height']) && exactKeys(right, ['width', 'height'])
    && left.width === right.width && left.height === right.height;
}

async function validateImage(runDir, runReal, task, image, anchor, index, generated, issues) {
  const plan = task.plan;
  const expectedFile = generated.deliveries[index];
  const expectedSource = plan.brand.enabled ? generated.sources[index] : null;
  const expectedPrompt = generated.prompts[index];
  if (!exactKeys(image, imageKeys) || image.image_id !== anchor.image_id
    || image.file !== expectedFile || image.source_file !== expectedSource
    || image.prompt_path !== expectedPrompt || image.placement !== anchor.placement
    || image.core_meaning !== anchor.core_meaning || image.structure !== anchor.structure
    || image.visual_metaphor !== anchor.visual_metaphor || image.content_qa_status !== 'pass'
    || image.style_qa_status !== 'pass' || image.set_qa_status !== 'pass'
    || image.size_check_status !== 'pass-native' || !Number.isInteger(image.generation_attempt)
    || image.generation_attempt < 1 || image.generation_attempt > 3
    || !isDeepStrictEqual(image.requested_dimensions, plan.generation_geometry.requested_dimensions)
    || image.native_output_preserved !== true || image.residual_risk !== 'none') {
    issues.push(issue('invalid_illustration_image', `${task.platform}/${anchor.image_id} does not match its approved anchor or QA contract.`));
  }
  const promptPath = await safeFile(runDir, runReal, expectedPrompt, issues, 'illustration_prompt_unsafe');
  const deliveryPath = await safeFile(runDir, runReal, expectedFile, issues, 'illustration_image_unsafe');
  const sourcePath = expectedSource
    ? await safeFile(runDir, runReal, expectedSource, issues, 'illustration_image_unsafe') : null;
  if (!promptPath || !deliveryPath || expectedSource && !sourcePath) return;
  const promptText = await readText(promptPath);
  if (!promptText.trim() || image.prompt_sha256 !== await fileSha256(promptPath)) {
    issues.push(issue('illustration_prompt_drift', `${task.platform}/${anchor.image_id} prompt is empty or stale.`));
  }
  const delivery = await rasterInfo(deliveryPath);
  const source = sourcePath ? await rasterInfo(sourcePath) : delivery;
  const extension = extname(deliveryPath).toLowerCase();
  const expectedFormat = plan.generation_backend.artifact_format === 'png' ? 'png' : 'jpg';
  const actualDimensions = { width: source.width, height: source.height };
  const deliveryDimensions = { width: delivery.width, height: delivery.height };
  const ratio = source.width && source.height ? source.width / source.height : NaN;
  const [ratioWidth, ratioHeight] = plan.generation_geometry.target_aspect_ratio.split(':').map(Number);
  const targetRatio = ratioWidth / ratioHeight;
  const geometryValid = Number.isInteger(source.width) && Number.isInteger(source.height)
    && source.width > 0 && source.height > 0 && source.format === expectedFormat
    && delivery.format === expectedFormat && ['.png', '.jpg', '.jpeg'].includes(extension)
    && Math.abs(ratio - targetRatio) <= plan.generation_geometry.ratio_tolerance
    && (plan.generation_geometry.minimum_short_edge === null
      || Math.min(source.width, source.height) >= plan.generation_geometry.minimum_short_edge)
    && sameDimensions(actualDimensions, image.source_dimensions)
    && sameDimensions(deliveryDimensions, image.delivery_dimensions)
    && sameDimensions(actualDimensions, deliveryDimensions)
    && Math.abs(image.source_aspect_ratio - ratio) < 1e-9;
  if (!geometryValid) {
    issues.push(issue('illustration_geometry_mismatch', `${task.platform}/${anchor.image_id} raster geometry is invalid.`));
  }
  if (image.file_sha256 !== await fileSha256(deliveryPath)
    || image.source_sha256 !== (sourcePath ? await fileSha256(sourcePath) : null)) {
    issues.push(issue('illustration_image_drift', `${task.platform}/${anchor.image_id} raster hash is stale.`));
  }
  if (!exactKeys(image.source_artifact, ['format', 'bytes'])
    || image.source_artifact.format !== expectedFormat || image.source_artifact.bytes !== source.bytes
    || !exactKeys(image.delivery_artifact, ['format', 'bytes', 'hard_limit_exporter'])
    || image.delivery_artifact.format !== expectedFormat || image.delivery_artifact.bytes !== delivery.bytes
    || image.delivery_artifact.hard_limit_exporter !== null) {
    issues.push(issue('illustration_artifact_metadata_invalid', `${task.platform}/${anchor.image_id} raster metadata is invalid.`));
  }
  const disabled = plan.brand.disabled_reason;
  const actions = Array.isArray(image.post_generation_actions) ? image.post_generation_actions : [];
  const brandValid = plan.brand.enabled
    ? image.brand_qa_status === 'pass' && image.brand_overlay_status === 'applied'
      && sourcePath && expectedFormat === 'png' && actions.length === 1
      && actions[0] === 'brand-overlay-native'
      && image.file_sha256 !== image.source_sha256
    : image.brand_qa_status === disabled && image.brand_overlay_status === disabled
      && image.source_file === null && image.source_sha256 === null
      && Array.isArray(image.post_generation_actions) && actions.length === 0;
  if (!brandValid) issues.push(issue('illustration_brand_qa_invalid', `${task.platform}/${anchor.image_id} brand state is invalid.`));
  const attempts = image.geometry_attempts;
  const attemptsValid = Array.isArray(attempts) && attempts.length === image.generation_attempt
    && attempts.every((attempt, attemptIndex) => exactKeys(attempt, ['attempt', 'requested_dimensions', 'source_dimensions', 'status'])
      && attempt.attempt === attemptIndex + 1
      && isDeepStrictEqual(attempt.requested_dimensions, plan.generation_geometry.requested_dimensions)
      && exactKeys(attempt.source_dimensions, ['width', 'height'])
      && ['pass-native', 'rejected-geometry', 'rejected-qa'].includes(attempt.status))
    && attempts.at(-1)?.status === 'pass-native'
    && isDeepStrictEqual(attempts.at(-1)?.source_dimensions, image.source_dimensions);
  if (!attemptsValid) issues.push(issue('illustration_geometry_attempts_invalid', `${task.platform}/${anchor.image_id} geometry attempts are invalid.`));
}

async function validateGenerateTask(runDir, runReal, state, task) {
  const issues = [];
  const { platform, paths, plan } = task;
  if (!plan) return { issues: [issue('missing_illustration_plan', `Cannot validate ${platform} generation without a valid plan.`)] };
  if (!Array.isArray(plan.anchors) || !plain(plan.generation_backend) || !plain(plan.brand)
    || !plain(plan.generation_geometry) || !task.planPath || !task.shotPath) {
    return { issues: [issue('invalid_illustration_plan', `Cannot validate ${platform} generation from a malformed plan.`)] };
  }
  const generated = generatedPaths(paths, plan);
  const generatedFiles = await currentGeneratedFiles(runDir, paths);
  const expectedGeneratedFiles = [...generated.prompts, ...generated.sources, ...generated.deliveries];
  if (generatedFiles.length !== expectedGeneratedFiles.length
    || new Set(generatedFiles).size !== expectedGeneratedFiles.length
    || !expectedGeneratedFiles.every((path) => generatedFiles.includes(path))) {
    issues.push(issue('undeclared_illustration_artifact', `${platform} current attempt contains missing or undeclared prompts/images.`));
  }
  const requestPath = await safeFile(runDir, runReal, paths.generateRequest, issues, 'missing_illustration_generate_control');
  const resultPath = await safeFile(runDir, runReal, paths.generateResult, issues, 'missing_illustration_generate_control');
  const bundlePath = await safeFile(runDir, runReal, paths.bundle, issues, 'missing_illustration_bundle');
  const manifestPath = await safeFile(runDir, runReal, paths.manifest, issues, 'missing_illustration_manifest');
  let request = null;
  let result = null;
  let bundle = null;
  try { if (requestPath) request = await readJson(requestPath); } catch (error) {
    issues.push(issue('invalid_illustration_request', error.message, { path: paths.generateRequest }));
  }
  try { if (resultPath) result = await readJson(resultPath); } catch (error) {
    issues.push(issue('invalid_illustration_result', error.message, { path: paths.generateResult }));
  }
  try { if (bundlePath) bundle = await readJson(bundlePath); } catch (error) {
    issues.push(issue('invalid_illustration_bundle', error.message, { path: paths.bundle }));
  }
  if (!request || !result || !bundle || !manifestPath) return { issues, request, result, bundle, generated };
  const selection = task.request?.selection;
  validateRequest(request, state, platform, 'generate', selection, request.inputs?.[1], request.inputs?.[2], paths, issues);
  const planHash = await fileSha256(task.planPath);
  const shotHash = await fileSha256(task.shotPath);
  const expectedInputs = [
    ...task.request.inputs.filter((input) => ['final_draft', 'title_selection', 'visual_coverage'].includes(input.role)),
    { role: 'illustration_plan', path: paths.plan, sha256: planHash },
    { role: 'shot_list', path: paths.shotList, sha256: shotHash }
  ];
  if (!isDeepStrictEqual(request.inputs, expectedInputs)
    || !isDeepStrictEqual(request.options, plan.options)
    || !isDeepStrictEqual(request.expected_artifacts, generated.expected)) {
    issues.push(issue('illustration_generate_lineage_invalid', `${platform} generate request does not bind the approved plan exactly.`));
  }
  await validateResult(runDir, requestPath, result, request, generated.expected, generated.roles, issues);
  const expectedBackend = { ...plan.generation_backend, process_cleanup_status: 'pass' };
  const validBundle = exactKeys(bundle, bundleKeys) && bundle.schema_version === 1
    && bundle.task_id === request.task_id && bundle.status === 'PASS' && bundle.platform === platform
    && bundle.provider_platform === providerPlatform(platform) && bundle.variant === plan.variant
    && isDeepStrictEqual(bundle.source, request.inputs[0]) && isDeepStrictEqual(bundle.selection, selection)
    && isDeepStrictEqual(bundle.plan, { path: paths.plan, sha256: planHash })
    && isDeepStrictEqual(bundle.shot_list, { path: paths.shotList, sha256: shotHash })
    && isDeepStrictEqual(bundle.style, plan.style) && isDeepStrictEqual(bundle.brand, plan.brand)
    && exactKeys(bundle.generation_backend, backendKeys)
    && isDeepStrictEqual(bundle.generation_backend, expectedBackend)
    && isDeepStrictEqual(bundle.generation_geometry, plan.generation_geometry)
    && bundle.image_count === plan.image_count && Array.isArray(bundle.images)
    && bundle.images.length === plan.image_count && exactKeys(bundle.manifest, ['path', 'sha256'])
    && bundle.manifest.path === paths.manifest && bundle.manifest.sha256 === await fileSha256(manifestPath)
    && bundle.residual_risk === 'none';
  if (!validBundle) issues.push(issue('invalid_illustration_bundle', `${platform} bundle does not exactly mirror its approved plan and generate request.`));
  const images = Array.isArray(bundle.images) ? bundle.images : [];
  const ids = images.map((image) => image?.image_id);
  if (!isDeepStrictEqual(ids, plan.anchors.map((anchor) => anchor.image_id))) {
    issues.push(issue('illustration_image_ids_mismatch', `${platform} bundle image IDs differ from the approved plan.`));
  }
  for (const [index, anchor] of plan.anchors.entries()) {
    if (images[index]) {
      await validateImage(runDir, runReal, task, images[index], anchor, index, generated, issues);
    }
  }
  const manifest = await readText(manifestPath);
  if (!manifest.trim() || !manifest.includes(`platform: ${providerPlatform(platform)}`)
    || !manifest.includes(`style_id: ${plan.style.id}`)
    || plan.anchors.some((anchor) => !manifest.includes(`image_id: ${anchor.image_id}`))) {
    issues.push(issue('invalid_illustration_manifest', `${platform} native manifest is incomplete.`));
  }
  for (const [index, artifact] of (result.artifacts || []).entries()) {
    const path = await safeFile(runDir, runReal, generated.expected[index], issues, 'illustration_result_artifact_unsafe');
    if (path && artifact?.sha256 !== await fileSha256(path)) {
      issues.push(issue('illustration_result_artifact_drift', `${platform} result hash is stale: ${artifact?.path || generated.expected[index]}.`, { path: artifact?.path || generated.expected[index] }));
    }
  }
  return { issues, request, result, bundle, generated };
}

function boundedQueuePath(state) {
  const attempt = state.stages.visual.attempt;
  return `07-visual/generation-queue${attempt === 1 ? '' : `.v${String(attempt).padStart(3, '0')}`}.json`;
}

async function validateBoundedChild(runDir, runReal, state, task, suite, anchor, child, issues) {
  if (!child || child.status !== 'pass' || !Number.isInteger(child.selected_attempt)
    || child.selected_attempt < 1 || child.selected_attempt > 3
    || !Array.isArray(child.attempts) || child.attempts.length !== child.selected_attempt) {
    issues.push(issue('invalid_illustration_child_state', `${task.platform}/${anchor.image_id} has no complete selected child attempt.`));
    return null;
  }
  let selected = null;
  for (const [index, row] of child.attempts.entries()) {
    const requestPath = await safeFile(runDir, runReal, row?.request_path, issues, 'missing_illustration_child_control');
    const resultPath = await safeFile(runDir, runReal, row?.result_path, issues, 'missing_illustration_child_control');
    if (!requestPath || !resultPath) continue;
    let request = null;
    let result = null;
    try { request = await readJson(requestPath); } catch (error) {
      issues.push(issue('invalid_illustration_child_request', error.message, { path: row.request_path }));
    }
    try { result = await readJson(resultPath); } catch (error) {
      issues.push(issue('invalid_illustration_child_result', error.message, { path: row.result_path }));
    }
    if (!request || !result) continue;
    const attempt = index + 1;
    const expectedTask = `illustration:${state.run_id}:${task.platform}:${task.plan.variant}:${anchor.image_id}:candidate-${String(attempt).padStart(2, '0')}:visual-${String(state.stages.visual.attempt).padStart(3, '0')}`;
    const artifactPaths = [...new Set(Object.values(request.artifacts || {}))];
    const artifactsValid = Array.isArray(result.artifacts)
      && result.artifacts.length === artifactPaths.length
      && result.artifacts.every((artifact) => artifactPaths.includes(artifact?.path)
        && /^[a-f0-9]{64}$/.test(artifact?.sha256 || ''));
    if (row.attempt !== attempt || request.task_id !== expectedTask || row.task_id !== expectedTask
      || request.mode !== 'generate_image' || request.candidate_attempt !== attempt
      || request.platform !== task.platform || request.anchor?.image_id !== anchor.image_id
      || request.parent_task_id !== `illustration:${state.run_id}:${task.platform}:${task.plan.variant}:generate:attempt-${String(state.stages.visual.attempt).padStart(3, '0')}`
      || !isDeepStrictEqual(request.anchor, anchor)
      || !isDeepStrictEqual(request.style, task.plan.style)
      || !isDeepStrictEqual(request.brand, task.plan.brand)
      || !isDeepStrictEqual(request.generation_backend, task.plan.generation_backend)
      || !isDeepStrictEqual(request.generation_geometry, task.plan.generation_geometry)
      || !isDeepStrictEqual(request.expected_artifacts, artifactPaths)
      || result.task_id !== request.task_id || result.request_sha256 !== await fileSha256(requestPath)
      || !['PASS', 'FAILED', 'BLOCKED'].includes(result.status) || !artifactsValid) {
      issues.push(issue('invalid_illustration_child_control', `${task.platform}/${anchor.image_id} attempt ${attempt} is invalid.`));
    }
    for (const artifact of result.artifacts || []) {
      const path = await safeFile(runDir, runReal, artifact.path, issues, 'illustration_child_artifact_unsafe');
      if (path && artifact.sha256 !== await fileSha256(path)) {
        issues.push(issue('illustration_child_artifact_drift', `Child artifact changed: ${artifact.path}.`, { path: artifact.path }));
      }
    }
    const selectedAttempt = attempt === child.selected_attempt;
    if (selectedAttempt && (row.status !== 'pass' || result.status !== 'PASS'
      || result.image?.image_id !== anchor.image_id || result.image?.selected_attempt !== attempt
      || row.result_sha256 !== await fileSha256(resultPath))) {
      issues.push(issue('invalid_illustration_child_result', `${task.platform}/${anchor.image_id} selected result is not a bound PASS.`));
    }
    if (selectedAttempt) selected = { row, request, result };
  }
  return selected;
}

async function validateBoundedGenerateTask(runDir, runReal, state, task, queue) {
  const issues = [];
  const { platform, paths, plan } = task;
  const suite = queue?.suites?.[platform];
  if (!suite || suite.status !== 'pass' || !suite.aggregate
    || !isDeepStrictEqual(suite.image_order, plan?.anchors?.map((anchor) => anchor.image_id))) {
    return { issues: [issue('invalid_illustration_queue_suite', `${platform} queue suite is not a terminal ordered PASS.`)] };
  }
  const requestPath = await safeFile(runDir, runReal, paths.generateRequest, issues, 'missing_illustration_generate_control');
  const resultPath = await safeFile(runDir, runReal, paths.generateResult, issues, 'missing_illustration_generate_control');
  const bundlePath = await safeFile(runDir, runReal, paths.bundle, issues, 'missing_illustration_bundle');
  const manifestPath = await safeFile(runDir, runReal, paths.manifest, issues, 'missing_illustration_manifest');
  if (!requestPath || !resultPath || !bundlePath || !manifestPath) return { issues };
  let request;
  let result;
  let bundle;
  try {
    [request, result, bundle] = await Promise.all([
      readJson(requestPath), readJson(resultPath), readJson(bundlePath)
    ]);
  } catch (error) {
    issues.push(issue('invalid_illustration_bounded_output', error.message));
    return { issues };
  }
  const planHash = await fileSha256(task.planPath);
  const shotHash = await fileSha256(task.shotPath);
  const expectedInputs = [
    ...task.request.inputs.filter((input) => ['final_draft', 'title_selection', 'visual_coverage'].includes(input.role)),
    { role: 'illustration_plan', path: paths.plan, sha256: planHash },
    { role: 'shot_list', path: paths.shotList, sha256: shotHash }
  ];
  validateRequest(request, state, platform, 'generate', task.request.selection, request.inputs?.[1], request.inputs?.[2], paths, issues);
  if (!isDeepStrictEqual(request.inputs, expectedInputs) || !isDeepStrictEqual(request.options, plan.options)
    || !isDeepStrictEqual(request.expected_artifacts, [paths.bundle, paths.manifest])) {
    issues.push(issue('illustration_generate_lineage_invalid', `${platform} bounded parent request does not bind the approved plan exactly.`));
  }
  await validateResult(
    runDir,
    requestPath,
    result,
    request,
    [paths.bundle, paths.manifest],
    ['illustration_bundle', 'native_manifest'],
    issues
  );
  const expectedBackend = { ...plan.generation_backend, process_cleanup_status: 'pass' };
  const validBundle = exactKeys(bundle, bundleKeys) && bundle.schema_version === 1
    && bundle.task_id === request.task_id && bundle.status === 'PASS' && bundle.platform === platform
    && bundle.provider_platform === providerPlatform(platform) && bundle.variant === plan.variant
    && isDeepStrictEqual(bundle.source, request.inputs[0]) && isDeepStrictEqual(bundle.selection, request.selection)
    && isDeepStrictEqual(bundle.plan, { path: paths.plan, sha256: planHash })
    && isDeepStrictEqual(bundle.shot_list, { path: paths.shotList, sha256: shotHash })
    && isDeepStrictEqual(bundle.style, plan.style) && isDeepStrictEqual(bundle.brand, plan.brand)
    && exactKeys(bundle.generation_backend, boundedBackendKeys)
    && isDeepStrictEqual(bundle.generation_backend, expectedBackend)
    && isDeepStrictEqual(bundle.generation_geometry, plan.generation_geometry)
    && bundle.image_count === plan.image_count && Array.isArray(bundle.images)
    && bundle.images.length === plan.image_count && exactKeys(bundle.manifest, ['path', 'sha256'])
    && bundle.manifest.path === paths.manifest && bundle.manifest.sha256 === await fileSha256(manifestPath)
    && bundle.residual_risk === 'none';
  if (!validBundle) issues.push(issue('invalid_illustration_bundle', `${platform} bounded bundle does not mirror its plan and parent request.`));

  const selected = [];
  const declaredGenerated = new Set();
  const declaredControls = new Set();
  for (const [index, anchor] of plan.anchors.entries()) {
    const child = suite.children?.[anchor.image_id];
    const value = await validateBoundedChild(runDir, runReal, state, task, suite, anchor, child, issues);
    selected.push(value);
    for (const row of child?.attempts || []) {
      const childRequestPath = join(runDir, row.request_path);
      if (!fileExists(childRequestPath)) continue;
      const childRequest = await readJson(childRequestPath);
      declaredControls.add(row.request_path);
      declaredControls.add(row.result_path);
      declaredControls.add(childRequest.artifacts.qa);
      for (const path of [childRequest.artifacts?.prompt, childRequest.artifacts?.candidate, childRequest.artifacts?.delivery]) {
        if (path) declaredGenerated.add(path);
      }
    }
    if (value && bundle.images?.[index]) {
      const generated = {
        prompts: [value.request.artifacts.prompt],
        sources: plan.brand.enabled ? [value.request.artifacts.candidate] : [],
        deliveries: [value.request.artifacts.delivery]
      };
      await validateImage(runDir, runReal, task, bundle.images[index], anchor, 0, generated, issues);
      const image = value.result.image;
      if (bundle.images[index].file !== image.delivery.path
        || bundle.images[index].file_sha256 !== image.delivery.sha256
        || bundle.images[index].prompt_sha256 !== image.prompt.sha256
        || bundle.images[index].generation_attempt !== value.row.attempt
        || plan.brand.enabled && bundle.images[index].source_sha256 !== image.source.sha256) {
        issues.push(issue('illustration_child_aggregate_drift', `${platform}/${anchor.image_id} bundle differs from its selected child result.`));
      }
    }
  }
  if (!isDeepStrictEqual(bundle.images?.map((image) => image.image_id), plan.anchors.map((anchor) => anchor.image_id))) {
    issues.push(issue('illustration_image_ids_mismatch', `${platform} bounded bundle image order differs from its plan.`));
  }
  const generatedFiles = await currentGeneratedFiles(runDir, paths);
  if (generatedFiles.length !== declaredGenerated.size
    || generatedFiles.some((path) => !declaredGenerated.has(path))) {
    issues.push(issue('undeclared_illustration_artifact', `${platform} bounded attempt contains missing or undeclared prompts/images.`));
  }
  for (const qaRow of suite.set_qa_rounds || []) {
    declaredControls.add(qaRow.request_path);
    declaredControls.add(qaRow.result_path);
    if (fileExists(join(runDir, qaRow.request_path))) {
      declaredControls.add((await readJson(join(runDir, qaRow.request_path))).review_path);
    }
  }
  const controlFiles = await currentBoundedControlFiles(runDir, paths);
  if (controlFiles.length !== declaredControls.size
    || controlFiles.some((path) => !declaredControls.has(path))) {
    issues.push(issue('undeclared_illustration_control', `${platform} bounded attempt contains missing or undeclared child/Set QA controls.`));
  }
  const lastQa = suite.set_qa_rounds?.at(-1);
  const qaRequestPath = lastQa
    ? await safeFile(runDir, runReal, lastQa.request_path, issues, 'missing_illustration_set_qa_control') : null;
  const qaResultPath = lastQa
    ? await safeFile(runDir, runReal, lastQa.result_path, issues, 'missing_illustration_set_qa_control') : null;
  if (!lastQa || lastQa.status !== 'pass' || !qaRequestPath || !qaResultPath) {
    issues.push(issue('invalid_illustration_set_qa', `${platform} has no terminal Set QA PASS.`));
  } else {
    const qaRequest = await readJson(qaRequestPath);
    const qaResult = await readJson(qaResultPath);
    const expectedQaInputs = selected.map((value, index) => ({
      role: 'illustration_child_result',
      image_id: plan.anchors[index].image_id,
      path: value.row.result_path,
      sha256: value.row.result_sha256
    }));
    if (qaRequest.mode !== 'set_qa' || qaRequest.parent_task_id !== request.task_id
      || !isDeepStrictEqual(qaRequest.inputs, expectedQaInputs)
      || qaResult.status !== 'PASS' || qaResult.set_qa?.status !== 'PASS'
      || qaResult.request_sha256 !== await fileSha256(qaRequestPath)
      || lastQa.result_sha256 !== await fileSha256(qaResultPath)
      || suite.aggregate.set_qa_result?.sha256 !== lastQa.result_sha256
      || suite.aggregate.set_qa_review?.sha256 !== qaResult.set_qa?.review?.sha256) {
      issues.push(issue('invalid_illustration_set_qa', `${platform} Set QA lineage is stale or incomplete.`));
    }
  }
  const manifest = await readText(manifestPath);
  if (!manifest.includes(`platform: ${providerPlatform(platform)}`)
    || !manifest.includes(`style_id: ${plan.style.id}`)
    || plan.anchors.some((anchor) => !manifest.includes(`image_id: ${anchor.image_id}`))) {
    issues.push(issue('invalid_illustration_manifest', `${platform} bounded manifest is incomplete.`));
  }
  if (suite.aggregate.bundle?.sha256 !== await fileSha256(bundlePath)
    || suite.aggregate.manifest?.sha256 !== await fileSha256(manifestPath)
    || suite.aggregate.parent_result?.sha256 !== await fileSha256(resultPath)) {
    issues.push(issue('illustration_aggregate_drift', `${platform} aggregate bindings are stale.`));
  }
  return { issues, request, result, bundle };
}

async function validateCompletedBindings(runDir, runReal, state, issues) {
  if (state.stages?.visual?.status !== 'completed') return;
  const expected = expectedVisualStageArtifacts(state);
  const bindings = (state.stages.visual.artifacts || []).filter((binding) =>
    expected.includes(binding?.path));
  const paths = bindings.map((binding) => binding?.path);
  if (bindings.length !== expected.length || new Set(paths).size !== expected.length
    || !expected.every((path) => paths.includes(path))) {
    issues.push(issue('invalid_visual_stage_binding', 'Completed visual stage must bind exactly 20 current plan, shot-list, bundle, and manifest files.'));
    return;
  }
  for (const binding of bindings) {
    const path = await safeFile(runDir, runReal, binding?.path, issues, 'invalid_visual_stage_binding');
    if (!exactKeys(binding, ['path', 'sha256']) || path
      && (!/^[a-f0-9]{64}$/.test(binding.sha256 || '') || binding.sha256 !== await fileSha256(path))) {
      issues.push(issue('visual_stage_artifact_drift', `Completed visual artifact changed: ${binding?.path || '(missing)'}.`, { path: binding?.path || null }));
    }
  }
}

export async function validateIllustrationGeneration(runDir, state) {
  const planValidation = await validateIllustrationPlans(runDir, state);
  const issues = [...planValidation.issues];
  const decisionValidation = await validateCurrentVisualDecision(runDir, state, planValidation.tasks);
  issues.push(...decisionValidation.issues);
  const bounded = state.capabilities?.providers?.illustration?.profile === 'bounded-per-image';
  if (state.gates?.visual?.status !== 'approved') {
    issues.push(issue('visual_plan_not_approved', 'Illustration generation requires the current visual plan gate to be approved.'));
  }
  let runReal;
  try { runReal = await realpath(runDir); } catch (error) {
    issues.push(issue('invalid_illustration_run_dir', error.message));
    return { issues, tasks: planValidation.tasks };
  }
  let queue = null;
  if (bounded) {
    const relativePath = boundedQueuePath(state);
    const path = await safeFile(runDir, runReal, relativePath, issues, 'missing_illustration_queue');
    try { if (path) queue = await readJson(path); } catch (error) {
      issues.push(issue('invalid_illustration_queue', error.message, { path: relativePath }));
    }
    const validEvents = Array.isArray(queue?.events) && queue.events.every((event) =>
      event?.event !== 'queue_dispatched' || Number.isInteger(event.active_generation_count)
        && event.active_generation_count <= 4
        && Object.values(event.active_generation_by_suite || {}).every((count) => Number.isInteger(count) && count <= 2));
    if (queue?.schema_version !== 1 || queue.profile !== 'bounded-per-image'
      || queue.run_id !== state.run_id || queue.visual_attempt !== state.stages.visual.attempt
      || queue.global_limit !== 4 || queue.suite_limit !== 2 || queue.status !== 'completed'
      || queue.cover?.status !== 'pass' || !validEvents) {
      issues.push(issue('invalid_illustration_queue', 'Bounded illustration queue is not a terminal 4-global/2-suite PASS.'));
    }
    for (const [platform, suite] of Object.entries(queue?.suites || {})) {
      const canary = suite.children?.[suite.canary_id];
      const canaryComplete = canary?.attempts?.find((row) => row.attempt === canary.selected_attempt)?.completed_at;
      const laterStarts = (suite.image_order || []).slice(1).flatMap((imageId) =>
        suite.children?.[imageId]?.attempts?.map((row) => row.started_at) || []).filter(Boolean);
      if (!canaryComplete || laterStarts.some((startedAt) => Date.parse(startedAt) < Date.parse(canaryComplete))) {
        issues.push(issue('illustration_canary_order_invalid', `${platform} dispatched non-canary images before its canary passed.`));
      }
    }
  }
  const tasks = [];
  for (const task of planValidation.tasks) {
    const generation = bounded
      ? await validateBoundedGenerateTask(runDir, runReal, { ...state, __runDir: resolve(runDir) }, task, queue)
      : await validateGenerateTask(runDir, runReal, { ...state, __runDir: resolve(runDir) }, task);
    tasks.push({ ...task, generation });
    issues.push(...generation.issues);
  }
  await validateCompletedBindings(runDir, runReal, state, issues);
  return { issues, tasks };
}

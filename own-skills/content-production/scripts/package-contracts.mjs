import { readFile, lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  fileExists,
  fileSha256,
  filesUnder,
  gateIntegrity,
  platforms,
  readJson,
  readText,
  sha256
} from './lib.mjs';
import { expectedVisualStageArtifacts, illustrationPaths } from './illustration-contracts.mjs';
import { coverPaths, expectedWechatCoverStageArtifacts } from './wechat-cover-contracts.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const ASSET_ID = /^[a-z0-9][a-z0-9-]*$/;
const REQUEST_KEYS = [
  'schema_version', 'contract', 'task_id', 'capability', 'provider_contract',
  'run_dir', 'run_mode', 'mode', 'attempt', 'platform', 'variant', 'asset_id',
  'asset_kind', 'inputs', 'output_dir', 'expected_artifacts', 'options',
  'interaction_policy'
];
const RESULT_KEYS = [
  'schema_version', 'contract', 'provider_contract', 'task_id', 'request_sha256',
  'status', 'artifacts', 'checks', 'compression', 'issues', 'warnings'
];
const COMPRESSION_KEYS = [
  'source', 'candidate', 'source_unchanged', 'dimensions_preserved',
  'saved_bytes', 'saved_percent', 'recommended_selection'
];
const FILE_INFO_KEYS = ['path', 'sha256', 'bytes', 'format', 'width', 'height'];
const SELECTION_KEYS = [
  'platform', 'variant', 'title_id', 'title', 'topic_phrase', 'draft_path',
  'draft_sha256', 'decision_rule'
];
const PLAN_KEYS = [
  'schema_version', 'contract', 'run_id', 'package_attempt', 'visual_attempt',
  'task_count', 'tasks'
];
const PLAN_TASK_KEYS = [
  'task_id', 'platform', 'variant', 'asset_id', 'asset_kind', 'source',
  'candidate', 'request_path', 'result_path'
];
const MANIFEST_KEYS = [
  'schema_version', 'status', 'package_attempt', 'platform', 'variant',
  'source', 'bundle', 'items'
];
const MANIFEST_ITEM_KEYS = [
  'image_id', 'bundle_file', 'bundle_sha256', 'publish_file',
  'publish_sha256', 'markdown_ref'
];
const OPTIMIZATION_KEYS = [
  'schema_version', 'status', 'package_attempt', 'platform', 'items', 'cover'
];
const OPTIMIZATION_ITEM_KEYS = [
  'asset_id', 'source', 'candidate', 'publish', 'selection', 'reason',
  'request', 'result'
];
const METADATA_KEYS = [
  'schema_version', 'status', 'package_attempt', 'platform', 'variant',
  'title_id', 'title', 'topic_phrase', 'source_draft', 'visual_plan',
  'visual_bundle', 'manifest', 'optimization', 'final_markdown', 'cover',
  'image_count'
];

function issue(code, message, extra = {}) {
  return { code, message, resume_from: 'package', ...extra };
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function nonempty(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function inside(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..'
    && !value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function versionData(attempt) {
  const version = `v${String(attempt).padStart(3, '0')}`;
  return {
    version,
    suffix: attempt === 1 ? '' : `.${version}`,
    versionDir: attempt === 1 ? '' : `${version}/`
  };
}

function normalizedFormat(value) {
  if (value === 'jpg' || value === 'jpeg') return 'jpeg';
  return value === 'png' || value === 'webp' ? value : null;
}

function extensionFor(format) {
  return format === 'jpeg' ? 'jpg' : format;
}

function formatFromExtension(path) {
  const value = path.toLowerCase();
  if (value.endsWith('.png')) return 'png';
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'jpeg';
  if (value.endsWith('.webp')) return 'webp';
  return null;
}

function savedPercent(sourceBytes, candidateBytes) {
  return Math.round(((sourceBytes - candidateBytes) / sourceBytes) * 10000) / 100;
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function textWithNewline(value) {
  return value.endsWith('\n') ? value : `${value}\n`;
}

async function safeFile(root, rootReal, relativePath, issues, code) {
  if (!nonempty(relativePath) || isAbsolute(relativePath)) {
    issues.push(issue(code, `Artifact path is invalid: ${relativePath || '(missing)'}.`, { path: relativePath || null }));
    return null;
  }
  const absolute = resolve(root, relativePath);
  if (!inside(root, absolute) || !fileExists(absolute)) {
    issues.push(issue(code, `Artifact is missing or escapes the run: ${relativePath}.`, { path: relativePath }));
    return null;
  }
  try {
    let current = root;
    for (const part of relative(root, absolute).split(/[\\\\/]/).filter(Boolean)) {
      current = join(current, part);
      if ((await lstat(current)).isSymbolicLink()) throw new Error('symbolic link');
    }
    const stat = await lstat(absolute);
    const real = await realpath(absolute);
    if (stat.isSymbolicLink() || !stat.isFile() || !inside(rootReal, real)) throw new Error('not a real in-run file');
    return absolute;
  } catch (error) {
    issues.push(issue(code, `Artifact must be a real file inside the run: ${relativePath}.`, { path: relativePath }));
    return null;
  }
}

async function safeJson(root, rootReal, relativePath, issues, code) {
  const absolute = await safeFile(root, rootReal, relativePath, issues, code);
  if (!absolute) return { absolute: null, value: null };
  try {
    return { absolute, value: await readJson(absolute) };
  } catch (error) {
    issues.push(issue(code, `Invalid JSON at ${relativePath}: ${error.message}`, { path: relativePath }));
    return { absolute, value: null };
  }
}

function exifOrientation(buffer, start, end) {
  const prefixed = end - start >= 6 && buffer.toString('ascii', start, start + 6) === 'Exif\0\0';
  const tiff = prefixed ? start + 6 : start;
  if (end - tiff < 8) return null;
  const order = buffer.toString('ascii', tiff, tiff + 2);
  const little = order === 'II';
  if (!little && order !== 'MM') return null;
  const uint16 = (offset) => little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const uint32 = (offset) => little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  if (uint16(tiff + 2) !== 42) return null;
  const directory = tiff + uint32(tiff + 4);
  if (directory + 2 > end) return null;
  const count = uint16(directory);
  for (let index = 0; index < count; index += 1) {
    const entry = directory + 2 + index * 12;
    if (entry + 12 > end) return null;
    if (uint16(entry) === 0x0112 && uint16(entry + 2) === 3 && uint32(entry + 4) === 1) {
      const orientation = uint16(entry + 8);
      return orientation >= 1 && orientation <= 8 ? orientation : null;
    }
  }
  return null;
}

function displayDimensions(format, width, height, orientation) {
  return [5, 6, 7, 8].includes(orientation)
    ? { format, width: height, height: width }
    : { format, width, height };
}

function pngInfo(buffer) {
  if (buffer.length < 24
    || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
  let offset = 8;
  let dimensions = null;
  let orientation = 1;
  while (offset + 12 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = offset + 8;
    const end = data + size;
    if (end + 4 > buffer.length) return null;
    if (type === 'IHDR' && size === 13) {
      dimensions = { width: buffer.readUInt32BE(data), height: buffer.readUInt32BE(data + 4) };
    } else if (type === 'eXIf') {
      orientation = exifOrientation(buffer, data, end) || orientation;
    }
    if (type === 'IEND') break;
    offset = end + 4;
  }
  return dimensions ? displayDimensions('png', dimensions.width, dimensions.height, orientation) : null;
}

function jpegInfo(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  let orientation = 1;
  let dimensions = null;
  while (offset + 8 < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda || offset + 2 > buffer.length) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (marker === 0xe1) orientation = exifOrientation(buffer, offset + 2, offset + length) || orientation;
    if (sof.has(marker)) {
      dimensions = {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += length;
  }
  return dimensions ? displayDimensions('jpeg', dimensions.width, dimensions.height, orientation) : null;
}

function webpInfo(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF'
    || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  let offset = 12;
  let dimensions = null;
  let orientation = 1;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > buffer.length) return null;
    if (type === 'VP8X' && size >= 10) {
      dimensions = {
        width: 1 + buffer.readUIntLE(data + 4, 3),
        height: 1 + buffer.readUIntLE(data + 7, 3)
      };
    } else if (type === 'VP8L' && size >= 5 && buffer[data] === 0x2f) {
      const b1 = buffer[data + 1];
      const b2 = buffer[data + 2];
      const b3 = buffer[data + 3];
      const b4 = buffer[data + 4];
      dimensions ||= {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10)
      };
    } else if (type === 'VP8 ' && size >= 10 && buffer[data + 3] === 0x9d
      && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      dimensions ||= {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff
      };
    } else if (type === 'EXIF') {
      orientation = exifOrientation(buffer, data, data + size) || orientation;
    }
    offset = data + size + (size % 2);
  }
  return dimensions ? displayDimensions('webp', dimensions.width, dimensions.height, orientation) : null;
}

export async function rasterInfo(path) {
  const buffer = await readFile(path);
  const value = pngInfo(buffer) || jpegInfo(buffer) || webpInfo(buffer);
  return value && value.width > 0 && value.height > 0 ? { ...value, bytes: buffer.length } : null;
}

export function packagePaths(state, platform) {
  const attempt = Number.isInteger(state?.stages?.package?.attempt) && state.stages.package.attempt > 0
    ? state.stages.package.attempt : 1;
  const { version, suffix, versionDir } = versionData(attempt);
  const base = `08-publish-pack/${platform}`;
  return {
    attempt,
    version,
    base,
    imagesDir: `${base}/images/${versionDir}`.replace(/\/$/, ''),
    imagePrefix: `images/${versionDir}`,
    manifest: `07-visual/${platform}/manifest${suffix}.json`,
    final: `${base}/final${suffix}.md`,
    metadata: `${base}/metadata${suffix}.json`,
    optimization: `${base}/optimization${suffix}.json`,
    cover: platform === 'wechat' ? `${base}/cover${suffix}.png` : null,
    article: platform === 'wechat' ? `${base}/article${suffix}.html` : null,
    preview: platform === 'wechat' ? `${base}/article-preview${suffix}.html` : null,
    layoutResult: platform === 'wechat' ? `${base}/layout-result${suffix}.json` : null
  };
}

export function compressionRoot(state) {
  const attempt = Number.isInteger(state?.stages?.package?.attempt) && state.stages.package.attempt > 0
    ? state.stages.package.attempt : 1;
  const { version } = versionData(attempt);
  return attempt === 1 ? '08-publish-pack/_compression' : `08-publish-pack/_compression/${version}`;
}

export function compressionTaskPaths(state, platform, assetId, targetFormat) {
  const base = `${compressionRoot(state)}/${platform}/${assetId}`;
  return {
    base,
    request: `${base}/compression.request.json`,
    result: `${base}/compression.result.json`,
    candidate: `${base}/candidate.${extensionFor(targetFormat)}`
  };
}

export function compressionPlanPath(state) {
  return `${compressionRoot(state)}/compression-plan.json`;
}

export function compressionProviderRequired(state) {
  const provider = state?.capabilities?.providers?.image_compression;
  return state?.schema_version === 2 && (nonempty(state?.capabilities?.config_path)
    || provider?.required === true || nonempty(provider?.skill_path));
}

async function loadContext(runDir, state, issues) {
  const root = resolve(runDir);
  let runReal;
  try {
    const stat = await lstat(root);
    runReal = await realpath(root);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('run_dir must be a real directory');
  } catch (error) {
    issues.push(issue('invalid_package_run_dir', error.message));
    return null;
  }
  const stage = state?.stages?.package;
  if (state?.schema_version !== 2 || !['running', 'completed'].includes(stage?.status)
    || !Number.isInteger(stage?.attempt) || stage.attempt < 1) {
    issues.push(issue('package_stage_mismatch', 'Package requires a positive running or completed package attempt.'));
  }
  if (state?.stages?.visual?.status !== 'completed' || state?.gates?.visual?.status !== 'approved') {
    issues.push(issue('package_visual_prerequisite_missing', 'Package requires the approved completed visual stage.'));
  }
  const provider = state?.capabilities?.providers?.image_compression;
  if (provider?.status !== 'PASS' || provider?.contract !== 'image-compression-v1'
    || !nonempty(provider?.skill_path) || !SHA256.test(provider?.skill_sha256 || '')) {
    issues.push(issue('compression_provider_unavailable', 'The image compression provider snapshot is not PASS, hashed, and registered for image-compression-v1.'));
    return { root, runReal, provider: null };
  }
  try {
    const skillPath = resolve(provider.skill_path);
    const stat = await lstat(skillPath);
    if (stat.isSymbolicLink() || !stat.isFile() || await fileSha256(skillPath) !== provider.skill_sha256) {
      throw new Error('compression provider SKILL.md changed after capability preflight');
    }
  } catch (error) {
    issues.push(issue('compression_provider_unavailable', error.message));
    return { root, runReal, provider: null };
  }
  for (const value of await gateIntegrity(root, state)) {
    issues.push(issue(value.code, value.message || 'An approved artifact changed or disappeared.', value));
  }
  return { root, runReal, provider };
}

async function validateVisualBindings(context, state, issues) {
  const expected = [
    ...expectedVisualStageArtifacts(state),
    ...expectedWechatCoverStageArtifacts(state)
  ];
  const bindings = state?.stages?.visual?.artifacts || [];
  const paths = bindings.map((item) => item?.path);
  if (bindings.length !== expected.length || new Set(paths).size !== expected.length
    || !expected.every((path) => paths.includes(path))) {
    issues.push(issue('invalid_package_visual_binding', 'Package requires the exact current 22-file visual completion binding.', {
      expected,
      actual: paths
    }));
    return null;
  }
  const map = new Map();
  for (const binding of bindings) {
    const absolute = await safeFile(context.root, context.runReal, binding?.path, issues, 'invalid_package_visual_binding');
    if (!exactKeys(binding, ['path', 'sha256']) || !SHA256.test(binding?.sha256 || '')
      || absolute && await fileSha256(absolute) !== binding.sha256) {
      issues.push(issue('package_visual_artifact_drift', `Visual binding is stale: ${binding?.path || '(missing)'}.`, { path: binding?.path || null }));
    } else {
      map.set(binding.path, binding);
    }
  }
  return map;
}

function validSelection(selection, platform) {
  return exactKeys(selection, SELECTION_KEYS) && selection.platform === platform
    && ['A', 'B'].includes(selection.variant) && nonempty(selection.title_id)
    && nonempty(selection.title) && selection.draft_path === `05-platforms/${platform}/${selection.variant}/final.md`
    && SHA256.test(selection.draft_sha256 || '')
    && (platform === 'weibo' ? nonempty(selection.topic_phrase) : selection.topic_phrase === null)
    && nonempty(selection.decision_rule);
}

async function sourceInfo(context, relativePath, declaredHash, issues, code) {
  const absolute = await safeFile(context.root, context.runReal, relativePath, issues, code);
  if (!absolute) return null;
  const hash = await fileSha256(absolute);
  const raster = await rasterInfo(absolute);
  if (hash !== declaredHash || !raster || raster.format !== formatFromExtension(relativePath)) {
    issues.push(issue(code, `Image source is stale or unsupported: ${relativePath}.`, { path: relativePath }));
    return null;
  }
  return { path: relativePath, sha256: hash, ...raster };
}

function taskId(state, task) {
  return `image-compression:${state.run_id}:${task.platform}:${task.variant}:${task.asset_id}:package-${String(task.attempt).padStart(3, '0')}`;
}

function requestOptions(assetKind) {
  return assetKind === 'wechat_cover'
    ? {
        format: 'png', quality: null, lossless: true, preserve_source: true,
        preserve_display_dimensions: true, selection_policy: 'strictly-smaller-else-source'
      }
    : {
        format: 'webp', quality: 80, lossless: false, preserve_source: true,
        preserve_display_dimensions: true, selection_policy: 'strictly-smaller-else-source'
      };
}

function requestFor(context, state, task) {
  const paths = compressionTaskPaths(state, task.platform, task.asset_id, task.target_format);
  const request = {
    schema_version: 1,
    contract: 'content-production-provider/v1',
    task_id: taskId(state, task),
    capability: 'image_compression',
    provider_contract: 'image-compression-v1',
    run_dir: context.root,
    run_mode: state.run_mode,
    mode: 'compress_one',
    attempt: task.attempt,
    platform: task.platform,
    variant: task.variant,
    asset_id: task.asset_id,
    asset_kind: task.asset_kind,
    inputs: [{ role: 'source_image', path: task.source.path, sha256: task.source.sha256 }],
    output_dir: paths.base,
    expected_artifacts: [paths.candidate],
    options: requestOptions(task.asset_kind),
    interaction_policy: 'return_to_orchestrator'
  };
  return { ...task, paths, request };
}

function planTask(task) {
  return {
    task_id: task.request.task_id,
    platform: task.platform,
    variant: task.variant,
    asset_id: task.asset_id,
    asset_kind: task.asset_kind,
    source: task.source,
    candidate: { path: task.paths.candidate, format: task.target_format },
    request_path: task.paths.request,
    result_path: task.paths.result
  };
}

export async function buildCompressionPlan(runDir, state) {
  const issues = [];
  const context = await loadContext(runDir, state, issues);
  if (!context) return { issues, context: null, tasks: [], plan: null };
  const visualBindings = await validateVisualBindings(context, state, issues);
  const tasks = [];
  const selections = new Map();
  if (visualBindings) {
    for (const platform of platforms) {
      const visual = illustrationPaths(state, platform);
      const planFile = await safeJson(context.root, context.runReal, visual.plan, issues, 'invalid_package_visual_plan');
      const bundleFile = await safeJson(context.root, context.runReal, visual.bundle, issues, 'invalid_package_visual_bundle');
      const plan = planFile.value;
      const bundle = bundleFile.value;
      if (!plan || !bundle) continue;
      const selection = bundle.selection;
      const anchors = Array.isArray(plan.anchors) ? plan.anchors : [];
      const images = Array.isArray(bundle.images) ? bundle.images : [];
      const ids = anchors.map((item) => item?.image_id);
      const valid = plan.platform === platform && bundle.platform === platform
        && plan.status === 'READY' && bundle.status === 'PASS'
        && validSelection(selection, platform)
        && bundle.variant === selection.variant && plan.variant === selection.variant
        && isDeepStrictEqual(bundle.plan, visualBindings.get(visual.plan))
        && anchors.length > 0 && bundle.image_count === images.length
        && images.length === anchors.length && new Set(ids).size === ids.length
        && anchors.every((anchor, index) => ASSET_ID.test(anchor?.image_id || '')
          && nonempty(anchor?.source_excerpt) && nonempty(anchor?.core_meaning)
          && images[index]?.image_id === anchor.image_id);
      if (!valid) {
        issues.push(issue('invalid_package_visual_source', `${platform} plan, bundle, selection, or image order is invalid.`));
        continue;
      }
      const draft = await safeFile(context.root, context.runReal, selection.draft_path, issues, 'package_source_draft_drift');
      if (!draft || await fileSha256(draft) !== selection.draft_sha256) {
        issues.push(issue('package_source_draft_drift', `Selected draft is stale for ${platform}.`, { path: selection.draft_path }));
        continue;
      }
      selections.set(platform, selection);
      for (const [index, image] of images.entries()) {
        if (!nonempty(image?.file) || !image.file.startsWith(`07-visual/${platform}/images/`)) {
          issues.push(issue('invalid_package_image_source', `${platform}/${image?.image_id || '(missing)'} source is outside its visual image directory.`));
          continue;
        }
        const source = await sourceInfo(context, image?.file, image?.file_sha256, issues, 'compression_source_unsafe');
        const declaredFormat = normalizedFormat(image?.delivery_artifact?.format);
        const declaredDimensions = image?.delivery_dimensions;
        if (!source || source.format !== declaredFormat || source.bytes !== image?.delivery_artifact?.bytes
          || source.width !== declaredDimensions?.width || source.height !== declaredDimensions?.height) {
          issues.push(issue('invalid_package_image_source', `${platform}/${image?.image_id || '(missing)'} source metadata differs from the current visual bundle.`));
          continue;
        }
        tasks.push(requestFor(context, state, {
          attempt: state.stages.package.attempt,
          platform,
          variant: selection.variant,
          asset_id: image.image_id,
          asset_kind: 'body_image',
          target_format: 'webp',
          source,
          anchor: anchors[index],
          selection,
          visual: {
            plan: { path: visual.plan, sha256: visualBindings.get(visual.plan)?.sha256 },
            bundle: { path: visual.bundle, sha256: visualBindings.get(visual.bundle)?.sha256 }
          }
        }));
      }
    }
    const wechatSelection = selections.get('wechat');
    const cover = coverPaths(state);
    const metadataFile = await safeJson(context.root, context.runReal, cover.metadata, issues, 'invalid_package_cover_metadata');
    const metadata = metadataFile.value;
    const validCover = metadata?.status === 'PASS' && metadata?.platform === 'wechat'
      && wechatSelection && isDeepStrictEqual(metadata.selection, wechatSelection)
      && metadata?.cover?.path === cover.cover && metadata.cover.format === 'png'
      && metadata.cover.width === 1923 && metadata.cover.height === 818
      && SHA256.test(metadata.cover.sha256 || '');
    if (!validCover) {
      issues.push(issue('invalid_package_cover_source', 'Current WeChat cover metadata does not bind the selected WeChat winner and 1923x818 PNG.'));
    } else {
      const source = await sourceInfo(context, cover.cover, metadata.cover.sha256, issues, 'compression_source_unsafe');
      if (!source || source.format !== 'png' || source.width !== 1923 || source.height !== 818) {
        issues.push(issue('invalid_package_cover_source', 'Current WeChat cover is not the bound 1923x818 PNG.'));
      } else {
        tasks.push(requestFor(context, state, {
          attempt: state.stages.package.attempt,
          platform: 'wechat',
          variant: wechatSelection.variant,
          asset_id: 'wechat-cover',
          asset_kind: 'wechat_cover',
          target_format: 'png',
          source,
          anchor: null,
          selection: wechatSelection,
          visual: { cover: { path: cover.cover, sha256: metadata.cover.sha256 } }
        }));
      }
    }
  }
  const ids = tasks.map((task) => `${task.platform}:${task.asset_id}`);
  if (new Set(ids).size !== ids.length || tasks.filter((task) => task.asset_kind === 'wechat_cover').length !== 1
    || platforms.some((platform) => !tasks.some((task) => task.platform === platform && task.asset_kind === 'body_image'))) {
    issues.push(issue('invalid_compression_task_set', 'Compression requires unique current body images for all five platforms and one WeChat cover.'));
  }
  const plan = {
    schema_version: 1,
    contract: 'image-compression-v1',
    run_id: state.run_id,
    package_attempt: state.stages?.package?.attempt,
    visual_attempt: state.stages?.visual?.attempt,
    task_count: tasks.length,
    tasks: tasks.map(planTask)
  };
  return { issues, context, tasks, plan, selections };
}

async function validateCompressionTask(context, task, issues) {
  const requestFile = await safeJson(context.root, context.runReal, task.paths.request, issues, 'invalid_compression_request');
  const resultFile = await safeJson(context.root, context.runReal, task.paths.result, issues, 'invalid_compression_result');
  const candidatePath = await safeFile(context.root, context.runReal, task.paths.candidate, issues, 'invalid_compression_candidate');
  const request = requestFile.value;
  const result = resultFile.value;
  if (!request || !result || !candidatePath) return { ...task, request, result, selection: null };
  if (!exactKeys(request, REQUEST_KEYS) || !isDeepStrictEqual(request, task.request)) {
    issues.push(issue('invalid_compression_request', `${task.platform}/${task.asset_id} request differs from the current visual/package attempt.`));
  }
  const artifact = result.artifacts?.[0];
  const compression = result.compression;
  const source = compression?.source;
  const candidate = compression?.candidate;
  const candidateActual = await rasterInfo(candidatePath);
  const candidateHash = await fileSha256(candidatePath);
  const expectedSelection = candidateActual && candidateActual.bytes < task.source.bytes ? 'candidate' : 'source';
  const compressionShape = exactKeys(compression, COMPRESSION_KEYS)
    && exactKeys(source, FILE_INFO_KEYS) && exactKeys(candidate, FILE_INFO_KEYS)
    && isDeepStrictEqual(source, task.source)
    && candidate?.path === task.paths.candidate && candidate?.sha256 === candidateHash
    && candidate?.bytes === candidateActual?.bytes && candidate?.format === candidateActual?.format
    && candidate?.width === candidateActual?.width && candidate?.height === candidateActual?.height
    && compression.source_unchanged === true && compression.dimensions_preserved === true
    && candidate?.format === task.target_format
    && candidate?.width === task.source.width && candidate?.height === task.source.height
    && compression.saved_bytes === task.source.bytes - candidate?.bytes
    && compression.saved_percent === savedPercent(task.source.bytes, candidate?.bytes)
    && compression.recommended_selection === expectedSelection;
  const resultShape = exactKeys(result, RESULT_KEYS) && result.schema_version === 1
    && result.contract === 'content-production-provider/v1'
    && result.provider_contract === 'image-compression-v1'
    && result.task_id === task.request.task_id
    && result.request_sha256 === await fileSha256(requestFile.absolute)
    && result.status === 'PASS'
    && Array.isArray(result.artifacts) && result.artifacts.length === 1
    && exactKeys(artifact, ['role', 'path', 'sha256'])
    && artifact.role === 'compressed_candidate' && artifact.path === task.paths.candidate
    && artifact.sha256 === candidateHash
    && exactKeys(result.checks, ['request_valid', 'mode'])
    && result.checks.request_valid === true && result.checks.mode === 'compress_one'
    && Array.isArray(result.issues) && result.issues.length === 0
    && Array.isArray(result.warnings)
    && (expectedSelection === 'source'
      ? result.warnings.length === 1
        && exactKeys(result.warnings[0], ['code', 'message'])
        && result.warnings[0].code === 'compression_candidate_not_smaller'
        && nonempty(result.warnings[0].message)
      : result.warnings.length === 0)
    && compressionShape;
  if (!resultShape) {
    issues.push(issue('invalid_compression_result', `${task.platform}/${task.asset_id} PASS result or compression report is stale or invalid.`));
  }
  return {
    ...task,
    request,
    result,
    request_sha256: await fileSha256(requestFile.absolute),
    result_sha256: await fileSha256(resultFile.absolute),
    candidate: candidateActual ? { path: task.paths.candidate, sha256: candidateHash, ...candidateActual } : null,
    selection: expectedSelection
  };
}

export async function validateCompressionTasks(runDir, state) {
  const built = await buildCompressionPlan(runDir, state);
  const issues = [...built.issues];
  if (!built.context) return { ...built, issues, tasks: [] };
  const planFile = await safeJson(
    built.context.root,
    built.context.runReal,
    compressionPlanPath(state),
    issues,
    'invalid_compression_plan'
  );
  const planValid = exactKeys(planFile.value, PLAN_KEYS) && isDeepStrictEqual(planFile.value, built.plan)
    && Array.isArray(planFile.value?.tasks)
    && planFile.value.tasks.every((task) => exactKeys(task, PLAN_TASK_KEYS));
  if (!planValid) issues.push(issue('invalid_compression_plan', 'Compression plan is missing, stale, or not the exact current task set.'));
  const tasks = [];
  for (const task of built.tasks) tasks.push(await validateCompressionTask(built.context, task, issues));
  const controlRoot = compressionRoot(state);
  const found = (await filesUnder(resolve(built.context.root, controlRoot)))
    .map((path) => `${controlRoot}/${path}`);
  const expected = [
    compressionPlanPath(state),
    ...built.tasks.flatMap((task) => [task.paths.request, task.paths.result, task.paths.candidate])
  ];
  if (found.length !== expected.length || new Set(found).size !== expected.length
    || !expected.every((path) => found.includes(path))) {
    issues.push(issue('undeclared_compression_artifact', 'Current compression attempt contains missing or undeclared controls/candidates.', {
      expected,
      actual: found
    }));
  }
  return { ...built, issues, tasks, plan: built.plan, plan_file: planFile.value };
}

function insertImages(markdown, title, entries) {
  const headings = [...markdown.matchAll(/^#(?!#)\s+[^\n]+$/gm)];
  if (headings.length !== 1) throw new Error('Selected source draft must contain exactly one H1.');
  const insertions = new Map();
  for (const entry of entries) {
    const index = markdown.indexOf(entry.anchor.source_excerpt);
    if (index < 0) throw new Error(`Visual source excerpt is missing for ${entry.image_id}.`);
    const remainder = markdown.slice(index + entry.anchor.source_excerpt.length);
    const separator = remainder.match(/\n[ \t]*\n/);
    const offset = separator ? index + entry.anchor.source_excerpt.length + separator.index : markdown.length;
    const values = insertions.get(offset) || [];
    values.push(`![${entry.image_id}](${entry.publish_file})`);
    insertions.set(offset, values);
  }
  let rendered = markdown;
  for (const offset of [...insertions.keys()].sort((left, right) => right - left)) {
    const block = insertions.get(offset).join('\n\n');
    rendered = `${rendered.slice(0, offset)}\n\n${block}${rendered.slice(offset)}`;
  }
  return textWithNewline(rendered.replace(/^#(?!#)\s+[^\n]+$/m, `# ${title}`));
}

function optimizationItem(task, publish) {
  return {
    asset_id: task.asset_id,
    source: task.source,
    candidate: task.candidate,
    publish,
    selection: task.selection,
    reason: task.selection === 'candidate' ? 'candidate_smaller' : 'candidate_not_smaller',
    request: { path: task.paths.request, sha256: task.request_sha256 },
    result: { path: task.paths.result, sha256: task.result_sha256 }
  };
}

async function packageDescriptors(runDir, state, validation) {
  const descriptors = [];
  const packages = [];
  for (const platform of platforms) {
    const paths = packagePaths(state, platform);
    const tasks = validation.tasks.filter((task) => task.platform === platform && task.asset_kind === 'body_image');
    const coverTask = platform === 'wechat'
      ? validation.tasks.find((task) => task.asset_kind === 'wechat_cover') : null;
    const selection = validation.selections.get(platform);
    const sourceMarkdown = await readText(resolve(runDir, selection.draft_path));
    const deliveries = [];
    for (const task of tasks) {
      const selected = task.selection === 'candidate' ? task.candidate : task.source;
      const publishFile = `${paths.imagePrefix}${task.asset_id}.${extensionFor(selected.format)}`;
      const publishPath = `${paths.base}/${publishFile}`;
      const bytes = await readFile(resolve(runDir, selected.path));
      const publish = { path: publishPath, sha256: sha256(bytes), bytes: bytes.length, format: selected.format, width: selected.width, height: selected.height };
      descriptors.push({ path: publishPath, content: bytes, kind: 'binary' });
      deliveries.push({ task, publishFile, publish, bytes });
    }
    let coverPublish = null;
    if (coverTask) {
      const selected = coverTask.selection === 'candidate' ? coverTask.candidate : coverTask.source;
      const bytes = await readFile(resolve(runDir, selected.path));
      coverPublish = {
        path: paths.cover,
        sha256: sha256(bytes),
        bytes: bytes.length,
        format: 'png',
        width: selected.width,
        height: selected.height
      };
      descriptors.push({ path: paths.cover, content: bytes, kind: 'binary' });
    }
    const optimization = {
      schema_version: 2,
      status: 'PASS',
      package_attempt: paths.attempt,
      platform,
      items: deliveries.map(({ task, publish }) => optimizationItem(task, publish)),
      cover: coverTask ? optimizationItem(coverTask, coverPublish) : null
    };
    const visual = illustrationPaths(state, platform);
    const manifest = {
      schema_version: 2,
      status: 'PASS',
      package_attempt: paths.attempt,
      platform,
      variant: selection.variant,
      source: { path: selection.draft_path, sha256: selection.draft_sha256 },
      bundle: tasks[0].visual.bundle,
      items: deliveries.map(({ task, publishFile, publish }) => ({
        image_id: task.asset_id,
        bundle_file: task.source.path.slice(`07-visual/${platform}/`.length),
        bundle_sha256: task.source.sha256,
        publish_file: publishFile,
        publish_sha256: publish.sha256,
        markdown_ref: publishFile
      }))
    };
    const finalMarkdown = insertImages(sourceMarkdown, selection.title, deliveries.map(({ task, publishFile }) => ({
      image_id: task.asset_id,
      anchor: task.anchor,
      publish_file: publishFile
    })));
    const optimizationHash = sha256(jsonText(optimization));
    const manifestHash = sha256(jsonText(manifest));
    const finalHash = sha256(finalMarkdown);
    const metadata = {
      schema_version: 2,
      status: 'PASS',
      package_attempt: paths.attempt,
      platform,
      variant: selection.variant,
      title_id: selection.title_id,
      title: selection.title,
      topic_phrase: selection.topic_phrase,
      source_draft: { path: selection.draft_path, sha256: selection.draft_sha256 },
      visual_plan: tasks[0].visual.plan,
      visual_bundle: tasks[0].visual.bundle,
      manifest: { path: paths.manifest, sha256: manifestHash },
      optimization: { path: paths.optimization, sha256: optimizationHash },
      final_markdown: { path: paths.final, sha256: finalHash },
      cover: coverPublish ? { path: paths.cover, sha256: coverPublish.sha256 } : null,
      image_count: deliveries.length
    };
    descriptors.push(
      { path: paths.optimization, content: Buffer.from(jsonText(optimization)), kind: 'json' },
      { path: paths.manifest, content: Buffer.from(jsonText(manifest)), kind: 'json' },
      { path: paths.final, content: Buffer.from(finalMarkdown), kind: 'text' },
      { path: paths.metadata, content: Buffer.from(jsonText(metadata)), kind: 'json' }
    );
    packages.push({ platform, paths, manifest, optimization, metadata, finalMarkdown, deliveries, coverPublish, visual });
  }
  return { descriptors, packages };
}

export async function buildPublishPackage(runDir, state) {
  const validation = await validateCompressionTasks(runDir, state);
  if (validation.issues.length) return { ...validation, descriptors: [], packages: [], artifacts: [] };
  const rendered = await packageDescriptors(runDir, state, validation);
  const artifacts = rendered.descriptors.map((item) => item.path);
  if (new Set(artifacts).size !== artifacts.length) {
    validation.issues.push(issue('duplicate_package_artifact', 'Current package renders duplicate business artifact paths.'));
  }
  return { ...validation, ...rendered, artifacts };
}

async function validatePackageSchemas(value, expected, keys, label, issues) {
  if (!exactKeys(value, keys) || !isDeepStrictEqual(value, expected)) {
    issues.push(issue('invalid_publish_package', `${label} is stale or violates the schema v2 package contract.`));
  }
}

export async function validatePublishPackages(runDir, state) {
  const built = await buildPublishPackage(runDir, state);
  const issues = [...built.issues];
  if (issues.length) return { ...built, issues };
  for (const descriptor of built.descriptors) {
    const absolute = await safeFile(resolve(runDir), built.context.runReal, descriptor.path, issues, 'missing_publish_package_artifact');
    if (absolute && await fileSha256(absolute) !== sha256(descriptor.content)) {
      issues.push(issue('publish_package_artifact_drift', `Publish package artifact changed: ${descriptor.path}.`, { path: descriptor.path }));
    }
  }
  for (const value of built.packages) {
    const manifest = await safeJson(resolve(runDir), built.context.runReal, value.paths.manifest, issues, 'invalid_publish_manifest');
    const optimization = await safeJson(resolve(runDir), built.context.runReal, value.paths.optimization, issues, 'invalid_optimization_report');
    const metadata = await safeJson(resolve(runDir), built.context.runReal, value.paths.metadata, issues, 'invalid_publish_metadata');
    await validatePackageSchemas(manifest.value, value.manifest, MANIFEST_KEYS, `${value.platform} manifest`, issues);
    if (Array.isArray(manifest.value?.items)
      && manifest.value.items.some((item) => !exactKeys(item, MANIFEST_ITEM_KEYS))) {
      issues.push(issue('invalid_publish_manifest', `${value.platform} manifest item schema is invalid.`));
    }
    await validatePackageSchemas(optimization.value, value.optimization, OPTIMIZATION_KEYS, `${value.platform} optimization`, issues);
    const optimizationItems = [...(optimization.value?.items || []), ...(optimization.value?.cover ? [optimization.value.cover] : [])];
    if (optimizationItems.some((item) => !exactKeys(item, OPTIMIZATION_ITEM_KEYS))) {
      issues.push(issue('invalid_optimization_report', `${value.platform} optimization item schema is invalid.`));
    }
    await validatePackageSchemas(metadata.value, value.metadata, METADATA_KEYS, `${value.platform} metadata`, issues);
    const actualImages = (await filesUnder(resolve(runDir, value.paths.imagesDir)))
      .map((path) => `${value.paths.imagePrefix}${path}`);
    const expectedImages = value.deliveries.map((item) => item.publishFile);
    if (actualImages.length !== expectedImages.length || new Set(actualImages).size !== expectedImages.length
      || !expectedImages.every((path) => actualImages.includes(path))) {
      issues.push(issue('untracked_publish_image', `${value.platform} active publish image set differs from its manifest.`, {
        expected: expectedImages,
        actual: actualImages
      }));
    }
  }
  return { ...built, issues };
}

export async function expectedPackageStageArtifacts(runDir, state, { includeLayout = true } = {}) {
  const built = await buildPublishPackage(runDir, state);
  const artifacts = [...built.artifacts];
  if (includeLayout) {
    const wechat = packagePaths(state, 'wechat');
    artifacts.push(wechat.article, wechat.preview, wechat.layoutResult);
  }
  return { issues: built.issues, artifacts, build: built };
}

import { execFile } from 'node:child_process';
import { lstat, realpath } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { promisify } from 'node:util';
import {
  fileSha256,
  filesUnder,
  htmlImageRefs,
  isLocalRef,
  markdownImageRefs,
  readJson,
  readText,
  sha256
} from './lib.mjs';
import { packagePaths, validatePublishPackages } from './package-contracts.mjs';

const execFileAsync = promisify(execFile);
const SHA256 = /^[a-f0-9]{64}$/;
const REQUEST_KEYS = [
  'schema_version', 'contract', 'task_id', 'capability', 'provider_contract',
  'run_dir', 'run_mode', 'mode', 'attempt', 'platform', 'variant', 'inputs',
  'output_dir', 'expected_artifacts', 'options', 'interaction_policy'
];
const INPUT_KEYS = ['role', 'path', 'sha256'];
const OPTIONS_KEYS = [
  'theme_id', 'preserve_substantive_content', 'require_manifest_images',
  'validation_policy', 'placeholder_policy', 'unknown_author_policy',
  'preview_embedding_policy', 'resource_bindings'
];
const RESOURCE_KEYS = [
  'skill', 'theme', 'common_components', 'validator', 'wrapper',
  'preview_template', 'provider_script'
];
const RESOURCE_PATHS = {
  skill: 'SKILL.md',
  theme: 'references/theme-red-white.md',
  common_components: 'references/common-components.md',
  validator: 'scripts/validate_gzh_html.py',
  wrapper: 'scripts/wrap_preview.py',
  preview_template: 'assets/preview-template.html',
  provider_script: 'scripts/provider_contract.py'
};
const BINDING_KEYS = ['path', 'sha256'];
const RESULT_KEYS = [
  'schema_version', 'contract', 'provider_contract', 'task_id',
  'request_sha256', 'status', 'artifacts', 'checks', 'issues', 'warnings'
];
const ARTIFACT_KEYS = ['role', 'path', 'sha256'];
const CHECK_KEYS = [
  'request_valid', 'mode', 'validator_errors', 'validator_warnings',
  'span_leaf_count', 'clean_fragment', 'safe_html', 'red_white_theme',
  'end_divider_count', 'cta_count', 'placeholder_count', 'source_block_count',
  'preserved_source_block_count', 'source_blocks_in_order',
  'manifest_image_count', 'markdown_image_count', 'html_image_count',
  'manifest_images_exact', 'preview_embedding_count',
  'preview_embedding_byte_identical', 'preview_copy_button'
];
const DELIVERY_KEYS = [
  'schema_version', 'status', 'package_attempt', 'platform', 'variant',
  'source_markdown', 'manifest', 'provider', 'clean', 'preview', 'validation'
];
const PROVIDER_KEYS = ['contract', 'request', 'result'];
const VALIDATION_KEYS = CHECK_KEYS.filter((key) => !['request_valid', 'mode'].includes(key));
const ALLOWED_TAGS = new Set([
  'section', 'p', 'span', 'strong', 'h3', 'img', 'br', 'table', 'thead',
  'tbody', 'tr', 'th', 'td', 'u', 'a'
]);
const VOID_TAGS = new Set(['img', 'br']);
const CODE_STYLE = /monospace|courier|consolas|sf mono/i;
const UNSAFE_STYLE = /url\s*\(|expression\s*\(|(?:^|[;\s])behavior\s*:|-moz-binding|javascript\s*:|data\s*:|position\s*:\s*(?:fixed|absolute|sticky)|(?:^|[;\s])float\s*:|display\s*:\s*(?:grid|none)|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?(?=\s*;|\s*$)|var\s*\(\s*--|@(?:media|keyframes|import)|\/\*|\\/i;
const PLACEHOLDER = /\{\{[^{}]+\}\}|\b(?:TODO|TBD|PLACEHOLDER|FIXME)\b|待补素材|待填写|在此填写|待确认|图片URL|【\s*插入[^】]*】|此处插入/gi;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
const MARKDOWN_LINK = /(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
const CTA = '如果你觉得今天这篇有收获，欢迎点赞、在看、转发三连，我们下篇见。';

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

async function pathPresent(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function hasSymlinkComponent(root, path, includeLeaf = true) {
  if (!inside(root, path)) return true;
  let current = root;
  const parts = relative(root, path).split(/[\\/]/).filter(Boolean);
  const count = includeLeaf ? parts.length : Math.max(0, parts.length - 1);
  for (const part of parts.slice(0, count)) {
    current = join(current, part);
    if (await pathPresent(current) && (await lstat(current)).isSymbolicLink()) return true;
  }
  return false;
}

async function safeFile(root, rootReal, relativePath, issues, code) {
  if (!nonempty(relativePath) || isAbsolute(relativePath)) {
    issues.push(issue(code, `Invalid artifact path: ${relativePath || '(missing)'}.`, { path: relativePath || null }));
    return null;
  }
  const absolute = resolve(root, relativePath);
  if (!inside(root, absolute) || !await pathPresent(absolute)) {
    issues.push(issue(code, `Artifact is missing or escapes the run: ${relativePath}.`, { path: relativePath }));
    return null;
  }
  try {
    const stat = await lstat(absolute);
    const real = await realpath(absolute);
    if (await hasSymlinkComponent(root, absolute) || !stat.isFile() || !inside(rootReal, real)) {
      throw new Error('not a real in-run file');
    }
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
    issues.push(issue(code, `Invalid JSON at ${relativePath}: ${error.message}.`, { path: relativePath }));
    return { absolute, value: null };
  }
}

function decodeHtml(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(?:#(x[0-9a-f]+|\d+)|([a-z]+));/gi, (match, numeric, name) => {
    if (numeric) {
      const base = numeric[0].toLowerCase() === 'x' ? 16 : 10;
      const number = Number.parseInt(base === 16 ? numeric.slice(1) : numeric, base);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return named[name.toLowerCase()] ?? match;
  });
}

function normalizeProse(value) {
  return decodeHtml(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/[`*_~=#>+|:：;；,.，。!！?？、\-—()（）\[\]{}]/g, '')
    .replace(/\s+/g, '');
}

function markdownSourceBlocks(markdown) {
  let lines = markdown.replaceAll('\r\n', '\n').split('\n');
  if (lines[0]?.trim() === '---') {
    const end = lines.slice(1).findIndex((line) => line.trim() === '---');
    if (end >= 0) lines = lines.slice(end + 2);
  }
  const blocks = [];
  const paragraph = [];
  let h1Removed = false;
  let inFence = false;
  let fenceChar = null;
  const flush = () => {
    if (!paragraph.length) return;
    const token = normalizeProse(paragraph.join(' '));
    if (token) blocks.push(token);
    paragraph.length = 0;
  };
  for (const line of lines) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      flush();
      if (!inFence) {
        inFence = true;
        fenceChar = fence[1][0];
      } else if (fence[1][0] === fenceChar) {
        inFence = false;
        fenceChar = null;
      }
      continue;
    }
    if (inFence) {
      const token = normalizeProse(line);
      if (token) blocks.push(token);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (!h1Removed && /^#(?!#)\s+\S/.test(line)) {
      flush();
      h1Removed = true;
      continue;
    }
    const imageOnly = line.trim().match(/^!\[[^\]]*\]\([^)\s]+(?:\s+["'][^"']*["'])?\)$/);
    if (imageOnly) {
      flush();
      continue;
    }
    if (/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/.test(line)
      || /^\s*(?:[-*_]\s*){3,}$/.test(line)) {
      flush();
      continue;
    }
    const structured = line.match(/^\s*(?:#{2,6}|>|[-+*]|\d+[.)])\s+(.*)$/);
    if (structured || line.trimStart().startsWith('|')) {
      flush();
      const content = (structured ? structured[1] : line.trim().replace(/^\||\|$/g, '').replaceAll('|', ' '))
        .replace(MARKDOWN_IMAGE, '');
      const token = normalizeProse(content);
      if (token) blocks.push(token);
      continue;
    }
    paragraph.push(line.replace(MARKDOWN_IMAGE, ''));
  }
  flush();
  return blocks;
}

function markdownCodeLines(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const values = [];
  let inFence = false;
  let fenceChar = null;
  for (const line of lines) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceChar = fence[1][0];
      } else if (fence[1][0] === fenceChar) {
        inFence = false;
        fenceChar = null;
      }
      continue;
    }
    if (inFence) {
      const value = decodeHtml(line).replace(/\s+/g, '');
      if (value) values.push(value);
    }
  }
  return values;
}

function parseAttributes(source) {
  const attributes = new Map();
  let rest = source.trim();
  while (rest) {
    const match = rest.match(/^([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/);
    if (!match) throw new Error(`Malformed HTML attributes: ${rest.slice(0, 80)}`);
    const name = match[1].toLowerCase();
    if (attributes.has(name)) throw new Error(`Duplicate HTML attribute: ${name}`);
    attributes.set(name, decodeHtml(match[2] ?? match[3] ?? match[4] ?? ''));
    rest = rest.slice(match[0].length).trimStart();
  }
  return attributes;
}

function safeHref(value) {
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) return false;
  const compact = value.replace(/[\s\u00a0]+/g, '').toLowerCase();
  if (compact.startsWith('//') || /^(?:javascript|data|file|vbscript):/.test(compact)) return false;
  const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/i)?.[1];
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme);
}

function inspectHtml(html) {
  const stack = [];
  const images = [];
  const links = [];
  const visible = [];
  const codeText = [];
  const nonCodeText = [];
  const errors = [];
  let topLevelCount = 0;
  let rootTag = null;
  let rootStyle = null;
  let endCount = 0;
  let spanLeafCount = 0;
  let structuralError = false;
  const tokens = html.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]*>|[^<]+/g) || [];
  for (const token of tokens) {
    if (!token.startsWith('<')) {
      if (!stack.length && token.trim()) {
        errors.push('Text exists outside the root section.');
        structuralError = true;
      }
      const text = decodeHtml(token);
      visible.push(text);
      if (stack.some((item) => item.code)) codeText.push(text);
      else nonCodeText.push(text);
      if (text.trim() === 'END' && stack.some((item) => {
        const style = item.style.replace(/\s+/g, '').toLowerCase();
        return style.includes('letter-spacing:3px') && style.includes('#dc2626');
      })) endCount += 1;
      continue;
    }
    if (/^<!--|^<!/i.test(token)) {
      errors.push('Comments and declarations are not allowed in clean HTML.');
      structuralError = true;
      continue;
    }
    const closing = token.match(/^<\s*\/\s*([a-z][a-z0-9]*)\s*>$/i);
    if (closing) {
      const tag = closing[1].toLowerCase();
      if (!stack.length || stack.at(-1).tag !== tag) {
        errors.push(`Unbalanced closing tag: ${tag}.`);
        structuralError = true;
      }
      else stack.pop();
      continue;
    }
    const opening = token.match(/^<\s*([a-z][a-z0-9]*)([\s\S]*?)(\/?)>$/i);
    if (!opening) {
      errors.push('Malformed HTML tag.');
      structuralError = true;
      continue;
    }
    const tag = opening[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) errors.push(`Disallowed HTML tag: ${tag}.`);
    let attributes;
    try {
      attributes = parseAttributes(opening[2]);
    } catch (error) {
      errors.push(error.message);
      attributes = new Map();
    }
    for (const [name, value] of attributes) {
      const valid = name === 'style'
        || name === 'leaf' && tag === 'span' && value === ''
        || ['src', 'alt'].includes(name) && tag === 'img'
        || name === 'href' && tag === 'a';
      if (!valid) errors.push(`Disallowed ${tag} attribute: ${name}.`);
      if (name === 'style' && UNSAFE_STYLE.test(value)) errors.push(`Unsafe inline style on ${tag}.`);
      if (name === 'href' && !safeHref(value)) errors.push('Unsafe link href.');
      const count = [...value.matchAll(new RegExp(PLACEHOLDER.source, 'gi'))].length;
      if (count) errors.push(`Attribute ${name} contains an unresolved placeholder.`);
    }
    if (tag === 'img') {
      const src = attributes.get('src');
      if (!nonempty(src)) errors.push('Every image requires a non-empty src.');
      else images.push(src);
    }
    if (tag === 'a') {
      const href = attributes.get('href');
      if (!href) errors.push('Every link requires href.');
      else if (safeHref(href)) links.push(href);
    }
    if (tag === 'span' && attributes.has('leaf')) spanLeafCount += 1;
    if (!stack.length) {
      topLevelCount += 1;
      rootTag = tag;
      if (tag !== 'section') errors.push('The root element must be section.');
      rootStyle = attributes.get('style') || null;
    }
    const selfClosing = opening[3] === '/';
    if (selfClosing && !VOID_TAGS.has(tag)) {
      errors.push(`Non-void tag cannot self-close: ${tag}.`);
      structuralError = true;
    }
    if (!VOID_TAGS.has(tag) && !selfClosing) {
      stack.push({
        tag,
        style: attributes.get('style') || '',
        code: CODE_STYLE.test(attributes.get('style') || '')
      });
    }
  }
  if (stack.length) {
    errors.push(`Unclosed HTML tags: ${stack.map((item) => item.tag).join(', ')}.`);
    structuralError = true;
  }
  if (topLevelCount !== 1) {
    errors.push('Clean HTML must contain exactly one top-level element.');
    structuralError = true;
  }
  const normalizedStyle = (rootStyle || '').replace(/\s+/g, '').toLowerCase();
  let redWhiteTheme = [
    'max-width:677px', 'margin:0auto', 'background:#ffffff', 'color:#374151',
    'line-height:1.75', 'overflow-x:hidden'
  ].every((value) => normalizedStyle.includes(value))
    && html.toLowerCase().includes('#dc2626')
    && html.toLowerCase().includes('#fee2e2');
  const visibleText = decodeHtml(visible.join('')).replace(/\s+/g, '');
  const ctaCount = occurrenceCount(visibleText, CTA);
  const endIndex = visibleText.lastIndexOf('END');
  const ctaIndex = visibleText.lastIndexOf(CTA);
  const authorIdentityOmitted = endIndex >= 0 && visibleText.slice(endIndex + 3) === CTA;
  redWhiteTheme = redWhiteTheme && endCount === 1 && ctaCount === 1
    && endIndex < ctaIndex && authorIdentityOmitted;
  if (!redWhiteTheme) errors.push('Clean HTML does not have the exact red-white root, one END divider, and identity-free CTA footer.');
  const attributePlaceholderCount = tokens.filter((token) => token.startsWith('<')).reduce((sum, token) =>
    sum + [...token.matchAll(new RegExp(PLACEHOLDER.source, 'gi'))].length, 0);
  const placeholderCount = attributePlaceholderCount
    + [...nonCodeText.join('\n').matchAll(new RegExp(PLACEHOLDER.source, 'gi'))].length;
  if (placeholderCount) errors.push('Clean HTML contains unresolved placeholders outside code.');
  return {
    errors,
    images,
    links,
    visible: normalizeProse(visible.join('')),
    visibleText,
    codeText: decodeHtml(codeText.join('')).replace(/\s+/g, ''),
    placeholderCount,
    redWhiteTheme,
    endCount,
    ctaCount,
    spanLeafCount,
    cleanFragment: !structuralError && topLevelCount === 1 && rootTag === 'section'
  };
}

function sameMultiset(left, right) {
  if (left.length !== right.length) return false;
  const counts = new Map();
  for (const value of left) counts.set(value, (counts.get(value) || 0) + 1);
  for (const value of right) {
    const count = counts.get(value) || 0;
    if (!count) return false;
    counts.set(value, count - 1);
  }
  return [...counts.values()].every((value) => value === 0);
}

function htmlEscape(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
}

function occurrenceCount(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(needle, index)) >= 0) {
    count += 1;
    index += needle.length;
  }
  return count;
}

export function wechatLayoutPaths(state) {
  const packagePath = packagePaths(state, 'wechat');
  const attempt = packagePath.attempt;
  const root = attempt === 1
    ? '08-publish-pack/_layout'
    : `08-publish-pack/_layout/v${String(attempt).padStart(3, '0')}`;
  const staging = `${root}/staging`;
  return {
    attempt,
    root,
    staging,
    request: `${root}/wechat-layout.request.json`,
    result: `${root}/wechat-layout.result.json`,
    stagedClean: `${staging}/article.html`,
    stagedPreview: `${staging}/article-preview.html`,
    finalClean: packagePath.article,
    finalPreview: packagePath.preview,
    finalResult: packagePath.layoutResult
  };
}

export function wechatLayoutProviderRequired(state) {
  const provider = state?.capabilities?.providers?.wechat_layout;
  return state?.schema_version === 2 && (nonempty(state?.capabilities?.config_path)
    || provider?.required === true || nonempty(provider?.skill_path));
}

async function resourceBindings(providerRoot, providerRootReal, provider, issues) {
  const bindings = {};
  for (const key of RESOURCE_KEYS) {
    const resourcePath = RESOURCE_PATHS[key];
    const absolute = resolve(providerRoot, resourcePath);
    try {
      if (!inside(providerRoot, absolute) || !await pathPresent(absolute)
        || await hasSymlinkComponent(providerRoot, absolute)) throw new Error('missing, linked, or outside provider root');
      const stat = await lstat(absolute);
      const real = await realpath(absolute);
      if (!stat.isFile() || !inside(providerRootReal, real)) throw new Error('not a real provider file');
      const hash = await fileSha256(absolute);
      if (key === 'skill' && hash !== provider.skill_sha256) throw new Error('skill snapshot hash drift');
      bindings[key] = { path: resourcePath, sha256: hash };
    } catch (error) {
      issues.push(issue('invalid_layout_resource_binding', `${resourcePath}: ${error.message}.`, { path: resourcePath }));
    }
  }
  return bindings;
}

async function loadContext(runDir, state, { requireRunning = false } = {}) {
  const issues = [];
  const root = resolve(runDir);
  let runReal;
  try {
    const stat = await lstat(root);
    runReal = await realpath(root);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('run-dir must be a real directory');
  } catch (error) {
    issues.push(issue('invalid_layout_run_dir', error.message));
    return { issues, root, runReal: null };
  }
  const stage = state?.stages?.package;
  const allowed = requireRunning ? ['running'] : ['running', 'completed'];
  if (state?.schema_version !== 2 || !allowed.includes(stage?.status)
    || !Number.isInteger(stage?.attempt) || stage.attempt < 1
    || requireRunning && (state?.status !== 'running' || state?.current_stage !== 'package')) {
    issues.push(issue('layout_stage_mismatch', `WeChat layout requires the current positive package attempt to be ${allowed.join(' or ')}.`));
  }
  const provider = state?.capabilities?.providers?.wechat_layout;
  let providerRoot = null;
  let providerRootReal = null;
  let resources = {};
  if (provider?.status !== 'PASS' || provider?.contract !== 'wechat-layout-v1'
    || !nonempty(provider?.skill_path) || !SHA256.test(provider?.skill_sha256 || '')) {
    issues.push(issue('wechat_layout_provider_unavailable', 'The WeChat layout provider snapshot is not PASS, hashed, and registered for wechat-layout-v1.'));
  } else {
    try {
      const skillPath = resolve(provider.skill_path);
      const stat = await lstat(skillPath);
      if (stat.isSymbolicLink() || !stat.isFile() || await fileSha256(skillPath) !== provider.skill_sha256) {
        throw new Error('layout provider SKILL.md changed after capability preflight');
      }
      providerRoot = dirname(skillPath);
      const providerRootStat = await lstat(providerRoot);
      if (providerRootStat.isSymbolicLink() || !providerRootStat.isDirectory()) {
        throw new Error('layout provider root must be a real directory');
      }
      providerRootReal = await realpath(providerRoot);
      resources = await resourceBindings(providerRoot, providerRootReal, provider, issues);
    } catch (error) {
      issues.push(issue('wechat_layout_provider_unavailable', error.message));
    }
  }
  const publication = await validatePublishPackages(root, state);
  issues.push(...publication.issues);
  const wechat = publication.packages?.find((item) => item.platform === 'wechat') || null;
  if (!wechat) issues.push(issue('layout_package_unavailable', 'The current schema v2 WeChat pre-layout package is unavailable.'));
  return {
    issues, root, runReal, state, provider, providerRoot, providerRootReal,
    resources, publication, wechat, paths: wechatLayoutPaths(state)
  };
}

function expectedRequest(context) {
  const { state, wechat, paths } = context;
  const options = {
    theme_id: 'red-white',
    preserve_substantive_content: true,
    require_manifest_images: true,
    validation_policy: 'zero-errors-zero-warnings',
    placeholder_policy: 'forbid-outside-code',
    unknown_author_policy: 'omit_identity_keep_cta',
    preview_embedding_policy: 'trimmed-byte-identical-once',
    resource_bindings: context.resources
  };
  return {
    schema_version: 1,
    contract: 'content-production-provider/v1',
    task_id: `wechat-layout:${state.run_id}:wechat:${wechat.metadata.variant}:package-${String(paths.attempt).padStart(3, '0')}`,
    capability: 'wechat_layout',
    provider_contract: 'wechat-layout-v1',
    run_dir: context.root,
    run_mode: state.run_mode,
    mode: 'format_wechat',
    attempt: paths.attempt,
    platform: 'wechat',
    variant: wechat.metadata.variant,
    inputs: [
      { role: 'source_markdown', path: wechat.paths.final, sha256: sha256(wechat.finalMarkdown) },
      { role: 'publish_manifest', path: wechat.paths.manifest, sha256: sha256(`${JSON.stringify(wechat.manifest, null, 2)}\n`) }
    ],
    output_dir: paths.staging,
    expected_artifacts: [paths.stagedClean, paths.stagedPreview],
    options,
    interaction_policy: 'return_to_orchestrator'
  };
}

export async function buildWechatLayoutRequest(runDir, state) {
  const context = await loadContext(runDir, state, { requireRunning: true });
  const request = context.wechat && Object.keys(context.resources || {}).length === RESOURCE_KEYS.length
    ? expectedRequest(context) : null;
  if (request && (!exactKeys(request, REQUEST_KEYS) || !exactKeys(request.options, OPTIONS_KEYS)
    || !exactKeys(request.options.resource_bindings, RESOURCE_KEYS)
    || request.inputs.some((input) => !exactKeys(input, INPUT_KEYS)))) {
    context.issues.push(issue('internal_layout_request_invalid', 'The generated WeChat layout request violates its exact schema.'));
  }
  return { ...context, request };
}

async function runValidator(context, cleanPath) {
  const validator = resolve(context.providerRoot, context.resources.validator.path);
  try {
    const { stdout, stderr } = await execFileAsync('python3', [validator, cleanPath], {
      encoding: 'utf8', maxBuffer: 4 * 1024 * 1024
    });
    const diagnostics = `${stdout}${stderr}`;
    const errors = Number(diagnostics.match(/ERROR\s*[×x]\s*(\d+)/i)?.[1] || 0);
    const warnings = Number(diagnostics.match(/WARNING\s*[×x]\s*(\d+)/i)?.[1] || 0);
    return {
      errors,
      warnings,
      spanLeafCount: Number(diagnostics.match(/span leaf\s*包裹\s*:\s*(\d+)/i)?.[1] || 0),
      pass: errors === 0 && warnings === 0
        && diagnostics.includes('完全合规，可直接粘贴到公众号编辑器'),
      diagnostics
    };
  } catch (error) {
    const diagnostics = `${error.stdout || ''}${error.stderr || ''}${error.message || ''}`;
    return {
      errors: Number(diagnostics.match(/ERROR\s*[×x]\s*(\d+)/i)?.[1] || 1),
      warnings: Number(diagnostics.match(/WARNING\s*[×x]\s*(\d+)/i)?.[1] || 0),
      spanLeafCount: Number(diagnostics.match(/span leaf\s*包裹\s*:\s*(\d+)/i)?.[1] || 0),
      pass: false,
      diagnostics
    };
  }
}

async function inspectLayout(context, request, cleanPath, previewPath) {
  const issues = [];
  const source = await readText(resolve(context.root, request.inputs[0].path));
  const manifest = await readJson(resolve(context.root, request.inputs[1].path));
  const clean = await readText(cleanPath);
  const preview = await readText(previewPath);
  const html = inspectHtml(clean);
  for (const message of html.errors) issues.push(issue('unsafe_wechat_layout_html', message));

  const sourceBlocks = markdownSourceBlocks(source);
  let cursor = 0;
  let preserved = 0;
  for (const block of sourceBlocks) {
    const index = html.visible.indexOf(block, cursor);
    if (index < 0) break;
    preserved += 1;
    cursor = index + block.length;
  }
  const sourceBlocksInOrder = preserved === sourceBlocks.length;
  if (!sourceBlocksInOrder) {
    issues.push(issue('layout_source_content_loss', 'Clean HTML does not preserve 100% of substantive Markdown blocks in order.', {
      source_block_count: sourceBlocks.length,
      preserved_source_block_count: preserved
    }));
  }

  const markdownRefs = markdownImageRefs(source);
  const manifestRefs = Array.isArray(manifest?.items) ? manifest.items.map((item) => item.markdown_ref) : [];
  const htmlRefs = htmlImageRefs(clean);
  const manifestImagesExact = markdownRefs.length > 0
    && sameMultiset(markdownRefs, manifestRefs) && sameMultiset(markdownRefs, htmlRefs);
  if (!manifestImagesExact) {
    issues.push(issue('layout_manifest_images_mismatch', 'Markdown, manifest, and clean HTML image references must be the same exact multiset.', {
      markdown: markdownRefs, manifest: manifestRefs, html: htmlRefs
    }));
  }
  const markdownLinks = [...source.matchAll(new RegExp(MARKDOWN_LINK.source, 'g'))].map((match) => match[1]);
  const linksExact = sameMultiset(markdownLinks, html.links);
  if (!linksExact) {
    issues.push(issue('layout_markdown_links_mismatch', 'Markdown links are missing, duplicated, or changed in clean HTML.', {
      markdown: markdownLinks,
      html: html.links
    }));
  }
  const sourceCodeLines = markdownCodeLines(source);
  let codeCursor = 0;
  let preservedCodeLines = 0;
  for (const line of sourceCodeLines) {
    const index = html.codeText.indexOf(line, codeCursor);
    if (index < 0) break;
    preservedCodeLines += 1;
    codeCursor = index + line.length;
  }
  const codeExact = preservedCodeLines === sourceCodeLines.length;
  if (!codeExact) {
    issues.push(issue('layout_code_content_loss', 'Fenced code characters or order changed in clean HTML.', {
      source_code_line_count: sourceCodeLines.length,
      preserved_code_line_count: preservedCodeLines
    }));
  }
  const packagePath = packagePaths(context.state, 'wechat');
  for (const item of manifest?.items || []) {
    const ref = item?.markdown_ref;
    if (!nonempty(ref) || !isLocalRef(ref) || ref !== item.publish_file
      || !ref.startsWith(packagePath.imagePrefix)) {
      issues.push(issue('layout_manifest_image_unsafe', `Unsafe or stale manifest image reference: ${ref || '(missing)'}.`, { path: ref || null }));
      continue;
    }
    const relativePath = `${packagePath.base}/${ref}`;
    const absolute = await safeFile(context.root, context.runReal, relativePath, issues, 'layout_manifest_image_unsafe');
    if (absolute && item.publish_sha256 !== await fileSha256(absolute)) {
      issues.push(issue('layout_manifest_image_drift', `Manifest image hash is stale: ${ref}.`, { path: relativePath }));
    }
  }

  const validator = await runValidator(context, cleanPath);
  if (!validator.pass) {
    issues.push(issue('layout_validator_failed', 'Child validator did not report zero errors and zero warnings.', {
      validator_errors: validator.errors,
      validator_warnings: validator.warnings
    }));
  }
  if (validator.spanLeafCount < 1 || validator.spanLeafCount !== html.spanLeafCount) {
    issues.push(issue('layout_span_leaf_mismatch', 'Clean HTML span leaf count is zero or differs from the child validator.', {
      parser_count: html.spanLeafCount,
      validator_count: validator.spanLeafCount
    }));
  }
  const template = await readText(resolve(context.providerRoot, context.resources.preview_template.path));
  const cleanTrimmed = clean.trim();
  const title = htmlEscape(basename(context.paths.stagedClean, extname(context.paths.stagedClean)));
  const expectedPreview = template.replace('<!--GZH_CONTENT-->', cleanTrimmed, 1).replace('{{TITLE}}', title, 1);
  const previewEmbeddingCount = occurrenceCount(preview, cleanTrimmed);
  const previewExact = preview === expectedPreview && previewEmbeddingCount === 1;
  const previewCopyButton = previewExact
    && /<button\b[^>]*\bid=["']gzhCopyBtn["'][^>]*>[\s\S]*?复制到公众号[\s\S]*?<\/button>/i.test(preview);
  if (!previewExact) {
    issues.push(issue('layout_preview_mismatch', 'Preview must be the exact bound template with the trimmed clean fragment embedded once.'));
  }
  if (!previewCopyButton) {
    issues.push(issue('layout_preview_copy_button_missing', 'Preview copy button is missing or duplicated.'));
  }

  const checks = {
    request_valid: true,
    mode: 'format_wechat',
    validator_errors: validator.errors,
    validator_warnings: validator.warnings,
    span_leaf_count: validator.spanLeafCount,
    clean_fragment: html.cleanFragment,
    safe_html: html.errors.length === 0 && linksExact && codeExact,
    red_white_theme: html.redWhiteTheme,
    end_divider_count: html.endCount,
    cta_count: html.ctaCount,
    placeholder_count: html.placeholderCount,
    source_block_count: sourceBlocks.length,
    preserved_source_block_count: preserved,
    source_blocks_in_order: sourceBlocksInOrder,
    manifest_image_count: manifestRefs.length,
    markdown_image_count: markdownRefs.length,
    html_image_count: htmlRefs.length,
    manifest_images_exact: manifestImagesExact,
    preview_embedding_count: previewEmbeddingCount,
    preview_embedding_byte_identical: previewExact,
    preview_copy_button: previewCopyButton
  };
  return { issues, checks, source, manifest, clean, preview };
}

export async function validateWechatLayoutProvider(runDir, state) {
  const context = await loadContext(runDir, state);
  const issues = [...context.issues];
  if (!context.wechat || Object.keys(context.resources || {}).length !== RESOURCE_KEYS.length) {
    return { ...context, issues, request: null, result: null, inspection: null };
  }
  const expected = expectedRequest(context);
  const requestFile = await safeJson(context.root, context.runReal, context.paths.request, issues, 'invalid_wechat_layout_request');
  const resultFile = await safeJson(context.root, context.runReal, context.paths.result, issues, 'invalid_wechat_layout_result');
  const request = requestFile.value;
  const result = resultFile.value;
  if (!exactKeys(request, REQUEST_KEYS) || !isDeepStrictEqual(request, expected)
    || !exactKeys(request?.options, OPTIONS_KEYS)
    || !exactKeys(request?.options?.resource_bindings, RESOURCE_KEYS)
    || request?.inputs?.some((input) => !exactKeys(input, INPUT_KEYS))) {
    issues.push(issue('invalid_wechat_layout_request', 'Canonical layout request is stale or violates the exact current-attempt schema.'));
  }
  const cleanPath = await safeFile(context.root, context.runReal, context.paths.stagedClean, issues, 'invalid_layout_candidate');
  const previewPath = await safeFile(context.root, context.runReal, context.paths.stagedPreview, issues, 'invalid_layout_candidate');
  let inspection = null;
  if (cleanPath && previewPath) inspection = await inspectLayout(context, expected, cleanPath, previewPath);
  if (inspection) issues.push(...inspection.issues);

  const expectedArtifacts = cleanPath && previewPath ? [
    { role: 'clean_html_candidate', path: context.paths.stagedClean, sha256: await fileSha256(cleanPath) },
    { role: 'preview_html_candidate', path: context.paths.stagedPreview, sha256: await fileSha256(previewPath) }
  ] : [];
  const resultValid = exactKeys(result, RESULT_KEYS)
    && result.schema_version === 1
    && result.contract === 'content-production-provider/v1'
    && result.provider_contract === 'wechat-layout-v1'
    && result.task_id === expected.task_id
    && result.request_sha256 === (requestFile.absolute ? await fileSha256(requestFile.absolute) : null)
    && result.status === 'PASS'
    && Array.isArray(result.artifacts) && result.artifacts.length === 2
    && result.artifacts.every((artifact) => exactKeys(artifact, ARTIFACT_KEYS))
    && isDeepStrictEqual(result.artifacts, expectedArtifacts)
    && exactKeys(result.checks, CHECK_KEYS)
    && inspection && isDeepStrictEqual(result.checks, inspection.checks)
    && Array.isArray(result.issues) && result.issues.length === 0
    && Array.isArray(result.warnings) && result.warnings.length === 0;
  if (!resultValid) issues.push(issue('invalid_wechat_layout_result', 'Canonical layout result is not an exact matching PASS for the independently validated staging artifacts.'));

  const actualControls = await filesUnder(resolve(context.root, context.paths.root));
  const expectedControls = [
    basename(context.paths.request), basename(context.paths.result),
    `staging/${basename(context.paths.stagedClean)}`,
    `staging/${basename(context.paths.stagedPreview)}`
  ].sort();
  if (!isDeepStrictEqual(actualControls, expectedControls)) {
    issues.push(issue('undeclared_layout_artifact', 'Current layout attempt contains missing or undeclared controls/staging artifacts.', {
      expected: expectedControls,
      actual: actualControls
    }));
  }
  return { ...context, issues, request, result, inspection };
}

function jsonBuffer(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

export async function buildWechatLayoutDelivery(runDir, state) {
  const validation = await validateWechatLayoutProvider(runDir, state);
  if (validation.issues.length || !validation.inspection) {
    return { ...validation, descriptors: [], artifacts: [], layoutResult: null };
  }
  const clean = Buffer.from(validation.inspection.clean);
  const preview = Buffer.from(validation.inspection.preview);
  const requestHash = await fileSha256(resolve(validation.root, validation.paths.request));
  const resultHash = await fileSha256(resolve(validation.root, validation.paths.result));
  const cleanBinding = { path: validation.paths.finalClean, sha256: sha256(clean) };
  const previewBinding = { path: validation.paths.finalPreview, sha256: sha256(preview) };
  const checks = validation.inspection.checks;
  const layoutResult = {
    schema_version: 2,
    status: 'PASS',
    package_attempt: validation.paths.attempt,
    platform: 'wechat',
    variant: validation.wechat.metadata.variant,
    source_markdown: validation.request.inputs[0],
    manifest: validation.request.inputs[1],
    provider: {
      contract: 'wechat-layout-v1',
      request: { path: validation.paths.request, sha256: requestHash },
      result: { path: validation.paths.result, sha256: resultHash }
    },
    clean: cleanBinding,
    preview: previewBinding,
    validation: Object.fromEntries(VALIDATION_KEYS.map((key) => [key, checks[key]]))
  };
  if (!exactKeys(layoutResult, DELIVERY_KEYS) || !exactKeys(layoutResult.provider, PROVIDER_KEYS)
    || !exactKeys(layoutResult.source_markdown, INPUT_KEYS)
    || !exactKeys(layoutResult.manifest, INPUT_KEYS)
    || !exactKeys(layoutResult.clean, BINDING_KEYS)
    || !exactKeys(layoutResult.preview, BINDING_KEYS)
    || !exactKeys(layoutResult.validation, VALIDATION_KEYS)) {
    validation.issues.push(issue('internal_layout_delivery_invalid', 'Rendered layout delivery violates its schema v2 contract.'));
    return { ...validation, descriptors: [], artifacts: [], layoutResult: null };
  }
  const descriptors = [
    { path: validation.paths.finalClean, content: clean, kind: 'text' },
    { path: validation.paths.finalPreview, content: preview, kind: 'text' },
    { path: validation.paths.finalResult, content: jsonBuffer(layoutResult), kind: 'json' }
  ];
  return {
    ...validation,
    descriptors,
    artifacts: descriptors.map((item) => item.path),
    layoutResult
  };
}

export async function validateWechatLayoutDelivery(runDir, state) {
  const built = await buildWechatLayoutDelivery(runDir, state);
  const issues = [...built.issues];
  if (issues.length) return { ...built, issues };
  for (const descriptor of built.descriptors) {
    const absolute = await safeFile(resolve(runDir), built.runReal, descriptor.path, issues, 'missing_layout_delivery');
    if (absolute && await fileSha256(absolute) !== sha256(descriptor.content)) {
      issues.push(issue('layout_delivery_drift', `Layout delivery changed: ${descriptor.path}.`, { path: descriptor.path }));
    }
  }
  const value = await safeJson(resolve(runDir), built.runReal, built.paths.finalResult, issues, 'invalid_layout_delivery');
  if (value.value && !isDeepStrictEqual(value.value, built.layoutResult)) {
    issues.push(issue('invalid_layout_delivery', 'Business layout result is stale or violates the schema v2 contract.'));
  }
  return { ...built, issues };
}

export function expectedWechatLayoutArtifacts(state) {
  const paths = wechatLayoutPaths(state);
  return [paths.finalClean, paths.finalPreview, paths.finalResult];
}

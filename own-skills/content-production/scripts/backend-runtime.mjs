import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import {
  fileExists,
  fileSha256,
  portableRefForPath,
  readJson,
  resolveRunPortablePathRef,
  skillDir
} from './lib.mjs';
import { componentAttempt } from './visual-state.mjs';

const exactMessages = {
  configuration: 'backend configuration inaccessible',
  credentials: 'backend credentials unavailable to adapter',
  endpoint: 'backend endpoint mismatch',
  model: 'backend model channel unavailable'
};
const profileKeys = [
  'schema_version', 'artifact', 'run_id', 'created_at', 'backend_kind', 'provider',
  'endpoint_source', 'endpoint_origin', 'endpoint_sha256', 'adapter', 'model',
  'artifact_format', 'safety_policy', 'profile_fingerprint'
];
const leaseKeys = [
  'schema_version', 'artifact', 'run_id', 'consumer', 'attempt', 'created_at',
  'profile', 'backend_kind', 'provider', 'endpoint_source', 'adapter', 'model',
  'configuration', 'backend_context', 'backend_context_sha256', 'preflight'
];
const contextKeys = [
  'provider', 'dialect', 'endpoint_source', 'endpoint_origin', 'endpoint_sha256',
  'credential_source', 'adapter_id', 'model', 'artifact_format'
];
const preflightCheckKeys = [
  'adapter_callable', 'endpoint_credential', 'model_channel', 'output_path_format',
  'process_cleanup'
];
const SHA256 = /^[a-f0-9]{64}$/;
const CONSUMERS = new Set(['body_visual', 'wechat_cover']);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function nonempty(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function validIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function containsSensitiveField(value) {
  if (Array.isArray(value)) return value.some(containsSensitiveField);
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && /Bearer\s/i.test(value);
  }
  return Object.entries(value).some(([key, child]) => {
    const normalized = key.toLowerCase().replace(/-/g, '_');
    if (!['credential_source', 'credential_persistence', 'endpoint_credential'].includes(normalized)
      && /(?:api_?key|token|password|secret|authorization|credential)/.test(normalized)) return true;
    return containsSensitiveField(child);
  });
}

function safeEndpointOverride(value) {
  if (value === null) return true;
  try {
    const endpoint = new URL(value);
    return ['http:', 'https:'].includes(endpoint.protocol) && !endpoint.username
      && !endpoint.password && !endpoint.search && !endpoint.hash;
  } catch {
    return false;
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function issue(kind) {
  return {
    code: `backend_${kind}_unavailable`.replace('endpoint_unavailable', 'endpoint_mismatch'),
    message: exactMessages[kind],
    resume_from: 'visual'
  };
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed); } catch { return null; }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed;
}

function stripTomlComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
      quote = quote === char ? null : quote || char;
    } else if (char === '#' && !quote) {
      return line.slice(0, index);
    }
  }
  return line;
}

export function parseCodexConfig(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const value = { model_providers: {} };
  let target = value;
  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = stripTomlComment(rawLine).trim();
    if (!line) continue;
    const section = line.match(/^\[model_providers\.([A-Za-z0-9_-]+)\]$/);
    if (section) {
      target = value.model_providers[section[1]] ||= {};
      continue;
    }
    if (line.startsWith('[')) {
      target = {};
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (pair && target !== null) target[pair[1]] = unquote(pair[2]);
  }
  return value;
}

function adapterCommand(path) {
  const extension = extname(path).toLowerCase();
  if (extension === '.py') return { executable: process.env.PYTHON || 'python3', prefix: [path] };
  if (extension === '.mjs' || extension === '.js') return { executable: process.execPath, prefix: [path] };
  return { executable: path, prefix: [] };
}

function runChild(executable, args, { env = process.env } = {}) {
  return new Promise((done) => {
    const child = spawn(executable, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', () => done({ status: null, stdout: '', stderr: '' }));
    child.on('close', (status) => done({ status, stdout, stderr }));
  });
}

function defaultAdapterPath(processEnv) {
  const codexHome = processEnv.CODEX_HOME || join(homedir(), '.codex');
  return join(codexHome, 'skills', '.system', 'imagegen', 'scripts', 'image_gen.py');
}

function authCredential(auth, provider) {
  const declaredProvider = auth.active_provider || auth.model_provider || auth.provider || null;
  if (declaredProvider && declaredProvider !== provider) return { mismatch: true, key: null };
  const providerAuth = auth.providers?.[provider] || auth.model_providers?.[provider] || null;
  const key = providerAuth?.api_key || providerAuth?.OPENAI_API_KEY
    || auth.OPENAI_API_KEY || auth.api_key || null;
  return { mismatch: false, key };
}

async function resolveContext({
  configPath,
  authPath,
  adapterPath,
  explicitBaseUrl = null,
  model = null,
  processEnv = process.env
}) {
  let configText;
  let authText;
  let config;
  let auth;
  try {
    [configText, authText] = await Promise.all([
      readFile(configPath, 'utf8'),
      readFile(authPath, 'utf8')
    ]);
    config = parseCodexConfig(configText);
    auth = JSON.parse(authText);
  } catch {
    return { issues: [issue('configuration')] };
  }
  const provider = config.model_provider;
  if (typeof provider !== 'string' || !provider.trim()) return { issues: [issue('configuration')] };
  const providerConfig = config.model_providers?.[provider] || {};
  const baseUrl = explicitBaseUrl
    || providerConfig.base_url || providerConfig.openai_base_url
    || config.base_url || config.openai_base_url
    || processEnv.OPENAI_BASE_URL || null;
  let endpoint;
  try {
    endpoint = new URL(baseUrl);
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password
      || endpoint.search || endpoint.hash) throw new Error('invalid endpoint');
  } catch {
    return { issues: [issue('endpoint')] };
  }
  const credential = authCredential(auth, provider);
  if (credential.mismatch) return { issues: [issue('endpoint')] };
  if (typeof credential.key !== 'string' || !credential.key) return { issues: [issue('credentials')] };
  const resolvedAdapter = resolve(adapterPath || defaultAdapterPath(processEnv));
  let adapterBytes;
  try {
    await access(resolvedAdapter, constants.R_OK);
    const value = await stat(resolvedAdapter);
    if (!value.isFile()) throw new Error('not a file');
    adapterBytes = await readFile(resolvedAdapter);
  } catch {
    return { issues: [issue('configuration')] };
  }
  const resolvedModel = model || providerConfig.image_model || config.image_model
    || processEnv.OPENAI_IMAGE_MODEL || 'gpt-image-2';
  const endpointSource = explicitBaseUrl ? 'user-explicit'
    : providerConfig.base_url || providerConfig.openai_base_url || config.base_url || config.openai_base_url
      ? 'active-provider-config' : 'process-env';
  const command = adapterCommand(resolvedAdapter);
  const context = {
    provider,
    dialect: 'openai-compatible',
    endpoint_source: endpointSource,
    endpoint_origin: endpoint.origin,
    endpoint_sha256: sha256(baseUrl),
    credential_source: 'codex-auth:active-provider',
    adapter_id: resolvedAdapter,
    model: resolvedModel,
    artifact_format: 'png'
  };
  return {
    issues: [],
    context,
    adapter: { path: resolvedAdapter, sha256: sha256(adapterBytes), command: command.executable },
    configuration: {
      path: resolve(configPath), sha256: sha256(configText), auth_path: resolve(authPath),
      endpoint_override: explicitBaseUrl || null
    },
    secret: { baseUrl, apiKey: credential.key, command }
  };
}

async function checkAdapter(value) {
  const result = await runChild(value.secret.command.executable, [...value.secret.command.prefix, '--help']);
  return result.status === 0;
}

async function checkOutputRoot(outputRoot) {
  const path = join(resolve(outputRoot), `.backend-preflight-${process.pid}.png`);
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from([137, 80, 78, 71]));
    await unlink(path);
    return true;
  } catch {
    try { await unlink(path); } catch {}
    return false;
  }
}

async function checkModelChannel(value, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`${value.secret.baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { authorization: `Bearer ${value.secret.apiKey}` }
    });
  } catch {
    return issue('endpoint');
  }
  if (response.status === 401 || response.status === 403) return issue('credentials');
  if (!response.ok) return issue('endpoint');
  try {
    const body = await response.json();
    const models = Array.isArray(body?.data) ? body.data.map((item) => item?.id) : [];
    return models.includes(value.context.model) ? null : issue('model');
  } catch {
    return issue('model');
  }
}

export function selectBackendKind({ explicitBackend = null, nativeStatus }) {
  if (explicitBackend) {
    if (!['runtime-native', 'configured-api'].includes(explicitBackend)) throw new Error('Unsupported explicit backend.');
    return explicitBackend;
  }
  if (nativeStatus === 'available') return 'runtime-native';
  if (nativeStatus === 'unavailable') return 'configured-api';
  throw new Error('Native backend availability must be resolved before backend selection.');
}

export function classifyBackendOutcome(outcome, backendKind = 'runtime-native') {
  if (outcome === 'quality-failure') {
    return { action: 'retry-candidate', retry_backend: backendKind, block_attempt: false };
  }
  if (outcome === 'transient-error') {
    return { action: 'retry-transport', retry_backend: backendKind, block_attempt: false };
  }
  if (outcome === 'irrecoverable-execution-error') {
    return { action: 'block-attempt', retry_backend: null, block_attempt: true };
  }
  if (outcome === 'pass') return { action: 'continue', retry_backend: backendKind, block_attempt: false };
  throw new Error('Unsupported backend outcome.');
}

export function backendProfilePath() {
  return '07-visual/backend-profile.json';
}

export function backendLeasePathForAttempt(state, consumer = 'body_visual') {
  if (!CONSUMERS.has(consumer)) throw new Error(`Unsupported backend lease consumer: ${consumer}`);
  const attempt = componentAttempt(state, consumer);
  const kind = consumer === 'body_visual' ? 'body' : 'cover';
  return `07-visual/backend-lease.${kind}.v${String(attempt).padStart(3, '0')}.json`;
}

function runtimeRoots(runDir) {
  return {
    RUN_ROOT: resolve(runDir),
    SKILL_ROOT: skillDir,
    CODEX_HOME: process.env.CODEX_HOME || join(homedir(), '.codex'),
    WORKSPACE_ROOT: process.env.WORKSPACE_ROOT || process.cwd()
  };
}

function portableId(ref) {
  return ref ? `${ref.root}:${ref.path}` : null;
}

function portableResolved(runDir, resolved) {
  const roots = runtimeRoots(runDir);
  const native = resolved.kind === 'runtime-native';
  const adapterRef = native ? null : portableRefForPath(resolved.adapter.path, roots);
  const configuration = native ? null : {
    config_ref: portableRefForPath(resolved.configuration.path, roots),
    config_sha256: resolved.configuration.sha256,
    auth_ref: portableRefForPath(resolved.configuration.auth_path, roots),
    endpoint_override: resolved.configuration.endpoint_override
  };
  const context = {
    ...resolved.context,
    adapter_id: native ? resolved.context.adapter_id : portableId(adapterRef)
  };
  return {
    adapter: {
      id: native ? resolved.adapter.path : portableId(adapterRef),
      ref: adapterRef,
      sha256: resolved.adapter.sha256
    },
    configuration,
    context
  };
}

export function resolveNativeBackend({ nativeStatus }) {
  if (nativeStatus !== 'available') return { issues: [issue('configuration')] };
  const adapterPath = 'runtime-native:image-generation';
  const context = {
    provider: 'runtime-native',
    dialect: 'native-tool',
    endpoint_source: 'runtime-native',
    endpoint_origin: null,
    endpoint_sha256: null,
    credential_source: 'runtime-native',
    adapter_id: adapterPath,
    model: 'gpt-image-2',
    artifact_format: 'png'
  };
  return {
    kind: 'runtime-native',
    context,
    adapter: { path: adapterPath, sha256: sha256(adapterPath), command: 'runtime-native' },
    configuration: null,
    preflight: {
      status: 'PASS', checked_at: new Date().toISOString(), count: 1,
      checks: {
        adapter_callable: 'PASS', endpoint_credential: 'PASS', model_channel: 'PASS',
        output_path_format: 'PASS', process_cleanup: 'PASS'
      }
    },
    issues: []
  };
}

export function createBackendProfile({ state, resolved, runDir, createdAt = new Date().toISOString() }) {
  if (resolved?.issues?.length || !['runtime-native', 'configured-api'].includes(resolved?.kind)) {
    throw new Error('Cannot create a BackendProfile from a blocked backend resolution.');
  }
  if (!runDir) throw new Error('BackendProfile creation requires its runtime run root.');
  const portable = portableResolved(runDir, resolved);
  const profile = {
    schema_version: 1,
    artifact: 'BackendProfile',
    run_id: state.run_id,
    created_at: createdAt,
    backend_kind: resolved.kind,
    provider: portable.context.provider,
    endpoint_source: portable.context.endpoint_source,
    endpoint_origin: portable.context.endpoint_origin,
    endpoint_sha256: portable.context.endpoint_sha256,
    adapter: portable.adapter,
    model: portable.context.model,
    artifact_format: portable.context.artifact_format,
    safety_policy: {
      credential_persistence: 'forbidden',
      backend_switch: 'explicit-reset-only',
      native_pixel_policy: 'preserve'
    },
    profile_fingerprint: ''
  };
  profile.profile_fingerprint = sha256(canonicalJson({ ...profile, profile_fingerprint: undefined }));
  return profile;
}

export function validateBackendProfile(value, state) {
  const issues = [];
  const configured = value?.backend_kind === 'configured-api';
  const validAdapter = exactKeys(value?.adapter, ['id', 'ref', 'sha256'])
    && nonempty(value.adapter.id) && SHA256.test(value.adapter.sha256 || '')
    && (configured ? value.adapter.ref?.root && value.adapter.id === portableId(value.adapter.ref)
      : value.adapter.ref === null && value.adapter.id === 'runtime-native:image-generation');
  const fingerprint = value && sha256(canonicalJson({ ...value, profile_fingerprint: undefined }));
  if (!exactKeys(value, profileKeys) || value.schema_version !== 1 || value.artifact !== 'BackendProfile'
    || value.run_id !== state.run_id || !validIsoDate(value.created_at)
    || !['runtime-native', 'configured-api'].includes(value.backend_kind)
    || !nonempty(value.provider) || !nonempty(value.endpoint_source)
    || configured && (!nonempty(value.endpoint_origin) || !SHA256.test(value.endpoint_sha256 || ''))
    || !configured && (value.endpoint_origin !== null || value.endpoint_sha256 !== null)
    || !validAdapter || !nonempty(value.model) || value.artifact_format !== 'png'
    || !exactKeys(value.safety_policy, ['credential_persistence', 'backend_switch', 'native_pixel_policy'])
    || value.safety_policy.credential_persistence !== 'forbidden'
    || value.safety_policy.backend_switch !== 'explicit-reset-only'
    || value.safety_policy.native_pixel_policy !== 'preserve'
    || value.profile_fingerprint !== fingerprint) {
    issues.push({ code: 'backend_profile_invalid', message: 'backend configuration inaccessible', resume_from: 'visual' });
  }
  if (containsSensitiveField(value)) {
    issues.push({ code: 'backend_profile_secret_exposure', message: 'backend configuration inaccessible', resume_from: 'visual' });
  }
  return issues;
}

export async function loadBackendProfile(runDir, state) {
  const path = backendProfilePath();
  const absolute = join(runDir, path);
  if (!fileExists(absolute)) {
    return { issues: [{ code: 'backend_profile_missing', message: 'backend configuration inaccessible', resume_from: 'visual' }], path, value: null };
  }
  let value;
  try { value = await readJson(absolute); } catch {
    return { issues: [{ code: 'backend_profile_invalid', message: 'backend configuration inaccessible', resume_from: 'visual' }], path, value: null };
  }
  return { issues: validateBackendProfile(value, state), path, value, sha256: await fileSha256(absolute) };
}

export function createBackendLease({
  state,
  resolved,
  profile,
  profileSha256,
  consumer,
  runDir,
  createdAt = new Date().toISOString()
}) {
  if (!CONSUMERS.has(consumer) || resolved?.issues?.length || !profile || !runDir
    || !SHA256.test(profileSha256 || '')) {
    throw new Error('Cannot create a BackendLease from an incomplete profile binding.');
  }
  const portable = portableResolved(runDir, resolved);
  return {
    schema_version: 2,
    artifact: 'BackendLease',
    run_id: state.run_id,
    consumer,
    attempt: componentAttempt(state, consumer),
    created_at: createdAt,
    profile: { path: backendProfilePath(), sha256: profileSha256 },
    backend_kind: profile.backend_kind,
    provider: profile.provider,
    endpoint_source: profile.endpoint_source,
    adapter: portable.adapter,
    model: profile.model,
    configuration: portable.configuration,
    backend_context: portable.context,
    backend_context_sha256: sha256(canonicalJson(portable.context)),
    preflight: resolved.preflight
  };
}

export function validateBackendLease(value, state, consumer = 'body_visual', profile = null) {
  const issues = [];
  const context = value?.backend_context;
  const configured = value?.backend_kind === 'configured-api';
  const validConfiguration = configured
    ? exactKeys(value?.configuration, ['config_ref', 'config_sha256', 'auth_ref', 'endpoint_override'])
      && value.configuration.config_ref?.root && SHA256.test(value.configuration.config_sha256 || '')
      && value.configuration.auth_ref?.root
      && safeEndpointOverride(value.configuration.endpoint_override)
      && (value.endpoint_source === 'user-explicit') === (value.configuration.endpoint_override !== null)
    : value?.configuration === null;
  const validContext = exactKeys(context, contextKeys) && nonempty(context.provider)
    && nonempty(context.dialect) && nonempty(context.endpoint_source)
    && (configured ? nonempty(context.endpoint_origin) && SHA256.test(context.endpoint_sha256 || '')
      : context.endpoint_origin === null && context.endpoint_sha256 === null)
    && nonempty(context.credential_source) && nonempty(context.adapter_id)
    && nonempty(context.model) && ['png', 'jpeg', 'jpg'].includes(context.artifact_format);
  const checks = value?.preflight?.checks;
  const validPreflight = exactKeys(value?.preflight, ['status', 'checked_at', 'count', 'checks'])
    && value.preflight.status === 'PASS' && validIsoDate(value.preflight.checked_at)
    && value.preflight.count === 1 && exactKeys(checks, preflightCheckKeys)
    && preflightCheckKeys.every((key) => checks[key] === 'PASS');
  if (!exactKeys(value, leaseKeys) || value.schema_version !== 2 || value.artifact !== 'BackendLease'
    || value.run_id !== state.run_id || value.consumer !== consumer
    || value.attempt !== componentAttempt(state, consumer)
    || !validIsoDate(value.created_at)
    || !['runtime-native', 'configured-api'].includes(value.backend_kind)
    || !exactKeys(value.profile, ['path', 'sha256']) || value.profile.path !== backendProfilePath()
    || !SHA256.test(value.profile.sha256 || '')
    || !exactKeys(value.adapter, ['id', 'ref', 'sha256']) || !nonempty(value.adapter.id)
    || !SHA256.test(value.adapter.sha256 || '') || !validConfiguration || !validContext
    || value.provider !== context?.provider || value.endpoint_source !== context?.endpoint_source
    || value.model !== context?.model || value.adapter?.id !== context?.adapter_id
    || value.backend_context_sha256 !== sha256(canonicalJson(context)) || !validPreflight) {
    issues.push({ code: 'backend_lease_invalid', message: 'backend configuration inaccessible', resume_from: 'visual' });
  }
  if (containsSensitiveField(value)) {
    issues.push({ code: 'backend_lease_secret_exposure', message: 'backend configuration inaccessible', resume_from: 'visual' });
  }
  if (profile && (value.profile.sha256 !== profile.sha256
    || value.backend_kind !== profile.value?.backend_kind || value.provider !== profile.value?.provider
    || value.endpoint_source !== profile.value?.endpoint_source || value.model !== profile.value?.model
    || value.adapter.id !== profile.value?.adapter?.id)) {
    issues.push({ code: 'backend_profile_drift', message: 'backend endpoint mismatch', resume_from: 'visual' });
  }
  return issues;
}

export async function loadBackendLease(runDir, state, consumer = 'body_visual', { processEnv = process.env } = {}) {
  const path = backendLeasePathForAttempt(state, consumer);
  const absolute = join(runDir, path);
  if (!fileExists(absolute)) {
    return { issues: [{ code: 'backend_lease_missing', message: 'backend configuration inaccessible', resume_from: 'visual' }], path, value: null };
  }
  let value;
  try { value = await readJson(absolute); } catch {
    return { issues: [{ code: 'backend_lease_invalid', message: 'backend configuration inaccessible', resume_from: 'visual' }], path, value: null };
  }
  const profile = await loadBackendProfile(runDir, state);
  const issues = [...profile.issues, ...validateBackendLease(value, state, consumer, profile)];
  if (!issues.length && value.backend_kind === 'configured-api') {
    let configPath;
    let authPath;
    let adapterPath;
    try {
      configPath = resolveRunPortablePathRef(value.configuration.config_ref, runDir);
      authPath = resolveRunPortablePathRef(value.configuration.auth_ref, runDir);
      adapterPath = resolveRunPortablePathRef(value.adapter.ref, runDir);
    } catch {
      issues.push(issue('configuration'));
    }
    const resolved = {
      kind: value.backend_kind,
      context: value.backend_context,
      adapter: { path: adapterPath, sha256: value.adapter.sha256, command: adapterCommand(adapterPath || '').executable },
      configuration: {
        path: configPath,
        sha256: value.configuration.config_sha256,
        auth_path: authPath,
        endpoint_override: value.configuration.endpoint_override
      },
      preflight: value.preflight,
      issues: []
    };
    const validation = issues.length ? { issues: [] } : await validateResolvedBackend(resolved, {
      configPath,
      authPath,
      adapterPath,
      processEnv
    }, { runDir, expectedPortableContext: value.backend_context });
    issues.push(...validation.issues);
  }
  if (!issues.length && value.backend_kind === 'runtime-native'
    && value.adapter.sha256 !== sha256(value.adapter.id)) {
    issues.push({ code: 'backend_lease_adapter_drift', message: 'backend configuration inaccessible', resume_from: 'visual' });
  }
  return { issues, path, value, sha256: await fileSha256(absolute) };
}

export async function validateBackendLeaseFile(runDir, state, options = {}) {
  return loadBackendLease(runDir, state, options.consumer || 'body_visual', options);
}

export function expectedPlanBackend(lease, geometry) {
  const value = {
    kind: lease.backend_kind,
    adapter: lease.adapter.id,
    endpoint_source: lease.backend_kind === 'runtime-native' ? 'runtime-native'
      : lease.endpoint_source === 'user-explicit' ? 'user-confirmed-config' : 'active-runtime-config',
    resolved_model: lease.model,
    artifact_format: lease.backend_context.artifact_format,
    credential_access: 'pass',
    model_check: 'pass',
    process_cleanup_plan: 'verify-request-process-exit',
    process_cleanup_status: 'not-run'
  };
  if (geometry) {
    value.aspect_control = 'hard_parameter';
    value.structured_size = geometry;
  }
  return value;
}

export async function resolveConfiguredBackend(options) {
  const resolved = await resolveContext(options);
  if (resolved.issues.length) return { issues: resolved.issues };
  const checkedAt = new Date().toISOString();
  if (!await checkAdapter(resolved)) return { issues: [issue('configuration')] };
  if (!await checkOutputRoot(options.outputRoot)) return { issues: [issue('configuration')] };
  const modelIssue = await checkModelChannel(resolved, options.fetchImpl || fetch);
  if (modelIssue) return { issues: [modelIssue] };
  const result = {
    kind: 'configured-api',
    context: resolved.context,
    adapter: resolved.adapter,
    configuration: resolved.configuration,
    preflight: {
      status: 'PASS', checked_at: checkedAt, count: 1,
      checks: {
        adapter_callable: 'PASS', endpoint_credential: 'PASS', model_channel: 'PASS',
        output_path_format: 'PASS', process_cleanup: 'PASS'
      }
    },
    issues: []
  };
  return result;
}

export async function validateResolvedBackend(value, options, { runDir = null, expectedPortableContext = null } = {}) {
  if (value?.issues?.length || value?.kind !== 'configured-api') return { issues: [issue('configuration')] };
  const current = await resolveContext({
    ...options,
    configPath: options.configPath || value.configuration.path,
    authPath: options.authPath || value.configuration.auth_path,
    adapterPath: options.adapterPath || value.adapter.path,
    explicitBaseUrl: value.configuration.endpoint_override
  });
  if (current.issues.length) return { issues: current.issues };
  const expectedContext = runDir
    ? portableResolved(runDir, { ...current, kind: 'configured-api' }).context : value.context;
  const matches = isDeepStrictEqual(expectedContext, expectedPortableContext || value.context)
    && current.adapter.path === value.adapter.path && current.adapter.sha256 === value.adapter.sha256
    && current.configuration.path === value.configuration.path
    && current.configuration.sha256 === value.configuration.sha256
    && value.preflight?.status === 'PASS' && value.preflight?.count === 1;
  if (!matches) return { issues: [issue('endpoint')] };
  return { issues: [] };
}

export async function executeConfiguredGeneration({
  resolved,
  configPath,
  authPath,
  runDir = null,
  processEnv = process.env,
  adapterArgs
}) {
  const current = await resolveContext({
    configPath: configPath || resolved.configuration.path,
    authPath: authPath || resolved.configuration.auth_path,
    adapterPath: resolved.adapter.path,
    explicitBaseUrl: resolved.configuration.endpoint_override,
    processEnv
  });
  const currentContext = runDir && !current.issues.length
    ? portableResolved(runDir, { ...current, kind: 'configured-api' }).context : current.context;
  if (current.issues.length || !isDeepStrictEqual(currentContext, resolved.context)
    || current.adapter.sha256 !== resolved.adapter.sha256
    || current.configuration.sha256 !== resolved.configuration.sha256) {
    return { status: 'BLOCKED', issues: current.issues.length ? current.issues : [issue('endpoint')], argv: [] };
  }
  const argv = [...current.secret.command.prefix, ...adapterArgs];
  const env = Object.fromEntries(Object.entries(processEnv).filter(([key]) =>
    !/(?:API_?KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION|CREDENTIAL)/i.test(key)));
  env.OPENAI_BASE_URL = current.secret.baseUrl;
  env.OPENAI_API_KEY = current.secret.apiKey;
  const child = await runChild(current.secret.command.executable, argv, { env });
  if (child.status !== 0) {
    return { status: 'BLOCKED', issues: [issue('model')], argv: [current.secret.command.executable, ...argv] };
  }
  return { status: 'PASS', issues: [], argv: [current.secret.command.executable, ...argv] };
}

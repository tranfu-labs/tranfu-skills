import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileExists, fileSha256, readJson } from './lib.mjs';

const exactMessages = {
  configuration: 'backend configuration inaccessible',
  credentials: 'backend credentials unavailable to adapter',
  endpoint: 'backend endpoint mismatch',
  model: 'backend model channel unavailable'
};
const leaseKeys = [
  'schema_version', 'artifact', 'run_id', 'visual_attempt', 'created_at', 'backend_kind',
  'provider', 'endpoint_source', 'adapter', 'model', 'configuration', 'backend_context',
  'backend_context_sha256', 'preflight'
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
    if (!['credential_source', 'endpoint_credential'].includes(normalized)
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

export function backendLeasePathForAttempt(state) {
  const attempt = Number.isInteger(state?.stages?.visual?.attempt) && state.stages.visual.attempt > 0
    ? state.stages.visual.attempt : 1;
  return `07-visual/backend-lease.v${String(attempt).padStart(3, '0')}.json`;
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

export function createBackendLease({ state, resolved, createdAt = new Date().toISOString() }) {
  if (resolved?.issues?.length || !['runtime-native', 'configured-api'].includes(resolved?.kind)) {
    throw new Error('Cannot create a BackendLease from a blocked backend resolution.');
  }
  const backendContext = resolved.context;
  return {
    schema_version: 1,
    artifact: 'BackendLease',
    run_id: state.run_id,
    visual_attempt: state.stages.visual.attempt,
    created_at: createdAt,
    backend_kind: resolved.kind,
    provider: backendContext.provider,
    endpoint_source: backendContext.endpoint_source,
    adapter: { path: resolved.adapter.path, sha256: resolved.adapter.sha256 },
    model: backendContext.model,
    configuration: resolved.configuration,
    backend_context: backendContext,
    backend_context_sha256: sha256(canonicalJson(backendContext)),
    preflight: resolved.preflight
  };
}

export function validateBackendLease(value, state) {
  const issues = [];
  const context = value?.backend_context;
  const configured = value?.backend_kind === 'configured-api';
  const validConfiguration = configured
    ? exactKeys(value?.configuration, ['path', 'sha256', 'auth_path', 'endpoint_override'])
      && nonempty(value.configuration.path) && SHA256.test(value.configuration.sha256 || '')
      && nonempty(value.configuration.auth_path)
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
  if (!exactKeys(value, leaseKeys) || value.schema_version !== 1 || value.artifact !== 'BackendLease'
    || value.run_id !== state.run_id || value.visual_attempt !== state.stages?.visual?.attempt
    || !validIsoDate(value.created_at)
    || !['runtime-native', 'configured-api'].includes(value.backend_kind)
    || !exactKeys(value.adapter, ['path', 'sha256']) || !nonempty(value.adapter.path)
    || !SHA256.test(value.adapter.sha256 || '') || !validConfiguration || !validContext
    || value.provider !== context?.provider || value.endpoint_source !== context?.endpoint_source
    || value.model !== context?.model || value.adapter?.path !== context?.adapter_id
    || value.backend_context_sha256 !== sha256(canonicalJson(context)) || !validPreflight) {
    issues.push({ code: 'backend_lease_invalid', message: 'backend configuration inaccessible', resume_from: 'visual' });
  }
  if (containsSensitiveField(value)) {
    issues.push({ code: 'backend_lease_secret_exposure', message: 'backend configuration inaccessible', resume_from: 'visual' });
  }
  return issues;
}

export async function validateBackendLeaseFile(runDir, state, { processEnv = process.env } = {}) {
  const path = backendLeasePathForAttempt(state);
  const absolute = join(runDir, path);
  if (!fileExists(absolute)) {
    return { issues: [{ code: 'backend_lease_missing', message: 'backend configuration inaccessible', resume_from: 'visual' }], path, value: null };
  }
  let value;
  try { value = await readJson(absolute); } catch {
    return { issues: [{ code: 'backend_lease_invalid', message: 'backend configuration inaccessible', resume_from: 'visual' }], path, value: null };
  }
  const issues = validateBackendLease(value, state);
  if (!issues.length && value.backend_kind === 'configured-api') {
    const resolved = {
      kind: value.backend_kind,
      context: value.backend_context,
      adapter: { ...value.adapter, command: adapterCommand(value.adapter.path).executable },
      configuration: value.configuration,
      preflight: value.preflight,
      issues: []
    };
    const validation = await validateResolvedBackend(resolved, {
      configPath: value.configuration?.path,
      authPath: value.configuration?.auth_path,
      adapterPath: value.adapter.path,
      processEnv
    });
    issues.push(...validation.issues);
  }
  if (!issues.length && value.backend_kind === 'runtime-native'
    && value.adapter.sha256 !== sha256(value.adapter.path)) {
    issues.push({ code: 'backend_lease_adapter_drift', message: 'backend configuration inaccessible', resume_from: 'visual' });
  }
  return { issues, path, value, sha256: await fileSha256(absolute) };
}

export function expectedPlanBackend(lease, geometry) {
  const value = {
    kind: lease.backend_kind,
    adapter: lease.adapter.path,
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

export async function validateResolvedBackend(value, options) {
  if (value?.issues?.length || value?.kind !== 'configured-api') return { issues: [issue('configuration')] };
  const current = await resolveContext({
    ...options,
    configPath: options.configPath || value.configuration.path,
    authPath: options.authPath || value.configuration.auth_path,
    adapterPath: options.adapterPath || value.adapter.path,
    explicitBaseUrl: value.configuration.endpoint_override
  });
  if (current.issues.length) return { issues: current.issues };
  const matches = isDeepStrictEqual(current.context, value.context)
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
  if (current.issues.length || !isDeepStrictEqual(current.context, resolved.context)
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

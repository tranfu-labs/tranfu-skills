import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  classifyBackendOutcome,
  createBackendLease,
  executeConfiguredGeneration,
  resolveConfiguredBackend,
  selectBackendKind,
  validateBackendLease,
  validateBackendLeaseFile,
  validateResolvedBackend
} from '../scripts/backend-runtime.mjs';

const secret = 'test-secret-must-never-leak';

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

function adapter(root) {
  const path = join(root, 'stub-image-adapter.mjs');
  write(path, `
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args.includes('--help')) process.exit(0);
const out = args[args.indexOf('--out') + 1];
const envProof = args[args.indexOf('--env-proof') + 1];
writeFileSync(out, 'stub-image');
writeFileSync(envProof, JSON.stringify({
  base: process.env.OPENAI_BASE_URL,
  key_present: Boolean(process.env.OPENAI_API_KEY),
  other_key_present: Boolean(process.env.OTHER_API_KEY)
}));
`);
  chmodSync(path, 0o755);
  return path;
}

function modelEndpoint({ models = ['gpt-image-2'] } = {}) {
  const requests = [];
  return {
    baseUrl: 'https://active-provider.example/v1',
    requests,
    fetchImpl: async (url, options) => {
      requests.push({ url, authorization: options.headers.authorization });
      return {
        status: 200,
        ok: true,
        json: async () => ({ data: models.map((id) => ({ id })) })
      };
    }
  };
}

function configuredFiles(root, baseUrl, { configProvider = 'tranfu', authProvider = 'tranfu' } = {}) {
  const configPath = join(root, 'config.toml');
  const authPath = join(root, 'auth.json');
  write(configPath, [
    `model_provider = "${configProvider}"`,
    'image_model = "gpt-image-2"',
    '',
    `[model_providers.${configProvider}]`,
    `base_url = "${baseUrl}"`
  ].join('\n'));
  write(authPath, JSON.stringify({
    active_provider: authProvider,
    providers: { [authProvider]: { api_key: secret } }
  }));
  return { configPath, authPath };
}

test('native availability wins and selected attempts never auto-switch', () => {
  assert.equal(selectBackendKind({ explicitBackend: null, nativeStatus: 'available' }), 'runtime-native');
  assert.equal(selectBackendKind({ explicitBackend: null, nativeStatus: 'unavailable' }), 'configured-api');
  assert.equal(selectBackendKind({ explicitBackend: 'configured-api', nativeStatus: 'available' }), 'configured-api');
  assert.deepEqual(classifyBackendOutcome('quality-failure'), {
    action: 'retry-candidate', retry_backend: 'runtime-native', block_attempt: false
  });
  assert.deepEqual(classifyBackendOutcome('transient-error'), {
    action: 'retry-transport', retry_backend: 'runtime-native', block_attempt: false
  });
  assert.deepEqual(classifyBackendOutcome('irrecoverable-execution-error'), {
    action: 'block-attempt', retry_backend: null, block_attempt: true
  });
});

test('configured preflight uses active Codex auth when shell has no key and queries only its endpoint once', async () => {
  const root = mkdtempSync(join(tmpdir(), 'backend-runtime-'));
  const server = modelEndpoint();
  try {
    const paths = configuredFiles(root, server.baseUrl);
    const result = await resolveConfiguredBackend({
      ...paths,
      adapterPath: adapter(root),
      processEnv: {},
      outputRoot: join(root, 'output'),
      fetchImpl: server.fetchImpl
    });
    assert.deepEqual(result.issues, []);
    assert.equal(result.context.provider, 'tranfu');
    assert.equal(result.context.endpoint_origin, new URL(server.baseUrl).origin);
    assert.equal(result.context.credential_source, 'codex-auth:active-provider');
    assert.equal(result.context.model, 'gpt-image-2');
    assert.equal(server.requests.length, 1);
    assert.equal(server.requests[0].url, `${server.baseUrl}/models`);
    assert.equal(server.requests[0].authorization, `Bearer ${secret}`);

    const validated = await validateResolvedBackend(result, {
      ...paths, adapterPath: result.adapter.path, processEnv: {}, outputRoot: join(root, 'output')
    });
    assert.deepEqual(validated.issues, []);
    assert.equal(server.requests.length, 1, 'lease validation must not repeat model preflight');
    assert.equal(JSON.stringify(result).includes(secret), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('provider-mixed endpoint and credential fail with the exact endpoint error', async () => {
  const root = mkdtempSync(join(tmpdir(), 'backend-runtime-mixed-'));
  const server = modelEndpoint();
  try {
    const paths = configuredFiles(root, server.baseUrl, { configProvider: 'provider-a', authProvider: 'provider-b' });
    const result = await resolveConfiguredBackend({
      ...paths, adapterPath: adapter(root), processEnv: {}, outputRoot: join(root, 'output'),
      fetchImpl: server.fetchImpl
    });
    assert.deepEqual(result.issues.map((item) => item.message), ['backend endpoint mismatch']);
    assert.equal(server.requests.length, 0);
    assert.equal(JSON.stringify(result).includes(secret), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('configuration and credential failures use their exact backend errors', async () => {
  const root = mkdtempSync(join(tmpdir(), 'backend-runtime-errors-'));
  try {
    const missing = await resolveConfiguredBackend({
      configPath: join(root, 'missing-config.toml'),
      authPath: join(root, 'missing-auth.json'),
      adapterPath: adapter(root),
      processEnv: {},
      outputRoot: join(root, 'output')
    });
    assert.deepEqual(missing.issues.map((item) => item.message), ['backend configuration inaccessible']);

    const configPath = join(root, 'config.toml');
    const authPath = join(root, 'auth.json');
    write(configPath, [
      'model_provider = "openai"',
      'openai_base_url = "https://active-provider.example/v1"',
      'image_model = "gpt-image-2"'
    ].join('\n'));
    write(authPath, JSON.stringify({ active_provider: 'openai' }));
    const credentials = await resolveConfiguredBackend({
      configPath, authPath, adapterPath: adapter(root), processEnv: {}, outputRoot: join(root, 'output')
    });
    assert.deepEqual(credentials.issues.map((item) => item.message), ['backend credentials unavailable to adapter']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing image model uses the exact model-channel error', async () => {
  const root = mkdtempSync(join(tmpdir(), 'backend-runtime-model-'));
  const server = modelEndpoint({ models: ['text-only-model'] });
  try {
    const paths = configuredFiles(root, server.baseUrl);
    const result = await resolveConfiguredBackend({
      ...paths, adapterPath: adapter(root), processEnv: {}, outputRoot: join(root, 'output'),
      fetchImpl: server.fetchImpl
    });
    assert.deepEqual(result.issues.map((item) => item.message), ['backend model channel unavailable']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('configured wrapper injects credentials only into the child environment and returns redacted output', async () => {
  const root = mkdtempSync(join(tmpdir(), 'backend-runtime-wrapper-'));
  const server = modelEndpoint();
  try {
    const paths = configuredFiles(root, server.baseUrl);
    const adapterPath = adapter(root);
    const resolved = await resolveConfiguredBackend({
      ...paths, adapterPath, processEnv: {}, outputRoot: join(root, 'output'),
      fetchImpl: server.fetchImpl
    });
    const outputPath = join(root, 'output', 'image.png');
    const envProof = join(root, 'output', 'env-proof.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    const result = await executeConfiguredGeneration({
      resolved,
      configPath: paths.configPath,
      authPath: paths.authPath,
      processEnv: { OTHER_API_KEY: 'must-not-reach-adapter' },
      adapterArgs: ['--out', outputPath, '--env-proof', envProof]
    });
    assert.equal(result.status, 'PASS');
    assert.equal(readFileSync(outputPath, 'utf8'), 'stub-image');
    assert.deepEqual(JSON.parse(readFileSync(envProof, 'utf8')), {
      base: server.baseUrl,
      key_present: true,
      other_key_present: false
    });
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(result.argv.includes(secret), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('configured lease is redacted, remains bound to its attempt, and blocks configuration drift', async () => {
  const root = mkdtempSync(join(tmpdir(), 'backend-runtime-lease-'));
  const server = modelEndpoint();
  try {
    const paths = configuredFiles(root, server.baseUrl);
    const resolved = await resolveConfiguredBackend({
      ...paths, adapterPath: adapter(root), processEnv: {}, outputRoot: join(root, 'output'),
      fetchImpl: server.fetchImpl
    });
    const state = { run_id: 'lease-run', stages: { visual: { attempt: 2 } } };
    const lease = createBackendLease({ state, resolved, createdAt: '2026-07-22T00:00:00.000Z' });
    assert.deepEqual(validateBackendLease(lease, state), []);
    assert.equal(JSON.stringify(lease).includes(secret), false);
    const exposed = structuredClone(lease);
    exposed.configuration.token = secret;
    assert.ok(validateBackendLease(exposed, state).some((item) => item.code === 'backend_lease_secret_exposure'));
    write(join(root, '07-visual', 'backend-lease.v002.json'), JSON.stringify(lease));

    const current = await validateBackendLeaseFile(root, state, { processEnv: {} });
    assert.deepEqual(current.issues, []);
    assert.equal(server.requests.length, 1, 'lease validation cannot repeat the non-billable preflight');

    write(paths.configPath, [
      'model_provider = "tranfu"',
      'image_model = "gpt-image-2"',
      '',
      '[model_providers.tranfu]',
      'base_url = "https://changed-provider.example/v1"'
    ].join('\n'));
    const drift = await validateBackendLeaseFile(root, state, { processEnv: {} });
    assert.deepEqual(drift.issues.map((item) => item.message), ['backend endpoint mismatch']);
    assert.equal(JSON.stringify(drift).includes(secret), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an explicit task endpoint stays bound through lease validation and execution', async () => {
  const root = mkdtempSync(join(tmpdir(), 'backend-runtime-explicit-'));
  const server = modelEndpoint();
  try {
    const paths = configuredFiles(root, 'https://ignored-provider.example/v1');
    const adapterPath = adapter(root);
    const resolved = await resolveConfiguredBackend({
      ...paths,
      adapterPath,
      explicitBaseUrl: server.baseUrl,
      processEnv: { OPENAI_BASE_URL: 'https://ignored-env.example/v1' },
      outputRoot: join(root, 'output'),
      fetchImpl: server.fetchImpl
    });
    assert.deepEqual(resolved.issues, []);
    assert.equal(resolved.context.endpoint_source, 'user-explicit');
    const validated = await validateResolvedBackend(resolved, {
      ...paths, adapterPath, processEnv: { OPENAI_BASE_URL: 'https://ignored-env.example/v1' }
    });
    assert.deepEqual(validated.issues, []);

    const outputPath = join(root, 'output', 'explicit.png');
    const envProof = join(root, 'output', 'explicit-env.json');
    const generated = await executeConfiguredGeneration({
      resolved, processEnv: {}, adapterArgs: ['--out', outputPath, '--env-proof', envProof]
    });
    assert.equal(generated.status, 'PASS');
    assert.equal(JSON.parse(readFileSync(envProof, 'utf8')).base, server.baseUrl);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

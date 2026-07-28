import { createHash } from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function createReuseFingerprint({
  draft,
  title_selection,
  coverage_anchor,
  style,
  text_content,
  brand,
  backend_profile,
  geometry,
  prompt_compiler,
  qa,
  image
}) {
  const input = {
    draft,
    title_selection,
    coverage_anchor,
    style,
    text_content,
    brand,
    backend_profile,
    geometry,
    prompt_compiler
  };
  return {
    schema_version: 1,
    artifact: 'VisualReuseFingerprint',
    input_sha256: sha256(input),
    qa_sha256: qa?.sha256 || null,
    image_sha256: image?.sha256 || null,
    fingerprint: sha256({ input, qa, image })
  };
}

export function createReuseInputSha256(value) {
  return createReuseFingerprint({
    ...value,
    qa: { sha256: '0'.repeat(64) },
    image: { sha256: '0'.repeat(64) }
  }).input_sha256;
}

export function validReuseFingerprint(value) {
  return value?.schema_version === 1 && value?.artifact === 'VisualReuseFingerprint'
    && /^[a-f0-9]{64}$/.test(value.input_sha256 || '')
    && /^[a-f0-9]{64}$/.test(value.qa_sha256 || '')
    && /^[a-f0-9]{64}$/.test(value.image_sha256 || '')
    && /^[a-f0-9]{64}$/.test(value.fingerprint || '');
}

export function selectReusableSuite(previous, current) {
  const currentChildren = current?.children || {};
  const reusableChildren = {};
  for (const [imageId, expected] of Object.entries(currentChildren)) {
    const candidate = previous?.children?.[imageId];
    if (expected?.text_policy === 'icons_only' || candidate?.text_policy === 'icons_only') continue;
    if (!validReuseFingerprint(candidate?.fingerprint)
      || candidate.fingerprint.input_sha256 !== expected?.input_sha256) continue;
    reusableChildren[imageId] = {
      ...candidate,
      result: candidate.result,
      image: candidate.image,
      qa: candidate.qa,
      fingerprint: candidate.fingerprint
    };
  }
  const expectedIds = Object.keys(currentChildren);
  const wholeSuite = expectedIds.length > 0 && expectedIds.every((id) => reusableChildren[id])
    && previous?.bundle && previous?.manifest;
  return {
    mode: wholeSuite ? 'suite' : Object.keys(reusableChildren).length ? 'partial' : 'none',
    children: reusableChildren,
    bundle: wholeSuite ? previous.bundle : null,
    manifest: wholeSuite ? previous.manifest : null,
    rerun_set_qa: !wholeSuite && Object.keys(reusableChildren).length > 0
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReuseInputSha256,
  createReuseFingerprint,
  selectReusableSuite
} from '../scripts/visual-reuse.mjs';

test('input fingerprint excludes QA and image output hashes', () => {
  const base = {
    draft: { sha256: 'a'.repeat(64) },
    title_selection: { sha256: 'b'.repeat(64) },
    coverage_anchor: { source_excerpt: '确认边界' },
    style: { spec_sha256: 'c'.repeat(64) },
    text_content: { primary: { headline: '确认边界' } },
    brand: { renderer_sha256: 'd'.repeat(64) },
    backend_profile: { sha256: 'e'.repeat(64) },
    geometry: { width: 1600, height: 1200 },
    prompt_compiler: { sha256: 'f'.repeat(64) }
  };
  assert.equal(createReuseInputSha256(base), createReuseFingerprint({
    ...base,
    qa: { sha256: '1'.repeat(64) },
    image: { sha256: '2'.repeat(64) }
  }).input_sha256);
});

function fingerprint(seed) {
  return createReuseFingerprint({
    draft: { sha256: seed.repeat(64).slice(0, 64) },
    title_selection: { sha256: 'a'.repeat(64) },
    coverage_anchor: { excerpt: '边界' },
    style: { spec_sha256: 'b'.repeat(64) },
    text_content: { headline: '确认边界', labels: ['确认', '边界'] },
    brand: { sha256: 'c'.repeat(64) },
    backend_profile: { sha256: 'd'.repeat(64) },
    geometry: { width: 1600, height: 1200 },
    prompt_compiler: { sha256: 'e'.repeat(64) },
    qa: { sha256: 'f'.repeat(64) },
    image: { sha256: '1'.repeat(64) }
  });
}

test('unchanged suite reuses original bundle and image references', () => {
  const fp = fingerprint('9');
  const selected = selectReusableSuite({
    children: {
      first: { fingerprint: fp, result: { path: 'old/result.json' }, image: { path: 'old/image.png' }, qa: { path: 'old/qa.json' } }
    },
    bundle: { path: 'old/bundle.json', sha256: '2'.repeat(64) },
    manifest: { path: 'old/manifest.md', sha256: '3'.repeat(64) }
  }, { children: { first: { input_sha256: fp.input_sha256, text_policy: 'allowlist' } } });
  assert.equal(selected.mode, 'suite');
  assert.equal(selected.children.first.image.path, 'old/image.png');
  assert.equal(selected.rerun_set_qa, false);
});

test('partial suite reuses matching children but requires Set QA', () => {
  const fp = fingerprint('8');
  const selected = selectReusableSuite({
    children: { first: { fingerprint: fp, result: {}, image: {}, qa: {} } }
  }, {
    children: {
      first: { input_sha256: fp.input_sha256, text_policy: 'allowlist' },
      second: { input_sha256: '0'.repeat(64), text_policy: 'allowlist' }
    }
  });
  assert.equal(selected.mode, 'partial');
  assert.deepEqual(Object.keys(selected.children), ['first']);
  assert.equal(selected.rerun_set_qa, true);
});

test('icons-only legacy images are never reusable under V3 text policy', () => {
  const fp = fingerprint('7');
  const selected = selectReusableSuite({
    children: { first: { fingerprint: fp, text_policy: 'icons_only', result: {}, image: {}, qa: {} } },
    bundle: {}, manifest: {}
  }, { children: { first: { input_sha256: fp.input_sha256, text_policy: 'allowlist' } } });
  assert.equal(selected.mode, 'none');
});

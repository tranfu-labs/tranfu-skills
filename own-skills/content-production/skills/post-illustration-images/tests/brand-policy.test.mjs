import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveBrandPolicy } from "../scripts/resolve-brand-policy.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function styleSpec(defaultEnabled, userOverrideAllowed = true) {
  return {
    id: "test-style",
    brandPolicy: { defaultEnabled, userOverrideAllowed },
    fixedComponents: {
      brandSlot: { enabled: true, anchor: "top-right" }
    }
  };
}

test("uses enabled style default without an override", () => {
  assert.deepEqual(resolveBrandPolicy(styleSpec(true)), {
    brand_enabled: true,
    brand_policy_default_enabled: true,
    brand_override: null,
    brand_policy_source: "style-default"
  });
});

test("uses disabled style default without an override", () => {
  assert.equal(resolveBrandPolicy(styleSpec(false)).brand_enabled, false);
});

test("explicit user override wins over the style default", () => {
  assert.equal(resolveBrandPolicy(styleSpec(false), "enabled").brand_enabled, true);
  assert.equal(resolveBrandPolicy(styleSpec(true), "disabled").brand_enabled, false);
});

test("legacy styles remain enabled", () => {
  const legacy = styleSpec(true);
  delete legacy.brandPolicy;
  assert.equal(resolveBrandPolicy(legacy).brand_policy_source, "legacy-default");
  assert.equal(resolveBrandPolicy(legacy).brand_enabled, true);
});

test("rejects overrides when a style forbids them", () => {
  assert.throws(
    () => resolveBrandPolicy(styleSpec(true, false), "disabled"),
    /does not allow brand overrides/
  );
});

test("brand overlay self-test loads the vendored CommonJS runtime", () => {
  const result = spawnSync(process.execPath, [resolve(ROOT, "scripts/apply-brand-overlay.mjs"), "--self-test"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Brand overlay self-test passed/);
});

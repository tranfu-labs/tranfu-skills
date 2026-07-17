import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resolver = resolve(root, "scripts/resolve-generation-geometry.mjs");
const cases = [
  ["references/styles/wechat-style-doodle.spec.json", "1600x1200", "4:3"],
  ["references/styles/xhs-style-cream-paper.spec.json", "1152x1536", "3:4"],
  ["references/styles/xhs-style-explainer-notebook.spec.json", "1152x1536", "3:4"],
  ["references/styles/xhs-style-orange-card.spec.json", "1152x1536", "3:4"],
  ["references/styles/zhihu-style-title.spec.json", "2048x1152", "16:9"],
  ["references/styles/weibo-signal-core.spec.json", "1152x1536", "3:4"],
  ["references/styles/toutiao-luminous-tech.spec.json", "2048x1152", "16:9"]
];

function resolveGeometry(specPath, model = "gpt-image-2") {
  const result = spawnSync(process.execPath, [resolver, "--style-spec", specPath, "--model", model], {
    cwd: root,
    encoding: "utf8"
  });
  return { ...result, output: result.status === 0 ? JSON.parse(result.stdout) : null };
}

test("all production styles request native gpt-image-2 sizes and preserve backend pixels", () => {
  for (const [specPath, requestSize, ratio] of cases) {
    const result = resolveGeometry(specPath);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output.requested_dimensions, requestSize);
    assert.equal(result.output.target_aspect_ratio, ratio);
    assert.equal(result.output.delivery_dimensions, "source");
    assert.equal(result.output.native_output_policy, "preserve");
    assert.equal(result.output.post_generation_resize, "forbidden");
  }
});

test("does not borrow gpt-image-2 geometry for another model", () => {
  const result = resolveGeometry(cases[0][0], "other-image-model");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No geometry profile/);
});

test("accepts a design canvas whose declared ratio is within tolerance", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "generation-geometry-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const specPath = join(directory, "near-ratio.spec.json");
  const spec = JSON.parse(readFileSync(resolve(root, cases[4][0]), "utf8"));
  spec.canvas.width = 1672;
  spec.canvas.height = 941;
  writeFileSync(specPath, JSON.stringify(spec));

  const result = resolveGeometry(specPath);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output.requested_dimensions, "2048x1152");
  assert.equal(result.output.design_dimensions, "1672x941");
});

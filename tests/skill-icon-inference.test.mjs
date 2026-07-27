import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";
import { inferSkillIcon, resolveSkillIconSpec } from "../scripts/lib/skill-icon-inference.mjs";

const require = createRequire(import.meta.url);
let hasSharp = true;
try {
  require.resolve("sharp");
} catch {
  hasSharp = false;
}

const availableIcons = [
  "book-open-check",
  "chart-line",
  "cloud-cog",
  "file-code-2",
  "file-down",
  "images",
  "layout-template",
  "list-checks",
  "target",
  "workflow",
];

test("infers a semantic icon for a newly added skill", () => {
  assert.deepEqual(
    inferSkillIcon({
      slug: "customer-market-analysis",
      description: "Analyze a market and competitive landscape.",
      availableIcons,
    }),
    ["strategy", "chart-line", "自动匹配：市场分析"],
  );
});

test("uses a deterministic fallback when no keyword matches", () => {
  const input = { slug: "novel-capability", description: "A new capability.", availableIcons };
  assert.deepEqual(inferSkillIcon(input), inferSkillIcon(input));
  assert.ok(availableIcons.includes(inferSkillIcon(input)[1]));
});

test("preserves curated mappings for existing skills", () => {
  const curatedSpecs = { "known-skill": ["content", "images", "人工语义"] };
  assert.deepEqual(
    resolveSkillIconSpec({ slug: "known-skill", availableIcons, curatedSpecs }),
    { spec: curatedSpecs["known-skill"], source: "curated" },
  );
});

test("generator creates SVG and PNG for a newly added unmapped skill", { skip: !hasSharp }, async () => {
  const skillsRoot = await mkdtemp(path.join(os.tmpdir(), "tranfu-icon-skill-"));
  const skillDir = path.join(skillsRoot, "customer-market-analysis");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    "---\nname: customer-market-analysis\ndescription: Analyze a market and competitors.\n---\n",
  );

  try {
    const result = spawnSync(process.execPath, ["scripts/generate-own-skill-icons.mjs"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
      env: { ...process.env, SKILLS_ROOT: skillsRoot },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const svg = await readFile(path.join(skillDir, "assets/icon.svg"), "utf8");
    const png = await readFile(path.join(skillDir, "assets/icon.png"));
    const manifest = JSON.parse(await readFile(path.join(skillsRoot, "icon-manifest.json"), "utf8"));
    assert.match(svg, /width="48" height="48" viewBox="0 0 48 48"/);
    assert.match(svg, /<rect width="48" height="48" fill="#FFF3E8"\/>/);
    assert.equal(png.readUInt32BE(16), 48);
    assert.equal(png.readUInt32BE(20), 48);
    assert.equal(manifest[0].selection_source, "inferred");
    assert.equal(manifest[0].lucide_icon, "chart-line");
  } finally {
    await rm(skillsRoot, { recursive: true, force: true });
  }
});

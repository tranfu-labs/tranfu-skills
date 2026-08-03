import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { validateSkillPresentationMetadata } from "../scripts/validate-presentation-metadata.mjs";
import { makeTmpRepo, cleanup, writeSkill } from "./helpers.mjs";

const README = `---
description: Human readable description.
prompt_examples:
  - prompt: Please do the thing.
    scene: Thing
---

# Skill

Body.
`;

function addPresentationMetadata(skillDir) {
  mkdirSync(join(skillDir, "assets"), { recursive: true });
  mkdirSync(join(skillDir, "agents"), { recursive: true });
  writeFileSync(join(skillDir, "README.md"), README);
  writeFileSync(join(skillDir, "README.zh.md"), README);
  writeFileSync(join(skillDir, "assets/icon.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\"></svg>\n");
  writeFileSync(join(skillDir, "assets/icon.png"), "not-empty\n");
  writeFileSync(join(skillDir, "agents/openai.yaml"), `interface:
  icon_small: "./assets/icon.svg"
  icon_large: "./assets/icon.png"
  display_name: "Demo"
`);
}

test("presentation metadata: complete skill passes", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "complete" });
    addPresentationMetadata(dir);
    const results = validateSkillPresentationMetadata(dir, root);
    assert.deepEqual(results, []);
  } finally {
    cleanup(root);
  }
});

test("presentation metadata: new own skill missing README/icon fails before merge", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, {
      name: "new-skill",
      presentation: false,
      frontmatter: { author: "Stupides9169", display_name: "New Skill", display_name_zh: "新 Skill" },
      files: {
        "agents/openai.yaml": `interface:
  display_name: "New Skill"
`,
      },
    });
    const results = validateSkillPresentationMetadata(dir, root);
    assert.equal(results.length, 1);
    assert.equal(results[0].severity, "error");
    assert.equal(results[0].rule, "presentation.required");
    assert.match(results[0].message, /README\.md/);
    assert.match(results[0].message, /assets\/icon\.svg/);
    assert.match(results[0].message, /interface\.icon_small/);
  } finally {
    cleanup(root);
  }
});

test("presentation metadata: legacy debt can be baselined as warning", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, {
      name: "legacy",
      presentation: false,
      frontmatter: { display_name: "Legacy", display_name_zh: "旧 Skill" },
    });
    const baseline = {
      "own-skills/legacy": [
        "README.md",
        "README.zh.md",
        "assets/icon.svg",
        "assets/icon.png",
        "agents/openai.yaml",
      ],
    };
    const results = validateSkillPresentationMetadata(dir, root, { baseline });
    assert.equal(results.length, 1);
    assert.equal(results[0].severity, "warning");
    assert.equal(results[0].rule, "presentation.legacy-baseline");
  } finally {
    cleanup(root);
  }
});

test("presentation metadata: partial fix still fails when not fully covered by baseline", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, {
      name: "partial",
      presentation: false,
      frontmatter: { display_name: "Partial", display_name_zh: "部分 Skill" },
    });
    const baseline = { "own-skills/partial": ["README.md"] };
    const results = validateSkillPresentationMetadata(dir, root, { baseline });
    assert.equal(results.length, 1);
    assert.equal(results[0].severity, "error");
    assert.equal(results[0].rule, "presentation.required");
    assert.match(results[0].message, /README\.zh\.md/);
  } finally {
    cleanup(root);
  }
});

test("presentation metadata: missing SKILL.md display names fail", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, {
      name: "no-display",
      frontmatter: { display_name: "", display_name_zh: "" },
    });
    const results = validateSkillPresentationMetadata(dir, root);
    assert.equal(results.length, 1);
    assert.equal(results[0].severity, "error");
    assert.match(results[0].message, /SKILL\.md:display_name/);
    assert.match(results[0].message, /SKILL\.md:display_name_zh/);
  } finally {
    cleanup(root);
  }
});

test("presentation metadata: README prompt_examples must be an array of prompt/scene maps", () => {
  const root = makeTmpRepo();
  try {
    const badReadme = `---
description: Human readable description.
prompt_examples: not-an-array
---

# Bad
`;
    const dir = writeSkill(root, { name: "bad-readme", readme: badReadme });
    const results = validateSkillPresentationMetadata(dir, root);
    assert.equal(results.length, 1);
    assert.equal(results[0].severity, "error");
    assert.match(results[0].message, /README\.md:prompt_examples/);
    assert.match(results[0].message, /README\.zh\.md:prompt_examples/);
  } finally {
    cleanup(root);
  }
});

test("presentation metadata: README frontmatter needs description", () => {
  const root = makeTmpRepo();
  try {
    const badReadme = `---
prompt_examples:
  - prompt: Please do the thing.
    scene: Thing
---

# Bad
`;
    const dir = writeSkill(root, { name: "bad-description", readme: badReadme });
    const results = validateSkillPresentationMetadata(dir, root);
    assert.equal(results.length, 1);
    assert.equal(results[0].severity, "error");
    assert.match(results[0].message, /README\.md:description/);
    assert.match(results[0].message, /README\.zh\.md:description/);
  } finally {
    cleanup(root);
  }
});

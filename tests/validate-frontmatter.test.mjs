import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { validateSkillFile, parseFrontmatter } from "../scripts/validate-frontmatter.mjs";
import { makeTmpRepo, cleanup, writeSkill, writeRawSkillMd } from "./helpers.mjs";

function findRule(results, rule) {
  return results.find((r) => r.rule === rule);
}

test("frontmatter: valid → 0 errors", () => {
  const root = makeTmpRepo();
  try {
    writeSkill(root, { name: "good" });
    const errs = validateSkillFile(join(root, "own-skills/good/SKILL.md"), root);
    assert.equal(errs.length, 0);
  } finally {
    cleanup(root);
  }
});

test("frontmatter: external metadata fields are optional", () => {
  const root = makeTmpRepo();
  try {
    writeRawSkillMd(root, {
      root: "external-skills",
      name: "ext",
      content: `---
name: ext
description: external stub
origin: external
source_url: https://github.com/example/ext
---

# x
`,
    });
    const errs = validateSkillFile(join(root, "external-skills/ext/SKILL.md"), root);
    assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);
  } finally {
    cleanup(root);
  }
});

test("frontmatter: missing required field → frontmatter.missing-field", () => {
  const root = makeTmpRepo();
  try {
    writeRawSkillMd(root, {
      name: "bad",
      content: "---\nname: bad\n---\n",
    });
    const errs = validateSkillFile(join(root, "own-skills/bad/SKILL.md"), root);
    const missing = errs.filter((e) => e.rule === "frontmatter.missing-field");
    assert.ok(missing.length >= 5, "should report several missing fields");
    assert.ok(missing.every((e) => e.severity === "error"));
    assert.ok(missing.every((e) => e.fix_hint));
  } finally {
    cleanup(root);
  }
});

test("frontmatter: no frontmatter block → frontmatter.parse", () => {
  const root = makeTmpRepo();
  try {
    writeRawSkillMd(root, { name: "noyaml", content: "# just a heading\n" });
    const errs = validateSkillFile(join(root, "own-skills/noyaml/SKILL.md"), root);
    assert.equal(errs.length, 1);
    assert.equal(errs[0].rule, "frontmatter.parse");
  } finally {
    cleanup(root);
  }
});

test("frontmatter: description > 1024 chars → too-long", () => {
  const root = makeTmpRepo();
  try {
    const longDesc = "a".repeat(1025);
    writeSkill(root, { name: "long", frontmatter: { description: longDesc } });
    const errs = validateSkillFile(join(root, "own-skills/long/SKILL.md"), root);
    const tooLong = findRule(errs, "frontmatter.description-too-long");
    assert.ok(tooLong, "should report description-too-long");
    assert.match(tooLong.message, /1025 characters/);
  } finally {
    cleanup(root);
  }
});

test("frontmatter: description exactly 1024 → ok", () => {
  const root = makeTmpRepo();
  try {
    const desc = "a".repeat(1024);
    writeSkill(root, { name: "exact", frontmatter: { description: desc } });
    const errs = validateSkillFile(join(root, "own-skills/exact/SKILL.md"), root);
    assert.equal(errs.length, 0);
  } finally {
    cleanup(root);
  }
});

test("frontmatter: folded block scalar (>) parses + length counted correctly", () => {
  const root = makeTmpRepo();
  try {
    const content = `---
name: folded
description: >
  this is a long
  description spread
  across multiple lines
version: 0.0.1
author: t
updated_at: 2026-01-01
origin: own
---

# x
`;
    writeRawSkillMd(root, { name: "folded", content });
    const errs = validateSkillFile(join(root, "own-skills/folded/SKILL.md"), root);
    assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);
  } finally {
    cleanup(root);
  }
});

test("parseFrontmatter (unit): folded value collapses whitespace", () => {
  const { data, error } = parseFrontmatter(
    "---\ndesc: >\n  hello\n  world\n---\n",
  );
  assert.equal(error, null);
  assert.equal(data.desc, "hello world");
});

test("parseFrontmatter (unit): nested metadata maps and lists stay structured", () => {
  const { data, error } = parseFrontmatter(`---
name: nested
metadata:
  requires:
    bins: ["node", "rg"]
  relatedSkills:
    - "../foo/SKILL.md"
    - "../bar/SKILL.md"
---
`);
  assert.equal(error, null);
  assert.deepEqual(data.metadata, {
    requires: { bins: ["node", "rg"] },
    relatedSkills: ["../foo/SKILL.md", "../bar/SKILL.md"],
  });
});

test("parseFrontmatter (unit): lists of maps stay structured", () => {
  const { data, error } = parseFrontmatter(`---
prompt_examples:
  - prompt: Help me use this skill
    scene: English example
  - prompt: "Review this input"
    scene: Review
---
`);
  assert.equal(error, null);
  assert.deepEqual(data.prompt_examples, [
    { prompt: "Help me use this skill", scene: "English example" },
    { prompt: "Review this input", scene: "Review" },
  ]);
});

test("parseFrontmatter (unit): URL scalar lists remain string lists", () => {
  const { data, error } = parseFrontmatter(`---
sources:
  - https://example.com/skill
---
`);
  assert.equal(error, null);
  assert.deepEqual(data.sources, ["https://example.com/skill"]);
});

test("parseFrontmatter (unit): JSON-compatible scalar types stay typed", () => {
  const { data, error } = parseFrontmatter(
    '---\nenabled: true\ndisabled: false\ntags: ["one", "two"]\nquoted: "true"\n---\n',
  );
  assert.equal(error, null);
  assert.equal(data.enabled, true);
  assert.equal(data.disabled, false);
  assert.deepEqual(data.tags, ["one", "two"]);
  assert.equal(data.quoted, "true");
});

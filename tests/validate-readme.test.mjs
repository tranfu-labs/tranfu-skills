import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { validateSkillReadme } from "../scripts/validate-readme.mjs";
import { makeTmpRepo, cleanup, writeSkill } from "./helpers.mjs";

function ruleIds(errs) {
  return errs.map((e) => e.rule).sort();
}

const GOOD_README = `# title

## 同类对比

foo vs bar

## 价值

when to use this

## 已知限制

no GPU support
`;

test("readme: missing README → readme.missing (ERROR)", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "noreadme" });
    const errs = validateSkillReadme(dir, root);
    assert.deepEqual(ruleIds(errs), ["readme.missing"]);
    assert.equal(errs[0].severity, "error");
  } finally {
    cleanup(root);
  }
});

test("readme: README.zh.md alone → no missing", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "zh" });
    writeFileSync(join(dir, "README.zh.md"), GOOD_README);
    const errs = validateSkillReadme(dir, root);
    assert.equal(errs.length, 0, JSON.stringify(errs));
  } finally {
    cleanup(root);
  }
});

test("readme: README.en.md alone → no missing", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "en" });
    writeFileSync(join(dir, "README.en.md"), GOOD_README);
    const errs = validateSkillReadme(dir, root);
    assert.equal(errs.length, 0, JSON.stringify(errs));
  } finally {
    cleanup(root);
  }
});

test("readme: only 1 H2 → readme.too-few-sections (ERROR)", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "thin", readme: "# t\n\n## only one\n\nx\n" });
    const errs = validateSkillReadme(dir, root);
    const ids = ruleIds(errs);
    assert.ok(ids.includes("readme.too-few-sections"));
    assert.ok(errs.every((e) => e.severity === "error"));
  } finally {
    cleanup(root);
  }
});

test("readme: 5 H2 but no keyword categories → readme.no-value-section (ERROR)", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, {
      name: "novalue",
      readme: "# t\n\n## a\n\n## b\n\n## c\n\n## d\n\n## e\n",
    });
    const errs = validateSkillReadme(dir, root);
    assert.deepEqual(ruleIds(errs), ["readme.no-value-section"]);
    assert.equal(errs[0].severity, "error");
  } finally {
    cleanup(root);
  }
});

test("readme: 3 H2 + 3 keyword categories → 0 errors", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "good", readme: GOOD_README });
    const errs = validateSkillReadme(dir, root);
    assert.equal(errs.length, 0, JSON.stringify(errs));
  } finally {
    cleanup(root);
  }
});

test("readme: H2 inside code fence → NOT counted as H2", () => {
  const root = makeTmpRepo();
  try {
    const readme = `# t

\`\`\`md
## not an H2
## also fake
## still fake
\`\`\`

## 同类对比

real one
`;
    const dir = writeSkill(root, { name: "fence", readme });
    const errs = validateSkillReadme(dir, root);
    assert.ok(
      errs.some((e) => e.rule === "readme.too-few-sections"),
      "should fail too-few because fenced ## don't count",
    );
  } finally {
    cleanup(root);
  }
});

test("readme: 触发示例 counts as how-to category", () => {
  const root = makeTmpRepo();
  try {
    const readme = `# t

## 什么时候用

why

## 触发示例

how

## 期望输出

io
`;
    const dir = writeSkill(root, { name: "trig", readme });
    const errs = validateSkillReadme(dir, root);
    assert.equal(errs.length, 0, JSON.stringify(errs));
  } finally {
    cleanup(root);
  }
});

test("readme: 类似 counts as comparable category", () => {
  const root = makeTmpRepo();
  try {
    const readme = `# t

## 类似工具

foo

## 价值

bar

## 输入与输出

baz
`;
    const dir = writeSkill(root, { name: "sim", readme });
    const errs = validateSkillReadme(dir, root);
    assert.equal(errs.length, 0, JSON.stringify(errs));
  } finally {
    cleanup(root);
  }
});

test("readme: missing rule fix_hint mentions all 3 README variants", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "miss" });
    const errs = validateSkillReadme(dir, root);
    assert.equal(errs.length, 1);
    assert.match(errs[0].message, /README\.md, README\.zh\.md, README\.en\.md/);
  } finally {
    cleanup(root);
  }
});

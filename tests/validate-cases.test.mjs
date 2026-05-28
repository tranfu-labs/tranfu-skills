import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { validateSkillCases } from "../scripts/validate-cases.mjs";
import { makeTmpRepo, cleanup, writeSkill } from "./helpers.mjs";

function ruleIds(errs) {
  return errs.map((e) => e.rule).sort();
}

function mkCase(skillDir, n, { withInput = true, withPrompt = true, withOutput = true } = {}) {
  if (withInput) {
    mkdirSync(join(skillDir, "cases", String(n), "input"), { recursive: true });
    if (withPrompt) {
      writeFileSync(join(skillDir, "cases", String(n), "input", "PROMPT.md"), "drive\n");
    } else {
      writeFileSync(join(skillDir, "cases", String(n), "input", "x.txt"), "a");
    }
  }
  if (withOutput) {
    mkdirSync(join(skillDir, "cases", String(n), "output"), { recursive: true });
    writeFileSync(join(skillDir, "cases", String(n), "output", "x.txt"), "a");
  }
}

test("cases: no cases/ → 0 errors", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "nocases" });
    const errs = validateSkillCases(dir, root);
    assert.equal(errs.length, 0);
  } finally {
    cleanup(root);
  }
});

test("cases: valid 1+2 sequential → 0 errors", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "good" });
    mkCase(dir, 1);
    mkCase(dir, 2);
    const errs = validateSkillCases(dir, root);
    assert.equal(errs.length, 0, JSON.stringify(errs));
  } finally {
    cleanup(root);
  }
});

test("cases: input/ exists but no PROMPT.md → cases.missing-prompt-md", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "noprompt" });
    mkCase(dir, 1, { withPrompt: false });
    const errs = validateSkillCases(dir, root);
    assert.deepEqual(ruleIds(errs), ["cases.missing-prompt-md"]);
  } finally {
    cleanup(root);
  }
});

test("cases: input/ has PROMPT.md + supporting file → 0 errors", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "withaux" });
    mkCase(dir, 1);
    writeFileSync(join(dir, "cases/1/input/screenshot.png"), "fake-png");
    const errs = validateSkillCases(dir, root);
    assert.equal(errs.length, 0, JSON.stringify(errs));
  } finally {
    cleanup(root);
  }
});

test("cases: missing input → cases.missing-input", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "noinput" });
    mkCase(dir, 1, { withInput: false });
    const errs = validateSkillCases(dir, root);
    assert.deepEqual(ruleIds(errs), ["cases.missing-input"]);
  } finally {
    cleanup(root);
  }
});

test("cases: missing output → cases.missing-output", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "nooutput" });
    mkCase(dir, 1, { withOutput: false });
    const errs = validateSkillCases(dir, root);
    assert.deepEqual(ruleIds(errs), ["cases.missing-output"]);
  } finally {
    cleanup(root);
  }
});

test("cases: gaps in numbering (1, 3, 7) → 0 errors (no sequential constraint)", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "gaps" });
    mkCase(dir, 1);
    mkCase(dir, 3);
    mkCase(dir, 7);
    const errs = validateSkillCases(dir, root);
    assert.equal(errs.length, 0, JSON.stringify(errs));
  } finally {
    cleanup(root);
  }
});

test("cases: leading zero (cases/01) → cases.leading-zero (ERROR)", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "lz" });
    mkdirSync(join(dir, "cases", "01", "input"), { recursive: true });
    mkdirSync(join(dir, "cases", "01", "output"), { recursive: true });
    writeFileSync(join(dir, "cases", "01", "input", "x"), "a");
    writeFileSync(join(dir, "cases", "01", "output", "x"), "a");
    const errs = validateSkillCases(dir, root);
    const lz = errs.find((e) => e.rule === "cases.leading-zero");
    assert.ok(lz);
    assert.equal(lz.severity, "error");
  } finally {
    cleanup(root);
  }
});

test("cases: legacy *.md → cases.legacy-single-file (ERROR after severity bump)", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "legacy" });
    mkdirSync(join(dir, "cases"), { recursive: true });
    writeFileSync(join(dir, "cases/oldcase.md"), "# legacy\n");
    const errs = validateSkillCases(dir, root);
    assert.deepEqual(ruleIds(errs), ["cases.legacy-single-file"]);
    assert.equal(errs[0].severity, "error");
  } finally {
    cleanup(root);
  }
});

test("cases: mixed legacy + new → cases.mixed-legacy-and-new + legacy-single-file", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "mix" });
    mkCase(dir, 1);
    writeFileSync(join(dir, "cases/oldcase.md"), "# legacy\n");
    const errs = validateSkillCases(dir, root);
    const ids = ruleIds(errs);
    assert.ok(ids.includes("cases.mixed-legacy-and-new"));
    assert.ok(ids.includes("cases.legacy-single-file"));
  } finally {
    cleanup(root);
  }
});

test("cases: cases/README.md → ignored", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "rm" });
    mkCase(dir, 1);
    writeFileSync(join(dir, "cases/README.md"), "# cases\n");
    const errs = validateSkillCases(dir, root);
    assert.equal(errs.length, 0, JSON.stringify(errs));
  } finally {
    cleanup(root);
  }
});

test("cases: .gitkeep / .DS_Store dotfiles → ignored", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "dot" });
    mkCase(dir, 1);
    writeFileSync(join(dir, "cases/.gitkeep"), "");
    writeFileSync(join(dir, "cases/1/input/.DS_Store"), "x");
    const errs = validateSkillCases(dir, root);
    assert.equal(errs.length, 0, JSON.stringify(errs));
  } finally {
    cleanup(root);
  }
});

test("cases: input dir with only .DS_Store → missing-input (dotfiles don't count)", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "dso" });
    mkdirSync(join(dir, "cases/1/input"), { recursive: true });
    mkdirSync(join(dir, "cases/1/output"), { recursive: true });
    writeFileSync(join(dir, "cases/1/input/.DS_Store"), "x");
    writeFileSync(join(dir, "cases/1/output/x.txt"), "a");
    const errs = validateSkillCases(dir, root);
    assert.deepEqual(ruleIds(errs), ["cases.missing-input"]);
  } finally {
    cleanup(root);
  }
});

test("cases: unexpected non-numeric dir → cases.unexpected-entry (ERROR)", () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "weird" });
    mkdirSync(join(dir, "cases/notes"), { recursive: true });
    writeFileSync(join(dir, "cases/notes/x.txt"), "a");
    const errs = validateSkillCases(dir, root);
    const ue = errs.find((e) => e.rule === "cases.unexpected-entry");
    assert.ok(ue);
    assert.equal(ue.severity, "error");
  } finally {
    cleanup(root);
  }
});

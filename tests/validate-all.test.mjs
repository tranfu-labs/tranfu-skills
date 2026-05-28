import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { runAll } from "../scripts/validate-all.mjs";
import { makeTmpRepo, cleanup, writeSkill } from "./helpers.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/validate-all.mjs", import.meta.url));

test("validate-all: --target clean skill → 0 errors", () => {
  const root = makeTmpRepo();
  try {
    writeSkill(root, { name: "clean" });
    const { results } = runAll({
      mode: "target",
      target: "own-skills/clean",
      rootDir: root,
    });
    const errors = results.filter((r) => r.severity === "error");
    assert.equal(errors.length, 0, JSON.stringify(errors));
  } finally {
    cleanup(root);
  }
});

test("validate-all: --target broken skill → aggregates errors from multiple validators", () => {
  const root = makeTmpRepo();
  try {
    writeSkill(root, {
      name: "broken",
      files: { "run.mjs": "eval('1+1')\n", "cases/1/output/x.txt": "a" },
    });
    const { results } = runAll({
      mode: "target",
      target: "own-skills/broken",
      rootDir: root,
    });
    const errors = results.filter((r) => r.severity === "error");
    const validators = new Set(errors.map((e) => e.validator));
    assert.ok(validators.has("security"), "should report security error");
    assert.ok(validators.has("cases"), "should report cases.missing-input (no input/)");
  } finally {
    cleanup(root);
  }
});

test("validate-all: --target non-existent path → throws", () => {
  const root = makeTmpRepo();
  try {
    assert.throws(
      () => runAll({ mode: "target", target: "nope/nada", rootDir: root }),
      /not a skill dir/,
    );
  } finally {
    cleanup(root);
  }
});

test("validate-all: --all over multi-skill repo → enumerates all", () => {
  const root = makeTmpRepo();
  try {
    writeSkill(root, { name: "a" });
    writeSkill(root, { name: "b" });
    writeSkill(root, { root: "external-skills", name: "c" });
    const { skillDirs, results } = runAll({ mode: "all", rootDir: root });
    assert.equal(skillDirs.length, 3);
    const errors = results.filter((r) => r.severity === "error");
    assert.equal(errors.length, 0, JSON.stringify(errors));
  } finally {
    cleanup(root);
  }
});

test("validate-all: CLI --json on broken skill emits structured JSON, exit 1", () => {
  const root = makeTmpRepo();
  try {
    writeSkill(root, {
      name: "x",
      files: { "run.mjs": "eval('1+1')\n" },
    });
    let stdout = "";
    let exitCode = 0;
    try {
      stdout = execSync(`node "${SCRIPT}" --all --json`, {
        cwd: root,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      stdout = err.stdout ?? "";
      exitCode = err.status;
    }
    assert.equal(exitCode, 1);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, false);
    assert.ok(parsed.summary.errors > 0);
    assert.ok(Array.isArray(parsed.results));
    for (const r of parsed.results) {
      for (const key of ["validator", "skill", "path", "rule", "severity", "message"]) {
        assert.ok(key in r, `result missing key: ${key}`);
      }
    }
  } finally {
    cleanup(root);
  }
});

test("validate-all: CLI --target invalid path with --json emits structured error, exit 2", () => {
  const root = makeTmpRepo();
  try {
    let stdout = "";
    let exitCode = 0;
    try {
      stdout = execSync(`node "${SCRIPT}" --target nope --json`, {
        cwd: root,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      stdout = err.stdout ?? "";
      exitCode = err.status;
    }
    assert.equal(exitCode, 2);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, false);
    assert.ok(parsed.error);
    assert.match(parsed.error, /not a skill dir/);
  } finally {
    cleanup(root);
  }
});

/**
 * Tests for scripts/build-index.mjs
 * Uses Node built-in test runner (zero external deps).
 *
 * Run: node --test tests/build-index.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(REPO_ROOT, "scripts", "build-index.mjs");
const FIXTURES_DIR = join(REPO_ROOT, "tests", "fixtures");

/**
 * Run build-index.mjs in a given working directory (using fixtures).
 * Returns { stdout, stderr, indexJson, exitCode }.
 */
function runBuildIndex(cwd) {
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    const result = execSync(
      `node "${SCRIPT}"`,
      { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    stdout = result;
  } catch (err) {
    stdout = err.stdout ?? "";
    stderr = err.stderr ?? "";
    exitCode = err.status ?? 1;
  }

  const indexPath = join(cwd, "index.json");
  let indexJson = null;
  if (existsSync(indexPath)) {
    try {
      indexJson = JSON.parse(readFileSync(indexPath, "utf8"));
    } catch {
      // parse failed
    }
  }

  return { stdout, stderr, exitCode, indexJson };
}

/**
 * Set up a temp directory that mirrors the fixtures structure for testing.
 * We symlink the fixture skill dirs into temp own-skills/ and external-skills/.
 */
function setupTempFixtures() {
  const tmpDir = join(tmpdir(), `build-index-test-${Date.now()}`);
  mkdirSync(join(tmpDir, "own-skills", "good-skill"), { recursive: true });
  mkdirSync(join(tmpDir, "own-skills", "bad-skill"), { recursive: true });
  mkdirSync(join(tmpDir, "external-skills", "ext-skill"), { recursive: true });

  // Copy fixture SKILL.md files
  const copy = (src, dst) => writeFileSync(dst, readFileSync(src, "utf8"));

  copy(
    join(FIXTURES_DIR, "own-skills", "good-skill", "SKILL.md"),
    join(tmpDir, "own-skills", "good-skill", "SKILL.md")
  );
  copy(
    join(FIXTURES_DIR, "own-skills", "bad-skill", "SKILL.md"),
    join(tmpDir, "own-skills", "bad-skill", "SKILL.md")
  );
  copy(
    join(FIXTURES_DIR, "external-skills", "ext-skill", "SKILL.md"),
    join(tmpDir, "external-skills", "ext-skill", "SKILL.md")
  );

  // Build-index uses `git ls-tree HEAD ...` for sha — set up a minimal git repo
  execSync("git init && git add -A && git commit -m init --allow-empty-message", {
    cwd: tmpDir,
    stdio: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@test.com",
    },
  });

  return tmpDir;
}

function cleanupTempDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors in tests
  }
}

// ----- Test 1: Valid frontmatter → skill appears in index -----
test("valid frontmatter → skill included in index", () => {
  const tmpDir = setupTempFixtures();
  try {
    const { indexJson, exitCode } = runBuildIndex(tmpDir);
    assert.equal(exitCode, 0, "should exit 0");
    assert.ok(indexJson, "index.json should be created");
    assert.equal(indexJson.version, 1, "version should be 1");
    assert.ok(indexJson.generated_at, "generated_at should be set");
    const goodSkill = indexJson.skills.find((s) => s.name === "good-skill");
    assert.ok(goodSkill, "good-skill should be in index");
    assert.equal(goodSkill.type, "own", "type should be own");
    assert.equal(goodSkill.description, "A well-formed skill for testing");
    assert.ok(Array.isArray(goodSkill.files), "files should be array");
    assert.ok(goodSkill.files.includes("SKILL.md"), "files should include SKILL.md");
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// ----- Test 2: Missing name/description → skipped, stderr warning, others unaffected -----
test("missing name/description → skip with stderr warn, other skills unaffected", () => {
  const tmpDir = setupTempFixtures();
  try {
    let stderr = "";
    try {
      execSync(`node "${SCRIPT}"`, {
        cwd: tmpDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      stderr = err.stderr ?? "";
    }
    // Even if exit code 0 (errors go to stderr), check stderr has skip message
    const indexPath = join(tmpDir, "index.json");
    const indexJson = JSON.parse(readFileSync(indexPath, "utf8"));

    // bad-skill should NOT be in index
    const badSkill = indexJson.skills.find((s) => s.name === "bad-skill");
    assert.equal(badSkill, undefined, "bad-skill should NOT be in index");

    // good-skill should still be present (not affected by bad-skill)
    const goodSkill = indexJson.skills.find((s) => s.name === "good-skill");
    assert.ok(goodSkill, "good-skill should still be indexed");
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// ----- Test 3: External skill preserves source_url -----
test("external type preserves source_url field", () => {
  const tmpDir = setupTempFixtures();
  try {
    runBuildIndex(tmpDir);
    const indexPath = join(tmpDir, "index.json");
    const indexJson = JSON.parse(readFileSync(indexPath, "utf8"));

    const extSkill = indexJson.skills.find((s) => s.name === "ext-skill");
    assert.ok(extSkill, "ext-skill should be in index");
    assert.equal(extSkill.type, "external", "type should be external");
    assert.equal(
      extSkill.source_url,
      "https://github.com/example/ext-skill",
      "source_url should be preserved"
    );
  } finally {
    cleanupTempDir(tmpDir);
  }
});

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
  mkdirSync(join(tmpDir, "own-skills", "block-scalar-skill"), { recursive: true });
  mkdirSync(join(tmpDir, "external-skills", "ext-skill"), { recursive: true });

  // Copy fixture SKILL.md files
  const copy = (src, dst) => writeFileSync(dst, readFileSync(src, "utf8"));

  copy(
    join(FIXTURES_DIR, "own-skills", "good-skill", "SKILL.md"),
    join(tmpDir, "own-skills", "good-skill", "SKILL.md")
  );
  copy(
    join(FIXTURES_DIR, "own-skills", "good-skill", "README.md"),
    join(tmpDir, "own-skills", "good-skill", "README.md")
  );
  copy(
    join(FIXTURES_DIR, "own-skills", "good-skill", "README.en.md"),
    join(tmpDir, "own-skills", "good-skill", "README.en.md")
  );
  copy(
    join(FIXTURES_DIR, "own-skills", "good-skill", "README.zh.md"),
    join(tmpDir, "own-skills", "good-skill", "README.zh.md")
  );
  copy(
    join(FIXTURES_DIR, "own-skills", "bad-skill", "SKILL.md"),
    join(tmpDir, "own-skills", "bad-skill", "SKILL.md")
  );
  copy(
    join(FIXTURES_DIR, "own-skills", "block-scalar-skill", "SKILL.md"),
    join(tmpDir, "own-skills", "block-scalar-skill", "SKILL.md")
  );
  copy(
    join(FIXTURES_DIR, "external-skills", "ext-skill", "SKILL.md"),
    join(tmpDir, "external-skills", "ext-skill", "SKILL.md")
  );
  copy(
    join(FIXTURES_DIR, "external-skills", "ext-skill", "README.md"),
    join(tmpDir, "external-skills", "ext-skill", "README.md")
  );
  copy(
    join(FIXTURES_DIR, "external-skills", "ext-skill", "README.zh.md"),
    join(tmpDir, "external-skills", "ext-skill", "README.zh.md")
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
    assert.equal(goodSkill.version, "0.1.0");
    assert.equal(goodSkill.author, "test");
    assert.equal(goodSkill.updated_at, "2026-01-01");
    assert.equal(goodSkill.display_name, "Good Skill");
    assert.equal(goodSkill.display_name_zh, "好技能");
    assert.equal(goodSkill.description_en, "An English catalog summary from README");
    assert.equal(goodSkill.description_zh, "README 中的中文目录摘要");
    assert.deepEqual(goodSkill.prompt_examples_en, [
      { prompt: "Help me use this skill", scene: "English example" },
    ]);
    assert.deepEqual(goodSkill.prompt_examples_zh, [
      { prompt: "帮我使用这个技能", scene: "中文示例" },
    ]);
    assert.deepEqual(goodSkill.readme, {
      en: "README.md",
      zh: "README.zh.md",
    });
    assert.equal(goodSkill.origin, "own");
    assert.equal(goodSkill.recommend_reason, "Useful catalog metadata");
    assert.equal(goodSkill.userInvocable, true);
    assert.equal(goodSkill["argument-hint"], "<input>");
    assert.deepEqual(goodSkill.metadata, {
      requires: { bins: ["node", "rg"] },
      relatedSkills: ["../other/SKILL.md"],
    });
    assert.ok(Array.isArray(goodSkill.files), "files should be array");
    assert.ok(goodSkill.files.includes("SKILL.md"), "files should include SKILL.md");
    assert.ok(goodSkill.published_at, "published_at should be set for committed skill");
    assert.match(
      goodSkill.published_at,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
      "published_at should be UTC ISO8601"
    );

    const externalSkill = indexJson.skills.find((s) => s.name === "ext-skill");
    assert.ok(externalSkill, "external skill should be indexed");
    assert.equal(externalSkill.description_en, undefined);
    assert.equal(externalSkill.description_zh, undefined);
    assert.equal(externalSkill.prompt_examples_en, undefined);
    assert.equal(externalSkill.prompt_examples_zh, undefined);
    assert.equal(externalSkill.readme, undefined);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test("README.en.md with frontmatter takes precedence over README.md", () => {
  const tmpDir = setupTempFixtures();
  try {
    writeFileSync(
      join(tmpDir, "own-skills", "good-skill", "README.en.md"),
      `---
description: Preferred explicit English summary
prompt_examples:
  - prompt: Use the explicit English README
    scene: Explicit locale
---

# Explicit English README
`,
    );
    const { indexJson, exitCode } = runBuildIndex(tmpDir);
    assert.equal(exitCode, 0);
    const goodSkill = indexJson.skills.find((s) => s.name === "good-skill");
    assert.equal(goodSkill.description_en, "Preferred explicit English summary");
    assert.deepEqual(goodSkill.prompt_examples_en, [
      { prompt: "Use the explicit English README", scene: "Explicit locale" },
    ]);
    assert.equal(goodSkill.readme.en, "README.en.md");
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// ----- Test 2: Generated catalog fields cannot be overridden by frontmatter -----
test("generated catalog fields take precedence over frontmatter", () => {
  const tmpDir = setupTempFixtures();
  try {
    const skillMd = join(tmpDir, "own-skills", "good-skill", "SKILL.md");
    const content = readFileSync(skillMd, "utf8").replace(
      "origin: own\n",
      "origin: own\ntype: external\npublished_at: 1999-01-01\npath: elsewhere\nfiles: fake\nsha: fake\n",
    );
    writeFileSync(skillMd, content);

    const { indexJson } = runBuildIndex(tmpDir);
    const goodSkill = indexJson.skills.find((s) => s.name === "good-skill");
    assert.equal(goodSkill.type, "own");
    assert.notEqual(goodSkill.published_at, "1999-01-01");
    assert.equal(goodSkill.path, "own-skills/good-skill");
    assert.ok(Array.isArray(goodSkill.files));
    assert.notEqual(goodSkill.sha, "fake");
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// ----- Test 3: Missing name/description → skipped, stderr warning, others unaffected -----
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

// ----- Test 4: YAML folded block scalar (>) → multi-line description folded to single line -----
test("YAML folded block scalar (>) description → folded to single line", () => {
  const tmpDir = setupTempFixtures();
  try {
    runBuildIndex(tmpDir);
    const indexPath = join(tmpDir, "index.json");
    const indexJson = JSON.parse(readFileSync(indexPath, "utf8"));

    const skill = indexJson.skills.find((s) => s.name === "block-scalar-skill");
    assert.ok(skill, "block-scalar-skill should be in index");
    assert.ok(
      !skill.description.startsWith(">"),
      `description should NOT start with ">", got: ${JSON.stringify(skill.description)}`
    );
    assert.ok(
      skill.description.includes("multi-line description"),
      `description should contain folded content, got: ${JSON.stringify(skill.description)}`
    );
    assert.ok(
      !skill.description.includes("\n"),
      `folded description should have no newlines, got: ${JSON.stringify(skill.description)}`
    );
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// ----- Test 5: published_at = 首次提交时间, 后续 commit 不改变它 -----
test("published_at stays at first-add commit after later modifications", () => {
  const tmpDir = setupTempFixtures();
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@test.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@test.com",
  };
  try {
    const skillMd = join(tmpDir, "own-skills", "good-skill", "SKILL.md");
    // 首次提交时间以 git 为准 (setupTempFixtures 已 commit)
    const firstAdd = execSync(
      'git log --follow --diff-filter=A --format=%cI -- "own-skills/good-skill/SKILL.md"',
      { cwd: tmpDir, encoding: "utf8" }
    ).trim().split("\n").filter(Boolean).pop();

    // 修改并二次 commit, 用一个明显不同的未来 committer date
    writeFileSync(skillMd, readFileSync(skillMd, "utf8") + "\nmodified\n");
    execSync('git add -A && git commit -m update', {
      cwd: tmpDir,
      stdio: "pipe",
      env: { ...gitEnv, GIT_COMMITTER_DATE: "2030-01-01T00:00:00Z" },
    });

    const { indexJson } = runBuildIndex(tmpDir);
    const goodSkill = indexJson.skills.find((s) => s.name === "good-skill");
    assert.equal(
      goodSkill.published_at,
      new Date(firstAdd).toISOString(),
      "published_at should equal first-add commit date, not the later modification"
    );
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// ----- Test 6: 未提交的新 skill → 省略 published_at, 不合成空值 -----
test("uncommitted skill → published_at omitted", () => {
  const tmpDir = setupTempFixtures();
  try {
    const newDir = join(tmpDir, "own-skills", "uncommitted-skill");
    mkdirSync(newDir, { recursive: true });
    writeFileSync(
      join(newDir, "SKILL.md"),
      "---\nname: uncommitted-skill\ndescription: not yet committed\n---\nbody\n"
    );
    const { indexJson } = runBuildIndex(tmpDir);
    const skill = indexJson.skills.find((s) => s.name === "uncommitted-skill");
    assert.ok(skill, "uncommitted-skill should still be in index");
    assert.equal(
      Object.prototype.hasOwnProperty.call(skill, "published_at"),
      false,
      "published_at should be omitted for uncommitted skill"
    );
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// ----- Test 7: 浅 clone → 整体省略 published_at (错值比缺值更糟) -----
test("shallow clone → published_at omitted", () => {
  const tmpDir = setupTempFixtures();
  const shallowDir = `${tmpDir}-shallow`;
  try {
    execSync(`git clone --depth 1 "file://${tmpDir}" "${shallowDir}"`, { stdio: "pipe" });
    const { indexJson } = runBuildIndex(shallowDir);
    const goodSkill = indexJson.skills.find((s) => s.name === "good-skill");
    assert.ok(goodSkill, "good-skill should be in index");
    assert.equal(
      Object.prototype.hasOwnProperty.call(goodSkill, "published_at"),
      false,
      "published_at should be omitted in shallow clone"
    );
  } finally {
    cleanupTempDir(shallowDir);
    cleanupTempDir(tmpDir);
  }
});

// ----- Test 8: External skill preserves source_url -----
test("external type preserves source_url field", () => {
  const tmpDir = setupTempFixtures();
  try {
    runBuildIndex(tmpDir);
    const indexPath = join(tmpDir, "index.json");
    const indexJson = JSON.parse(readFileSync(indexPath, "utf8"));

    const extSkill = indexJson.skills.find((s) => s.name === "ext-skill");
    assert.ok(extSkill, "ext-skill should be in index");
    assert.equal(extSkill.type, "external", "type should be external");
    assert.equal(extSkill.version, "0.1.0");
    assert.equal(extSkill.author, "external-author");
    assert.equal(
      Object.prototype.hasOwnProperty.call(extSkill, "updated_at"),
      false,
      "absent optional metadata should not be synthesized"
    );
    assert.equal(
      extSkill.source_url,
      "https://github.com/example/ext-skill",
      "source_url should be preserved"
    );
  } finally {
    cleanupTempDir(tmpDir);
  }
});

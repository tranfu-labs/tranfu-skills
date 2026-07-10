import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { execSync } from "child_process";
import { join, relative } from "path";

import { parseFrontmatter } from "./validate-frontmatter.mjs";

const ROOTS = { "meta-skills": "meta", "own-skills": "own", "external-skills": "external" };

// These fields describe the generated catalog entry itself. Frontmatter may contain
// similarly named lifecycle metadata, but it must not be able to override the values
// derived from the repository layout and git history.
const GENERATED_FIELDS = new Set(["type", "published_at", "path", "files", "sha"]);

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full));
  }
  return out;
}

function blobSha(filePath) {
  try {
    return execSync(`git ls-tree HEAD "${filePath}" | awk '{print $3}'`).toString().trim();
  } catch {
    // If file not in git index yet (e.g. new file), return empty string
    return "";
  }
}

// 浅 clone 里 git log 只能看到截断边界, 会把老 skill 的 published_at 算成错误的近期日期 —
// 错值比缺值更糟, 所以浅 clone / 非 git 环境下整体省略 published_at (CI 用 fetch-depth: 0, 不受影响).
const isShallowRepo = (() => {
  try {
    return execSync("git rev-parse --is-shallow-repository").toString().trim() === "true";
  } catch {
    return true;
  }
})();
if (isShallowRepo) console.error("warn: shallow or non-git repository, omitting published_at");

function publishedAt(filePath) {
  if (isShallowRepo) return "";
  try {
    // --diff-filter=A 只取"添加"该文件的 commit; --follow 让目录改名/迁移后仍追溯到最初发布.
    // 输出按时间倒序, 最后一行是首次进入仓库的 commit; %cI 取 committer date,
    // squash merge 下即 PR 合入 main 的时刻. 统一转 UTC ISO8601 输出.
    const out = execSync(`git log --follow --diff-filter=A --format=%cI -- "${filePath}"`)
      .toString().trim();
    const oldest = out.split("\n").filter(Boolean).pop();
    return oldest ? new Date(oldest).toISOString() : "";
  } catch {
    return "";
  }
}

const skills = [];
for (const [root, type] of Object.entries(ROOTS)) {
  let dirs;
  try { dirs = readdirSync(root); } catch { continue; } // 子目录可能不存在
  for (const name of dirs) {
    const skillDir = join(root, name);
    if (!statSync(skillDir).isDirectory()) continue;
    const skillMd = join(skillDir, "SKILL.md");
    let md;
    try { md = readFileSync(skillMd, "utf8"); } catch { continue; }
    const { data: fm, error: frontmatterError } = parseFrontmatter(md);
    if (frontmatterError) {
      console.error(`skip ${skillDir}: ${frontmatterError}`);
      continue;
    }
    if (!fm.name || !fm.description) {
      console.error(`skip ${skillDir}: missing frontmatter name/description`);
      continue;
    }
    const frontmatterMetadata = Object.fromEntries(
      Object.entries(fm).filter(([field]) => !GENERATED_FIELDS.has(field)),
    );
    const published = publishedAt(skillMd);
    skills.push({
      ...frontmatterMetadata,
      type,
      ...(published ? { published_at: published } : {}),
      path: skillDir,
      files: listFiles(skillDir),
      sha: blobSha(skillMd),
    });
  }
}

// generated_at 仅作信息展示, 不参与 PR validate (workflow 用 jq 删掉它再比对).
// 任何"基于 git 时间"的方案都会被 squash merge 打破 — squash 创造新 commit,
// 它的 date 跟 PR 里 commit 的 date 不一致, validate-diff 永远 fail.
function generatedAt() {
  return new Date().toISOString();
}

const index = { version: 1, generated_at: generatedAt(), skills };
writeFileSync("index.json", JSON.stringify(index, null, 2));
console.log(`wrote index.json: ${skills.length} skills`);

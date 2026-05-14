import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { execSync } from "child_process";
import { join, relative } from "path";

const ROOTS = { "meta-skills": "meta", "own-skills": "own", "external-skills": "external" };

function parseFrontmatter(md) {
  // 支持: key: value (单行) + key: > / >- / | / |- (block scalar 多行)
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  const lines = m[1].split("\n");
  let i = 0;
  while (i < lines.length) {
    const kv = lines[i].match(/^(\w+):\s*(.*)$/);
    if (!kv) { i++; continue; }
    const [, key, rawVal] = kv;
    const blockMarker = rawVal.match(/^([>|])([+-]?)$/);
    if (blockMarker) {
      // block scalar: 收集后续缩进行 (或空行) 到下一个 key
      const folded = blockMarker[1] === ">";
      i++;
      const blockLines = [];
      while (i < lines.length) {
        const ln = lines[i];
        if (ln.match(/^\s+/) || ln.trim() === "") {
          blockLines.push(ln.replace(/^\s+/, ""));
          i++;
        } else break;
      }
      let value = folded
        ? blockLines.filter(ln => ln.trim()).join(" ").trim()  // folded: 全 fold 成单空格分隔
        : blockLines.join("\n").trim();                         // literal: 保留换行
      out[key] = value;
    } else {
      out[key] = rawVal.trim();
      i++;
    }
  }
  return out;
}

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
    const fm = parseFrontmatter(md);
    if (!fm.name || !fm.description) {
      console.error(`skip ${skillDir}: missing frontmatter name/description`);
      continue;
    }
    skills.push({
      name: fm.name,
      type,
      description: fm.description,
      path: skillDir,
      files: listFiles(skillDir),
      sha: blobSha(skillMd),
      ...(type === "external" && fm.source_url ? { source_url: fm.source_url } : {})
    });
  }
}

// generated_at 用 HEAD commit 的 author date 而不是 new Date(),
// 否则同一 commit 跑两次产生不同 index.json, PR CI dry-run 永远 fail.
function generatedAt() {
  try {
    return execSync("git log -1 --format=%aI HEAD", { encoding: "utf8" }).trim();
  } catch {
    return new Date().toISOString(); // 非 git 环境 fallback
  }
}

const index = { version: 1, generated_at: generatedAt(), skills };
writeFileSync("index.json", JSON.stringify(index, null, 2));
console.log(`wrote index.json: ${skills.length} skills`);

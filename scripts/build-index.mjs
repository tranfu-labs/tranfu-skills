import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { execSync } from "child_process";
import { join, relative } from "path";

const ROOTS = { "meta-skills": "meta", "own-skills": "own", "external-skills": "external" };

function parseFrontmatter(md) {
  // 提取 --- ... --- 之间的简单 key: value (单行值)
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
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

const index = { version: 1, generated_at: new Date().toISOString(), skills };
writeFileSync("index.json", JSON.stringify(index, null, 2));
console.log(`wrote index.json: ${skills.length} skills`);

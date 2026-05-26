import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let counter = 0;

export function makeTmpRepo(prefix = "validator-test") {
  counter += 1;
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${process.pid}-${counter}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}

export function writeSkill(rootDir, {
  root = "own-skills",
  name,
  frontmatter = {},
  body = "# x\n",
  readme = null,
  files = {},
}) {
  const skillDir = join(rootDir, root, name);
  mkdirSync(skillDir, { recursive: true });

  const fm = {
    name,
    description: "fixture",
    version: "0.0.1",
    author: "t",
    updated_at: "2026-01-01",
    origin: "own",
    ...frontmatter,
  };
  const yamlLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
  const skillMd = `---\n${yamlLines.join("\n")}\n---\n\n${body}`;
  writeFileSync(join(skillDir, "SKILL.md"), skillMd);

  if (readme != null) writeFileSync(join(skillDir, "README.md"), readme);

  for (const [relPath, content] of Object.entries(files)) {
    const full = join(skillDir, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }

  return skillDir;
}

export function writeRawSkillMd(rootDir, { root = "own-skills", name, content }) {
  const skillDir = join(rootDir, root, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), content);
  return skillDir;
}

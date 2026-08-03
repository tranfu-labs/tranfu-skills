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
  presentation = true,
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

  if (presentation) {
    const defaultReadme = `---\ndescription: Human readable description.\nprompt_examples:\n  - prompt: Please do the thing.\n    scene: Thing\n---\n\n# ${name}\n\nBody.\n`;
    writeFileSync(join(skillDir, "README.md"), readme ?? defaultReadme);
    writeFileSync(join(skillDir, "README.zh.md"), readme ?? defaultReadme);
    mkdirSync(join(skillDir, "assets"), { recursive: true });
    writeFileSync(join(skillDir, "assets/icon.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\"></svg>\n");
    writeFileSync(join(skillDir, "assets/icon.png"), "not-empty\n");
    mkdirSync(join(skillDir, "agents"), { recursive: true });
    writeFileSync(join(skillDir, "agents/openai.yaml"), `interface:\n  icon_small: \"./assets/icon.svg\"\n  icon_large: \"./assets/icon.png\"\n  display_name: \"${name}\"\n`);
  } else if (readme != null) {
    writeFileSync(join(skillDir, "README.md"), readme);
  }

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

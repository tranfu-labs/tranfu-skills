#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  compareCandidateIcon,
  formatSimilarity,
  MAX_ICON_SIMILARITY,
} from "./icon_similarity.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const iconRoot = path.join(skillRoot, "assets", "lucide");
const curatedSpecsFile = path.join(skillRoot, "assets", "curated-specs.json");
const brandRegistryFile = path.join(skillRoot, "assets", "brand-registry.json");

const families = {
  strategy: ["#FFF3E8", "#EA580C"],
  content: ["#F1EAFE", "#6D28D9"],
  engineering: ["#EAF2FF", "#2563EB"],
  operations: ["#EAF8F2", "#15805D"],
};

const keywordRules = [
  { keywords: ["mcp", "model context protocol", "模型上下文协议"], family: "engineering", icon: "server-cog", metaphor: "MCP 服务连接" },
  { keywords: ["growth", "acquisition", "retention", "增长", "获客", "拉新", "留存"], family: "strategy", icon: "chart-no-axes-combined", metaphor: "用户增长曲线" },
  { keywords: ["deploy", "cloud", "coolify", "发布", "部署", "运维"], family: "operations", icon: "cloud-cog", metaphor: "部署运维" },
  { keywords: ["security", "safe", "lock", "安全", "权限", "隐私"], family: "operations", icon: "file-lock-2", metaphor: "安全保护" },
  { keywords: ["download", "url", "fetch", "collect", "采集", "抓取", "下载"], family: "operations", icon: "file-down", metaphor: "内容获取" },
  { keywords: ["undo", "reversible", "rollback", "恢复", "回滚", "可逆"], family: "operations", icon: "undo-2", metaphor: "可恢复操作" },
  { keywords: ["market", "business", "商业", "市场", "赛道"], family: "strategy", icon: "chart-line", metaphor: "市场分析" },
  { keywords: ["opportunity", "target", "机会", "目标"], family: "strategy", icon: "target", metaphor: "目标机会" },
  { keywords: ["score", "evaluation", "evaluate", "评估", "评分"], family: "strategy", icon: "gauge", metaphor: "评估评分" },
  { keywords: ["strategy", "decision", "战略", "策略", "决策"], family: "strategy", icon: "compass", metaphor: "战略决策" },
  { keywords: ["image", "visual", "picture", "cover", "图片", "视觉", "封面", "插图"], family: "content", icon: "images", metaphor: "视觉内容" },
  { keywords: ["write", "draft", "article", "文案", "文章", "写作", "草稿"], family: "content", icon: "file-pen-line", metaphor: "内容写作" },
  { keywords: ["format", "markdown", "排版", "格式"], family: "content", icon: "align-left", metaphor: "内容排版" },
  { keywords: ["design", "ui", "layout", "设计", "界面", "布局"], family: "content", icon: "layout-template", metaphor: "界面设计" },
  { keywords: ["review", "audit", "check", "审查", "评审", "检查"], family: "engineering", icon: "list-checks", metaphor: "工程检查" },
  { keywords: ["code", "github", "repo", "开发", "代码", "仓库"], family: "engineering", icon: "file-code-2", metaphor: "代码工程" },
  { keywords: ["workflow", "pipeline", "agent", "流程", "智能体"], family: "engineering", icon: "workflow", metaphor: "工作流程" },
  { keywords: ["document", "readme", "spec", "文档", "规格"], family: "engineering", icon: "book-open-check", metaphor: "工程文档" },
];

function usage() {
  return `Usage:
  node scripts/generate_icon.mjs <skill-dir-or-SKILL.md> [options]

Options:
  --family <name>    strategy | content | engineering | operations
  --icon <name>      bundled Lucide or brand-* mark name
  --metaphor <text>  semantic description for the selected icon
  --force            overwrite existing icon.svg or icon.png
  --dry-run          print the selection without writing files
  --list-icons       list bundled Lucide and brand mark names
  --help             show this help`;
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const result = {
    target: "",
    family: "",
    icon: "",
    metaphor: "",
    force: false,
    dryRun: false,
    listIcons: false,
    help: false,
  };
  const valueOptions = new Map([
    ["--family", "family"],
    ["--icon", "icon"],
    ["--metaphor", "metaphor"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (valueOptions.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${arg} requires a value`);
      result[valueOptions.get(arg)] = value;
      index += 1;
    } else if (arg === "--force") {
      result.force = true;
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--list-icons") {
      result.listIcons = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg.startsWith("--")) {
      fail(`unknown option ${arg}`);
    } else if (!result.target) {
      result.target = arg;
    } else {
      fail(`unexpected argument ${arg}`);
    }
  }
  return result;
}

function availableIcons() {
  if (!fs.existsSync(iconRoot)) fail(`bundled icons are missing: ${iconRoot}`);
  return fs
    .readdirSync(iconRoot)
    .filter((file) => file.endsWith(".svg"))
    .map((file) => path.basename(file, ".svg"))
    .sort();
}

function loadCuratedSpecs() {
  if (!fs.existsSync(curatedSpecsFile)) {
    fail(`curated icon mappings are missing: ${curatedSpecsFile}`);
  }
  try {
    return JSON.parse(fs.readFileSync(curatedSpecsFile, "utf8"));
  } catch (error) {
    fail(`invalid curated icon mappings: ${error.message}`);
  }
}

function loadBrandRegistry() {
  if (!fs.existsSync(brandRegistryFile)) {
    fail(`brand registry is missing: ${brandRegistryFile}`);
  }
  try {
    return JSON.parse(fs.readFileSync(brandRegistryFile, "utf8"));
  } catch (error) {
    fail(`invalid brand registry: ${error.message}`);
  }
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function frontmatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) fail("target SKILL.md has no valid YAML frontmatter");
  const lines = match[1].split(/\r?\n/);
  const result = {};
  for (let index = 0; index < lines.length; index += 1) {
    const keyMatch = lines[index].match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!keyMatch) continue;
    const [, key, rawValue] = keyMatch;
    if (rawValue === ">" || rawValue === "|" || rawValue === ">-" || rawValue === "|-") {
      const parts = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        parts.push(lines[index + 1].trim());
        index += 1;
      }
      result[key] = parts.join(" ");
    } else {
      result[key] = rawValue.replace(/^['"]|['"]$/g, "").trim();
    }
  }
  return result;
}

function infer({ slug, description, icons, curatedSpecs, brandRegistry }) {
  if (curatedSpecs[slug]) {
    const [family, icon, metaphor] = curatedSpecs[slug];
    if (!families[family]) fail(`curated mapping for ${slug} has unknown family ${family}`);
    if (!icons.includes(icon)) fail(`curated mapping for ${slug} has unknown icon ${icon}`);
    return { family, icon, metaphor, source: "curated" };
  }
  const normalizedSlug = slug.replace(/[-_]/g, " ").toLowerCase();
  const brandMatches = Object.entries(brandRegistry).filter(([, spec]) =>
    spec.aliases.some((alias) => normalizedSlug.includes(alias.toLowerCase())),
  );
  if (brandMatches.length > 1) {
    fail(
      `target Skill name matches multiple brands: ${brandMatches
        .map(([brand]) => brand)
        .join(", ")}; add a curated mapping`,
    );
  }
  if (brandMatches.length === 1) {
    const [brand, spec] = brandMatches[0];
    if (!families[spec.default_family]) {
      fail(`brand registry entry ${brand} has unknown family ${spec.default_family}`);
    }
    if (!icons.includes(spec.default_icon)) {
      fail(`brand registry entry ${brand} has unknown icon ${spec.default_icon}`);
    }
    return {
      family: spec.default_family,
      icon: spec.default_icon,
      metaphor: spec.metaphor,
      source: "brand-registry",
    };
  }
  const searchable = `${slug.replace(/[-_]/g, " ")} ${description}`.toLowerCase();
  const matched = keywordRules.find(
    (rule) =>
      icons.includes(rule.icon) &&
      rule.keywords.some((keyword) => searchable.includes(keyword)),
  );
  if (matched) {
    return {
      family: matched.family,
      icon: matched.icon,
      metaphor: matched.metaphor,
      source: "keyword",
    };
  }
  const hash = stableHash(`${slug}\n${description}`);
  const familyNames = Object.keys(families);
  const reservedIcons = new Set(Object.values(curatedSpecs).map((spec) => spec[1]));
  const fallbackIcons = icons.filter(
    (icon) => !icon.startsWith("brand-") && !reservedIcons.has(icon),
  );
  if (fallbackIcons.length === 0) {
    fail("no unreserved Lucide icon is available for stable fallback");
  }
  return {
    family: familyNames[Math.floor(hash / fallbackIcons.length) % familyNames.length],
    icon: fallbackIcons[hash % fallbackIcons.length],
    metaphor: `稳定回退：${fallbackIcons[hash % fallbackIcons.length]}`,
    source: "stable-hash",
  };
}

function lucideChildren(name) {
  const file = path.join(iconRoot, `${name}.svg`);
  if (!fs.existsSync(file)) fail(`unknown bundled Lucide icon: ${name}`);
  const source = fs.readFileSync(file, "utf8");
  for (const forbidden of ["<script", "<text", "<filter", "<linearGradient", "<image", "<foreignObject"]) {
    if (source.includes(forbidden)) fail(`bundled mark ${name} contains forbidden element ${forbidden}`);
  }
  if (name.startsWith("brand-") && !/viewBox=["']0 0 24 24["']/.test(source)) {
    fail(`brand mark ${name} must use viewBox="0 0 24 24"`);
  }
  const match = source.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!match) fail(`invalid bundled Lucide SVG: ${name}`);
  return match[1].trim();
}

function brandSource(name) {
  if (!name.startsWith("brand-")) return null;
  const source = fs.readFileSync(path.join(iconRoot, `${name}.svg`), "utf8");
  const match = source.match(/<!--\s*brand-source:\s*([\s\S]*?)\s*-->/);
  if (!match) fail(`brand mark ${name} is missing a brand-source comment`);
  return match[1].trim();
}

function brandSpecForIcon(icon, brandRegistry) {
  const match = Object.entries(brandRegistry).find(
    ([, spec]) => spec.default_icon === icon,
  );
  return match ? { name: match[0], ...match[1] } : null;
}

function makeSvg(family, icon, brandRegistry) {
  const isBrandMark = icon.startsWith("brand-");
  const brandSpec = isBrandMark ? brandSpecForIcon(icon, brandRegistry) : null;
  if (isBrandMark && !brandSpec) {
    fail(`brand mark ${icon} is not registered in assets/brand-registry.json`);
  }
  const [background, stroke] = isBrandMark
    ? [brandSpec.background, brandSpec.foreground]
    : families[family];
  const markStyle = isBrandMark
    ? `color="${stroke}" fill="${stroke}" stroke="none"`
    : `fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="${background}"/>
  <g transform="translate(9 9) scale(1.25)" ${markStyle}>
    ${lucideChildren(icon)}
  </g>
</svg>
`;
}

function updateYaml(skillDir) {
  const agentDir = path.join(skillDir, "agents");
  const file = path.join(agentDir, "openai.yaml");
  fs.mkdirSync(agentDir, { recursive: true });
  let source = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "interface:\n";
  const entries = [
    ["icon_small", '"./assets/icon.svg"'],
    ["icon_large", '"./assets/icon.png"'],
  ];
  const missing = [];
  for (const [key, value] of entries) {
    const existing = new RegExp(`^(\\s*)${key}:.*$`, "m");
    if (existing.test(source)) {
      source = source.replace(existing, `$1${key}: ${value}`);
    } else {
      missing.push([key, value]);
    }
  }
  if (missing.length > 0) {
    const lines = missing.map(([key, value]) => `  ${key}: ${value}`).join("\n");
    const marker = source.match(/^interface:[ \t]*$/m);
    if (marker) {
      const at = marker.index + marker[0].length;
      const suffix = source.slice(at);
      source = `${source.slice(0, at)}\n${lines}${suffix.startsWith("\n") ? suffix : `\n${suffix}`}`;
    } else {
      source = `${source.replace(/\s*$/, "")}\ninterface:\n${lines}\n`;
    }
  }
  fs.writeFileSync(file, source.endsWith("\n") ? source : `${source}\n`);
}

function pngIs48(file) {
  const bytes = fs.readFileSync(file);
  return (
    bytes.length >= 24 &&
    bytes.toString("hex", 0, 8) === "89504e470d0a1a0a" &&
    bytes.readUInt32BE(16) === 48 &&
    bytes.readUInt32BE(20) === 48
  );
}

const options = parseArgs(process.argv.slice(2));
const icons = availableIcons();
const curatedSpecs = loadCuratedSpecs();
const brandRegistry = loadBrandRegistry();
if (options.help) {
  console.log(usage());
  process.exit(0);
}
if (options.listIcons) {
  console.log(icons.join("\n"));
  process.exit(0);
}
if (!options.target) fail(`target Skill is required\n\n${usage()}`);

const inputPath = path.resolve(options.target);
const skillFile =
  fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()
    ? path.join(inputPath, "SKILL.md")
    : inputPath;
if (!fs.existsSync(skillFile) || path.basename(skillFile) !== "SKILL.md") {
  fail(`target must be a Skill directory or SKILL.md: ${inputPath}`);
}
const targetDir = path.dirname(skillFile);
const metadata = frontmatter(fs.readFileSync(skillFile, "utf8"));
if (!metadata.name) fail("target SKILL.md frontmatter is missing a non-empty name");
if (!metadata.description) fail("target SKILL.md frontmatter is missing a non-empty description");
const slug = metadata.name;
const inferred = infer({
  slug,
  description: metadata.description || "",
  icons,
  curatedSpecs,
  brandRegistry,
});
const selection = {
  family: options.family || inferred.family,
  icon: options.icon || inferred.icon,
  metaphor: options.metaphor || inferred.metaphor,
  source: options.family || options.icon || options.metaphor ? "manual" : inferred.source,
};
if (!families[selection.family]) {
  fail(`unknown family ${selection.family}; use ${Object.keys(families).join(", ")}`);
}
if (!icons.includes(selection.icon)) {
  fail(`unknown icon ${selection.icon}; run with --list-icons`);
}

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  fail(`sharp is not installed; run: npm install --prefix "${skillRoot}" --no-package-lock`);
}
const similarityComparisons = await compareCandidateIcon({
  slug,
  icon: selection.icon,
  curatedSpecs,
  iconRoot,
  sharp,
});
const closestMatch = similarityComparisons[0] || null;
if (closestMatch && closestMatch.similarity > MAX_ICON_SIMILARITY) {
  fail(
    `icon ${selection.icon} is ${formatSimilarity(closestMatch.similarity)} perceptually similar ` +
      `to ${closestMatch.slug}/${closestMatch.icon}; maximum allowed is ` +
      `${formatSimilarity(MAX_ICON_SIMILARITY)}. Choose a semantically correct bundled mark that passes the gate.`,
  );
}

const assetsDir = path.join(targetDir, "assets");
const svgFile = path.join(assetsDir, "icon.svg");
const pngFile = path.join(assetsDir, "icon.png");
const selectedBrand = selection.icon.startsWith("brand-")
  ? brandSpecForIcon(selection.icon, brandRegistry)
  : null;
const summary = {
  skill: slug,
  family: selection.family,
  mark_type: selection.icon.startsWith("brand-") ? "brand" : "lucide",
  brand_source: brandSource(selection.icon),
  brand_name: selectedBrand?.name || null,
  foreground_color: selectedBrand?.foreground || families[selection.family][1],
  background_color: selectedBrand?.background || families[selection.family][0],
  lucide_icon: selection.icon,
  metaphor: selection.metaphor,
  selection_source: selection.source,
  similarity_method: "normalized-phash",
  similarity_limit: MAX_ICON_SIMILARITY,
  closest_match: closestMatch
    ? {
        skill: closestMatch.slug,
        lucide_icon: closestMatch.icon,
        similarity: Number(closestMatch.similarity.toFixed(4)),
      }
    : null,
  icon_small: svgFile,
  icon_large: pngFile,
};
if (options.dryRun) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}
if (!options.force && (fs.existsSync(svgFile) || fs.existsSync(pngFile))) {
  fail("target already has icon.svg or icon.png; rerun with --force only when replacement is intended");
}

fs.mkdirSync(assetsDir, { recursive: true });
const svgSource = makeSvg(selection.family, selection.icon, brandRegistry);
const tempPng = path.join(assetsDir, `.icon-${process.pid}.png`);
await sharp(Buffer.from(svgSource)).resize(48, 48).png().toFile(tempPng);
if (!pngIs48(tempPng)) {
  fs.rmSync(tempPng, { force: true });
  fail("PNG renderer did not produce a valid 48×48 image");
}
fs.writeFileSync(svgFile, svgSource);
fs.renameSync(tempPng, pngFile);
updateYaml(targetDir);
console.log(JSON.stringify(summary, null, 2));

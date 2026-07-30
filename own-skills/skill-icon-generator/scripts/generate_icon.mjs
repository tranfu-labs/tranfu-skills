#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  compareCandidateToRepository,
  formatSimilarity,
  isSkillRepository,
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

const candidateRules = [
  {
    keywords: ["mcp", "model context protocol", "模型上下文协议"],
    family: "engineering",
    candidates: [
      ["server-cog", "MCP 服务连接"],
      ["network", "服务连接网络"],
      ["workflow", "工具调用流程"],
    ],
  },
  {
    keywords: ["growth", "acquisition", "retention", "增长", "获客", "拉新", "留存"],
    family: "strategy",
    candidates: [
      ["chart-no-axes-combined", "用户增长曲线"],
      ["chart-line", "增长趋势"],
      ["target", "增长目标"],
      ["gauge", "增长指标"],
    ],
  },
  {
    keywords: ["deploy", "cloud", "coolify", "发布", "部署", "运维"],
    family: "operations",
    candidates: [
      ["cloud-cog", "部署运维"],
      ["server-cog", "服务配置"],
      ["package-check", "发布交付"],
    ],
  },
  {
    keywords: ["security", "safe", "lock", "安全", "权限", "隐私"],
    family: "operations",
    candidates: [
      ["file-lock-2", "安全保护"],
      ["shield-check", "安全校验"],
      ["key-round", "权限控制"],
    ],
  },
  {
    keywords: ["download", "url", "fetch", "collect", "采集", "抓取", "下载"],
    family: "operations",
    candidates: [
      ["file-down", "内容获取"],
      ["image-down", "图片获取"],
      ["library-big", "素材采集"],
    ],
  },
  {
    keywords: ["undo", "reversible", "rollback", "恢复", "回滚", "可逆"],
    family: "operations",
    candidates: [
      ["undo-2", "可恢复操作"],
      ["git-compare-arrows", "变更回退"],
    ],
  },
  {
    keywords: ["market", "business", "商业", "市场", "赛道"],
    family: "strategy",
    candidates: [
      ["chart-line", "市场分析"],
      ["telescope", "市场观察"],
      ["radar", "市场扫描"],
      ["compass", "市场方向"],
    ],
  },
  {
    keywords: ["opportunity", "target", "机会", "目标"],
    family: "strategy",
    candidates: [
      ["target", "目标机会"],
      ["radar", "机会扫描"],
      ["telescope", "机会发现"],
    ],
  },
  {
    keywords: ["score", "evaluation", "evaluate", "评估", "评分"],
    family: "strategy",
    candidates: [
      ["gauge", "评估评分"],
      ["clipboard-check", "评估清单"],
      ["list-checks", "评分检查"],
    ],
  },
  {
    keywords: ["strategy", "decision", "战略", "策略", "决策"],
    family: "strategy",
    candidates: [
      ["compass", "战略决策"],
      ["target", "策略目标"],
      ["telescope", "前瞻判断"],
    ],
  },
  {
    keywords: ["image", "visual", "picture", "cover", "图片", "视觉", "封面", "插图"],
    family: "content",
    candidates: [
      ["images", "视觉内容"],
      ["gallery-thumbnails", "封面缩略图"],
      ["panel-top", "文章封面区域"],
      ["gallery-vertical-end", "视觉卡片序列"],
      ["image-down", "图片处理"],
      ["panels-top-left", "图文版式"],
      ["panel-left", "左侧标题与右侧主体的封面版式"],
    ],
  },
  {
    keywords: ["write", "draft", "article", "文案", "文章", "写作", "草稿"],
    family: "content",
    candidates: [
      ["file-pen-line", "内容写作"],
      ["notebook-pen", "写作记录"],
      ["newspaper", "文章内容"],
      ["align-left", "文字编排"],
    ],
  },
  {
    keywords: ["format", "markdown", "排版", "格式"],
    family: "content",
    candidates: [
      ["align-left", "内容排版"],
      ["list", "格式整理"],
      ["layout-template", "版式模板"],
    ],
  },
  {
    keywords: ["design", "ui", "layout", "设计", "界面", "布局"],
    family: "content",
    candidates: [
      ["layout-template", "界面设计"],
      ["palette", "视觉设计"],
      ["pen-tool", "图形设计"],
      ["panels-top-left", "界面布局"],
      ["shapes", "设计元素"],
    ],
  },
  {
    keywords: ["review", "audit", "check", "审查", "评审", "检查", "验收"],
    family: "engineering",
    candidates: [
      ["list-checks", "工程检查"],
      ["clipboard-check", "验收清单"],
      ["file-check-2", "文件校验"],
      ["scan-eye", "视觉检查"],
    ],
  },
  {
    keywords: ["code", "github", "repo", "开发", "代码", "仓库"],
    family: "engineering",
    candidates: [
      ["file-code-2", "代码工程"],
      ["git-branch", "代码分支"],
      ["workflow", "开发流程"],
    ],
  },
  {
    keywords: ["workflow", "pipeline", "agent", "流程", "智能体"],
    family: "engineering",
    candidates: [
      ["workflow", "工作流程"],
      ["waypoints", "流程节点"],
      ["git-fork", "并行分支"],
    ],
  },
  {
    keywords: ["document", "readme", "spec", "文档", "规格"],
    family: "engineering",
    candidates: [
      ["book-open-check", "工程文档"],
      ["book-open-text", "文档内容"],
      ["file-check-2", "文档校验"],
    ],
  },
];

function usage() {
  return `Usage:
  node scripts/generate_icon.mjs <skill-dir-or-SKILL.md> [options]

Options:
  --repository <path>  existing Skill repository used for duplicate comparison
  --family <name>      strategy | content | engineering | operations
  --icon <name>        use one bundled mark instead of automatic candidates
  --metaphor <text>    semantic description for a manually selected mark
  --force              overwrite existing icon.svg or icon.png
  --dry-run            compare and report without writing files
  --list-icons         list bundled mark names
  --help               show this help`;
}

function fail(message, details = null) {
  console.error(`Error: ${message}`);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function parseArgs(argv) {
  const result = {
    target: "",
    repository: "",
    family: "",
    icon: "",
    metaphor: "",
    force: false,
    dryRun: false,
    listIcons: false,
    help: false,
  };
  const valueOptions = new Map([
    ["--repository", "repository"],
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

function loadJson(file, label) {
  if (!fs.existsSync(file)) fail(`${label} is missing: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`invalid ${label}: ${error.message}`);
  }
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

function findRepositoryFrom(start) {
  let current = path.resolve(start);
  if (fs.existsSync(current) && fs.statSync(current).isFile()) {
    current = path.dirname(current);
  }
  while (true) {
    if (isSkillRepository(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return "";
    current = parent;
  }
}

function resolveRepository(explicitPath, targetDir) {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    return isSkillRepository(resolved) ? resolved : "";
  }
  if (process.env.TRANFU_SKILLS_REPOSITORY) {
    const resolved = path.resolve(process.env.TRANFU_SKILLS_REPOSITORY);
    return isSkillRepository(resolved) ? resolved : "";
  }
  const candidates = [targetDir, process.cwd(), skillRoot];
  for (const candidate of candidates) {
    const resolved = findRepositoryFrom(candidate);
    if (resolved) return resolved;
  }
  return "";
}

function brandForSkill(slug, brandRegistry) {
  const normalizedSlug = slug.replace(/[-_]/g, " ").toLowerCase();
  const matches = Object.entries(brandRegistry).filter(([, spec]) =>
    spec.aliases.some((alias) => normalizedSlug.includes(alias.toLowerCase())),
  );
  if (matches.length > 1) {
    fail(
      `target Skill name matches multiple brands: ${matches
        .map(([brand]) => brand)
        .join(", ")}`,
    );
  }
  return matches.length === 1 ? { name: matches[0][0], ...matches[0][1] } : null;
}

function addCandidate(output, seen, candidate, icons) {
  if (!icons.includes(candidate.icon) || candidate.icon.startsWith("brand-")) return;
  if (seen.has(candidate.icon)) return;
  seen.add(candidate.icon);
  output.push(candidate);
}

function automaticCandidates({ slug, description, icons, curatedSpecs }) {
  const output = [];
  const seen = new Set();
  const curated = curatedSpecs[slug];
  if (curated && !curated[1].startsWith("brand-")) {
    addCandidate(
      output,
      seen,
      {
        family: curated[0],
        icon: curated[1],
        metaphor: curated[2],
        source: "curated",
      },
      icons,
    );
  }

  const searchable = `${slug.replace(/[-_]/g, " ")} ${description}`.toLowerCase();
  const matchingRule = candidateRules.find((rule) =>
    rule.keywords.some((keyword) => searchable.includes(keyword)),
  );
  if (matchingRule) {
    for (const [icon, metaphor] of matchingRule.candidates) {
      addCandidate(
        output,
        seen,
        {
          family: matchingRule.family,
          icon,
          metaphor,
          source: "keyword",
        },
        icons,
      );
    }
  }
  if (output.length > 0) return output;
  return output;
}

function lucideSource(name) {
  const file = path.join(iconRoot, `${name}.svg`);
  if (!fs.existsSync(file)) fail(`unknown bundled mark: ${name}`);
  const source = fs.readFileSync(file, "utf8");
  for (const forbidden of [
    "<script",
    "<text",
    "<filter",
    "<linearGradient",
    "<image",
    "<foreignObject",
  ]) {
    if (source.includes(forbidden)) {
      fail(`bundled mark ${name} contains forbidden element ${forbidden}`);
    }
  }
  return source;
}

function lucideChildren(name) {
  const source = lucideSource(name);
  const match = source.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!match) fail(`invalid bundled mark SVG: ${name}`);
  return match[1].trim();
}

function brandSource(name) {
  if (!name.startsWith("brand-")) return null;
  const source = lucideSource(name);
  const match = source.match(/<!--\s*brand-source:\s*([\s\S]*?)\s*-->/);
  if (!match) fail(`brand mark ${name} is missing a brand-source comment`);
  return match[1].trim();
}

function makeSvg(selection, brand) {
  const isBrand = Boolean(brand);
  const [background, foreground] = isBrand
    ? [brand.background, brand.foreground]
    : families[selection.family];
  const markStyle = isBrand
    ? `fill="${foreground}" stroke="none"`
    : `fill="none" stroke="${foreground}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="${background}"/>
  <g transform="translate(9 9) scale(1.25)" ${markStyle}>
    ${lucideChildren(selection.icon)}
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
const assetsDir = path.join(targetDir, "assets");
const svgFile = path.join(assetsDir, "icon.svg");
const pngFile = path.join(assetsDir, "icon.png");
if (!options.dryRun && !options.force && (fs.existsSync(svgFile) || fs.existsSync(pngFile))) {
  fail("target already has icon.svg or icon.png; rerun with --force only when replacement is intended");
}

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  fail(`sharp is not installed; run: npm install --prefix "${skillRoot}" --no-package-lock`);
}

const curatedSpecs = loadJson(curatedSpecsFile, "curated icon mappings");
const brandRegistry = loadJson(brandRegistryFile, "brand registry");
const brand = brandForSkill(slug, brandRegistry);
let selection;
let attempts = [];
let repositoryRoot = null;
let inventoryCount = null;

if (brand) {
  if (options.icon && options.icon !== brand.default_icon) {
    fail(
      `brand-bound Skill ${slug} must use ${brand.default_icon}; generic manual marks are not allowed`,
    );
  }
  if (options.family) {
    fail(`brand-bound Skill ${slug} uses official brand colors; --family is not allowed`);
  }
  if (!icons.includes(brand.default_icon)) {
    fail(`brand registry references missing mark ${brand.default_icon}`);
  }
  selection = {
    family: brand.default_family,
    icon: brand.default_icon,
    metaphor: brand.metaphor,
    source: "brand-registry",
  };
} else {
  repositoryRoot = resolveRepository(options.repository, targetDir);
  if (!repositoryRoot) {
    fail(
      "existing Skill repository was not found; pass --repository <tranfu-skills-path> or set TRANFU_SKILLS_REPOSITORY",
    );
  }
  const inferred = automaticCandidates({
    slug,
    description: metadata.description,
    icons,
    curatedSpecs,
  });
  const candidates = options.icon
    ? [
        {
          family: options.family || inferred[0]?.family || "content",
          icon: options.icon,
          metaphor: options.metaphor || `人工候选：${options.icon}`,
          source: "manual",
        },
      ]
    : inferred.map((candidate) => ({
        ...candidate,
        family: options.family || candidate.family,
        metaphor: options.metaphor || candidate.metaphor,
      }));
  if (candidates.length === 0) {
    fail(
      "no semantically relevant candidate group matched this Skill; choose an appropriate bundled mark with --icon or add a new official Lucide master",
    );
  }

  for (const candidate of candidates) {
    if (!families[candidate.family]) {
      fail(`unknown family ${candidate.family}; use ${Object.keys(families).join(", ")}`);
    }
    if (!icons.includes(candidate.icon)) {
      fail(`unknown icon ${candidate.icon}; run with --list-icons`);
    }
    const comparison = await compareCandidateToRepository({
      candidateSource: lucideSource(candidate.icon),
      repositoryRoot,
      targetSkillName: slug,
      sharp,
    });
    inventoryCount = comparison.inventory_count;
    const closest = comparison.comparisons[0] || null;
    const rejected = Boolean(
      closest && closest.similarity > MAX_ICON_SIMILARITY,
    );
    attempts.push({
      icon: candidate.icon,
      metaphor: candidate.metaphor,
      closest_match: closest
        ? {
            skill: closest.skill,
            relative_path: closest.relative_path,
            similarity: Number(closest.similarity.toFixed(4)),
          }
        : null,
      result: rejected ? "rejected" : "accepted",
    });
    if (!rejected) {
      selection = candidate;
      break;
    }
  }
  if (!selection) {
    fail(
      `all semantically relevant candidates exceeded the ${formatSimilarity(
        MAX_ICON_SIMILARITY,
      )} duplicate limit; add a new official Lucide master and retry`,
      {
        repository: repositoryRoot,
        similarity_limit: MAX_ICON_SIMILARITY,
        attempts,
      },
    );
  }
}

const backgroundColor = brand ? brand.background : families[selection.family][0];
const foregroundColor = brand ? brand.foreground : families[selection.family][1];
const acceptedAttempt = attempts.find((attempt) => attempt.result === "accepted") || null;
const summary = {
  skill: slug,
  repository: repositoryRoot,
  repository_icon_count: inventoryCount,
  family: selection.family,
  mark_type: brand ? "brand" : "lucide",
  brand_name: brand?.name || null,
  brand_source: brand ? brandSource(selection.icon) : null,
  foreground_color: foregroundColor,
  background_color: backgroundColor,
  lucide_icon: selection.icon,
  metaphor: selection.metaphor,
  selection_source: selection.source,
  similarity_method: brand ? "skipped-for-brand" : "normalized-phash-live-repository",
  similarity_limit: brand ? null : MAX_ICON_SIMILARITY,
  closest_match: acceptedAttempt?.closest_match || null,
  attempts,
  icon_small: svgFile,
  icon_large: pngFile,
};
if (options.dryRun) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

fs.mkdirSync(assetsDir, { recursive: true });
const svgSource = makeSvg(selection, brand);
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

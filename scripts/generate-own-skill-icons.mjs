#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { resolveSkillIconSpec } from "./lib/skill-icon-inference.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = process.env.SKILLS_ROOT || path.join(repoRoot, "own-skills");
const sourceRoot =
  process.env.LUCIDE_ICON_SOURCE ||
  path.join(repoRoot, "scripts", "lucide-icons");

const families = {
  strategy: ["#FFF3E8", "#EA580C"],
  content: ["#F1EAFE", "#6D28D9"],
  engineering: ["#EAF2FF", "#2563EB"],
  operations: ["#EAF8F2", "#15805D"],
};

// One professional Lucide master icon and one semantic reading per top-level Skill.
// Avoid multi-symbol composites: distinction comes from the primary silhouette.
const specs = {
  "agent-architecture-decision": ["engineering", "workflow", "Agent 工作流架构"],
  "ai-opportunity-evaluation": ["strategy", "target", "机会目标判断"],
  "ai-startup-feasibility-check": ["strategy", "rocket", "创业方向启航"],
  "article-cover-image": ["content", "panel-top", "文章封面区域"],
  "black-line-icon-style": ["content", "pen-tool", "线性笔尖"],
  "build-marketing-outline": ["strategy", "funnel", "营销漏斗提纲"],
  "business-analysis-pipeline": ["strategy", "chart-no-axes-combined", "商业分析组合图"],
  "collect-sources": ["content", "library-big", "资料来源集合"],
  "compress-image": ["operations", "image-down", "图片体积降低"],
  "content-production": ["content", "panels-top-left", "多平台内容生产"],
  "content-topics": ["content", "lightbulb", "内容选题灵感"],
  "credibility-review": ["content", "shield-check", "可信度核验"],
  "daily-report": ["content", "newspaper", "每日资讯报告"],
  "draft-content": ["content", "file-pen-line", "内容草稿写作"],
  "elite-market-researcher": ["strategy", "telescope", "前瞻市场研究"],
  "format-content": ["content", "align-left", "内容格式整理"],
  "generate-product-logo": ["content", "gem", "产品品牌标记"],
  "github-delivery-check": ["engineering", "package-check", "代码交付检查"],
  "github-repo-completeness": ["engineering", "list-checks", "仓库完备清单"],
  "goal-driven-decomposition": ["strategy", "git-branch", "目标分支拆解"],
  "langgraph-architecture-review": ["engineering", "chart-network", "图架构审查"],
  "lark-safe-write": ["operations", "file-lock-2", "文档安全写入"],
  "market-analysis": ["strategy", "chart-line", "市场趋势分析"],
  "openspec-driven-development": ["engineering", "file-code-2", "规格驱动开发"],
  "opportunity-hunter": ["strategy", "radar", "机会雷达"],
  "post-illustration-images": ["content", "images", "文章配图组"],
  "prd-to-parallel-loop": ["engineering", "git-fork", "PRD 并行分支"],
  "product-title-generation": ["content", "tag-plus", "产品标题生成"],
  "project-init-docs": ["engineering", "folder-cog", "项目文档初始化"],
  "project-scoring": ["strategy", "gauge", "项目评分仪表"],
  "prompt-review": ["engineering", "message-square-check", "提示词审查"],
  "proofread-content": ["content", "file-check-2", "内容审校"],
  "reversible-ops": ["operations", "undo-2", "可恢复操作"],
  "session-to-knowledge": ["content", "book-open-text", "会话知识沉淀"],
  "skill-content-fit": ["engineering", "scan-search", "Skill 内容适配"],
  "skill-create-workflow": ["engineering", "puzzle", "Skill 能力创建"],
  "skill-domain-framing": ["engineering", "focus", "Skill 领域框定"],
  "skill-improve-workflow": ["engineering", "wrench", "Skill 工作流改进"],
  "skill-name-generation": ["engineering", "tags", "Skill 名称生成"],
  "skill-readme-generation": ["engineering", "book-open-check", "Skill README 生成"],
  "skill-reverse-engineer": ["engineering", "search-code", "Skill 反向解析"],
  "social-media-login-collector": ["operations", "key-round", "登录数据采集"],
  "strategy-first-development": ["strategy", "compass", "战略优先开发"],
  "structured-thinking-advisor": ["strategy", "git-compare-arrows", "结构化比较思考"],
  "title-options": ["content", "list", "标题候选列表"],
  "tranfu-coolify-ops": ["operations", "cloud-cog", "云端部署运维"],
  "tranfu-layout-systems": ["content", "layout-template", "页面布局系统"],
  "tranfu-linear-ui-icon-set": ["content", "grid-2x2", "统一线性图标组"],
  "tranfu-website-design": ["content", "monitor-cog", "网站设计系统"],
  "ui-ecosystem": ["content", "boxes", "UI 组件生态"],
  "url-to-markdown": ["operations", "file-down", "网页内容落盘"],
  "visual-builder": ["content", "blocks", "视觉模块搭建"],
  "visual-design-producer": ["content", "palette", "视觉设计生产"],
  "visual-dna-system": ["content", "dna", "视觉基因系统"],
  "visual-pipeline": ["content", "waypoints", "视觉生产路径"],
  "webapp-polish-audit": ["content", "scan-eye", "Web 界面目检"],
  "wechat-sketch-cover": ["content", "gallery-thumbnails", "公众号封面"],
  "write-social-preview-head": ["engineering", "share-2", "社交分享预览"],
  "write-spec": ["engineering", "clipboard-check", "产品规格文档"],
  "xiaohongshu-card-publish": ["content", "gallery-vertical-end", "竖版卡片发布"],
};

function description(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return "";
  const lines = match[1].split(/\r?\n/);
  const result = [];
  let active = false;
  for (const line of lines) {
    if (/^description:\s*/.test(line)) {
      active = true;
      result.push(line.replace(/^description:\s*[>|-]*\s*/, ""));
    } else if (active && /^\s+/.test(line)) {
      result.push(line.trim());
    } else if (active) break;
  }
  return result.join(" ").replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ").trim();
}

function lucideChildren(name) {
  const file = path.join(sourceRoot, `${name}.svg`);
  if (!fs.existsSync(file)) throw new Error(`Missing Lucide icon: ${name}`);
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!match) throw new Error(`Invalid Lucide SVG: ${name}`);
  return match[1].trim();
}

function makeSvg(family, iconName) {
  const [background, stroke] = families[family];
  const children = lucideChildren(iconName);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="${background}"/>
  <g transform="translate(9 9) scale(1.25)" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    ${children}
  </g>
</svg>
`;
}

function updateYaml(skillDir) {
  const agentDir = path.join(skillDir, "agents");
  const file = path.join(agentDir, "openai.yaml");
  fs.mkdirSync(agentDir, { recursive: true });
  let source = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "interface:\n";
  for (const [key, value] of [
    ["icon_small", '"./assets/icon.svg"'],
    ["icon_large", '"./assets/icon.png"'],
  ]) {
    const existing = new RegExp(`^(\\s*)${key}:.*$`, "m");
    if (existing.test(source)) {
      source = source.replace(existing, `$1${key}: ${value}`);
    } else {
      const marker = source.match(/^interface:\s*$/m);
      if (!marker) {
        source = `${source.replace(/\s*$/, "")}\ninterface:\n  ${key}: ${value}\n`;
      } else {
        const at = marker.index + marker[0].length;
        source = `${source.slice(0, at)}\n  ${key}: ${value}${source.slice(at)}`;
      }
    }
  }
  fs.writeFileSync(file, source.endsWith("\n") ? source : `${source}\n`);
}

function pngIs48(file) {
  const bytes = fs.readFileSync(file);
  return (
    bytes.toString("hex", 0, 8) === "89504e470d0a1a0a" &&
    bytes.readUInt32BE(16) === 48 &&
    bytes.readUInt32BE(20) === 48
  );
}

async function writePair(skillDir, svgSource) {
  const assets = path.join(skillDir, "assets");
  const svgFile = path.join(assets, "icon.svg");
  const pngFile = path.join(assets, "icon.png");
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(svgFile, svgSource);
  await sharp(Buffer.from(svgSource)).resize(48, 48).png().toFile(pngFile);
  if (!pngIs48(pngFile)) throw new Error(`Failed to render ${skillDir}`);
  updateYaml(skillDir);
}

const availableIcons = fs
  .readdirSync(sourceRoot)
  .filter((file) => file.endsWith(".svg"))
  .map((file) => path.basename(file, ".svg"))
  .sort();
const slugs = fs
  .readdirSync(skillsRoot)
  .filter((slug) => fs.existsSync(path.join(skillsRoot, slug, "SKILL.md")))
  .sort();
const manifest = [];
for (const slug of slugs) {
  const skillDir = path.join(skillsRoot, slug);
  const skillDescription = description(fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8"));
  const { spec, source } = resolveSkillIconSpec({
    slug,
    description: skillDescription,
    availableIcons,
    curatedSpecs: specs,
  });
  const [family, iconName, metaphor] = spec;
  await writePair(skillDir, makeSvg(family, iconName));
  manifest.push({
    slug,
    family,
    lucide_icon: iconName,
    metaphor,
    description: skillDescription,
    selection_source: source,
    icon_small: `own-skills/${slug}/assets/icon.svg`,
    icon_large: `own-skills/${slug}/assets/icon.png`,
    dimensions: "48x48",
    stroke_width: 2,
  });
}

const embeddedRoot = path.join(skillsRoot, "content-production", "skills");
const embedded = fs.existsSync(embeddedRoot)
  ? fs
      .readdirSync(embeddedRoot)
      .filter((slug) => fs.existsSync(path.join(embeddedRoot, slug, "SKILL.md")))
      .sort()
  : [];
for (const slug of embedded) {
  const skillDir = path.join(embeddedRoot, slug);
  const skillDescription = description(fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8"));
  const { spec } = resolveSkillIconSpec({
    slug,
    description: skillDescription,
    availableIcons,
    curatedSpecs: specs,
  });
  const [family, iconName] = spec;
  await writePair(skillDir, makeSvg(family, iconName));
}

fs.writeFileSync(
  path.join(skillsRoot, "icon-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
const cards = manifest
  .map(
    (item) => `<article data-family="${item.family}">
  <img src="./${item.slug}/assets/icon.svg" alt="">
  <div><strong>${item.slug}</strong><span>${item.metaphor}</span></div>
</article>`,
  )
  .join("\n");
fs.writeFileSync(
  path.join(skillsRoot, "icon-gallery.html"),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TranFu Skill Icons</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f7f8;color:#18181b;font:14px/1.5 system-ui,sans-serif}
main{max-width:1180px;margin:auto;padding:40px 24px}h1{margin:0 0 6px;font-size:28px}p{margin:0 0 28px;color:#71717a}
section{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
article{display:flex;align-items:center;gap:14px;padding:14px;background:#fff;border:1px solid #e4e4e7;border-radius:12px}
img{width:48px;height:48px;flex:none}strong,span{display:block}strong{font-size:13px}span{margin-top:3px;color:#71717a;font-size:12px}
</style></head><body><main><h1>TranFu Skill Icons</h1><p>60 个顶层 Skill · Lucide 几何母体 · 48×48 · 2px 统一描边</p><section>${cards}</section></main></body></html>\n`,
);

const topLevelRows = manifest
  .map(
    (item) =>
      `| \`${item.slug}\` | ${item.metaphor} | [SVG](./${item.slug}/assets/icon.svg) | [PNG](./${item.slug}/assets/icon.png) |`,
  )
  .join("\n");
const embeddedRows = embedded
  .map(
    (slug) =>
      `| \`content-production/skills/${slug}\` | 复用 \`${slug}\` 的语义图标 | [SVG](./content-production/skills/${slug}/assets/icon.svg) | [PNG](./content-production/skills/${slug}/assets/icon.png) |`,
  )
  .join("\n");
fs.writeFileSync(
  path.join(skillsRoot, "skill-icon-map.md"),
  `# Skill 与图标对应表

统一规格：48×48px、最终 2px 描边、圆角线帽与圆角转折。

## 顶层 Skill

| Skill | 图标语义 | SVG | PNG |
|---|---|---|---|
${topLevelRows}

## content-production 内嵌 Skill

| Skill | 图标语义 | SVG | PNG |
|---|---|---|---|
${embeddedRows}
`,
);

console.log(`Generated ${manifest.length} top-level and ${embedded.length} embedded icons.`);

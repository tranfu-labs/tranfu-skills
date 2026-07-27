const keywordRules = [
  { keywords: ["deploy", "cloud", "coolify", "发布", "部署", "运维"], family: "operations", icon: "cloud-cog", metaphor: "自动匹配：部署运维" },
  { keywords: ["security", "safe", "lock", "安全", "权限", "隐私"], family: "operations", icon: "file-lock-2", metaphor: "自动匹配：安全保护" },
  { keywords: ["download", "url", "fetch", "collect", "采集", "抓取", "下载"], family: "operations", icon: "file-down", metaphor: "自动匹配：内容获取" },
  { keywords: ["undo", "reversible", "rollback", "恢复", "回滚", "可逆"], family: "operations", icon: "undo-2", metaphor: "自动匹配：可恢复操作" },
  { keywords: ["market", "business", "商业", "市场", "赛道"], family: "strategy", icon: "chart-line", metaphor: "自动匹配：市场分析" },
  { keywords: ["opportunity", "target", "机会", "目标"], family: "strategy", icon: "target", metaphor: "自动匹配：目标机会" },
  { keywords: ["score", "evaluation", "evaluate", "评估", "评分"], family: "strategy", icon: "gauge", metaphor: "自动匹配：评估评分" },
  { keywords: ["strategy", "decision", "战略", "决策"], family: "strategy", icon: "compass", metaphor: "自动匹配：战略决策" },
  { keywords: ["image", "visual", "picture", "cover", "图片", "视觉", "封面", "插图"], family: "content", icon: "images", metaphor: "自动匹配：视觉内容" },
  { keywords: ["write", "draft", "article", "文案", "文章", "写作", "草稿"], family: "content", icon: "file-pen-line", metaphor: "自动匹配：内容写作" },
  { keywords: ["format", "markdown", "排版", "格式"], family: "content", icon: "align-left", metaphor: "自动匹配：内容排版" },
  { keywords: ["design", "ui", "layout", "设计", "界面", "布局"], family: "content", icon: "layout-template", metaphor: "自动匹配：界面设计" },
  { keywords: ["review", "audit", "check", "审查", "评审", "检查"], family: "engineering", icon: "list-checks", metaphor: "自动匹配：工程检查" },
  { keywords: ["code", "github", "repo", "开发", "代码", "仓库"], family: "engineering", icon: "file-code-2", metaphor: "自动匹配：代码工程" },
  { keywords: ["workflow", "pipeline", "agent", "流程", "智能体"], family: "engineering", icon: "workflow", metaphor: "自动匹配：工作流程" },
  { keywords: ["document", "readme", "spec", "文档", "规格"], family: "engineering", icon: "book-open-check", metaphor: "自动匹配：工程文档" },
];

function stableHash(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function inferSkillIcon({ slug, description = "", availableIcons }) {
  const searchable = `${slug.replace(/[-_]/g, " ")} ${description}`.toLowerCase();
  const matched = keywordRules.find((rule) => rule.keywords.some((keyword) => searchable.includes(keyword)));
  if (matched && availableIcons.includes(matched.icon)) {
    return [matched.family, matched.icon, matched.metaphor];
  }

  const icons = [...availableIcons].sort();
  if (icons.length === 0) throw new Error("No Lucide icon sources available");
  const hash = stableHash(slug);
  const families = ["strategy", "content", "engineering", "operations"];
  const icon = icons[hash % icons.length];
  const family = families[Math.floor(hash / icons.length) % families.length];
  return [family, icon, `自动匹配：${icon}`];
}

export function resolveSkillIconSpec({ slug, description = "", availableIcons, curatedSpecs }) {
  return {
    spec: curatedSpecs[slug] ?? inferSkillIcon({ slug, description, availableIcons }),
    source: curatedSpecs[slug] ? "curated" : "inferred",
  };
}

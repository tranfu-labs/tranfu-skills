---
name: seo-audit
description: Single-page SEO audit skill. Give it a URL, get a structured HTML report covering 20+ checks (robots.txt / sitemap / canonical / hreflang / Schema / E-E-A-T / TDK / H1 / 内链 / 关键词). Script + LLM 混合架构. Trigger when user says "audit this page", "审一下 SEO", "查 SEO", "SEO 体检", "seo audit", "技术 SEO 报告". Do NOT trigger when: 用户要全站爬虫 / 关键词排名追踪 / 反链分析 (这些是 SEO 工具如 Ahrefs/Semrush 的范围, 不是本 skill 范围).
version: 1.0.0
author: JeffLi1993
updated_at: 2026-05-20
origin: external
source_url: https://github.com/JeffLi1993/seo-audit-skill/tree/main/seo-audit
---

# seo-audit (external thin pointer)

这是一个 **external 薄指针** —— 仓库里只存 frontmatter 和推荐者补充内容, 不存 skill body.

首次 `tfs install seo-audit` 时, install 流程会从 `source_url` 拉上游 (`seo-audit/` 子目录, 含 SKILL.md + Python 脚本 + HTML 报告模板). 上游官方推荐 `npx skills add JeffLi1993/seo-audit-skill` 一键装.

- 上游仓库: https://github.com/JeffLi1993/seo-audit-skill
- 本 skill 子路径: `seo-audit/` (basic tier, 同仓另有 `seo-audit-full/` 深度版)
- License: 见上游 LICENSE

更新内容请直接看上游 README / SKILL.md, 别在本仓库改 body.

## 推荐场景

适用:
- 落地页 / 营销页上线前自查 (TDK / H1 / canonical / 内链 / 关键词)
- 公司站季度 SEO 体检, 出 HTML 报告给团队过
- 跟 Cursor / Claude Code 配合, 把报告 finding 喂回让 AI 逐项 fix

不适用: 全站爬虫 / 关键词排名追踪 / 反链分析 (走 Ahrefs / Semrush); 不审 SPA 客户端渲染内容 (需先 SSR).

## 同类 Skill 对比

> 由 tranfu-publish 起草, 推荐者签字.

### 公司库内
- [web-design-guidelines](../web-design-guidelines/SKILL.md) — 审 UI 代码合规 (a11y / focus / forms); **本 skill 区别**: 不审代码本身, 而是审"上线后能不能被搜到", 走搜索引擎可见性维度
- [ui-ux-pro-max](../ui-ux-pro-max/SKILL.md) — 设计参考库 (风格 / 配色 / 字体); **本 skill 区别**: 设计前 vs SEO 后, 三者形成"设计 → 代码 → 搜索"全链路闭环

### 外部世界
- [Lighthouse SEO audit](https://developer.chrome.com/docs/lighthouse/seo) — Chrome 官方 SEO 审计 (5-10 项); **本 skill 区别**: 检查项更深 (20+ 含 hreflang / Schema / E-E-A-T 信任页 / 关键词布局等 Lighthouse 不查的)
- [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/) — 老牌全站爬虫 + GUI; **本 skill 区别**: 单页深度审 + LLM 语义判断, 不是全站爬, 适合精审而非批量

### 本 skill 独特价值
- Script + LLM 混合架构 — Python 跑确定性检查, LLM 跑语义判断
- 输出独立 HTML 报告含 Priority Actions 排序, 可直接转交团队
- 跑 RFC 9309 / JSON-LD / hreflang 等深度解析, 检查覆盖面广

## 使用技巧

> 由 tranfu-publish 引导起草.

### 材料方案
- 装上游推荐 `npx skills add JeffLi1993/seo-audit-skill`, 一次铺好两个 tier (basic + full)
- 准备目标 URL (HTTPS, 可公网访问, 非登录态)
- Python 3 + 网络 (脚本要 fetch 目标页 + robots.txt + sitemap)

### 推荐用法
- 第一次跑: 直接说 "audit this page: https://example.com"
- 报告产物: `reports/<hostname>-audit.html`, 自己读完留要的, 丢不要的
- 二阶段: 把 Priority Actions 段贴回 Claude/Cursor, 让 AI 逐项 fix

### 已知限制
- 只审单页, 不是全站爬虫
- SPA 客户端渲染页可能漏内容 (脚本拉原始 HTML)
- 部分检查依赖外部 API (full tier 用 CrUX/GSC, basic tier 不依赖)

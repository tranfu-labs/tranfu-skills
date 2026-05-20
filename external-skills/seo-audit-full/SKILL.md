---
name: seo-audit-full
description: Deep single-page SEO audit. Basic 20+ checks + Core Web Vitals (CrUX field data) + GSC crawl status + Content E-E-A-T depth + Robots Meta + OG/Social + 竞品 gap. Trigger when user says "deep SEO audit", "完整 SEO 体检", "深度 SEO", "审一下 Core Web Vitals", "GSC 数据 + SEO 综合分析", "seo audit full". Do NOT trigger when: 用户只要快速自查 (走 seo-audit basic) / 全站爬虫 (走 Screaming Frog 类工具) / 关键词追踪 (走 Ahrefs).
version: 1.0.0
author: JeffLi1993
updated_at: 2026-05-20
origin: external
source_url: https://github.com/JeffLi1993/seo-audit-skill/tree/main/seo-audit-full
---

# seo-audit-full (external thin pointer)

这是一个 **external 薄指针** —— 仓库里只存 frontmatter 和推荐者补充内容, 不存 skill body.

首次 `tfs install seo-audit-full` 时, install 流程会从 `source_url` 拉上游 (`seo-audit-full/` 子目录). 同仓还有 basic tier `seo-audit/`, 两个独立 skill, 按需选.

- 上游仓库: https://github.com/JeffLi1993/seo-audit-skill
- 本 skill 子路径: `seo-audit-full/` (deep tier, basic 版见同仓 `seo-audit/`)
- License: 见上游 LICENSE

更新内容请直接看上游 README / SKILL.md, 别在本仓库改 body.

## 推荐场景

适用:
- 季度 SEO 深度体检, 出报告给团队 / 老板过
- 重要落地页 / 营销页上线终审 (不只查代码, 还要看 GSC index 状态 + 真实场 Core Web Vitals)
- 高价值页面 (流量 / 转化大头) 跑 E-E-A-T + 竞品 gap 找优化空间

不适用: 日常快速自查 (走 seo-audit basic, PR #59); 没流量的新页 (CrUX 无 field data 取不到); 全站爬虫 (走 Screaming Frog).

## 同类 Skill 对比

> 由 tranfu-publish 起草, 推荐者签字.

### 公司库内
- [seo-audit](../seo-audit/SKILL.md) (basic) — 同作者同仓的轻量 tier, 20+ 检查; **本 skill 区别**: 在 basic 基础上加 CrUX field data + GSC crawl + 内容质量 + OG/Social + Robots Meta 等 6+ 深度项, 慢但完整
- [web-design-guidelines](../web-design-guidelines/SKILL.md) — 审 UI 代码合规 (a11y/focus/forms); **本 skill 区别**: 不审代码, 而是审"上线后被搜到 + 性能 + 内容质量"全链路

### 外部世界
- [Lighthouse Performance + SEO](https://developer.chrome.com/docs/lighthouse) — Chrome 官方综合审计 (实验室数据); **本 skill 区别**: 用 CrUX **真实场** field data (用户实际看到的性能), 而 Lighthouse 是 lab 仿真数据
- [Ahrefs Site Audit](https://ahrefs.com/site-audit) — 商业全站 SEO 平台; **本 skill 区别**: 不是商业订阅, agent skill 形式直接在 Claude/Cursor 里跑; 单页深度而非全站

### 本 skill 独特价值
- CrUX field data + GSC 真实场数据, 不是 lab 数据
- 内容质量 E-E-A-T 深度评估走 LLM, 跑出可读评分
- 竞品 gap 分析帮重要页定位优化空间

## 使用技巧

> 由 tranfu-publish 引导起草.

### 材料方案
- 装上游 `npx skills add JeffLi1993/seo-audit-skill`, 一次铺 basic + full 两 tier
- GSC 数据准备: Google Search Console 加目标域 + OAuth 授权
- 目标页选有流量的 (CrUX field data 需要足够 sample 才有)

### 推荐用法
- 第一次跑: "deep SEO audit https://example.com/landing"
- 季度体检节奏 (basic 月度, full 季度), 别日常用
- 把 Priority Actions 段贴回 Claude/Cursor, 让 AI 逐项 fix

### 已知限制
- GSC 需域所有权 + OAuth, 配置门槛比 basic 高
- CrUX field data 只对有流量的页面有数据 (长尾页拿不到)
- 跑得慢 (多个外部 API 调用 + LLM 深度评估)

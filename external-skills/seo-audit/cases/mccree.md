---
recommender: mccree
recommended_at: 2026-05-20
reason_kind: read-and-curious
scenario_tag: SEO 体检
source_session_summary: 用户用 npx skills add 命令推荐 JeffLi1993/seo-audit-skill, 这是单仓两 tier 的 SEO skill (basic + full). 我按 read-and-curious 起草 basic tier, 强调它跟公司库刚发的 ui-ux-pro-max / web-design-guidelines 形成"设计 → 代码 → 搜索"全链路闭环, 以及 Script + LLM 混合架构这两个客观信号.
---

## 怎么发现的

公司库最近发的 `ui-ux-pro-max` (设计参考) + `web-design-guidelines` (代码合规) 解决了前端 design → code 链路, 但还缺 "上线后能不能被搜到" 这一环 — own-skills 里没 SEO 类, external 里也没.

JeffLi1993/seo-audit-skill 是 2026-05 仍在维护的开源 skill, 关键观察:
- 架构是 **Script + LLM 两层混合** (Python 跑 deterministic 检查, LLM 跑语义判断), 不是纯 prompt
- 一个仓里装了 basic (`seo-audit`) + full (`seo-audit-full`) 两个独立 skill, 按需用
- 上游官方推荐 `npx skills add` 一键装, 走 Anthropic Agent Skills 标准

## 它做了什么

典型流程 (上游 README 描述):

```
用户: "audit this page: https://openclaw.ai"
↓
skill: 跑 Python (check-site / check-page / check-schema / fetch-page)
       + LLM 语义判断
↓
输出: reports/openclaw-ai-audit.html
含 Audit Summary / Site Checks / Page Checks / Priority Actions / Insight Walkthrough
```

basic tier 覆盖 20+ 检查项:
- **站点级**: robots.txt (RFC 9309) / sitemap.xml / 404 处理 / URL 归一化 / hreflang / JSON-LD Schema / E-E-A-T 信任页
- **页面级**: URL slug / Title / Meta Desc / H1 / Canonical / Alt / Word Count / 关键词位置 / Heading 结构 / 内链

## 我特别想强调的点

**两个信号值得团队评估**:

1. **Script + LLM 混合架构** — 不是纯 prompt 类 SEO skill (那种产出依赖模型当前能力, 不稳定). Python 脚本跑 deterministic 检查 (robots.txt / XML / JSON-LD 解析) 保证数据可靠, LLM 只做语义判断 (关键词意图 / 内容质量). 同类里这种架构不多.

2. **跟公司库现有 skill 闭环** — `ui-ux-pro-max` → `web-design-guidelines` → `seo-audit`, 三个一前一后形成"设计 → 代码 → 搜索"全链路审计, 落地页 / 营销页用得上.

## 我没用上但可能也很好用的延伸

- 同仓 `seo-audit-full` 深度版含 Core Web Vitals (CrUX field data) / GSC 数据 / 竞品 gap 分析, 走单独 PR 推
- HTML 报告产物可以塞进 PR diff 给 reviewer 审 (尤其营销页 PR)
- 跟 `web-design-guidelines` 串用: 一个审 a11y / focus, 一个审 SEO, 互不重叠

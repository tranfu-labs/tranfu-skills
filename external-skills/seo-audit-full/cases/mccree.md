---
recommender: mccree
recommended_at: 2026-05-20
reason_kind: read-and-curious
scenario_tag: SEO 深度体检
source_session_summary: 用户用 npx skills add 命令推荐 JeffLi1993/seo-audit-skill (同仓双 tier). 我按 read-and-curious 起草 full tier, 强调它跟 PR #59 的 basic 是 tier 关系不冲突, 以及 CrUX + GSC 真实场数据 + 内容质量 LLM 评估这三个 basic tier 给不出来的信号.
---

## 怎么发现的

PR #59 已经把 basic tier `seo-audit` 推到公司库, 适合日常快速自查. 但日常自查解决不了两个问题:
- **真实场性能** — Lighthouse 给的是 lab 仿真数据, 用户在弱网 / 老设备上看到的可能完全不同
- **Google 实际怎么 index 你** — robots.txt + sitemap 配对了不代表 Google 真索引了, 要看 GSC

`seo-audit-full` 在 basic 基础上加了 6+ 深度项, 关键是 **CrUX field data** (Chrome 用户真实场性能) + **GSC crawl status** (Google 实际索引情况) + **内容质量 E-E-A-T 深度评估** (LLM 跑评分).

## 它做了什么

跟 basic 流程一致, 但触发不同 tier:

```
用户: "deep SEO audit https://openclaw.ai/pricing"
↓
skill (seo-audit-full): 跑 basic 20+ 项 + 深度项 (CrUX/GSC/内容质量/竞品 gap)
↓
输出: reports/openclaw-ai-audit.html
```

full tier 在 basic 之上额外覆盖:
- **Core Web Vitals**: LCP, CLS, INP from CrUX field data
- **GSC Crawl Status**: index coverage, crawl errors, blocked resources
- **OG / Social Tags**: og:image, twitter:card, 社交预览完整性
- **Content Quality**: E-E-A-T 深度 / 可读性 / 与竞品对比
- **Robots Meta**: noindex / nofollow / max-snippet
- **竞品 gap**: 跟同关键词 top 排名页对比, 找差距

## 我特别想强调的点

**两个信号让 full tier 跟 basic 拉开差距**:

1. **真实场 vs lab 数据** — CrUX field data 是真实用户在 Chrome 上跑出来的性能数据, 不是 Lighthouse / WebPageTest 这种 lab 仿真. 这俩差距很大 (尤其 INP, lab 几乎测不出).
2. **GSC 整合** — Google 怎么 index 你才是 SEO 的终局信号. robots.txt + sitemap + canonical 都对, 不代表 Google 真索引 / 不代表 ranking. full tier 把 GSC crawl status 拉进报告, 闭环.

**节奏建议**: basic 月度自查, full 季度深度. 不要日常用 full — 跑得慢 + GSC API 限速 + 对长尾页 CrUX 没数据.

## 我没用上但可能也很好用的延伸

- 跟 `web-design-guidelines` (a11y 审计) 串用, 大改前先 full SEO 审 + a11y 审, 一次性出综合报告
- 重要落地页上线时跑一次 full, 留存报告做对照基线, 下季度跑同页对比改动
- 报告产物的 Priority Actions 段可以直接喂回 Claude/Cursor, 让 AI 按优先级修

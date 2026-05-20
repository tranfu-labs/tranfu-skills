---
recommender: mccree
recommended_at: 2026-05-20
reason_kind: read-and-curious
scenario_tag: 设计系统选型
source_session_summary: 用户让我把外部 skill ui-ux-pro-max 推荐到公司库, 未明确说亲测, 我按 read-and-curious 起草, 强调数据集量级 + 18 平台覆盖 + 仍在维护这几个观察到的客观信号.
---

## 怎么发现的

公司库目前还没有"UI/UX 设计系统数据库"类型的 skill — 已有的 `daily-report` 是海报渲染, `goal-driven-decomposition` 是设计流程编排, 都不解决"该选什么色板 / 字体 / 图表类型"这种**输入侧**问题.

UI/UX Pro Max (https://uupm.cc) 是当前 Claude Skills 生态里少数把设计参考做成**可检索数据集**的 skill — 不是给原则, 而是给 67 种 UI 风格 / 161 色板 / 57 字体配对 / 99 条 UX 守则 / 25 种图表类型, 用 BM25 + regex 混合检索一次出基线.

## 它做了什么

典型流程 (上游 CLAUDE.md 描述):

```bash
# 一次性出完整设计系统
python3 src/ui-ux-pro-max/scripts/search.py "saas dashboard" --design-system

# 局部检索
python3 src/ui-ux-pro-max/scripts/search.py "minimal" --domain style
python3 src/ui-ux-pro-max/scripts/search.py "dark fintech" --domain color
```

输出含: pattern / style / colors / typography / effects / anti-patterns. 支持指定栈: `--stack react|nextjs|vue|svelte|swiftui|flutter|...` (15+ 栈).

## 我特别想强调的点

公司库的设计系统类目前是空白, 而这个 skill 在外部对标里数据集量级 + 平台覆盖 (18 种) 都是最大的, 值得推给团队评估 — 即使最后不全员装, 至少有人深度用过, 可以反过来沉淀公司自己的 set design 数据集.

## 我没用上但可能也很好用的延伸

- 上游同时支持 Cursor / Windsurf / Copilot / Codex 等 18 种平台, 团队多工具混用时可统一行为
- 99 条 UX 守则可单独抽出来当 design review checklist, 不一定要在 AI 工作流里跑
- 跟 Anthropic 官方 frontend-design (反 AI slop 原则) 叠用, 一个给输入, 一个给审美校准

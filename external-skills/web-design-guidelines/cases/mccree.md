---
recommender: mccree
recommended_at: 2026-05-20
reason_kind: read-and-curious
scenario_tag: 前端代码审计
source_session_summary: 用户让我把 vercel-labs/agent-skills 下的 web-design-guidelines 推到公司库. 我按 read-and-curious 起草, 强调跟刚发的 ui-ux-pro-max 形成"设计输入 + 代码审计"闭环, 以及 Vercel 官方背书 + 实时拉规则不会过期这两个客观信号.
---

## 怎么发现的

公司库刚发的 `ui-ux-pro-max` 解决了"该选什么"的设计输入侧问题, 但还缺一个"写出来的代码对不对"的输出侧审计 — 现有 own-skills 里 `prompt-review` 审 prompt, `credibility-review` 审稿件, **没有审 UI 代码的**.

Vercel 官方 `web-design-guidelines` 正好补这一缺. 关键观察: skill 本身只有 1.2KB, 不内嵌规则, 每次跑时实时 fetch `vercel-labs/web-interface-guidelines/main/command.md` 拿最新 100+ 规则 — 这意味着规则升级不依赖 skill 升级, 维护成本几乎为零.

## 它做了什么

典型流程 (上游 SKILL.md 描述):

```
用户: "review my UI src/components/**/*.tsx"
↓
skill: WebFetch https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
↓
读指定文件 → 对照 100+ 规则 → 输出 `file:line` 格式 findings
```

覆盖维度 (摘自上游 repo README):
- **Accessibility**: aria-labels, semantic HTML, keyboard handlers
- **Focus States**: visible focus, focus-visible patterns
- **Forms**: autocomplete, validation, error handling
- + 还有 performance / UX 等共 100+ 条

## 我特别想强调的点

**跟 ui-ux-pro-max 闭环**: 一个在前给"设计选项", 一个在后审"代码合规", 配合用可以覆盖前端从设计到代码的完整链路. 单独装也能用, 但两个一起装价值更大.

另外 Vercel 官方背书 + 实时拉规则的设计模式, 是这个 skill 跟其它 a11y / design audit skill 拉开差距的地方 — 规则永远不会过期.

## 我没用上但可能也很好用的延伸

- 同仓还有 `vercel-optimize` (Vercel 项目成本 / 性能审计) 和 `react-best-practices` (40+ React/Next.js 规则), 用 Vercel 部署的项目可以一起推
- `argument-hint: <file-or-pattern>` 暗示可在 CI 里用, 锁定 PR diff 文件跑增量审计
- 输出 `file:line` 格式可直接喂给 lint / GitHub annotations

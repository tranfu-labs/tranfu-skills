---
recommender: BruceL017
recommended_at: 2026-05-13
reason_kind: discovered-elsewhere
scenario_tag: prompt工程参考
source_session_summary: 用户看到 Andrej Karpathy 的 LLM 编码准则仓库，觉得值得推荐给公司库。用户已在个人 CLAUDE.md 中实践类似原则（Minimum Code / Touch Only What Must Be Touched / Goal-Driven Execution），与 Karpathy 的观察高度同频。
---

## 怎么发现的

从 Andrej Karpathy 的公开分享中了解到他对 LLM 编码陷阱的系统性观察。Karpathy 作为 AI 领域标杆人物，其对 LLM 编码行为的观察有很高权威性。仓库本身结构简洁 — 一个 CLAUDE.md 文件，四条行为准则，零依赖。

## 它做了什么

将 Karpathy 总结的四大原则融入 Claude Code 的默认行为：
1. **Think Before Coding** — 不假设、不隐藏困惑、主动呈现 tradeoff
2. **Simplicity First** — 最小代码解决问题，不预造抽象
3. **Surgical Changes** — 只动必须动的地方，匹配现有风格
4. **Goal-Driven Execution** — 定义验收标准，loop 到验证通过

用户自己的 CLAUDE.md 中早已实践类似原则（Minimum Code、Touch Only What Must Be Touched、Goal-Driven Execution），与 Karpathy 的观察高度同频，说明这些原则在真实工作流中确实有效。

## 我特别想强调的点

不是"又一个 prompt 技巧合集"，而是经过 Karpathy 验证的底层行为准则。安装即生效，不需要学新命令。

## 我没用上但可能也很好用的延伸

- 上游仓库同时支持 Cursor（.cursor/rules/karpathy-guidelines.mdc），团队如果有混用 Claude + Cursor 的场景可以统一行为标准
- 可作为新员工 onboarding 的"AI 编码行为底线"文档

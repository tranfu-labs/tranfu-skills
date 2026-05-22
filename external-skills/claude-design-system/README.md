# claude-design-system

> Anthropic 内部 Claude 设计工具的 system prompt 镜像. 不是执行型 skill, 是**参考材料** —— 看 Anthropic 怎么调教 Claude 做 HTML 原型 / React / 幻灯片 / 动画 / 设计系统适配.

- 上游: https://github.com/elder-plinius/CL4R1T4S/blob/main/ANTHROPIC/Claude-Design-Sys-Prompt.txt
- 原作者: Anthropic (内部 prompt, 镜像抓取)
- 镜像维护者: elder-plinius
- 类型: external 薄指针 + 参考文档

## 推荐场景

适用:
- 自己写 Claude / Cursor / Codex 的设计型 agent, 想抄一份"Anthropic 自家是怎么写的"基线
- 用 Claude.ai design 工具时遇到怪现象 (React styles 冲突 / slide 编号错位 / scrollIntoView 报错), 来这里反查规则
- 给团队做"AI 设计协作"内部分享, 当作真实 case study 看 prompt 长什么样

不适用:
- 想直接出设计 → 走 [ui-ux-pro-max](../ui-ux-pro-max/SKILL.md) (检索风格 / 配色 / 字体)
- 想审 UI 代码合规 → 走 [web-design-guidelines](../web-design-guidelines/SKILL.md)
- 想画架构 / 流程图 → 走 [fireworks-tech-graph](../fireworks-tech-graph/SKILL.md)
- 只是用 Claude.ai design 功能, 不需要装它 (它本身就跑在 Claude.ai 里)

## 同类 Skill 对比

> 由 tranfu-publish 起草, 推荐者签字.

### 公司库内
- [ui-ux-pro-max](../ui-ux-pro-max/SKILL.md) — 可检索的设计数据集 (67/161/57/99/25); **本 skill 区别**: 不是数据集, 是 Anthropic 内部 prompt 全文, 给 prompt-engineer 看, 不给设计师查
- [web-design-guidelines](../web-design-guidelines/SKILL.md) — 实时拉 Vercel 100+ UI 合规规则审代码; **本 skill 区别**: 不审代码, 是只读参考材料, 互补使用 (装 web-design-guidelines 审 + 装本 skill 学怎么调 agent)

### 外部世界
- [Anthropic frontend-design](https://claude.com/blog/improving-frontend-design-through-skills) — Anthropic 官方公开的"反 AI slop"原则性 skill; **本 skill 区别**: 那是公开版给社区, 本 skill 是 Claude.ai 内部 *实际生产* 的 system prompt, 颗粒度更细 (含 React+Babel pinned 版本 / oklch 色规则 / speaker notes JSON 结构)
- [CL4R1T4S 项目其他厂商 prompt](https://github.com/elder-plinius/CL4R1T4S) — 同源, 也有 OpenAI / xAI / Perplexity 的镜像; **本 skill 区别**: 只针对 Anthropic 设计工具一份, 不发散

### 本 skill 独特价值
- 唯一公开可查的 Anthropic 设计 agent prompt 全文 (422 行)
- 含可直接抄的工程细节: React 18.3.1 pinned + integrity, styles 命名硬约束, 1-indexed slide label
- 反查表: Claude.ai 输出怪现象 → prompt 里能找到对应规则

## 使用技巧

> 由 tranfu-publish 引导起草.

### 材料方案
- 当参考读, 别当 skill 执行 —— 它没设计触发关键词, 装了不会自动跑
- 跟 ui-ux-pro-max 叠用: 那个给"该选什么", 本 prompt 给"该怎么交付"
- 给自己写 agent 时按需摘抄, 不要整段照搬 (含 Anthropic 内部工具引用如 `done` / `fork_verifier_agent`, 在你环境里跑不了)

### 推荐用法
- 第一次读: 看 §workflow 5 步 + §HTML/React 编码规范 (含 styles 命名硬约束)
- 反查场景: Claude.ai 输出某个怪行为 (e.g. 拒绝说工具名 / slide 编号 off-by-one), 直接 grep prompt 关键词
- 给团队分享: 配 Anthropic 官方 frontend-design blog 一起读, 对照"公开版 vs 内部版"

### 已知限制
- 是 leaked / 社区抓取版, 不是 Anthropic 官方发布, 后续可能下架或失效
- 含 `done` / `fork_verifier_agent` / `copy_starter_component` 等 Anthropic 内部工具名, 你环境里没这些
- License 不明确, 商业使用 / 重新分发请自行评估法律风险

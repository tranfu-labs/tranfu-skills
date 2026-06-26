# make-interfaces-feel-better

> 把界面 polish 拆成可执行的设计工程细节: typography、radius、shadow、motion、hit area、image outline、tabular numbers 和 micro-interactions.

- 上游: https://github.com/jakubkrehel/make-interfaces-feel-better/tree/main/skills/make-interfaces-feel-better
- 原文: https://jakub.kr/writing/details-that-make-interfaces-feel-better
- 作者: Jakub Krehel
- 类型: external 薄指针 + UI polish 规则

## 推荐场景

适用:
- 组件功能已经完成, 但界面看起来还差一口气
- 做 UI review 时想要 Before / After 表格, 逐条说明 polish 改动
- 处理文字换行、嵌套圆角、阴影、图标动效、tabular numbers、点击缩放、命中区等细节

不适用:
- 需要完整设计系统 / 配色 / 字体选型 -> 走 [ui-ux-pro-max](../ui-ux-pro-max/SKILL.md)
- 需要 a11y / focus / forms / performance 合规审计 -> 走 [web-design-guidelines](../web-design-guidelines/SKILL.md)
- 需要 TranFu 官网品牌和组件规范 -> 走 [tranfu-website-design](../../own-skills/tranfu-website-design/SKILL.md)

## 同类 Skill 对比

> 由 tranfu-publish 起草, 推荐者签字. 帮助阅读者横向决定要装哪个 / 跳到更合适的同类.

### 公司库内
- [web-design-guidelines](../web-design-guidelines/SKILL.md) — 审 UI 代码的 a11y / focus / forms / performance / UX 规则; **本 skill 区别**: 不做合规清单, 专注界面手感细节
- [ui-ux-pro-max](../ui-ux-pro-max/SKILL.md) — 提供 UI 风格、配色、字体、图表和 UX 选型资料; **本 skill 区别**: 已有方向后的微观 polish, 不负责选型
- [tranfu-website-design](../../own-skills/tranfu-website-design/SKILL.md) — 约束 TranFu 官网品牌、布局、组件和视觉 QA; **本 skill 区别**: 通用界面手感规则, 不绑定 TranFu 品牌

### 外部世界
- [Anthropic frontend-design](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) — 建立 distinctive aesthetic direction 并实现前端界面; **本 skill 区别**: 不定大风格, 给 radius / motion / typography / hit-area 细节
- [shadcn/ui Skills](https://ui.shadcn.com/docs/skills) — 让 AI 理解 shadcn/ui 组件、patterns 和安装 API; **本 skill 区别**: 不绑组件库, 关注通用 polish 细节
- [Impeccable](https://impeccable.style/) — 前端设计 skill、命令和反模式集合; **本 skill 区别**: 轻量单 skill, 适合快速 review 和小改

### 本 skill 独特价值
- 把微交互细节变成检查表
- 覆盖文字、动效、边界和命中区
- 输出 Before/After 表格便于 review

## 使用技巧

> 由 tranfu-publish 引导起草 (作者 / 推荐者答, AI 整合, 推荐者签字).
> 帮助阅读者纵向上手 — tacit knowledge 在此. 横向同类对比见上方 §同类 Skill 对比.

### 材料方案
- 先读上游四个主题文件
- 已有设计系统时只做 polish 层
- 和 a11y 审查分开跑

### 推荐用法
- Prompt: 审这个组件哪里 feels off
- 改动用 Before / After 表格交付
- 动效项目优先查 animations.md

### 已知限制
- 不提供完整设计系统选型
- 不替代可访问性专项审计
- 依赖上游链接可访问

---
description: "对浏览器渲染的 Web UI 做只读、证据驱动的打磨审计，并通过隔离判断和最终校验保证报告可信。"
prompt_examples:
  - prompt: 审下 https://practice.example.com，抓一下哪里像 demo、不像正式产品。
    scene: 检查单个页面
  - prompt: 从 https://app.example.com 开始抽取代表性子页面，再逐页做打磨审查。
    scene: 检查多个页面
  - prompt: 仪表盘 1440px 看着还行，手机上塌了，帮我做视口对比审查。
    scene: 检查响应式布局
---

# Webapp 打磨审查

对浏览器最终渲染的 Web UI 做只读审查。每条发现必须由截图、最终 DOM/可访问性状态、计算样式、布局盒或安全可达的交互状态支持；不会读取项目源码，也不会实施修复。

## 什么时候使用

- 审查一个点名的页面、路由、组件状态或可见 UI bug。
- 从入口 URL 抽取代表性子页面族，检查跨页面一致性。
- 检查响应式连续性、状态覆盖、交互反馈、视觉可信度、可访问性或“像 demo、不像真实产品”的完成度问题。
- 用户明确要求“先审查、后修复”时，先完成只读审计。

不要用于实现、改代码、产出 diff、大范围重新设计、后端/API/数据/CLI/基础设施、产品策略、UX 研究、信息架构或纯文案任务。

## 它如何保证可靠性

Skill 只使用一套 S0–S7 状态机：

1. 解析审计意图、范围、运行时能力、runDir 和 TODO 台账。
2. 仅在非明确单页请求下发现并抽取代表性子页面。
3. 为每个页面选择有浏览器 inventory 证据支持的审查维度。
4. 把截图和盘点 JSON 落到 `/tmp/webapp-polish-audit/<RUN_ID>/`。
5. 按 harness 并发槽分批派发：每个截图/规定对比组一个隔离 Judge，再由独立 Verifier 验收。
6. 使用独立 Aggregator；主 Agent 只在 Browser 中最终锚定 actionable 发现。
7. 最终先过确定性的 JSON validator，再过独立 Final verifier，才能声称完成。

Judge、Verifier、Aggregator、Final verifier 不得串岗。缺失证据必须进入 gap/blocker，不能静默改成“已经满足”。

## 产物

- `polish-audit-report.json`：发现、逐类覆盖、gaps、blockers 和证据引用的唯一机读事实源。
- `audit-state.json`：S0–S7 状态和截图判断单元对账台账。
- 同一 runDir 下的 PNG 截图与 inventory JSON。
- 面向用户的简短摘要、精确审计视口和报告路径。

最终 validator 会拒绝错误 schema、证据缺失、判断单元漏派、actionable 没有 finding、blocker 没有 gap，以及 gap 与 already_satisfied 相互矛盾的报告。

## 安全边界

- 不检查项目源码，不向项目目录写文件。
- 不提交表单，不创建/更新/删除数据，不变更权限，不上传文件，不触发外部副作用。
- 不实施修复，不产出代码 diff。
- 最终 Browser 锚定至少覆盖桌面和窄视口；项目有额外 breakpoint 协议时追加覆盖，否则明确记入 gaps。

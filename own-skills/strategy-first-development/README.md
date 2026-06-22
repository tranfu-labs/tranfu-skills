# strategy-first-development

## 介绍

把复杂产品/工程开发从“马上写代码”改成“先多轮达成战略共识、搜索成熟项目、选择技术栈、规划路线图，并落地项目控制面文档”的 agent 工作流。

这个 skill 的核心目标是：用户使用后，项目至少拥有战略、北极星、技术栈、路线图和 agent 操作手册，后续 harness/agent 可以沿着这些文件高效正确推进，而不是无头乱窜、随机生成或重复造轮子。

它不是创建/优化 skill 的元工作流。创建、审查、修复已有 skill 时应使用对应的 skill 工作流。

## 默认产物

充分讨论并完成成熟项目调研后，默认创建或更新：

- `AGENTS.md`
- `docs/product/strategy.md`
- `docs/product/north-star.md`
- `docs/architecture/technical-stack.md`
- `docs/product/roadmap.md`

如果项目已有等价 canonical docs，优先更新现有文件，避免重复文档。

## 什么时候用

当你希望 agent 先和你讨论清楚方向，并把共识沉淀成项目控制面时使用。典型场景包括：

- 新产品/新 MVP 还没确定战略目标、北极星和产品形态；
- 需要先看参考截图、竞品页面或生成几个预期页面方向；
- 需要搜索 GitHub 成熟项目、官方框架和生态默认方案，避免重复造轮子；
- 需要确定技术栈、模块边界、架构和工作流程；
- 需要把战略、技术栈、路线图和后续验证方式落进仓库文件。

不要用于单行命令、小文案、翻译、已明确范围的 bug 修复、纯代码 review，或“创建/优化 skill”这类元任务。

## 触发示例

```text
用 strategy-first-development 帮我先充分讨论这个产品，并落地默认战略文件。
```

```text
我想做一个高考出分后选学校和专业的网页，先不要写代码，先定产品战略、北极星、成熟项目、技术栈和路线图。
```

```text
这个项目开始前先和我多轮讨论方案，搜索 GitHub 成熟项目，再生成 AGENTS.md、strategy、north-star、technical-stack、roadmap。
```

```text
不要重复造轮子，先查成熟框架和参考项目，告诉我采用什么、吸收什么、拒绝什么，再落地技术栈文档。
```

## 期望输出

skill 会推动 agent 输出：

- consensus checkpoints：每轮讨论的已达成共识、仍开放问题、默认建议和需要用户决策；
- strategy packet：战略目标、目标用户、产品形态、核心 workflow、非目标、约束和开放问题；
- mature project findings：GitHub/官方生态成熟项目调研，包含 adopt / absorb / reject / inspect_later；
- technical stack：技术栈、被拒绝方案、自研边界、临时方案退出条件；
- roadmap：Now / Next / Later / Not Doing；
- default artifacts：默认 5 个项目控制面文件；
- verification results：文件存在、未重复 canonical docs、draft/assumptions/open questions 明确、未改生产代码。

关键硬约束：

- 必须多轮讨论或显式记录用户接受的假设；
- 写 `technical-stack.md` 前必须先根据战略目标搜索成熟项目/官方框架；
- 默认落地 5 个控制面文件，但只限文档，不得借机改生产代码；
- 不得在没有理由时手写成熟领域的核心引擎；
- 交付前必须报告验证命令和结果。

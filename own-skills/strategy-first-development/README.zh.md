---
prompt_examples:
  - prompt: 想做一个高考出分后帮学生选校选专业的网页——先别写代码, 跑一遍战略共识再把 5 个控制面文档落进来。
    scene: 规划全新 MVP
  - prompt: 不要重复造轮子, 先搜 GitHub 成熟项目和官方生态默认方案, 告诉我 adopt / absorb / reject 之后再定技术栈。
    scene: 优先复用现有工具
  - prompt: 战略共识达成后, 帮我把 AGENTS.md / strategy.md / north-star.md / technical-stack.md / roadmap.md 落进这个仓库。
    scene: 生成项目方案
  - prompt: 先别写任何文件, 只跟我多轮讨论战略目标、产品形态和非目标, 出共识节点就停。
    scene: 先讨论再开发
  - prompt: 这个老仓库最近方向漂了, 帮我复位战略、重搜成熟项目、更新 technical-stack 文档, 不要动生产代码。
    scene: 重新评估架构
  - prompt: provider、模型、部署目标怎么选, 我要基于战略目标和约束的决策包, 不要写代码。
    scene: 选择服务商
---

[English](./README.md) | [中文](./README.zh.md)

# 战略先行开发流程

在动代码之前, 把模糊或高影响力的产品/工程请求变成项目的公共控制面——多轮达成战略共识、搜索成熟项目、选定技术栈、切分路线图、落地默认控制面文档。

## 什么时候用它

**新项目 / 新 MVP, 战略还没锁**:

目标用户、主工作流、北极星和非目标都还漂着——你想要 agent 先讨论方向、共识达成后再写文档, 而不是二话不说 Next.js + Tailwind 起手就干。

**避免重复造成熟引擎**:

在选栈之前, 想让 agent 先搜 GitHub、官方文档、包管理器和生态默认方案, 再把结论分成 `adopt` / `absorb` / `reject` / `inspect_later`——必须保留自研的部分要写清战略理由。

**落地项目控制面**:

想让 5 份标准战略文档——`AGENTS.md`、`docs/product/strategy.md`、`docs/product/north-star.md`、`docs/architecture/technical-stack.md`、`docs/product/roadmap.md`——原地创建或更新, 已有标准文档优先更新而不是重复建。

**provider / 部署 / 架构升级决策**:

问题不是"写不写代码", 而是"选哪个模型 / provider / 部署目标 / 模块边界", 想让决策紧扣战略需求和成熟项目调研, 而不是个人品味。

**只讨论, 不动文件**: 有时你只想跑多轮共识和一份战略包 (STRATEGY_PACKET), `may_write_docs: false`——agent 停在共识节点上。

**不接**: 单行命令、小文案、翻译、已明确范围的 bug 修复、纯代码 review、发版 / 发布, 以及创建 / 审查 skill 的元任务——都走各自对应的工作流。

## 它会产出什么

**只落文档产物——战略落地阶段绝不动生产代码、依赖清单或部署文件。**

- **共识节点 (checkpoint)**: 每轮记录 `已达成 / 仍开放 / 默认建议 / 需要用户决策`——不发一份长问卷, 拆成多轮短问答。
- **战略包 (STRATEGY_PACKET)**: 战略目标、目标用户、产品形态、主工作流、非目标、约束、风险、开放问题——固定 YAML 结构。
- **成熟项目调研**: 至少几个候选, 含来源、成熟度、战略契合、可复用部分、可吸收内容、风险, 每条配一个 `adopt` / `absorb` / `reject` / `inspect_later` 决定。
- **技术栈方向**: 选定栈、采用的库、吸收的模式、拒绝的替代方案、必须自研的部分及战略理由、临时选择及其退出条件。
- **路线图**: `Now` / `Next` / `Later` / `Not Doing`, 每片配一道关卡或证据要求。
- **默认产物**: 5 份控制面文档, 默认标记 `draft` 直至用户显式接受, 假设与开放问题始终可见。
- **验证汇报**: 目标文件已存在、标准文档未被重复、生产代码未被改动、成熟项目调研状态可见。

## 前置条件 / 边界

**前置**:

agent 能读取的工作区, 以及一个愿意跑几轮短共识的用户。做成熟项目调研需要联网——不能联网时会标记 `incomplete_with_reason`, 技术栈也不会作为「完全经过验证」呈现。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 战略定完后写 PRD / 功能 spec | **write-spec** |
| 评估某 AI 工作流值不值得投入 | **project-scoring** |
| 审 / 清理老项目的架构漂移 | **architecture-hygiene** |
| 给现有仓库加 AGENTS.md 和 AI 协作基础文档 | **project-init-docs** |
| 创建 / 审查 / 改进 skill 或 SKILL.md | **skill-create-workflow** / **skill-improve-workflow** / **prompt-review** |

**不接的场景**: 创建 / 审查 / 更新 skill 的元任务; 单行命令、小编辑、翻译、已明确范围的 bug 修复; 覆盖标准文档里用户手写的内容; 只改了文档就宣称实现完成; 无写下理由地手写成熟引擎 (auth / 支付 / 图表 / 富文本 / 媒体 / 调度 / 搜索 / 队列 / 模型客户端)。

**微妙边界**:

- 用户显式授权生成默认文件, 覆盖范围只有文档编辑, 不含生产代码
- 成熟项目调研无法完成时, 草稿文档可以先落, 但 `technical-stack.md` 必须写清调研缺口
- 已有标准文档原地更新; 遇到路径冲突要先摆出来问, 不能直接建第二份

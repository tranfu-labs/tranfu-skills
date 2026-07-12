---
prompt_examples:
  - prompt: 初始化。
    scene: 仓库根初始化
  - prompt: 这个老项目还没 AGENTS.md, 帮我搭一套 AI 能看懂的文档底座。
    scene: 存量补齐
  - prompt: 帮我把项目文档初始化一下, 把结构、命令、业务域一起沉下来。
    scene: AI 底座冷启动
  - prompt: 给这个项目加线框图, 每页画个版式事实源。
    scene: 加线框图
  - prompt: 帮我搭 DEPLOY.md, 把部署到哪、怎么建、怎么退写清楚。
    scene: 部署源初始化
---

# 项目文档初始化

在仓库根说「初始化」时, 扫真实事实一次性铺 AI 协作基线——`AGENTS.md` / `DEPLOY.md` / `spec.md` / 线框图对齐同一套契约。

## 什么时候用它

**正面初始化**:

我在一个已经能跑的仓库根说「初始化」, 想 skill 扫真实栈与目录、把 AI 协作基线一次铺好, 而不是拷空白模板。

**存量补齐**:

老项目代码在、文档欠账——没 `AGENTS.md`、没 `module-map.md`、没 `DEPLOY.md`, 想让 skill 按真实事实一次性补齐, 命令抄真实脚本、模块抄真实目录。

**AI 冷启动**:

我想让后续任何 AI 拿到仓库就能干活——`AGENTS.md` 知禁区、`DEPLOY.md` 知部署、`module-map.md` 知依赖、`openspec/` 与 `docs/wireframes/` 知契约与版式事实。

**显式指名**:

我点名要「搭 `AGENTS.md` 体系 / 加个 `DEPLOY.md` / 铺线框图」, 想让 skill 按同一套骨架把点名的部分与关联小节一起对齐。

**不接**:

跑 `npm init` / `create-react-app` 这类脚手架 → 与本 skill 无关; 只想写一份 `README` / 贡献指南 → 普通编辑; 改 `AGENTS.md` 的某一节 → 普通编辑; 打 tag / 版本号 → **release**; 日常写码闭环 → **openspec-driven-development**。

## 它会产出什么 / 你会看到什么

**默认先出执行前小结、用户确认才动笔; 目录级说明一律 `AGENTS.md` + `CLAUDE.md`, 绝不用 `README`**——最反常识的两点。

- **探测仓库**: 扫 `package.json` / `Dockerfile` / CI 工作流 / 路由等, 抽真实命令、模块、业务域、部署形态、页面清单; 亮出计划生成的文件清单等用户确认
- **落盘骨架**: 跑 `scripts/fill.sh` 铺静态骨架 (各 `CLAUDE.md` 指针、`changes/AGENTS.md` + `_template/`、`adr/AGENTS.md` + 0000 ADR、`docs/wireframes/` 静态骨架) + 事实文件骨架 (小节标题 + `TODO`)
- **填事实正文**: 根 `AGENTS.md`、`DEPLOY.md`、`module-map.md`、各 `spec.md`、`page.md`、`flow.md` 按真实事实填, 探测不到的整节留 `TODO: 需人工确认`
- **线框图默认铺**: `docs/wireframes/` 静态骨架 + `flow.md` 无条件生成; 有路由再 `--pages` 追加 `pages/<page>.md`; 是否保留留给根 `AGENTS.md` 的删除规则
- **幂等不覆盖**: 已存在文件读现有内容, 只补缺失小节或报差异, 覆盖前必须经用户确认
- **绝不会做**: 跑脚手架命令 (`npm init` / `create-react-app` / `cargo new`); 在 `DEPLOY.md` 里写真实密钥值; 编造探测不到的命令与依赖; 用 `README` 当目录指南

## 前置条件 / 边界

**前置**:

一个已 clone 的代码仓库根目录, 能跑 `bash` 执行 `scripts/probe.sh` 与 `scripts/fill.sh`; 有路由的项目还需要 `python3` (线框图列宽用 `east_asian_width` 校验, 禁 `awk length` / `wc -L`)。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 日常开发闭环 (方案 → 分支 → change → 归档) | **openspec-driven-development** |
| 打 tag / 写 changelog / 定版本号 | **release** |
| 审 / 优化提示词或 SKILL.md | **prompt-review** |

**不接的场景**:

- 脚手架命令 (`git init` / `npm init` / `create-react-app` / `cargo new`)
- 只新建单个文档 (「写个 `README`」/「写个贡献指南」)
- 已有 `AGENTS.md` 的局部小修改 (那是普通编辑)
- 编写业务代码 / 修 bug

**微妙边界**:

- 仓库根说「初始化」→ 触发; 不在仓库里说「初始化」→ 不触发
- 「搭 `AGENTS.md` 体系 / 加 `DEPLOY.md` / 铺线框图」→ 触发 (基线一部分); 「改 `AGENTS.md` 部署一节」→ 不触发 (局部编辑)
- 无界面工具 / 库 → 依旧铺 `docs/wireframes/` 静态骨架 + 保留删除规则; init 阶段不替用户判定 UI 与否

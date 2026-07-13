---
prompt_examples:
  - prompt: 刚做完 own-skills/skill-name-generation, 顺手把配套 README 也生成一下
    scene: 为新 Skill 写说明
  - prompt: 把 own-skills/ 下还没 README 的都批量补齐一份
    scene: 批量补充 README
  - prompt: 这份 README 是旧版单语中文, 按最新双语规范重生成, 覆盖旧的
    scene: 更新旧版 README
  - prompt: own-skills/openspec-driven-development/ 帮我生成 README
    scene: 为指定目录写说明
  - prompt: 这个 skill 要挂官网了, 先把 README 补齐再上线
    scene: 发布前补说明
  - prompt: 跟 skill-name-generation 一样, 给这个 skill 也做一份 README
    scene: 参考现有 README
---

[English](./README.md) | [中文](./README.zh.md)

# Skill README 生成

给已有 skill 的 `SKILL.md` 派生一对双语人话说明——英文 `README.md` + 中文 `README.zh.md`, 直接落到公司自建官网的 skill 详情页。

## 什么时候用它

**为新 Skill 写说明**:

我刚做完一个新 skill, `SKILL.md` 已经写好, 现在要挂到公司官网详情页, 想让 skill 顺手把配套 README 也生成好, 我不用一段段口述。

**批量补充 README**:

`own-skills/` 下还有一批老 skill 只有 `SKILL.md`, 一直没配 README——想按同一套规范一次性补齐, 每个目录一份独立文件, 绝不合并。

**更新旧版 README**:

某个 skill 的旧 README 是单语中文, 或骨架不合当前规范, 我明说「按最新双语规范重生成」, 就直接覆盖两份文件。

**发布前补说明**:

我要把某个 skill 挂到公司自建官网的详情页, 详情页会读 README 开头的示例提问, 显示成不同场景的用法示范——README 没补齐, 详情页就没内容可显示。

**参考现有 README**:

参照另一个已有好 README 的 skill, 说「跟 `skill-name-generation` 一样, 给这个 skill 也做一份」——skill 会照那份的骨架, 落到目标 skill 自己的 `SKILL.md` 上。

**不接**:

只想改现有 README 里的某一段 → 普通编辑就够, 不用 skill; 从零建 `SKILL.md` 或整个 skill → **skill-create-workflow**; 只给 skill 起显示名或英文目录名 → **skill-name-generation** / **skill-domain-framing**; 判断某段素材值不值得做成 skill → **skill-content-fit**; `SKILL.md` 太简陋想整体审修 → **skill-improve-workflow**。

## 它会产出什么

**一次调用产两份文件——英文 `README.md` + 中文 `README.zh.md`, 结构对应但绝不逐词直译。**

- **落盘**: `<目标 skill 目录>/README.md` (全英文正文) 与 `<目标 skill 目录>/README.zh.md` (全中文正文)
- **语言切换链接**: 两份文件都在开头元数据之后、H1 之前放一行 `[English](./README.md) | [中文](./README.zh.md)`
- **开头元数据**: 唯一字段 `prompt_examples`, 5-6 条自然口语示例提问, 覆盖至少 4 种触发场景
- **正文四段**: 开场一句摘要 → 什么时候用它 → 它会产出什么 → 前置条件与边界, 每版 30-80 行
- **改成人话**: 中文版逐句把作者圈才懂的行话过滤成普通中文, 让路过详情页的普通同事也扫得懂
- **完成汇报**: 终端打印两份落盘路径、总行数、示例提问条数与覆盖场景, 以及「拿不准之处」一行
- **绝不会做**: 改动目标 skill 的 `SKILL.md`, 改动仓库任何其他文件, 联网调 API, 自己另起子任务并发跑

## 前置条件与边界

**前置**:

目标是一个已有的 skill 目录, 里面必须已经有 `SKILL.md` (开头元数据完整、有 description)——本 skill 不建 skill 骨架, 只在已有骨架之上派生 README。无外部依赖: 不联网, 不调 API, 不启动 subagent。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 从零建 `SKILL.md` 或整个 skill | **skill-create-workflow** |
| 起 skill 显示名 (中英文) | **skill-name-generation** |
| 起 skill 英文名 / 目录名 | **skill-domain-framing** |
| 判断素材值不值得做成 skill | **skill-content-fit** |
| 整体审查修复已有 skill 质量 | **skill-improve-workflow** |

**不接的场景**:

- 改现有 README 里的某一段 (普通编辑就够)
- 给非 skill 的普通项目写 README 或项目文档
- CI 校验现有 README 开头元数据是否合规 (那是脚本的活)

**微妙边界**:

- 目标目录已有 `README.md` 或 `README.zh.md`, 用户没明说要「重生成 / 覆盖」→ 询问一次, 绝不擅自覆盖
- 目标 `SKILL.md` 太简陋 (缺触发场景 / 主流程) → 停下, 建议先用 **skill-improve-workflow** 把 `SKILL.md` 补齐再回来生成, 不硬凑一份内容单薄的 README
- 目标 skill 没定显示名 → 照常生成 README, 汇报里提醒用户可路由 **skill-name-generation**

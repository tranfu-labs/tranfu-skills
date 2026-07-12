---
prompt_examples:
  - prompt: 给这个 skill 加个 README, own-skills/skill-name-generation/
    scene: 单条新起
  - prompt: 把 own-skills/ 下还没 README 的都批量补齐一份
    scene: 存量批量
  - prompt: 这份 README 太老了, 按新骨架重出一份, 覆盖旧的
    scene: 覆盖重生成
  - prompt: own-skills/openspec-driven-development/ 帮我生成 README
    scene: 指定路径
  - prompt: 这个 skill 要挂官网了, 先把 README 补齐再上线
    scene: 官网预发
  - prompt: 跟 skill-name-generation 一样, 给这个 skill 也做一份 README
    scene: 跟随已有
---

# Skill README 生成

把一个已有 skill 的 `SKILL.md` 派生一份读起来像产品说明的中文 `README.md`, 挂上公司自建官网的 skill 详情页。

## 什么时候用它

**单条新起**:

我刚做完一个 skill, `SKILL.md` 已经写好, 现在要挂上公司官网, 想让 skill 顺手把配套 README 也生成好。

**存量批量**:

`own-skills/` 下还有一批老 skill 只有 `SKILL.md`, 一直没配 README——想一次性把还没 README 的都补齐, 每个目录一份独立文件。

**覆盖重生成**:

某个 skill 的旧 README 是很早以前手写的, 骨架不合当前规范, 想按新骨架整个重出一份, 我明说要覆盖。

**官网预发**:

我要把某个 skill 挂到公司自建官网的详情页, 详情页会读 README 开头的示例提问, 显示成不同场景的用法示范——README 没补齐, 详情页就没内容可显示。

**不接**:

只想改现有 README 里的某一段 → 普通编辑就够, 不用 skill; 从零建 `SKILL.md` 或整个 skill → **skill-create-workflow**; 只给 skill 起显示名或目录名 → **skill-name-generation** / **skill-domain-framing**; 判断某段素材值不值得做成 skill → **skill-content-fit**。

## 它会产出什么 / 你会看到什么

**只落盘一个文件, 绝不改动其他任何文件**——这是最反常识的一点。

- **落盘**: 目标 skill 目录内的 `README.md`, 由开头一段元数据 (5-6 条示例提问 + 场景标签) 和四段中文说明 (标题句 / 什么时候用它 / 会产出什么 / 前置条件与边界) 组成
- **绝不会做**: 改动目标 skill 的 `SKILL.md`, 改动仓库其他任何文件, 联网调 API, 自己另起子任务并发跑

## 前置条件 / 边界

**前置**:

目标是一个已有的 skill 目录, 里面必须已经有 `SKILL.md`——本 skill 不建 skill 骨架, 只在已有骨架之上派生 README。

**相邻 skill 分工**:

| 动作 | 交给 |
|---|---|
| 起 skill 显示名 (中英文) | **skill-name-generation** |
| 起 skill 英文名 / 目录名 | **skill-domain-framing** |
| 从零建 `SKILL.md` 或整个 skill | **skill-create-workflow** |
| 判断素材值不值得做成 skill | **skill-content-fit** |
| 整体审查修复已有 skill 质量 | **skill-improve-workflow** |

**不接的场景**:

- 改现有 README 里的某一段 (普通编辑就够)
- 给非 skill 的普通项目写 README 或项目文档
- CI 校验现有 README 开头元数据是否合规 (那是脚本的活)

**微妙边界**:

- 目标 `SKILL.md` 太简陋 (缺触发场景 / 主流程) → 停下, 建议先用 **skill-improve-workflow** 把 `SKILL.md` 补齐, 再回来生成 README, 不硬凑一份内容单薄的 README
- 目标目录已有 `README.md` 且用户没明说要重生成 → 询问一次是否覆盖, 用户不确认就保留现状

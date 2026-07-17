# draft-content

简体中文 | [English](README_EN.md)

`draft-content` 是一个面向中文内容生产的 Codex Skill。它承接已经完成的选题与素材，先生成或优化一份共享大纲，在人工按路径和 SHA-256 批准后，产出 A/B 两份平台中立母稿，并分别适配公众号、小红书、知乎、微博和头条号。

它只负责创作阶段，最终状态为 `READY_FOR_PROOFREAD`，不负责调研、选题、审校、配图、排版或发布。

## 核心流程

```text
上游选题与素材
→ 生成或优化共享大纲
→ 人工批准大纲路径与 SHA-256
→ A/B 平台中立母稿
→ A/B 各自适配五个平台
→ READY_FOR_PROOFREAD
```

- A 分支不读取任何写作风格文档。
- B 分支相对 A 唯一增加的文件输入是本次风格快照。
- 两个分支共享事实、受众、批准大纲、平台规则和运行参数。
- 平台稿直接从对应分支母稿适配，不从其他平台稿二次派生。
- 验证器检查输入快照、大纲审批、文件数量、H1、占位符、哈希绑定和完成状态。

## 什么时候用它

- 已有 `PASS` 选题和可用研究包，需要完整生成五个平台的 A/B 初稿。
- 用户直接给出主题、目标受众和获准材料，需要先确认大纲再开始创作。
- 总控系统需要通过 `drafting-v1` 合同派发大纲、母稿或平台适配任务。

它不负责调研、选题、标题池、审校、配图、排版或发布，也不用于只写一个平台的一次性稿件。

## 同类 Skill 对比

> 由 tranfu-publish 起草，作者 `BruceL017` 签字。帮助阅读者横向决定要安装哪个 Skill。

### 公司库内

- [collect-sources](../collect-sources/SKILL.md) — 在写作前建立可追溯研究包；**本 Skill 区别**：只消费获准事实，负责大纲到五平台初稿。
- [content-topics](../content-topics/SKILL.md) — 从证据中筛选跨平台主选题；**本 Skill 区别**：承接已通过的主选题并完成 A/B 创作。
- [proofread-content](../proofread-content/SKILL.md) — 对完整成稿执行三轮审校；**本 Skill 区别**：停在 `READY_FOR_PROOFREAD`，不改写审校终稿。

### 外部世界

- [wechat-explosive-article-skill](https://github.com/AIPMAndy/wechat-explosive-article-skill) — 聚焦公众号爆款文章；**本 Skill 区别**：一份批准大纲同时约束五个平台 A/B。
- [xhs-writer-skill](https://github.com/JuneYaooo/xhs-writer-skill) — 聚焦小红书笔记；**本 Skill 区别**：小红书只是十份平台产物之一。
- [toutiao-article-creator](https://github.com/aby-aby111/toutiao-article-creator) — 聚焦头条号文章；**本 Skill 区别**：先生成分支母稿，再做对应平台适配。

### 本 skill 独特价值

- 一次批准约束两条路线十份平台稿。
- A 不读风格，B 只增加风格快照。
- 哈希门禁与恢复状态可确定性验证。

## 使用技巧

> 由 tranfu-publish 引导起草，作者 `BruceL017` 签字。
> 帮助阅读者纵向上手；横向同类对比见上方 §同类 Skill 对比。

### 材料方案

- 优先提供 `PASS` 选题和 `ready` 研究包。
- 无标准上游时给出主题、受众和材料。
- 原大纲只优化结构，不补充事实。

### 推荐用法

- 先确认大纲路径和 SHA-256。
- 并行时为 A/B 使用隔离子 Agent。
- 完成后逐稿交给 `proofread-content`。

### 已知限制

- 不自行调研或补证。
- QA 不能证明模型隐藏读取行为。
- Provider 路由由总控负责审批状态。

## 平台产物

| 平台 | 默认形态 |
|---|---|
| 公众号 | 1800–3000 字深度文章，3–6 个章节 |
| 小红书 | 发布正文、6–9 页卡片文案、5–8 个标签 |
| 知乎 | 1500–3000 字问题型回答 |
| 微博 | 200–600 字单条，必要时为 3–6 条线程 |
| 头条号 | 1000–2000 字资讯解读 |

上游 `ContentTopicPlan` 指定的内容形式优先于这些软默认。每份平台稿只生成一个兑现正文承诺的 H1 工作标题，不生成标题池。

## 两种运行方式

### 独立工作流

独立工作流创建可恢复的 run，并执行人工大纲门禁：

```text
WORKDIR/03-内容创作/<run-id>/
├── manifest.json
├── 00-input/
├── 01-outline/
├── 02-masters/
├── 03-platforms/
└── 04-qa/report.json
```

输入支持：

- 标准模式：`ContentTopicPlan(status=PASS)` 与主题匹配的 `collect-sources` 研究包。
- 等价模式：用户明确提供的选题、目标受众、获准材料和可选大纲。

### 总控 Provider

Skill 同时提供无状态的 `content-production-provider: drafting-v1` 合同，用于总控系统派发 `outline`、`master` 和 `adapt` 任务。Provider 路由不会创建独立 run 或自己的审批门禁，详情见 [`orchestrated-provider.md`](draft-content/references/orchestrated-provider.md)。

## 安装

可安装的 Skill 位于仓库内的 [`draft-content/`](draft-content/) 目录。需要安装时，将该目录复制到 Codex 或 Claude 的 Skill 目录中。本仓库本身不会自动安装、同步或发布 Skill。

## 运行工具

项目提供五个无第三方依赖的 Node.js CLI：

```bash
node draft-content/scripts/init-run.mjs --help
node draft-content/scripts/inspect-run.mjs --help
node draft-content/scripts/set-outline-gate.mjs --help
node draft-content/scripts/verify-run.mjs --help
node draft-content/scripts/provider-contract.mjs --help
```

## 开发校验

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/test_scripts.mjs tests/test_provider_contract.mjs
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py draft-content
```

## 验证边界

QA 可以验证当前文件、哈希和预期分支绑定，但不能证明模型隐藏上下文中的实际读取行为或内容的因果作者关系。该限制会写入 manifest 和 QA 报告，不会被包装成严格因果实验保证。

## 许可证

本项目使用 [MIT License](LICENSE)。方法来源与第三方说明见 [NOTICE](NOTICE)。

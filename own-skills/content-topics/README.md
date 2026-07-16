---
description: "把调研材料、事实库和实时关注信号转成有证据门禁的跨平台选题方案，支持独立模式和 topic-planning-v1 Provider 模式。"
---

# Content Topics

`content-topics` 是面向固定内容账号的证据驱动跨平台选题 Skill。它把上游调研材料、事实库和实时关注信号转成可进入创作流程的选题方案，默认适配微信公众号、小红书、知乎、微博和今日头条。

## 什么时候用它

- 从调研材料或事实库中提炼可写的内容方向。
- 为微信公众号、小红书、知乎、微博和今日头条统一规划选题。
- 核验一个热点是否同时具备可信事实和平台关注信号。
- 让 `content-production` 通过 `topic-planning-v1` 调用选题 Provider。

只需要标题、完整正文、已有正文改写、内容日历、发布或历史表现分析时，不使用本 Skill。

## 同类 Skill 对比

> 由 tranfu-publish 起草，作者 `BruceL017` 签字。帮助阅读者横向决定要安装哪个 Skill。

### 公司库内

- [market-analysis](../market-analysis/) — 负责完整的市场与行业研究；**本 Skill 区别**：消费已有事实材料并生成跨平台内容选题，不替代上游调研。
- [opportunity-hunter](../opportunity-hunter/) — 负责发现和快筛创业机会；**本 Skill 区别**：面向内容账号，以证据门禁和平台适配筛选可写选题。
- [product-title-generation](../product-title-generation/) — 负责短产品名和入口名；**本 Skill 区别**：先决定写什么并给出选题母纲，不单独起标题。

### 外部世界

- 暂无已核验的同类项。

### 本 skill 独特价值

- 双证据与 72 小时热点门禁。
- 一次生成五平台选题母纲。
- 独立与 Provider 协议并存。

## 使用技巧

> 由 tranfu-publish 引导起草，作者 `BruceL017` 签字。横向定位见上方同类对比。

### 材料方案

- 优先提供事实库和调研素材。
- 热点材料保留发布时间与来源链接。
- 指定固定账号画像可提高适配度。

### 推荐用法

- 先用独立模式确认选题质量。
- 总控调用使用 `topic-planning-v1`。
- 指定平台子集可减少无关输出。

### 已知限制

- 无实时检索时不能做无材料热点。
- 不负责标题池、正文或发布。
- 不记录历史选题与表现数据。

## 运行模式

### 独立模式

普通选题请求读取本地材料或公开来源，执行 72 小时注意力核验、双证据门禁、候选筛选和平台适配，最终生成 `ContentTopicPlan`。

典型请求：

```text
使用 content-topics，读取当前内容目录的事实库，为五个平台生成今天的选题方案。
```

默认写入当前内容目录的 `02-选题方案.md`。同名文件存在时创建带时间戳的新文件，不覆盖旧版本。

### 总控 Provider 模式

作为 `content-production` 的 `topic_planning` Provider 调用时，Skill 使用 `topic-planning-v1` 结构化 request/result，只在总控 run 的 `01-discovery/` 中写入：

- `discovery.md`
- `topic-candidates.md`
- `topic-candidates.json`
- `provider-result.json`

Provider 模式复用独立模式的证据、门禁和排序规则，并采用总控提供的画像快照、授权输入、路径和状态协议。它不会改变独立模式的默认行为。

## 输入与边界

独立模式按以下顺序寻找输入：

1. 用户明确指定的文件或目录。
2. 对话中粘贴的材料。
3. 当前内容目录顶层的标准文件。
4. 无需登录即可读取的公开 URL。
5. 无材料热点模式。

标准文件包括：

- `00-统一输入与定位.md`
- `01-调研素材.md`
- `01-调研素材-v2.md`
- `01-事实库.md`

Skill 不递归扫描仓库，不修改上游文件，也不保存历史选题或表现数据。

## 输出与失败状态

独立模式产物包含：

- `status: PASS | NEEDS_EVIDENCE | BLOCKED`
- `confidence: high | medium | low`
- 使用画像、材料、热点查询时间与事实边界
- `PASS` 时 1 个主选题和 4 个备选
- `NEEDS_EVIDENCE` 时主选题为“无”并给出 4 个低置信备选
- 主选题的五平台标题原型、适配理由、内容形式、共享母纲和平台起草提示

没有“可信事实来源 + 平台关注信号”时返回 `NEEDS_EVIDENCE`，不强推主选题。唯一必需来源不可读，或无材料且没有实时检索能力时返回 `BLOCKED`，不伪造候选。

## 运行要求

`scripts/provider-contract.mjs` 使用 Node.js 校验路径、哈希、request/result 和产物结构。它不负责抓取，也不替代选题判断。

## 来源与许可证

本 Skill 使用 MIT License。方法层面的外部启发与许可边界记录在 [NOTICE](NOTICE)；没有复制 GPL 或来源不明项目的提示词文本。

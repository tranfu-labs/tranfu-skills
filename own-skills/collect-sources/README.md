# collect-sources

[中文](README.md) | [English](README_EN.md)

`collect-sources` 是一个面向中文 AI 科技媒体内容的前置调研 Skill。它在写作开始前搜索公开资料、保存证据、拆分和核实主张，并把可追溯的编辑简报交给后续写作工作流。

## 什么时候用它

- AI 模型、产品、公司和行业事件
- 开发者工具、开源项目与软件平台
- 芯片、算力、机器人和相邻互联网科技
- 用户提供的公开 URL、Markdown、TXT 和 PDF 补充材料

它不负责非科技主题、无内容创作目标的单点查询、成稿后的事实审校、标题或大纲生成、正文写作及发布。

## 同类 Skill 对比

> 由 tranfu-publish 起草，作者 `BruceL017` 签字。帮助阅读者横向决定要安装哪个 Skill。

### 公司库内

- [market-analysis](../market-analysis/SKILL.md) — 产出市场规模、竞争与机会报告；**本 Skill 区别**：为内容写作建立主张到来源的证据链。
- [elite-market-researcher](../elite-market-researcher/SKILL.md) — 面向战略决策的深度行业研究；**本 Skill 区别**：聚焦 AI 科技媒体的前置素材采集。
- [credibility-review](../credibility-review/SKILL.md) — 审查已完成文章的可信度；**本 Skill 区别**：在写作前核实事实并设置使用门禁。

### 外部世界

- [content-research-writer](https://github.com/davila7/claude-code-templates/blob/3d364f6066186995dfb163864dffe6f727adbcfb/cli-tool/components/skills/business-marketing/content-research-writer/SKILL.md) — 将调研、提纲、写作和审阅合并处理；**本 Skill 区别**：只交付可追溯研究包，不写正文。
- [xhs-writer reference-search](https://github.com/JuneYaooo/xhs-writer-skill/blob/main/references/reference-search.md) — 为小红书写作采集参考资料；**本 Skill 区别**：覆盖 AI 科技媒体并提供逐主张核实门禁。

### 本 skill 独特价值

- 主张、证据、来源形成双向链路。
- 独立与总控模式共用事实门禁。
- AI 科技热点默认覆盖近 30 天。

## 使用技巧

> 由 tranfu-publish 引导起草，作者 `BruceL017` 签字。
> 帮助阅读者纵向上手；横向同类对比见上方 §同类 Skill 对比。

### 材料方案

- 给出主题、目标读者和写作用途。
- 附上需核实的 URL、PDF 或文本。
- 无主题时直接说“启动调研”。

### 推荐用法

- 先完成选题，再进入完整证据采集。
- 写作环节只消费 `ready` 主张。
- 保留 `caveat`，禁用 `do_not_use`。

### 已知限制

- 不处理非科技主题和单点查询。
- 不绕过登录墙、付费墙或验证码。
- 只记录视觉线索，不下载素材。

## 核心行为

- 用户说“启动调研”“素材收集”或要求创作 AI 科技内容时触发。
- Codex 原生搜索和页面读取是默认能力；公开网页、RSS/Atom、Jina Reader、公开 JSON/API 和现有 `curl` 是匿名回退。
- 不索要 API key、账号、Cookie 或扫码登录，不安装缺失工具。
- 默认检索近 30 天热点，并按需回溯带日期的历史背景。
- 英文一手来源、独立科技媒体、中文语境材料、公开社区信号和反证检索分层处理。
- 搜索摘要只作为线索；可使用的事实必须回到可检查的原始页面。
- 视觉素材只登记原始页面、权属线索和建议用途，不下载文件。

## 安装

安装：

```bash
npx skills add https://github.com/BruceL017/collect-sources
```

可安装 Skill 位于仓库中的 `collect-sources/` 子目录。

## 使用

显式启动：

```text
使用 $collect-sources，围绕最近发布的某个 AI 模型启动素材收集。
```

也可以直接提出 AI 科技写作请求。Skill 会先生成调研包，再把 `ready` 主张交给后续写作环节：

```text
写一篇面向普通读者的文章，讲清楚某 AI 公司刚发布的新产品。
```

如果请求里没有主题，Skill 会先扫描近 30 天热点，返回 3–5 个有证据的候选，等待选题后再进入完整调研。

## 输出合同

每个项目持续维护三份 Markdown：

```text
reference/collect-sources/
├── 00-research-brief.md
├── 01-source-notes.md
└── 02-editorial-brief.md
```

每次运行追加独立的 `RUN-YYYYMMDD-HHmmss`，并通过完整 `SRC-<run>-###` 和 `CLM-<run>-###` ID 保持主张到来源的追溯关系。旧 run 不会被覆盖。

证据等级为 `L0`–`L3`，下游门禁为：

- `ready`：可在记录的范围和日期内断言。
- `caveat`：只能作为有归属的不确定性或限制。
- `do_not_use`：不得传给写作环节。

运行结果为 `complete`、`partial` 或 `blocked`。`partial` 中只要存在至少一个 `ready` 主张，复合写作请求仍可继续，但必须继承限制。

当由 `content-production` 总控调用时，Skill 切换到 `source-research-v1` provider 模式，不创建上述独立 run，直接在总控授权的 `02-research/` 生成研究简报、来源日志、结构化 claims 和证据映射。两个模式共用相同的证据等级与事实门禁。

## 验证

仓库测试检查 Skill 安装布局、独立行为合同，以及总控 request/result 和研究包结构；不联网，也不判断调研事实真伪：

```bash
python3 -m unittest discover -s tests -v
```

同时可运行 Codex 的 Skill 结构校验：

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" collect-sources
```

`scripts/provider-contract.mjs` 只负责总控模式的确定性 request/result、路径、哈希和研究包结构校验，不负责联网采集，也不会自动安装工具。独立模式仍是 prompt 驱动流程。

## 来源与许可

项目使用 MIT License。`NOTICE` 记录了调研流程设计所参考的公开或本地 Skill；本实现重新撰写全部规则，没有复制其代码或工作流文本。

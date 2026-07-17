# Output Contract

Maintain one append-only research package per project. The package is human-readable Markdown and is the stable interface for downstream content workflows.

## Contents

1. Paths and append semantics
2. Run and record IDs
3. Research brief template
4. Source notes template
5. Editorial brief template
6. Completion self-check

## 1. Paths And Append Semantics

Use these exact paths:

```text
WORKDIR/reference/collect-sources/00-research-brief.md
WORKDIR/reference/collect-sources/01-source-notes.md
WORKDIR/reference/collect-sources/02-editorial-brief.md
```

Create the directory and missing files before the first search. Initialize each missing file with its single document title, then append the current run section.

Keep one active section per run in each file. Update only that active section while the run is `in_progress`. Resume the newest matching unfinished run only when the same run ID and `in_progress` status appear in all three files and every matching rule in `research-protocol.md` passes. If a candidate run is absent or inconsistent in any file, preserve it, append a new run, and record the inconsistency. After a run becomes `complete`, `partial`, or `blocked`, treat it as immutable. A later request appends a new run to all three files.

Never overwrite an existing file, remove an earlier run, reuse an ID, or copy a prior conclusion into a new run without rechecking its source and freshness.

## 2. Run And Record IDs

Use local time with second precision:

```text
RUN-YYYYMMDD-HHmmss
SRC-<run>-###
CLM-<run>-###
QRY-<run>-###
```

For example:

```text
RUN-20260715-143012
SRC-RUN-20260715-143012-001
CLM-RUN-20260715-143012-001
QRY-RUN-20260715-143012-001
```

Number sources, claims, and queries from `001` within each run. Cite the complete ID everywhere; never use a bare numeric suffix.

## 3. Research Brief Template

The file title is `# 素材调研任务`. Append this structure for every run:

```markdown
## RUN-YYYYMMDD-HHmmss

- 状态：in_progress | complete | partial | blocked
- 模式：topic-research | source-enrichment | hotspot-discovery
- 主题：
- 目标读者：对科技感兴趣的中文大众
- 启动时间：YYYY-MM-DD HH:mm:ss +TZ
- 完成时间：in_progress | YYYY-MM-DD HH:mm:ss +TZ
- 热点发现窗口：YYYY-MM-DD 至 YYYY-MM-DD
- 用户提供的来源：无 | 路径/URL 列表
- 原始请求包含写作：yes | no

### 核心问题

| 编号 | 问题 | 核心/补充 | 覆盖状态 | 对应主张 |
|---|---|---|---|---|
| RQ-01 | ... | core | pending | — |

### 查询计划

- 英文一手来源：
- 独立科技媒体：
- 中文语境来源：
- 技术证据：
- 公开社区信号：
- 反证与补缺：

### 来源覆盖

| 来源层 | attempted/not_applicable | 有效来源 | 说明 |
|---|---|---:|---|
| 英文一手来源 | attempted | 0 | ... |

### 收口记录

- 最后一轮反证检索：
- 未解决缺口：
- 状态判定理由：
```

For hotspot discovery, add this exact table:

```markdown
### 热点候选

| 候选 | 总分 | 传播广度 | 增长速度 | 公开互动 | 中文相关性 | 事件影响 | 可核实性 | 证据门 | 传播原因 | 意义 | 证据 IDs | 核实风险 |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|
| ... | 0 | 0 | 0 | 0 | 0 | 0 | 0 | passed/failed | ... | ... | SRC-... | ... |
```

## 4. Source Notes Template

The file title is `# 来源笔记`. Append this structure for every run:

```markdown
## RUN-YYYYMMDD-HHmmss

- 状态：in_progress | complete | partial | blocked

### 检索日志

| Query ID | 时间 | 语言 | 目的 | 查询 | 结果与处理 |
|---|---|---|---|---|---|
| QRY-RUN-...-001 | ... | en | 一手来源 | ... | selected SRC-... |

### 来源索引

| Source ID | 类型 | 标题 | 发布者/作者 | 发布/更新日期 | 访问日期 | 语言 | 独立来源组 | 来源定位 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| SRC-RUN-...-001 | primary | ... | ... | ... | ... | en | ORIGIN-001 | https://... | fetched |

### SRC-RUN-YYYYMMDD-HHmmss-001 — 来源标题

- 来源类型：primary | independent-secondary | expert | community | lead
- 发布者/作者：
- 发布日期：YYYY-MM-DD | unknown
- 更新日期：YYYY-MM-DD | not_shown
- 访问日期：YYYY-MM-DD
- 来源定位：https://... | /absolute/local/path
- 语言：en | zh | other
- 独立来源组：ORIGIN-###
- 抓取状态：fetched | blocked | snippet_only
- 相关主张：CLM-... | none_yet

#### 相关性

...

#### 原文证据与定位

> 仅保留用于核实所必需的最短原文片段。

- 定位：section/paragraph/page/commit/issue/timestamp

#### 中文释义

...

#### 核实限制

...

#### 视觉素材线索

- 原始页面：
- 创作者/权属线索：unknown | ...
- 内容说明：
- 建议用途：
- 下载状态：not_downloaded
```

Keep blocked and snippet-only sources in the index so gaps remain auditable. Never add invented metadata; use `unknown` or `not_shown`.

Use a canonical URL for a web source and an absolute path for a local file. Never invent a URL for a local file. The enclosing `## RUN-...` section supplies the Run ID, which is also encoded in every full Source ID and Claim ID.

## 5. Editorial Brief Template

The file title is `# 编辑调研简报`. Append this structure for every run:

```markdown
## RUN-YYYYMMDD-HHmmss

- 状态：in_progress | complete | partial | blocked
- 截止时间：YYYY-MM-DD HH:mm:ss +TZ
- 可继续下游写作：yes | no
- Ready 主张数：0

### 主张账本

| Claim ID | 主张 | 类型 | 证据等级 | 使用门禁 | 支持来源 | 冲突来源 | as_of/事件日期 | 范围/定义/关键限定 | 限制与允许表述 |
|---|---|---|---|---|---|---|---|---|---|
| CLM-RUN-...-001 | ... | event | L3 | ready | SRC-... | — | YYYY-MM-DD | ... | ... |

### 事件概览

...

### 已核实时间线

- YYYY-MM-DD：... [CLM-...; SRC-...]

### 事实与关键数据

- ... [CLM-...; SRC-...]

### 引语、论文与技术证据

- ... [CLM-...; SRC-...]

### 观点分歧与限制

- ... [CLM-...; SRC-...]

### 公开反应

- ... [CLM-...; SRC-...]

### 为什么重要

- ... [CLM-...; SRC-...]

### 可写角度

- 角度：...
  - 支撑主张：CLM-...
  - 不得越过的限制：...

### 视觉素材线索

- ... [SRC-...]

### 缺口与不可使用内容

- caveat：...
- do_not_use：...

### 下游使用门禁

- 可断言的 ready 主张：CLM-...
- 仅可作为不确定性提及的 caveat：CLM-...
- 禁止传递的 do_not_use：CLM-...
- 必须继承的限制：...
```

Set `可继续下游写作` to `yes` only when the original request includes writing and at least one claim is `ready`. A `partial` run may continue under that rule. Set it to `no` for research-only requests, hotspot discovery awaiting selection, blocked runs, and runs with zero ready claims.

## 6. Completion Self-Check

Before changing the run from `in_progress`, verify every item:

- All three files contain the same run ID and final status.
- Every query, source, and claim ID is unique within the run.
- Every claim source ID resolves to a source section in `01-source-notes.md`.
- Every factual bullet in `02-editorial-brief.md` cites a claim and source ID.
- Every selected source has a canonical URL or absolute local path, access date, identity, type, language, and capture status.
- Every English evidence excerpt has a Chinese explanation.
- Every `ready` claim satisfies its claim-type `L3` rule.
- Every conflict and blocked source remains visible.
- No `do_not_use` item is asserted as fact or included in the ready handoff.
- Visual leads are linked but not downloaded.
- The completion reason and unresolved gaps are explicit.

If any item fails, keep the run `in_progress` while correcting it. If the item cannot be corrected with permitted evidence, mark the run `partial` or `blocked` and state why; never claim `complete`.

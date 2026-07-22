---
name: content-production
display_name: Multiplatform Content Production Workflow
display_name_zh: 多平台内容工作流
version: 0.1.0
author: BruceL017
updated_at: "2026-07-17"
origin: own
allow_exec: true
description: >-
  从一句话创作简述、明确题目或一份 Markdown 大纲自动编排中文多平台内容生产：完成选题与调研、证据化大纲、A/B 母稿、公众号/小红书/知乎/微博/头条十份终稿、34 个标题、五套平台配图、独立公众号封面、图片优化、公众号 HTML 和最终 QA。用于完整写作流水线、多平台内容矩阵、A/B 文风实验或一键内容生产；默认自主运行并保留可审计决策，不发布、不登录平台。Do NOT trigger when 用户只需要单篇轻量润色、只起标题、只配图、只排版、内容发布或发布后运营。
---

# Content Production

把本 Skill 当作唯一状态机和验收总控。具体能力由本地 provider Skill 执行；总控不重写 provider 的领域流程，也不允许 provider 创建第二套 run、门禁或用户确认。

## 完成定义

一次成功 run 必须交付：

- 2 份平台中立母稿。
- 5 个平台 x A/B = 10 份审校终稿。
- 精确 34 个可兑现标题候选和 5 个自动或人工选择结果。
- 5 套入选平台稿配图及优化记录。
- 1 张标题准确、`1923x818` 的公众号 PNG 封面。
- 1 份验证为零错误、零警告的公众号 clean HTML，以及浏览器预览。
- `qa.json`、`qa.md` 和人工发布交接单。

终点是本地交付包。禁止登录、创建平台草稿、排期、发布或读取发布后数据。

## 必读资源

开始新 run 或恢复旧 run 前完整读取：

1. `references/workflow.md`：入口、阶段、自动决策和恢复顺序。
2. `references/capability-contracts.md`：九个 provider 槽位与统一调用协议。
3. `references/artifact-contract.md`：目录、schema、数量和最终验收。
4. `references/editorial-policy.md`：事实、A/B、平台、标题和视觉边界。
5. `references/platform-profiles.json`：五平台画像与数量配置。

## 核心规则

- 只在 `runs/<run-id>/` 写本次产物。provider 只能写总控授权的目录。
- `run.json`、版本、门禁、失效和恢复点只由总控脚本维护。
- 所有 provider 调用都使用 `capability-contracts.md` 的 request/result envelope；不要解析 provider 面向人的普通回复来拼装产物。
- provider 未声明匹配的 `content-production-provider:*` marker，或契约检查失败时，停在初始化。
- 事实与安全 > 平台规范 > 读者画像 > B 风格 > 表达偏好。
- A/B 共享 claims、证据大纲、模型和参数。A 不读取 B 风格；B 只读取本次快照。
- 十份平台稿必须从对应 A/B 母稿生成，不从公众号稿二次派生。
- 标题只能读取审校稳定的十份终稿；内部数字评分不得成为总控接口。
- 公众号封面是独立发布资产，不进入公众号正文图片发布映射 `manifest.json`。
- `07-visual/wechat-cover/cover.json` 只记录生成、候选、视觉 QA 和源文件血缘；发布副本与压缩血缘由 package 阶段拥有。
- illustration 先保存原生 `manifest.md`；所有正文图片优化后再由 package 阶段写发布映射 `manifest.json`。封面保持 PNG 和 `1923x818`。
- image compression provider 只写 staging candidate；总控仅在 candidate 严格更小时采用，否则逐字节保留原图，并由 package 独占发布扩展名、manifest 和 schema v2 optimization。
- 图片写回五份入选 Markdown 后，最后执行公众号排版。
- 已批准或自动决定的文件禁止覆盖；修订写 `.v002`、`.v003` 并失效下游。

## 入口与运行模式

接受且只接受一个创作入口：

- `--brief <一句话>`：运行选题规划并自动选择主选题。
- `--topic <明确题目>`：跳过候选发现，仍执行深度调研。
- `--outline <Markdown 路径>`：快照大纲，仍执行事实核验和结构规范化。
- `--outline-text <粘贴的大纲>`：与大纲文件入口相同。

默认 `--run-mode autonomous`。该模式保留 `topic`、`outline`、`titles`、`visual`、`final` 五个审计门禁，但由总控根据固定规则写决策文件并立即批准，不暂停询问用户。只有用户明确要求逐阶段确认时才使用 `--run-mode reviewed`。

初始化：

```bash
cd "$SKILL_ROOT"
node scripts/init-run.mjs <slug> --brief <text> [--material <path>] [--material <path>]
node scripts/init-run.mjs <slug> --outline <path> [--material <path>]
```

粘贴大纲使用 `--outline-text`。路径或 shell 转义不可靠时，由 Agent 先在当前工作区创建输入 Markdown，再传绝对路径。

初始化返回 `BLOCKED` 时，报告 `00-intake/capabilities.json` 中的 provider 和缺失 contract marker；不要使用通用 Agent 静默替代。

## 执行方法

开始时创建任务列表，逐项列出阶段 0-10、五个门禁、当前状态和验证条件；任何时刻最多一个总控阶段为 `in_progress`。按 `workflow.md` 执行：

1. 初始化、快照入口和 provider 能力。
2. 从 brief 生成五个选题候选并决定主选题。
3. 对选题或大纲做深度调研，产出 verified claims。
4. 生成或规范化证据大纲，绑定 outline 决策。
5. 调用 drafting provider 生成 A/B 母稿和十份平台初稿。
6. 对十份稿分别调用 proofreading provider；provider 在单稿 PASS 前运行 `markdown-alignment`，总控再绑定 claims 并完成两份 regression report 与六项 semantic review。
7. 对十份终稿调用 title provider，聚合精确 34 个候选并选择五个平台赢家。
8. 只为五个赢家先生成 current policy snapshot 与五份 coverage，再按内容结构规划 `minimum..target` 张有独立正文锚点的配图；小红书固定 4-8 页且逐页覆盖。由脚本生成唯一 VisualDecision 并批准五份 plan 后，bounded-per-image 队列执行 Canary、逐图生成、Set QA 和定向重试，并与独立公众号封面共享四个生成名额，最终精确验收 22 件视觉核心产物。
9. 为全部正文图和封面生成压缩 candidate，总控按 strict-smaller 规则组装五个平台发布包；再为公众号排版创建受限 request，由 `format-content` 生成 staging clean HTML/预览，经过总控复验和晋级后才完成 package。
10. 运行确定性 QA；自主模式通过后直接完成，reviewed 模式等待 final 门禁。

阶段状态只通过脚本修改：

```bash
node scripts/inspect-run.mjs <run-dir>
node scripts/create-topic-request.mjs <run-dir>
node scripts/create-source-request.mjs <run-dir>
node scripts/create-drafting-request.mjs <run-dir> <outline|master|adapt> [--variant A|B] [--platform <id>]
node scripts/create-proofreading-request.mjs <run-dir> --platform <id> --variant <A|B>
node scripts/create-title-request.mjs <run-dir> --platform <id> --variant <A|B> [--model <id>] [--parameters-json '<json>'] [--execution-strategy parallel_subagents|sequential_fallback]
node scripts/aggregate-titles.mjs <run-dir>
node scripts/create-illustration-request.mjs <run-dir> <plan|generate> --platform <id> [--style-id <id>] [--max-images <N>] [--brand-override enabled|disabled] [--backend-hint runtime-native|configured-api|unknown] [--model-preference <id>]
node scripts/illustration-queue.mjs <run-dir> <init|dispatch|inspect>
node scripts/illustration-queue.mjs <run-dir> release --task-id <id> --reason rate_limit|transport
node scripts/create-wechat-cover-request.mjs <run-dir> [--backend-hint runtime-native|configured-api|programmatic|unknown]
node scripts/create-compression-requests.mjs <run-dir>
node scripts/assemble-publish-packs.mjs <run-dir>
node scripts/create-wechat-layout-request.mjs <run-dir>
node scripts/promote-wechat-layout.mjs <run-dir>
node scripts/check-claim-regression.mjs --before <draft.md> --after <checkpoint.md> --claims <claims.json> --phase <humanize|final> --output <report.json>
node scripts/set-semantic-review.mjs <report.json> --reviewer <id> --new-conclusion <PASS|BLOCKED> --scope-change <PASS|BLOCKED> --causal-strength <PASS|BLOCKED> --factual-addition <PASS|BLOCKED> --factual-omission <PASS|BLOCKED> --proper-noun-drift <PASS|BLOCKED>
node scripts/set-stage.mjs <run-dir> <stage> running
node scripts/set-stage.mjs <run-dir> <stage> completed --artifact <path>
node scripts/set-stage.mjs <run-dir> <stage> blocked --error <reason>
node scripts/set-gate.mjs <run-dir> <gate> approved --decision <path-or-value> --actor orchestrator --approval-mode autonomous
node scripts/check-provider-result.mjs <request.json> <result.json>
```

自主模式不得设置 `awaiting_approval`。reviewed 模式按 `workflow.md` 暂停并报告唯一待确认决策。

## 并行边界

- A/B 母稿可以并行，但必须隔离输入，且使用相同模型和参数。
- 十个平台适配任务可以并行，每个任务只能读取自己的母稿版本。
- 十份审校可以并行；单稿的三轮审校必须串行。
- 十个标题任务可以并行；同平台 A/B 使用相同模型和参数，聚合、阶段完成和门禁批准串行。
- 五个平台视觉由 bounded-per-image 队列调度：每套第 1 张 Canary PASS 前不得提交后续图片；之后全局最多 4 个、同套最多 2 个生成调用。
- visual gate 批准后，公众号封面与正文 child 共享全局 4 个名额；封面保持独立 provider，必须读取 titles gate 的公众号赢家，不接受调用方另传标题。
- 全部 child PASS 后每套串行执行 Set QA；失败必须点名 image ID，只为被点名图片创建下一 candidate，未被点名的 PASS child 继续冻结。
- 压缩 provider 首次运行可能安装固定 Sharp runtime；先串行执行一个任务完成 warm-up，再并行其余 current-attempt request。发布包聚合保持串行。

运行时没有隔离子 Agent 时记录 `sequential_fallback` 并顺序执行，不改变产物契约。

## 自动决策

自主模式只允许以下决策，不得伪造用户批准：

- `topic`：选择 `content-topics` 标记的主选题；它必须通过证据门。
- `outline`：事实核验和 schema 验证均通过后批准当前版本。
- `titles`：每个平台先排除 `promise_status != PASS`，再按风险、`recommended`、`rank`、A 优先的固定顺序选择。
- `visual`：visual stage 保持 running；五份 current-attempt plan 均为 `READY`、绑定正确正文与标题选择、样式/品牌/几何合法且无残余风险后批准，然后才创建 generate request。
- `final`：`verify-run.mjs` 返回 `READY` 后由总控批准并完成；不代表发布授权。

每次自动决策都必须保存版本化 decision 文件、actor=`orchestrator`、决策规则和输入哈希。

## 恢复与失败

- 恢复先运行 `inspect-run.mjs`，只执行返回的第一个未完成阶段。
- provider 返回 `BLOCKED` 或 `FAILED` 时，把完整 issue 写入阶段状态并从其 `resume_from` 恢复。
- 关键 claim 冲突或无来源时停在研究，不写正文。
- 标题不足 34 个时停在标题，不能用未通过事实门的候选补数。
- visual completed 或已批准计划后的 blocked visual 重新进入 running 时递增 attempt，只失效 visual 门禁、package、final QA；标题门禁和五个平台赢家保留。
- package completed 重新进入 running，或 package blocked 后重试时递增 attempt；completed 重开只失效 final QA/final 门禁，visual、titles 和五个平台赢家保留。压缩/layout controls 与发布业务文件使用 `_compression/vNNN`、`_layout/vNNN`、`.vNNN`/`images/vNNN/`。
- 任何平台配图、独立封面、优化记录、manifest、标题 H1 或 HTML 血缘不一致时，从最早失效阶段恢复。
- completed run 再次执行是只读；任何 QA 后漂移都视为阻断。

# Provider Capability Contracts v2

## 目录

- 注册与预检
- 统一调用协议
- 九个能力槽
- 阻断与安全边界

## 注册与预检

`capabilities.yaml` 使用可被 `JSON.parse` 解析的 JSON-compatible YAML。总控固定注册九个必需槽：

| ID | Provider | 必需 | Contract marker |
|---|---|---:|---|
| `topic_planning` | `content-topics` | 是 | `content-production-provider: topic-planning-v1` |
| `source_research` | `collect-sources` | 是 | `content-production-provider: source-research-v1` |
| `drafting` | `draft-content` | 是 | `content-production-provider: drafting-v1` |
| `proofreading` | `proofread-content` | 是 | `content-production-provider: proofreading-v1` |
| `title_generation` | `title-options` | 是 | `content-production-provider: title-generation-v1` |
| `illustration` | `post-illustration-images` | 是 | `content-production-provider: illustration-v1` |
| `wechat_cover` | `wechat-sketch-cover` | 是 | `content-production-provider: wechat-cover-v1` |
| `image_compression` | `compress-image` | 是 | `content-production-provider: image-compression-v1` |
| `wechat_layout` | `format-content` | 是 | `content-production-provider: wechat-layout-v1` |

预检确认配置版本、required 标志、contract ID、文件存在、marker 和 SHA-256。任一槽不可用时初始化 `BLOCKED`。

marker 只表示 provider 已实现下述 orchestrated 模式，不是装饰性字符串。没有实现接口时不得添加 marker。

## 统一调用协议

总控为每个任务创建结构化 request。provider 只读取列出的输入，只写 `output_dir`，并返回结构化 result。

```json
{
  "schema_version": 1,
  "contract": "content-production-provider/v1",
  "task_id": "proofread:<run_id>:wechat:A:attempt-001",
  "capability": "proofreading",
  "provider_contract": "proofreading-v1",
  "run_dir": "/absolute/run",
  "run_mode": "autonomous",
  "mode": "proofread",
  "platform": "wechat",
  "variant": "A",
  "inputs": [
    {"role": "draft", "path": "05-platforms/wechat/A/draft.md", "sha256": "..."}
  ],
  "output_dir": "05-platforms/wechat/A",
  "expected_artifacts": [
    "05-platforms/wechat/A/logic-final.md",
    "05-platforms/wechat/A/humanized.md",
    "05-platforms/wechat/A/final.md",
    "05-platforms/wechat/A/reviews/logic.md",
    "05-platforms/wechat/A/reviews/humanize.md",
    "05-platforms/wechat/A/reviews/detail.md",
    "05-platforms/wechat/A/reviews/proofread-result.json"
  ],
  "options": {
    "execution_strategy": "parallel_subagents",
    "model": "<model-id>",
    "parameters": {}
  },
  "interaction_policy": "return_to_orchestrator"
}
```

provider 返回：

```json
{
  "schema_version": 1,
  "contract": "content-production-provider/v1",
  "provider_contract": "proofreading-v1",
  "task_id": "proofread:<run_id>:wechat:A:attempt-001",
  "status": "PASS",
  "artifacts": [
    {"role": "logic_checkpoint", "path": "05-platforms/wechat/A/logic-final.md", "sha256": "..."},
    {"role": "humanized_checkpoint", "path": "05-platforms/wechat/A/humanized.md", "sha256": "..."},
    {"role": "final", "path": "05-platforms/wechat/A/final.md", "sha256": "..."},
    {"role": "logic_review", "path": "05-platforms/wechat/A/reviews/logic.md", "sha256": "..."},
    {"role": "humanize_review", "path": "05-platforms/wechat/A/reviews/humanize.md", "sha256": "..."},
    {"role": "detail_review", "path": "05-platforms/wechat/A/reviews/detail.md", "sha256": "..."},
    {"role": "proofread_result", "path": "05-platforms/wechat/A/reviews/proofread-result.json", "sha256": "..."}
  ],
  "checks": {"request_valid": true, "mode": "proofread"},
  "issues": [],
  "warnings": []
}
```

约束：

- `status` 只能是 `PASS|BLOCKED|FAILED`。
- issue 至少包含 `code`、`message`、`resume_from`。
- provider 不创建 run、门禁、版本决策或偏好文件，不覆盖已批准产物。
- provider 不直接向用户提问；信息不足时返回 `BLOCKED`。
- provider 不写 output_dir 外部。运行时依赖缓存是唯一例外，必须在 result 中披露。
- 总控验证 result、文件存在和哈希后才完成阶段。`check-provider-result.mjs` 输出 `contract_status` 与 `provider_status`；只有两者均为 `PASS` 时才可继续，provider 为 `BLOCKED|FAILED` 时脚本以非零退出并透传 issues。

## `topic_planning`

只用于 brief 入口。总控必须在派发前完成 request validation，并用以下命令从 `init-run` 快照确定性组包：

```bash
node scripts/create-topic-request.mjs <run-dir>
```

request 固定使用 `mode: plan`、`output_dir: 01-discovery` 和 `interaction_policy: return_to_orchestrator`。必需输入角色与路径为：

- `brief` -> `00-intake/brief.md`
- `materials` -> `00-intake/materials.json`
- `core_audience` -> `00-intake/core-audience.md`
- `platform_profiles` -> `00-intake/platform-profiles.json`
- `topic_history` -> `00-intake/topic-history.md`
- `article_audience` -> `00-intake/article-audience.md`

`materials.json` 非空时，每个 item 还必须增加一个 `material:<id>` 输入，路径为 `00-intake/<snapshot_path>`，SHA-256 同时匹配 manifest 和实际快照。provider 只读取这些逐项授权的素材，不从 manifest 的 `original_path` 回读工作区源文件。

输入 brief、素材清单与快照、核心画像、五平台画像、细分受众和历史选题。`expected_artifacts` 固定为：

- `01-discovery/discovery.md`
- `01-discovery/topic-candidates.md`
- `01-discovery/topic-candidates.json`

JSON 恰好五项，包含 `id`、`topic`、读者问题、承诺、素材匹配、时效、差异化、证据可得性、风险、`rank` 和 `recommended`。不得暴露内部数字评分。恰好一个通过事实门的候选可标记 `recommended=true`。

## `source_research`

当前 provider 保持 `collect-sources` 原有边界，只支持 AI 与相邻科技主题；不得因接入总控而静默扩展到医疗、法律、金融或其他高风险领域。超出范围时返回 `BLOCKED` 和恢复条件。

总控在 topic 门禁批准、run 进入 research 后，用确定性构建器组包并在派发前完成 provider request validation：

```bash
node scripts/create-source-request.mjs <run-dir>
```

request 固定使用 `mode: research`、`output_dir: 02-research` 和 `interaction_policy: return_to_orchestrator`。三种入口的共同输入角色为：

- `research_subject` -> `01-discovery/research-subject.json`
- `brief` -> `00-intake/brief.md`
- `materials` -> `00-intake/materials.json`
- `core_audience` -> `00-intake/core-audience.md`
- `article_audience` -> `00-intake/article-audience.md`
- `material:<id>` -> `00-intake/<snapshot_path>`

入口专属授权：brief 使用 `topic_discovery`、`topic_candidates`、`topic_decision`；topic 使用 `discovery_skip`；outline 使用 `discovery_skip` 和 `provided_outline`。provider 不读取平台画像、B 风格、历史选题或素材清单中的 `original_path`。本地读取仅限 request inputs；围绕已批准研究对象的匿名公开网页检索仍允许，但每个实际读取页面必须进入 source log。

`expected_artifacts` 恰好为：

- `02-research/brief.md`
- `02-research/source-log.md`
- `02-research/claims.json`
- `02-research/evidence-map.md`

关键 claim 使用总控 schema：稳定 ID、精确文本、`verified|conflicted|unverified|rejected`、source IDs、scope、risk、证据等级、使用门禁、as-of 和限制。至少一个 critical claim 且全部 critical claim 都为 `verified`、`L3`、`ready` 才可完成。`partial` 只有在全部 critical claim 仍满足该门槛时可 `PASS` 并记录 warning；关键 claim 不安全返回 `BLOCKED`，schema、ID、引用或四件套一致性错误返回 `FAILED`。阶段完成还会重新校验 canonical provider result 为 `PASS` 且登记的四件套哈希与磁盘一致，不能绕过 provider 状态直接推进。

## `drafting`

提供无状态 `outline|master|adapt` 三种模式。总控用同一个确定性构建器创建 13 个隔离任务：1 个 outline、A/B 各 1 个 master、五平台 x A/B 共 10 个 adapt：

```bash
node scripts/create-drafting-request.mjs <run-dir> outline
node scripts/create-drafting-request.mjs <run-dir> master --variant A --model <id> --parameters-json '<json>'
node scripts/create-drafting-request.mjs <run-dir> adapt --platform wechat --variant A --model <id> --parameters-json '<json>'
```

所有 request 固定使用 `capability: drafting`、`provider_contract: drafting-v1` 和 `interaction_policy: return_to_orchestrator`。provider 不创建嵌套 run、自有 manifest、门禁或用户确认；不得自行调研、审校终稿、起标题、配图、排版或发布。

### outline

`output_dir` 固定为 `03-outline`。共同输入角色为：

- `research_subject` -> `01-discovery/research-subject.json`
- `research_brief` -> `02-research/brief.md`
- `source_log` -> `02-research/source-log.md`
- `claims` -> `02-research/claims.json`
- `evidence_map` -> `02-research/evidence-map.md`
- `brief` -> `00-intake/brief.md`
- `core_audience` -> `00-intake/core-audience.md`
- `platform_profiles` -> `00-intake/platform-profiles.json`
- `article_audience` -> `00-intake/article-audience.md`

入口附加角色沿用已批准权威：brief 使用 `topic_candidates` 与 `topic_decision`；topic 使用 `discovery_skip`；outline 使用 `discovery_skip` 与 `provided_outline`。用户大纲只授权主题和结构意图，不覆盖 verified claims。outline 模式禁止读取 `style_b`。

首版 request 使用 `options.revision: 1`，输出恰好为 `03-outline/control-outline.md`、`03-outline/A-structure.md`、`03-outline/B-structure.md`。重开已完成的 outline 阶段时，总控保留旧版本并失效下游，再递增 revision；新 request/result 与三件套统一使用 `.vNNN`，例如 `drafting-outline.v002.request.json`、`control-outline.v002.md`，不得覆盖或混绑版本。三件 Markdown 各自必须恰好一个非空 H1。控制大纲必须覆盖全部 critical claim ID；两份 structure 必须绑定同一 control outline 路径与哈希。provider 完成后由总控独占 outline 门禁，且只能批准 completed stage 的精确三件套。

### master

每个 variant 单独 request，`output_dir` 为 `04-masters/<variant>`。共同输入仅含 `research_brief`、`claims`、`evidence_map`、active `control_outline`、对应 `structure`、`core_audience` 和 `article_audience`。B 额外且只额外读取 `style_b`；A request 出现 `style_b` 或任何 B 路径立即阻断。

每个任务输出恰好为 `final.md`、`review.md`、`provenance.json`。task ID 绑定当前 `masters` stage attempt；重开阶段后旧 request/result/provenance 无效。A/B request 的 `model` 与 `parameters` 必须完全相同；provenance 精确登记 request、输入路径/哈希、critical claim IDs、style 绑定和正文输出哈希。两份正文均为平台中立完整稿，恰好一个 H1，不含图片、HTML、标题池或下游执行声明；每篇至少 500 个排除 frontmatter、代码块、全部标题、Markdown 标记和空白后的正文可见字符及 3 个有正文的非空 H2，材料不足时通过 provider `block` 阻断而非重复填充。

### adapt

每个 `{platform,variant}` 单独 request，`output_dir` 为 `05-platforms/<platform>/<variant>`。只授权对应 `source_master`、该母稿 `master_provenance`、`core_audience`、`platform_profiles`、`article_audience`，以及构建器确定性预生成且只读的 `audience_snapshot`、`audience_manifest`；B 额外读取 `style_b`。禁止读取另一 variant、claims、evidence map、control outline或其他平台稿，避免从母稿之外补回事实。

每个任务登记恰好为 `draft.md`、`audience-snapshot.md`、`audience-snapshot.json`、`provenance.json`。task ID 绑定当前 `platforms` stage attempt；重开阶段后旧 request/result/provenance 无效。画像由构建器固定按 `core_audience -> platform_overlay -> article_segment` 合并并在 request 创建前落盘；同平台 A/B 的 Markdown 因此字节一致，worker 只生成正文与 provenance，不能让 B 风格进入画像。provenance 绑定对应母稿、母稿 provenance、画像、style 和自身输出哈希。十份稿必须直接从对应母稿适配，恰好一个 H1，不得由公众号稿二次派生。

防空壳门槛固定为：wechat、zhihu、toutiao 至少 350 个排除标题后的正文可见字符和 3 个有正文的非空 H2；weibo 至少 80 个排除标题后的正文可见字符；xiaohongshu 发布正文至少 180 个可见字符，6-9 页卡片每页至少 20 个可见字符，并有 5-8 个唯一标签。门槛不授权注水；合法 request 的可用事实不足时调用 provider `block` 写 canonical `BLOCKED` result。

构建 request 前必须先把对应 stage 设为 `running`。三类阶段只有在 canonical request/result 均为真实文件、result=`PASS`、产物集合精确且所有哈希和语义检查通过后才可 completed。无效 request、request input 漂移、输入不足或无法守住事实边界返回 `BLOCKED`；输出侧 schema、路径、哈希、血缘、完整度或产物错误返回 `FAILED`。

## `proofreading`

公开 provider contract 保持 `proofreading-v1`；新 run 的 capability 快照必须额外声明
`profile: markdown-alignment`。缺少该 profile 的旧 completed run 只读兼容，不再创建或恢复任务。

总控把 `editing` 设为 running 后，为五平台 x A/B 确定性创建十个任务：

```bash
node scripts/create-proofreading-request.mjs <run-dir> --platform <id> --variant <A|B> --model <id> --parameters-json '<json>'
```

每个 request 的 task ID 绑定当前 `editing` attempt。唯一授权 input 是该分支已由 completed
`platforms` stage 哈希绑定的 `draft.md`；provider 不读取 claims、研究、大纲、母稿、受众画像、
`style_b`、另一 variant 或其他平台稿。`output_dir` 固定为同一分支，canonical controls 是
`reviews/proofreading.request.json` 与 `reviews/proofreading.result.json`，不计入阶段内容产物。
同平台 A/B request 的 `model` 和 `parameters` 必须完全相同；canonical result 用 `request_sha256`
绑定 request 文件，执行后修改 request 不能复用旧 result。

Provider 禁止覆盖输入 `draft.md`，依次输出 `logic-final.md`、`humanized.md`、`final.md`、三份对应
review 和 `reviews/proofread-result.json`，恰好七件。三份 review 逐轮绑定输入、输出路径和 SHA-256。
每份 review 除 frontmatter 与唯一 H1 外必须有可见检查正文。
结构化 result 绑定 task、原 draft、三个 checkpoint、三份 review、八项 hard gate、三轮摘要和
1-24 完整 humanizer ledger；schema 字段精确，不得包含内部评分。干净稿允许三个 checkpoint 字节相同。

Provider finalize 在写 PASS 前使用共享 `markdown-alignment-1` 引擎，以原始 `draft.md` 为基线检查
`humanized.md` 与 `final.md`；失败立即返回具体 platform、variant、phase 和 blocker。Provider 不读取
claims。Provider 完成后，总控以原始 `draft.md` 为唯一 novelty 基线，分别执行
`draft.md -> humanized.md` 与 `draft.md -> final.md` 两次 claim regression；canonical
`claims.json` 只用于报告绑定和语义核对，不授权加入原稿没有的事实。两份 automatic report 通过后，
总控独立记录 `new_conclusion|scope_change|causal_strength|factual_addition|factual_omission|proper_noun_drift`
semantic review，并要求非空 reviewer 和有效 reviewed_at。任一新增数字、经历、引语、效果、事实、
结论、范围或因果强度，事实遗漏、专名漂移或删除限定词，均阻断。

报告记录 `engine_version` 和 `alignment_status`。只有 before、after、claims SHA-256 与 engine version
四项完全一致时，`set-semantic-review.mjs --reuse-from <report>` 才能复用 PASS 审查，并在目标报告记录
`review_mode=reused`、来源路径与来源 SHA-256。

`editing` completed 必须精确绑定每任务七件 provider 产物和两件总控 regression，共 `10 x 9 = 90`
件，并重新验证 canonical request/result、attempt、输入/输出哈希、标题/frontmatter/受保护字面、
Markdown 语义、完整度、proofread result 及两类回归。重开 editing 时 attempt 递增，旧 request/result
失效，titles 及全部下游 stage/gate 同步失效。completed editing 只能通过 `running` 重开，不能先降级
再复用旧 90 件绑定。request/input 漂移或作者依赖返回 `BLOCKED`；输出侧
schema、路径、哈希、保真或产物错误返回 `FAILED`。

## `title_generation`

总控把 `titles` 设为 running 后，为五平台 x A/B 确定性创建十个任务：

```bash
node scripts/create-title-request.mjs <run-dir> --platform <id> --variant <A|B> --model <id> --parameters-json '<json>'
```

每个 task ID 绑定当前 titles attempt。前置 editing 必须保留并通过精确 90 件完成包校验；唯一授权 input 是对应
`05-platforms/<platform>/<variant>/final.md`；provider 不读取另一分支、其他平台稿、claims、旧标题、
品牌参考或工作区其他文件，也不改写终稿。`output_dir` 固定为
`06-selection/providers/<platform>/<variant>`，其中 canonical controls 是
`title-generation.request.json` 和 `title-generation.result.json`，唯一业务产物是 `candidates.json`。
同平台 A/B request 的 `model` 和 `parameters` 必须完全相同；result 用 `request_sha256` 绑定 request。
request 固定使用 `mode=generate_titles`、`language=zh-CN`、`titles_only=true`、`old_title=null`、
`brand_reference=null` 和 `verification_scope=none`。

provider 先执行自身 `validate-request`，沿用原有单平台、无旧标题流程，只把通过事实门的候选写入
`candidates.json`，再执行 `finalize`。该文件顶层精确包含
`schema_version,task_id,status,platform,variant,source,target_count,recommendation_count,candidates`；
每项精确包含：

- `id`、`title`、`rank`、`strategy_id`、`recommended`
- `promise_map`、`promise_status`
- `risk`、`topic_phrase`

rank 精确为 `1..N`，ID 精确为 `<platform>-<variant>-<rank>`，strategy 只能使用原 title system 的
14 个 canonical ID。每条 `promise_map` 必须是当前终稿文件中逐字存在且非重复的文本锚点；交付项全部为 `PASS`，推荐数精确为
`min(3, N)`。公众号标题必须含汉字、单行且为 2-35 个非空白字符。微博 `title` 是下游 H1 使用的
单行 hook，`topic_phrase` 单独为一个内文 4-32 字符的 `#...#`；其他平台该字段为 null。

不得输出内部 score、rating、grade、profile、lane、公式、淘汰池或推理字段。候选不足目标数量时
调用 provider `block` 返回 `BLOCKED`，不得用事实门失败项补数或返回部分结果。没有 provider marker
时，`title-options` 继续按原独立对话工作流运行，不创建总控文件。

十个任务 PASS 后，`aggregate-titles.mjs` 校验 controls、attempt、输入和产物哈希、A/B 参数、schema
与数量，聚合精确 34 个并生成 titles、matrix 和 proposed selection。titles completed 精确绑定十份
candidate 加两份 aggregate，共 12 件；selection 只作为同版本 titles 门禁 decision。重开 titles 后
attempt 递增，旧 controls 无效，titles 门禁和全部视觉下游失效。

## `illustration`

必须保留 `post-illustration-images` 原独立对话流程；只有 request 使用 `content-production-provider/v1`、`provider_contract=illustration-v1` 时进入无状态 provider 路由。支持总控 `wechat|xiaohongshu|zhihu|weibo|toutiao`，其中 request 的 `provider_platform` 将 `xiaohongshu` 映射为 `xhs`。

总控为每个 winner 创建两个隔离任务：

```bash
node scripts/create-illustration-request.mjs <run-dir> plan --platform <id>
node scripts/create-illustration-request.mjs <run-dir> generate --platform <id>
```

request 固定包含 current visual attempt、canonical platform、provider alias、winner 全对象及以下唯一授权输入：

- plan：`final_draft`、titles gate 的 `title_selection` decision。
- generate：上述两项，加 visual gate 已批准的 `illustration_plan`、`shot_list`。

plan 只输出 current-attempt `plan[.vNNN].json` 与 `shot-list[.vNNN].md`，禁止出现 current-attempt prompts/images。计划必须选择注册 style，解析品牌策略与 `gpt-image-2` 几何，锚点逐字存在于 winner 正文；`max_images` 是上限，不是填充配额。

visual gate 在 stage 仍 running 时精确绑定五份 plan 与五份 shot-list。批准后仍停留在 visual，generate 才可创建。generate 的 expected artifacts 从已批准计划的 image IDs、artifact format 和品牌状态确定，输出：

- `bundle[.vNNN].json`
- provider 原生 `manifest[.vNNN].md`
- 每图一个 prompt
- 品牌启用时每图一份 unbranded source 和一份 branded delivery；关闭时只交付 native image

每图 content/style/set QA 必须 `pass`；品牌启用时 brand QA=`pass` 且 overlay=`applied`，关闭时使用对应的 `disabled-by-user|disabled-by-style-default`。生成尝试为 1-3，原生尺寸和宽高比通过 Style Spec，禁止 resize/crop/pad/stretch，residual risk 必须 `none`。PASS result 精确绑定 request 列出的全部动态产物，禁止额外 current-attempt prompt/image、软链接、目录逃逸或哈希漂移。

illustration 部分在 visual completed 中绑定五个平台各四个核心业务文件，共 20 件；动态 prompts/images 由 bundle 递归验收。`manifest.md` 属于 illustration provider。发布映射 `manifest.json` 由 package 阶段生成，provider 不创建或覆盖它。公众号此槽只生成正文图；发布封面由 `wechat_cover` 独占。总 visual 完成包还必须加入当前 attempt 的封面 PNG 与 metadata，共 22 件。

## `wechat_cover`

必须保留 `wechat-sketch-cover` 原独立工作流；只有 request 使用 `content-production-provider/v1`、`provider_contract=wechat-cover-v1` 时进入无状态 provider 路由。visual gate 批准后由总控创建任务：

```bash
node scripts/create-wechat-cover-request.mjs <run-dir> [--backend-hint runtime-native|configured-api|programmatic|unknown]
```

request 绑定 current visual attempt、titles gate decision、公众号 winner 全对象及其 `final.md` 路径/哈希。标题只接受含汉字、一个逻辑行、2-35 个非空白字符；调用方不能另传标题。固定输出为 current-attempt `cover[.vNNN].png` 与 `cover[.vNNN].json`，固定样式 `warm-hand-drawn-notebook-v1`、尺寸 `1923x818`、PNG、最多三次、逐候选执行，且 `best_effort_allowed=false`。

provider 可在授权目录写 current-attempt `source[.vNNN].md`、prompts、normalized candidates 和 canonical result。每个候选必须是完整可解码的 `1923x818 PNG`；最终 cover 与入选候选字节一致。十项视觉门必须全部 PASS，无额外可读文字、绝对失败或可见标题缺陷，residual risk=`none`。

标题准确性证据固定为 `provider_observed_exact`：expected/observed title 均等于 approved winner，视觉检查记录绑定最终 cover SHA-256、reviewer 和时间，同时显式记录 `ocr_status=not_performed` 及能力限制。总控验证选择、路径、哈希、尺寸、资源、候选、QA 和 result 血缘，但不得宣称完成了确定性 OCR。

独立模式仍可在三次尝试后返回自身 `BEST_EFFORT`；provider 模式将其映射为 `BLOCKED`，不写 canonical cover/metadata。visual completed 精确绑定 illustration 的 20 件核心文件加当前 cover PNG/metadata 两件。`cover.json` 只拥有生成与视觉 QA 血缘，不得包含 package 阶段的 publish path/hash 或 optimization；发布副本和压缩记录由下一个能力槽负责。

## `image_compression`

必须保留 `compress-image` 的独立单文件/目录、recursive 和显式 replace 流程；只有 request 使用 `content-production-provider/v1`、`provider_contract=image-compression-v1` 时进入单图 provider 路由。package running 后总控批量创建 current-attempt request：

```bash
node scripts/create-compression-requests.mjs <run-dir>
```

每项 task ID 为 `image-compression:<run-id>:<platform>:<variant>:<asset-id>:package-NNN`，唯一 input 是从 current visual bundle 或 cover metadata 派生的 `source_image` 路径/哈希。controls 与 candidate 固定在 `08-publish-pack/_compression[/vNNN]/<platform>/<asset-id>/`。request 顶层精确绑定 attempt、platform、variant、`asset_kind=body_image|wechat_cover`、output_dir 和唯一 expected candidate。新 run 出现 capability config、`required` 或 `skill_path` 任一 current provider 标记后，即使快照残缺，缺少 current compression plan 也必须阻断 package completion，不能静默改走 legacy package。

正文 options 固定为 WebP、quality 80、`lossless=false`；封面固定 PNG、quality null、`lossless=true`。两者都要求 `preserve_source=true`、`preserve_display_dimensions=true`、`selection_policy=strictly-smaller-else-source`。provider 模式禁止目录、recursive、replace、额外输入、symlink、逃逸、既有 candidate/result 和 source/output alias。

child `execute` 必须调用原 deterministic CLI，并返回一个 `compressed_candidate`。result 用 `request_sha256` 绑定 request；`compression.source|candidate` 精确记录 path、SHA-256、bytes、解码格式和 EXIF 朝向归一化后的尺寸，另记录 source unchanged、dimensions preserved、saved bytes/percent 和 recommended selection。只有 candidate 严格更小时推荐 candidate 且 warnings 为空；否则 PASS 必须且只能包含一个 `compression_candidate_not_smaller` warning 并推荐 source。总控按同一精确规则复验。

provider 不拥有最终发布选择。总控运行：

```bash
node scripts/assemble-publish-packs.mjs <run-dir>
```

总控独立重算 strict-smaller。选 candidate 时发布文件与 candidate 字节一致；否则与 source 字节一致并保留其真实 `png|jpeg|webp` 格式，JPEG 统一发布为 `.jpg`。封面 source/candidate/publish 必须是 `1923x818 PNG`。总控生成 schema v2 optimization、manifest、metadata 和 final Markdown；provider 不创建或覆盖这些文件。

## `wechat_layout`

必须保留 `format-content` 的独立 Markdown 输入、固定红白主题、原输出命名和八阶段流程；只有 request 使用 `content-production-provider/v1`、`provider_contract=wechat-layout-v1` 时进入 provider 路由。package 形成 current `N+21` pre-layout 业务产物后运行：

```bash
node scripts/create-wechat-layout-request.mjs <run-dir>
```

request 精确绑定 current `08-publish-pack/wechat/final[.vNNN].md` 与 `07-visual/wechat/manifest[.vNNN].json`，以及 child 的 SKILL、theme、common components、validator、wrapper、preview template 和 provider script 七项资源哈希。controls 固定在 `08-publish-pack/_layout[/vNNN]/`，唯一允许 Agent 写入的候选是 `staging/article.html`；provider 复用原 validator/wrapper 生成 `staging/article-preview.html` 和 canonical result。普通独立模式的两个文件不能冒充 provider 结果。

执行 child 时先运行 `python3 <format-content-root>/scripts/provider_contract.py validate-request <request.json>`，Agent 按固定主题写完唯一 clean candidate 后运行 `python3 <format-content-root>/scripts/provider_contract.py finalize <request.json>`。需要上游修订时使用 `block`，不得自行改 request 或业务发布文件。

随后运行：

```bash
node scripts/promote-wechat-layout.mjs <run-dir>
```

总控独立重算全部内容门禁，通过后才写业务输出：

- `article[.vNNN].html`：与 staging clean 字节一致的单一 `<section>` 片段。
- `article-preview[.vNNN].html`：由绑定 template 重建、仅嵌入一次 clean 字节的复制预览。
- `layout-result[.vNNN].json`：总控生成的 schema v2 输入、provider、输出和验证血缘。

成功要求原 validator errors=0、warnings=0；标签/属性/CSS/URL 通过安全白名单；除 H1 外正文块 100% 按源顺序出现；HTML 图片引用与 manifest 为精确多重集合且文件/哈希有效；代码区外无作者、媒体或模板占位符。作者未知时省略身份/署名行，但保留文章 CTA。任何 current provider 标记、request/result/staging 残缺或资源漂移都阻断，不能降级到旧 schema v1 路径。

## 阻断与安全边界

- 子 skill 普通模式的输出或回复不能冒充 provider result。
- 不兼容的目录所有权、额外确认或输出 schema 必须先在该子 skill 增加 orchestrated 模式。
- provider 缺失不得由总控临时生成同类产物绕过。
- 所有发布、账号、凭证、排期和发布后数据能力均越界。

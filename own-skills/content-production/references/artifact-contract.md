# Artifact Contract v2

所有路径相对 `runs/<run-id>/`。平台只能是 `wechat|xiaohongshu|zhihu|weibo|toutiao`，版本只能是 `A|B`。

## 目录与数量

| 路径 | 必需产物 |
|---|---|
| `run.json` | schema v2、状态、模式、provider、快照、阶段、门禁、恢复点 |
| `00-intake/` | `brief.md`、`materials.json`、画像、B 风格、能力快照、`raw/` |
| `01-discovery/` | brief 入口三件套；topic/outline 入口 `skip.json` |
| `02-research/` | 四件交付：`brief.md`、`source-log.md`、`claims.json`、`evidence-map.md`；另含内部 request/result 控制文件 |
| `03-outline/` | control outline、A/B structure |
| `04-masters/A|B/` | 各 `final.md`、`review.md`、`provenance.json` |
| `05-platforms/<platform>/A|B/` | 十份 draft、checkpoint、final、review、画像与 provenance |
| `06-selection/` | 十个 provider `candidates.json`、`titles.json`、`title-matrix.md`、selection decision |
| `07-visual/<platform>/` | 五套 plan、shot list、bounded child controls、Set QA、bundle、provider 原生 `manifest.md`、prompts、images；package 阶段另写发布映射 `manifest.json` |
| `07-visual/wechat-cover/` | current-attempt request/result、`source.md`、prompts、candidates、`cover.png`、`cover.json` |
| `08-publish-pack/<platform>/` | 五份 `final.md`、metadata、optimization、images |
| `08-publish-pack/wechat/` | 另含 `cover.png`、`article.html`、`article-preview.html`、`layout-result.json` |
| `08-publish-pack/_compression/` | current package attempt 的 plan、单图 request/result 与 staging candidates；不属于发布正文图片集合 |
| `08-publish-pack/_layout/` | current package attempt 的 layout request/result 与 staging clean/preview；不直接进入 package stage binding |
| `09-qa/` | `qa.json`、`qa.md`、`handoff.md` |

完成数量：2 母稿、10 平台终稿、34 标题、5 图文发布包、5 套非空配图、1 张公众号封面、1 份公众号 clean HTML。

## `run.json`

```json
{
  "schema_version": 2,
  "run_id": "YYYY-MM-DD-slug",
  "run_mode": "autonomous|reviewed",
  "input_mode": "brief|topic|outline",
  "status": "running|awaiting_approval|blocked|completed",
  "current_stage": "...",
  "capabilities": {},
  "snapshots": {},
  "stages": {},
  "gates": {},
  "platform_selections": {},
  "resume": {},
  "invalidations": [],
  "history": []
}
```

门禁只能是 `topic|outline|titles|visual|final`。每次批准保存 decision、bound artifacts、SHA-256、actor、approval mode 和时间。自主模式 actor 为 `orchestrator`，不能伪造 `user`。

必需快照：`brief`、`core_audience`、`platform_profiles`、`style_b`、`materials`、`topic_history`、`article_audience`、`capabilities`。输入文件和 provider 文件都记录源路径与 SHA-256。

## 选题与研究

`topic-candidates.json` 根为 `{ "candidates": [...] }`，恰好五项：

```json
{
  "id": "t-001",
  "topic": "...",
  "reader_problem": "...",
  "core_promise": "...",
  "material_fit": "high|medium|low",
  "timeliness": "...",
  "differentiation": "...",
  "evidence_availability": "high|medium|low",
  "risk": "none|low|medium|high",
  "rank": 1,
  "recommended": true
}
```

不得要求或暴露 provider 内部数字分数。brief 入口必须绑定版本化 topic decision；topic/outline 入口绑定 skip 记录。

`claims.json`：

```json
{
  "schema_version": 1,
  "research_status": "complete|partial",
  "claims": [{
    "id": "c-001",
    "text": "可独立核对的主张",
    "critical": true,
    "status": "verified|conflicted|unverified|rejected",
    "source_ids": ["s-001"],
    "scope": "适用边界",
    "risk": "none|low|medium|high",
    "evidence_level": "L0|L1|L2|L3",
    "use_gate": "ready|caveat|do_not_use",
    "as_of": "YYYY-MM-DD|unknown",
    "limitations": []
  }]
}
```

所有 critical claim 必须 verified、`L3/ready`、有 source ID、出现在 source log、evidence map 和 active outline。研究阶段完成时四件套必须同时绑定并通过语义校验，且 `02-research/source-research.request.json` 与 `provider-result.json` 必须匹配、result 为 `PASS`、产物哈希未漂移；安全的 `partial` 只允许留下非 critical 缺口。

## 母稿与平台稿

大纲阶段绑定恰好三件同版本内容产物，并保留首版 `03-outline/drafting-outline.request.json` / `drafting-outline.result.json` 或修订版 `drafting-outline.vNNN.request.json` / `drafting-outline.vNNN.result.json`。每个 master 目录保留 `drafting-master.request.json` 与 `drafting-master.result.json`；每个平台分支目录保留 `drafting-adapt.request.json` 与 `drafting-adapt.result.json`。这些 controls 不计入阶段内容产物数量，但阶段完成时必须存在、为真实文件、匹配 task 且 result 为 `PASS`。

母稿阶段绑定恰好 2 x 3 = 6 件内容产物。provenance 必须记录相同 model/parameters、active claims/outline/structure 路径与哈希。A 的 `style_b` 路径和哈希均为 null；B 必须绑定 `00-intake/style-b.md`。

平台适配阶段绑定恰好 5 x 2 x 4 = 40 件内容产物；每个分支先产出以下四件，再由 proofreading 增加 checkpoint 和 review：

```text
draft.md
audience-snapshot.md
audience-snapshot.json
provenance.json
```

每个 `05-platforms/<platform>/<variant>/` 至少包含：

```text
draft.md
logic-final.md
humanized.md
final.md
audience-snapshot.md
audience-snapshot.json
provenance.json
reviews/logic.md
reviews/humanize.md
reviews/detail.md
reviews/proofread-result.json
reviews/claim-regression-humanize.json
reviews/claim-regression-final.json
```

每个分支另保留 canonical controls `reviews/proofreading.request.json` 和
`reviews/proofreading.result.json`；controls 不计入阶段内容产物，但完成时必须匹配当前 editing attempt、
provider status=`PASS`、`request_sha256` 匹配且七件 provider 产物哈希未漂移。同平台 A/B request 的
模型和参数必须一致。

proofreading provider 负责三个 checkpoint、三份 review 和 `proofread-result.json`，恰好七件；总控
regression 以原始 `draft.md` 为 before，比较 `draft -> humanized` 与 `draft -> final`，并要求
三份 review 均有可见检查正文，结构化 result 使用精确 schema，automatic 和 semantic review 均
PASS。使用 `markdown-alignment` profile 的报告还必须绑定 `engine_version=markdown-alignment-1` 与
`IDENTICAL|ALIGNED` 状态；语义审查复用必须绑定同一四项哈希/engine 元组和来源报告哈希。
editing stage 精确绑定 `5 x 2 x (7 + 2) = 90` 件内容与
回归产物。所有绑定和完成态 QA 指纹都必须指向 run 内真实普通文件。重开 editing 后旧 attempt 的
controls 和 90 件绑定不能直接复用。

`audience-snapshot.json` 固定合并顺序：`core_audience -> platform_overlay -> article_segment`，每层记录 path、SHA-256 和平台画像版本。platform provenance 必须指向同版本母稿。

## 标题与选择

每个 `{platform,variant}` 使用独立目录
`06-selection/providers/<platform>/<variant>/`，其中 `candidates.json` 是唯一业务产物，
`title-generation.request.json` 与 `title-generation.result.json` 是 canonical controls。request 只绑定对应
终稿；result 必须为当前 attempt 的 PASS，并以 `request_sha256` 和 artifact SHA-256 绑定 request 与候选。

`titles.json` 每组精确记录 `task_id`、request/result/candidate 的 path/hash、`draft_path`、
`draft_sha256` 和 candidates。候选字段不可增减：

```json
{
  "id": "wechat-A-1",
  "title": "标题正文",
  "rank": 1,
  "strategy_id": "EVIDENCE_LED",
  "recommended": true,
  "promise_map": ["终稿文件中逐字存在的文本锚点"],
  "promise_status": "PASS",
  "risk": "low",
  "topic_phrase": null
}
```

同组 ID 必须为 `<platform>-<variant>-<rank>`，rank 精确连续为 `1..N`，标题文本唯一；strategy 只能是
title system 的 14 个 canonical ID。所有候选均为 `promise_status=PASS`，每个 promise anchor 必须逐字
存在于绑定终稿文件，推荐数精确为 `min(3, N)`。禁止写内部 score、rating、grade、profile、lane、公式、
淘汰池或推理字段。公众号标题必须含汉字、单行、2-35 个非空白字符。

微博候选的 `title` 是单行 hook 且不得含 `#`；`topic_phrase` 单独保存一个内文 4-32 字符的
`#...#`。其他平台 `topic_phrase` 必须为 null。

| 平台 | 每版本 | A+B |
|---|---:|---:|
| wechat | 3 | 6 |
| xiaohongshu | 5 | 10 |
| zhihu | 3 | 6 |
| weibo | 2 | 4 |
| toutiao | 4 | 8 |
| 合计 | 17 | 34 |

首个 titles attempt 输出 `titles.json`、`title-matrix.md`、`selection.v001.json`；后续 attempt 输出
`titles.vNNN.json`、`title-matrix.vNNN.md`、`selection.vNNN.json`。titles stage 精确绑定十份
`candidates.json` 加 titles/matrix 两份 aggregate，共 12 件真实普通文件；selection 是门禁 decision，
不计入阶段内容产物。

`selection.vNNN.json` 恰好五项，每项保存 platform、variant、title ID/text、`topic_phrase`、draft
path/hash 和 decision rule，并绑定同版本 titles path/hash。标题必须属于同平台同版本且
`promise_status=PASS`。自主选择固定按 risk、recommended、rank、A 优先排序；titles gate 只能绑定
completed stage 的同版本 titles 和 matrix。matrix 保存全部候选和确定性 proposed selection；reviewed
模式的门禁 decision 可以选择其他合法候选，但不能覆盖已完成 matrix。

发布包 `final.md` 的唯一 H1 必须等于 metadata 和入选标题，不能保留工作标题。

## 五套配图

每个 current visual attempt 先保留一份 policy snapshot 和五份 coverage。coverage 绑定 winner、titles decision 与 platform profile，记录 eligible/required units、唯一 excerpt 及 minimum/target；五个平台 cap 均为 8，小红书固定 4..8 页逐页覆盖。每平台 plan 精确绑定 coverage、注册 style、品牌策略、后端、`gpt-image-2` 几何和非空 anchors，状态必须 `READY`、residual risk=`none`。`shot-list.md` 与 plan 完全一致。唯一 VisualDecision 由脚本生成；visual gate 精确绑定五份 plan 和五份 shot-list，批准时 visual stage 仍为 running。

`bounded-per-image` generate 父 request 另绑定已批准 plan/shot-list，只授权 `bundle.json` 与 provider 原生 `manifest.md`。`07-visual/generation-queue[.vNNN].json` 登记五个平台 suite、共享全局 4/单套 2 的生成租约和独立封面占位；每图 control 位于 `children[/vNNN]/<image-id>/attempt-NN/`，Set QA 位于 `set-qa[/vNNN]/round-NN/`。child request 精确授权自己的 prompt、candidate/source、delivery 和 QA；result 绑定这些文件的哈希、真实几何和选中 attempt。

Set QA PASS 后父任务从已绑定 child result 按 plan 顺序写 `bundle.json`。bundle 精确镜像计划血缘和 image ID 顺序；每张图记录 prompt/source/delivery 路径与哈希、placement、core meaning、structure、visual metaphor、content/style/brand/set QA、原生尺寸、全部几何尝试、选中生成尝试和 residual risk。queue、child controls 与 Set QA 是递归验收控制产物，不进入 visual stage 的 22 件核心绑定。

content/style/set QA 必须 `pass`。品牌启用时 brand QA=`pass`、overlay=`applied`；品牌关闭时 brand QA 和 overlay 状态必须等于 `disabled-by-user` 或 `disabled-by-style-default`。生成尝试只能为 1-3，accepted source 与 delivery 尺寸保持一致且符合 Style Spec 比例/最短边，`native_output_preserved=true`、residual risk=`none`。

visual stage completed 精确绑定每平台 plan、shot-list、bundle、native manifest 四件共 20 件，再绑定当前 attempt 的公众号 cover PNG 与 metadata 两件，共 22 件。数量动态的 prompts/images/source/candidates 不进入 stage binding，但必须与 request expected artifacts、provider result、bundle 或 cover metadata 声明形成完全相等的集合，所有文件为 run 内真实普通文件且哈希一致。

package 阶段生成的发布映射 `manifest.json` 每项：

```json
{
  "image_id": "01-cover",
  "bundle_file": "images/01-cover.png",
  "bundle_sha256": "...",
  "publish_file": "images/01-cover.webp",
  "publish_sha256": "...",
  "markdown_ref": "images/01-cover.webp"
}
```

bundle、manifest、publish images 和 Markdown 引用集合必须一致。公众号独立封面不在该 manifest 中。

## 图片优化

provider-aware package 每个平台使用 schema v2 `optimization[.vNNN].json`。只有明确不含 current capability config、`required`/`skill_path` provider 标记且没有 current compression plan 的旧 run，才可只读兼容 schema v1；出现任一 current provider 标记后，即使快照残缺，缺少 plan 也必须阻断，不得降级或生成 v1：

```json
{
  "schema_version": 2,
  "status": "PASS",
  "package_attempt": 1,
  "platform": "wechat",
  "items": [{
    "asset_id": "01-boundary",
    "source": {"path": "07-visual/wechat/images/01-boundary.png", "sha256": "...", "bytes": 120000, "format": "png", "width": 1600, "height": 1200},
    "candidate": {"path": "08-publish-pack/_compression/wechat/01-boundary/candidate.webp", "sha256": "...", "bytes": 70000, "format": "webp", "width": 1600, "height": 1200},
    "publish": {"path": "08-publish-pack/wechat/images/01-boundary.webp", "sha256": "...", "bytes": 70000, "format": "webp", "width": 1600, "height": 1200},
    "selection": "candidate",
    "reason": "candidate_smaller",
    "request": {"path": ".../compression.request.json", "sha256": "..."},
    "result": {"path": ".../compression.result.json", "sha256": "..."}
  }],
  "cover": {
    "asset_id": "wechat-cover",
    "source": {"path": "07-visual/wechat-cover/cover.png", "sha256": "...", "bytes": 210000, "format": "png", "width": 1923, "height": 818},
    "candidate": {"path": "08-publish-pack/_compression/wechat/wechat-cover/candidate.png", "sha256": "...", "bytes": 215000, "format": "png", "width": 1923, "height": 818},
    "publish": {"path": "08-publish-pack/wechat/cover.png", "sha256": "...", "bytes": 210000, "format": "png", "width": 1923, "height": 818},
    "selection": "source",
    "reason": "candidate_not_smaller",
    "request": {"path": ".../compression.request.json", "sha256": "..."},
    "result": {"path": ".../compression.result.json", "sha256": "..."}
  }
}
```

每个正文 manifest publish file 恰好对应 `items` 一项；WeChat cover 只存在于 `cover`，不进入 manifest。总控必须重新计算 strict-smaller，publish 文件与选定 source/candidate 字节一致。candidate 更小时 reason=`candidate_smaller` 且 warnings 为空；相等或更大时，provider result 必须且只能包含一个 `compression_candidate_not_smaller` warning，selection=`source`、reason=`candidate_not_smaller`、发布 SHA/bytes 与 source 相同。正文发布格式允许 PNG、WebP，以及仅作为 source 回退的 JPEG；JPEG 扩展名统一 `.jpg`。封面始终为 `1923x818 PNG`。

package attempt 1 的 pre-layout 业务产物为 `N+21`：五份 manifest、五份 final Markdown、五份 metadata、五份 optimization、N 张正文发布图和一张封面。package 保持 running；`wechat_layout` 在 `_layout[/vNNN]/` 保存 request、provider result 和 staging 两件 HTML，总控复验后晋级三件 HTML/layout 业务产物。其完成后 package 才可精确绑定 `N+24`；controls/candidates/staging 不直接进入 stage binding。

## 独立公众号封面

`07-visual/wechat-cover/cover.json` 的字段分层摘要如下；为可读性省略了部分嵌套字段，因此该片段不是可直接提交的合法产物：

```json
{
  "schema_version": 1,
  "contract": "wechat-cover-v1",
  "task_id": "wechat-cover:<run_id>:wechat:A:attempt-001",
  "status": "PASS",
  "attempt": 1,
  "platform": "wechat",
  "variant": "A",
  "request": {"path": "07-visual/wechat-cover/wechat-cover.request.json", "sha256": "..."},
  "selection": {"platform": "wechat", "variant": "A", "title_id": "wechat-A-1", "title": "..."},
  "inputs": [],
  "style": {
    "id": "warm-hand-drawn-notebook-v1",
    "skill_file": {"path": "SKILL.md", "sha256": "..."},
    "style_spec": {"path": "references/style-spec.md", "sha256": "..."},
    "style_reference": {"path": "assets/style-reference.png", "sha256": "..."},
    "normalizer": {"path": "scripts/normalize_cover.py", "sha256": "..."}
  },
  "source": {"path": "07-visual/wechat-cover/source.md", "sha256": "..."},
  "backend": {"hint": "configured-api", "method": "...", "model": null},
  "generation": {
    "max_attempts": 3,
    "attempt_count": 1,
    "selected_attempt": 1,
    "attempts": [],
    "selected_qa": {
      "inspection": {"method": "model_visual_inspection", "artifact_sha256": "..."},
      "title_evidence": {
        "claim": "provider_observed_exact",
        "comparison": "exact",
        "evidence_class": "provider_visual_observation",
        "ocr_status": "not_performed"
      },
      "gates": {"title_accuracy": "PASS", "dimensions": "PASS"},
      "verification_limitations": ["No deterministic OCR was performed; title exactness is a provider visual observation bound to this artifact hash."]
    }
  },
  "cover": {
    "path": "07-visual/wechat-cover/cover.png",
    "sha256": "...",
    "format": "png",
    "width": 1923,
    "height": 818,
    "byte_identical": true
  },
  "residual_risk": "none"
}
```

示例省略了 selection、attempt 和十项 gate 的部分精确字段；实际 schema 不允许额外或缺失字段。生成源与入选候选必须是完整可解码的 `1923x818 PNG` 且字节一致。标题含汉字、一个逻辑行、2-35 个非空白字符。标题证据只能表述为绑定图片哈希的 provider visual observation，不能冒充 OCR。`BEST_EFFORT`、标题观察不一致、额外文字或任一视觉门失败均阻断。

该文件不包含 `publish_file`、publish hash 或 `optimization`。`08-publish-pack/wechat/cover.png` 的复制、无损优化和血缘属于 package 阶段。

## 发布包与排版

每平台 metadata 绑定 platform、variant、title ID/text、source draft、visual bundle、manifest 和 final Markdown 哈希。

公众号 `layout-result[.vNNN].json` 由总控生成；下面仅展示字段分层，实际契约要求精确键集合：

```json
{
  "schema_version": 2,
  "status": "PASS",
  "package_attempt": 1,
  "platform": "wechat",
  "variant": "A",
  "source_markdown": {"role": "source_markdown", "path": "08-publish-pack/wechat/final.md", "sha256": "..."},
  "manifest": {"role": "publish_manifest", "path": "07-visual/wechat/manifest.json", "sha256": "..."},
  "provider": {
    "contract": "wechat-layout-v1",
    "request": {"path": "08-publish-pack/_layout/wechat-layout.request.json", "sha256": "..."},
    "result": {"path": "08-publish-pack/_layout/wechat-layout.result.json", "sha256": "..."}
  },
  "clean": {"path": "08-publish-pack/wechat/article.html", "sha256": "..."},
  "preview": {"path": "08-publish-pack/wechat/article-preview.html", "sha256": "..."},
  "validation": {
    "validator_errors": 0,
    "validator_warnings": 0,
    "span_leaf_count": 42,
    "clean_fragment": true,
    "safe_html": true,
    "red_white_theme": true,
    "end_divider_count": 1,
    "cta_count": 1,
    "placeholder_count": 0,
    "source_block_count": 12,
    "preserved_source_block_count": 12,
    "source_blocks_in_order": true,
    "manifest_image_count": 3,
    "markdown_image_count": 3,
    "html_image_count": 3,
    "manifest_images_exact": true,
    "preview_embedding_count": 1,
    "preview_embedding_byte_identical": true,
    "preview_copy_button": true
  }
}
```

`article.html` 只能是单一 clean `<section>` 片段，并通过固定红白主题、安全白名单和原 validator 的零错误/零警告门禁。除 H1 外，Markdown 的段落、标题、列表项、表格行、代码和链接可见文本必须 100% 按序保留；manifest 图片引用必须精确匹配且实际文件/哈希有效。模板占位符只在代码区内允许。`article-preview.html` 必须等于绑定 preview template 注入 trimmed clean 的确定性结果，copy target 内仅出现一次相同字节。

## 最终 QA

`qa.json.counts`：

```json
{
  "masters": 2,
  "platform_finals": 10,
  "title_candidates": 34,
  "platform_image_sets": 5,
  "selected_packs": 5,
  "wechat_cover": 1,
  "wechat_html": 1
}
```

QA 绑定 run 内除 `run.json` 和 `09-qa/` 外全部文件指纹。自主模式 READY 后直接完成；reviewed 模式 final 批准前重新验证指纹。completed run 发现缺失、新增或漂移即阻断。

任何 `TODO|TBD|FIXME|待补|{{模板变量}}` 均为 blocker；`待确认` 在研究包的“限制与未知”中可作为真实不确定性表述，在其他交付中仍视为未完成占位。最终 handoff 必须明确列出十份终稿、五套配图、公众号封面、公众号 HTML，并声明人工发布。

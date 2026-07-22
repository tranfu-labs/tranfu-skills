# Content Production Workflow v2

## 目录

- 运行模式与门禁
- 阶段 0-3：入口、选题、调研、大纲
- 阶段 4-7：创作、审校、标题选择
- 阶段 8-10：视觉、发布包、QA
- 自动决策、失效与恢复

## 运行模式与门禁

平台顺序固定为 `wechat`、`xiaohongshu`、`zhihu`、`weibo`、`toutiao`；版本固定为 `A`、`B`。

五个门禁固定为 `topic`、`outline`、`titles`、`visual`、`final`。门禁是可审计决策点，不等于人工确认：

- `autonomous`：默认。总控写入 decision 文件并按固定规则批准，不中断运行。
- `reviewed`：用户明确要求逐阶段确认时使用；总控在对应门禁暂停。

provider 不得设置门禁、创建自己的 run 或直接询问用户。所有缺口返回总控。

## 阶段 0：初始化

1. 校验恰好一个入口：brief、明确 topic、Markdown 大纲文件或大纲文本。
2. 检查九个必需 provider；任一 provider 缺失或 contract marker 不符即 `BLOCKED`。
3. 创建 run，快照 brief、素材、核心画像、平台画像、B 风格、能力配置、历史选题和可选细分受众。
4. 记录 `run_mode`、`input_mode`、执行策略和所有哈希。

出口：`00-intake/` 完整，必需 provider 为 `PASS`。

## 阶段 1：采集与选题

### brief 入口

1. 运行 `create-topic-request.mjs` 从 intake 快照生成 request；provider request validation 通过后调用 `topic_planning`，输出 `discovery.md`、`topic-candidates.md` 和恰好五项的 `topic-candidates.json`。
2. 主选题必须通过事实可得性门。自主模式创建 `topic-decision.v001.json` 并批准；reviewed 模式等待用户选择。

### topic 或 outline 入口

写 `01-discovery/skip.json`。明确 topic 直接绑定 `topic`；outline 从大纲提取主题，但不得把大纲事实视为已核验。

出口：`topic` 门禁 approved。

## 阶段 2：深度调研

1. 运行 `create-source-request.mjs`，从 topic 门禁、入口权威文件和 intake 快照生成 `research-subject.json` 与 provider request。
2. 运行 `collect-sources` 的 `validate-request`；通过后调用 `source_research`。provider 不直接询问用户，也不启动热点发现。
3. provider 只写以下总控四件套：

- `02-research/brief.md`
- `02-research/source-log.md`
- `02-research/claims.json`
- `02-research/evidence-map.md`

4. 运行 provider `finalize` 和总控 `check-provider-result.mjs`；只有 `contract_status=PASS` 且 `provider_status=PASS` 才继续，`BLOCKED|FAILED` 原样停在 research。
5. 用 `set-stage.mjs` 绑定恰好四件套；它会再次要求 canonical request/result 存在、provider status 为 `PASS`、四件套哈希一致且研究包语义校验通过，之后才标记 completed。

关键 claim 必须 `verified`、`L3/ready` 且至少关联一个已定义 source ID。`partial` 研究只有在所有关键 claim 已验证、未验证项均非关键且不进入正文时才能继续；否则阻断。

出口：研究阶段 completed。

## 阶段 3：证据大纲

先把 `outline` 阶段设为 running，再运行 `create-drafting-request.mjs <run-dir> outline`，通过 provider 的 `validate-request` 后调用 `drafting` 的 outline 模式：

- brief/topic 入口生成 `control-outline.md`、`A-structure.md`、`B-structure.md`。
- outline 入口规范化用户大纲并映射 claim ID；不得改变用户主题和已授权结构意图，也不得把未验证事实重新带回大纲。

provider 只写 request 指定的同一版本三件套。首版沿用无版本文件；重新打开已完成的大纲阶段时，outline 门改为 pending、母稿及后续状态失效，下一次 request 使用 `revision + 1` 的统一 `.vNNN` 内容文件和 request/result 控制文件，旧版不得覆盖。运行 provider `finalize` 后，用 `set-stage.mjs` 绑定恰好三件套；阶段校验会再次检查 canonical request/result、全部 critical claim、structure 对 control outline 的哈希绑定和无占位符约束。

reviewed 模式要求修改已完成大纲时，把 `outline` 阶段重新设为 running。总控会把旧门禁记录进 invalidations、将 outline 门禁恢复 pending、失效 masters 及以后，并保留旧文件；新的 builder request 自动使用下一 revision 和 `.vNNN` 三件套。只有该版本完成并通过 provider 验收后，才能把同版本三件套重新批准。

自主模式在 schema、claim 和哈希检查通过后批准；reviewed 模式等待用户确认同一版本。

出口：`outline` 门禁 approved。

## 阶段 4：A/B 母稿

把 `masters` 阶段设为 running，分别运行 `create-drafting-request.mjs <run-dir> master --variant A|B`。两次调用的 task ID 都绑定当前 `masters` attempt，共享 claims、evidence map、active control outline、模型和参数，但使用隔离 request：A 的授权输入中不存在 B 风格，B 精确绑定 `00-intake/style-b.md`。重开已完成阶段会递增 attempt，旧 request/result/provenance 不能用于新 attempt。

每个 provider 输出 `final.md`、`review.md` 和 `provenance.json` 并分别 finalize。用 `set-stage.mjs` 一次绑定恰好六件套；它会校验两份 result、A/B model/parameters 相同、style 隔离、critical claim 声明及所有输入/输出哈希。

出口：两份平台中立母稿通过事实审查。

## 阶段 5：十份平台初稿

把 `platforms` 阶段设为 running，为每个 `{platform, variant}` 运行 `create-drafting-request.mjs <run-dir> adapt --platform <id> --variant <A|B>`。十个 task ID 都绑定当前 `platforms` attempt；重开已完成阶段后必须重建 request 并重新执行 provider。每个任务只读取对应母稿、母稿 provenance 和三层画像输入；B 才读取 style。禁止读取 claims、大纲、另一版本或其他平台稿，不能从母稿外补事实。

每次 builder 先确定性预生成并哈希绑定 `audience-snapshot.md` 与 `audience-snapshot.json`；provider 不得改写它们，只生成 `draft.md` 和 `provenance.json`，finalize 时把四件套一并登记。用 `set-stage.mjs` 一次绑定恰好 40 件；它会校验十份 result、对应母稿血缘、画像固定合并顺序、同平台 A/B 画像一致以及所有文件哈希。

出口：十份 `draft.md` 及血缘齐全。

## 阶段 6：十份审校终稿

把 `editing` 阶段设为 running，再为每个 `{platform,variant}` 运行
`create-proofreading-request.mjs <run-dir> --platform <id> --variant <A|B>`。每个 task ID 绑定当前
editing attempt，唯一 input 是该分支的只读 `draft.md`；十份稿可并行。

单稿内部按逻辑事实、去模板腔/平台声口、细节格式顺序执行三轮。provider 输出三个 checkpoint、
三份 review 和 `proofread-result.json`。provider finalize 在写 PASS 前先以原始 `draft.md` 检查
`humanized.md` 与 `final.md`；任一自动 blocker 立即返回当前 platform/variant，不等待其他任务。
provider 通过后，总控以原始 `draft.md` 为 before，分别对
`humanized.md`、`final.md` 运行 `check-claim-regression.mjs`。automatic PASS 后再用
`set-semantic-review.mjs` 独立记录新增结论、范围变化、因果增强、事实新增、事实遗漏和专名漂移六项
判断，并登记 reviewer 与 reviewed_at。两份报告的 before、after、claims 哈希和 engine version
完全相同时可使用 `--reuse-from` 复用并记录来源；不能用 verified claims 补入原稿没有的信息。同平台 A/B
request 必须使用相同模型和参数，provider result 必须绑定 request SHA-256。

十个任务全部完成后，用 `set-stage.mjs` 精确绑定七件 provider 产物和两件 regression report，
总计 90 件。完成门禁重新验证 request/result、原稿未覆盖、三轮血缘、保真、24 项 ledger、automatic
和 semantic review。任一新增事实、结论、范围变化或因果增强均阻断。重开 editing 后必须重建十个
request 并重新审校，旧 attempt 不能复用；completed editing 只能先进入 running 重开。

出口：十份 `final.md` 及回归报告均 `PASS`。

## 阶段 7：标题与五平台选择

把 `titles` 阶段设为 running，再为每个 `{platform,variant}` 确定性创建一个隔离任务：

```bash
node scripts/create-title-request.mjs <run-dir> --platform <id> --variant <A|B> --model <id> --parameters-json '<json>'
```

唯一 input 是 completed editing 阶段哈希绑定的对应 `final.md`，provider 不读取另一版本、其他平台稿、
claims、旧标题或品牌参考。每个任务只写
`06-selection/providers/<platform>/<variant>/candidates.json`，request/result 是同目录 canonical controls；
result 必须以 `request_sha256` 绑定当前 titles attempt。同平台 A/B 使用完全相同的模型和参数。

每版本数量固定为公众号 3、知乎 3、小红书 5、微博 2、头条 4。每个交付候选都必须
`promise_status=PASS`，`promise_map` 是当前终稿文件中逐字存在的文本锚点，推荐数精确为 `min(3, N)`；
不得交付被淘汰项或内部数字评分。微博的 `title` 只保存单行 hook，`topic_phrase` 单独保存一个
`#...#` 话题词；其他平台 `topic_phrase=null`。

十个 provider result 全部 PASS 后运行：

```bash
node scripts/aggregate-titles.mjs <run-dir>
```

总控生成当前 attempt 的 `titles[.vNNN].json`、`title-matrix[.vNNN].md` 和
`selection.vNNN.json`。首版沿用未加版本号的 titles/matrix；聚合结果必须恰好 34 个。

候选使用 `rank` 和 `recommended`，不得暴露或伪造 provider 内部数字评分。每个候选必须有正文承诺映射和事实门状态。

自主模式每个平台按以下顺序选择：

1. 仅保留 `promise_status=PASS`。
2. 风险顺序 `none < low < medium < high`。
3. `recommended=true` 优先。
4. `rank` 小者优先。
5. 完全相同时 A 优先。

用 `set-stage.mjs` 精确绑定十份 `candidates.json`、titles aggregate 和 matrix，共 12 件；selection
是门禁 decision，不计入阶段内容产物。自主模式批准确定性 selection；reviewed 模式可在同一聚合中
一次性选择五项，再批准同版本 titles/matrix 和 selection；人工选择不覆盖已完成 matrix 中保存的
确定性提案。重开 completed titles 会递增 attempt、保留旧聚合与 decision 文件、以新 attempt 重建
canonical provider 文件并拒绝旧 request/result，同时失效 titles 门禁及 visual 以后全部阶段。

出口：每个平台一个 `{variant, title_id}`，入选标题随后替换发布包 Markdown 的 H1。

## 阶段 8：五套配图与公众号封面

1. 把 `visual` 设为 running，运行 `create-visual-coverage.mjs <run-dir> --all`。总控从 titles gate 读取五个平台 winner，原子写 current policy snapshot 和五份 coverage；任一结构、唯一 excerpt、required unit、数量或跨平台检查失败时不写任何 plan request。
2. 在任何 plan request 前创建当前 attempt 的 BackendLease。用户明确指定后端时先验证指定路径；否则先判断原生生图能力，可调用即选择原生，不可调用才解析当前激活的配置后端。配置 endpoint 只按“本次任务明确设置、激活 provider 的 `base_url/openai_base_url`、进程 `OPENAI_BASE_URL`”取值；credential 只取同一 provider 的 Codex 认证上下文。`model_provider="openai"` 只表示兼容协议，不能推断服务商或官方 endpoint。
3. 配置后端只做一次非计费预检：adapter、endpoint/credential、图像模型 channel、输出路径/格式与进程清理。预检后不得再次查模型或寻找后端。Lease 与脱敏 BackendContext 不含凭证；adapter、配置或 Lease 漂移一律阻断。只允许四类后端错误：`backend configuration inaccessible`、`backend credentials unavailable to adapter`、`backend endpoint mismatch`、`backend model channel unavailable`。
4. 为五个平台分别运行 `create-illustration-request.mjs <run-dir> plan --platform <id>`。`max_images` 只从 coverage target 派生，命令行值只可作相等断言；`backend_hint` 与 `model_preference` 只可断言 Lease，不能选路。provider 消费 `final_draft`、`title_selection`、`visual_coverage`，沿用注册样式、品牌与几何规则，只输出 current plan 和 shot list。计划必须处于 minimum..target、覆盖所有 required unit、禁止重复 anchor；小红书逐页映射 4-8 张。
5. 五个 provider plan result 全部 PASS 后运行 `create-visual-decision.mjs <run-dir>`。只有该脚本生成的 current `VisualDecision` 可作为 visual gate decision；`set-gate.mjs` 在 visual 仍 running 时复算 policy、coverage、Lease、plan 和跨平台数量并精确验收十件 plan/shot-list。批准后 current stage 仍是 visual。
6. 批准后为五个平台分别运行 `create-illustration-request.mjs <run-dir> generate --platform <id>`，父 request 只授权最终 bundle/manifest；同时创建独立公众号封面 request。运行 `illustration-queue.mjs <run-dir> init` 后由 queue 派发正文 child 和封面：每套第 1 张实际图片仍是 Canary，PASS 后才派发后续图；全局最多 4 个、同套最多 2 个生成调用，封面占用同一个全局名额。
7. 每次正文图和封面生成都通过 `run-image-generation.mjs` 复用同一 Lease。原生 Lease 返回原生工具调用要求，Agent 完成后用 `--verify-existing` 复验；配置 Lease 只向固定 `image_gen.py` 子进程注入 `OPENAI_BASE_URL` 和 `OPENAI_API_KEY`，密钥不得进入 argv、Lease、BackendContext、request/result、manifest、日志或错误消息。
8. 每个 child 只授权自己的 prompt、candidate/source、同尺寸品牌 delivery、QA 和 result。Prompt preflight 检查文字 allowlist 与比例指令；candidate 读取真实 raster 格式、尺寸、比例和最短边。图片质量、文字、风格、品牌或几何失败只在已选后端创建下一 candidate；限流、超时或连接中断只重试同一后端和同一 transport attempt。已通过 child 的文件和哈希保持冻结。
9. 原生工具不可恢复的执行错误必须运行 `backend-lease.mjs <run-dir> record --outcome irrecoverable-execution-error` 阻断当前 visual attempt，禁止同 attempt 降级。总控开启下一 visual attempt 后，必须重新创建 policy、coverage、Lease、plan request/result、plan、shot list 和 decision，届时才可解析配置后端。配置后端失败不得猜 endpoint、拼接其他凭证或切换 provider。
10. 全部 child PASS 后，每套串行执行 Set QA，检查风格、颜色、密度、重复构图和叙事顺序。失败必须返回具体 image ID 和原因，只解冻被点名图片；无法定位时整套阻断。PASS 后父任务只从已验证 child result 按 plan 顺序聚合 `bundle[.vNNN].json` 与原生 `manifest[.vNNN].md`。公众号正文图不包含发布封面。
11. `wechat_cover` 保留独立模式的最多三次候选流程；provider 模式复用正文 Lease 与 BackendContext，逐候选生成和归一化，只接受十项视觉门全部 PASS 的结果。标题结论记录为绑定最终封面哈希的 `provider_observed_exact`，并显式记录 `ocr_status=not_performed`；不得把模型视觉检查表述成确定性 OCR。独立模式的 `BEST_EFFORT` 在总控中映射为 `BLOCKED`，不得写 canonical cover。
12. 用 `set-stage.mjs` 精确绑定五个平台各自的 plan、shot-list、bundle、native manifest 20 件，再绑定当前 attempt 的封面 PNG 与 `cover.json` 2 件，共 22 件。queue、child、Set QA、prompts/images/source/candidates 不直接进入 stage binding，由递归的路径、哈希、QA 和集合校验覆盖。全部通过后进入 package。

首个 visual attempt 使用无版本业务文件；重开 completed visual，或已批准计划/后端后从 blocked 重启，递增 attempt 并重建该 attempt 的 policy、coverage、BackendLease、plan controls、plan、shot list 和 decision，再使用 `.v002` controls/业务文件及 `prompts/v002`、`images/.../v002`。封面同步使用 `wechat-cover.v002.request/result.json`、`source.v002.md`、`cover.v002.png/json`、`prompts/v002/` 和 `candidates/v002/`。旧 attempt 不得覆盖或复用。已完成 legacy run 保持只读，不补写新控制工件。

出口：五套非空配图和独立公众号封面均 `PASS`。

## 阶段 9：优化、发布包与公众号 HTML

1. 把 `package` 设为 running，运行 `create-compression-requests.mjs <run-dir>`。总控只从 visual completed 的当前 22 件绑定派生任务：每张正文图一项，另加公众号封面一项；调用方不能另传 source、format 或 output。出现 capability config、`required` 或 `skill_path` 任一 current provider 标记时，缺少 current plan 必须阻断；残缺快照同样不能降级到旧 package 流程。
2. 每个 request 调用 `image_compression`。provider 只写 `_compression[/vNNN]/<platform>/<asset-id>/candidate.webp|png` 和 canonical result，不写最终发布图、manifest 或 optimization。正文固定 WebP quality 80；封面固定无损 PNG 与 `1923x818`；source 必须保持字节不变、显示尺寸不变。
3. 首次冷启动先串行执行一项以准备固定 Sharp runtime，再并行其余任务。每个 candidate 无论是否更小都保留为审计产物；candidate 相等或更大仍可为 provider PASS，并推荐 source。
4. 所有任务 PASS 后运行 `assemble-publish-packs.mjs <run-dir>`。总控重新计算 `candidate.bytes < source.bytes`，只有严格更小时采用 candidate；否则逐字节复制 source，并按真实格式使用 `.png|.jpg|.webp`。JPEG 只可能作为原图回退格式，不是 provider target。
5. assembler 生成五份 schema v2 `optimization[.vNNN].json`、发布映射 `manifest[.vNNN].json`、`metadata[.vNNN].json` 和入选 `final[.vNNN].md`，再写 N 张正文发布图与独立封面。封面记录在 WeChat `optimization.cover`，不进入正文 manifest。唯一 H1 等于入选标题，正文图按已批准 plan 的 `source_excerpt` 插入。
6. 此时形成 `N+21` 件 pre-layout 业务产物，package 必须继续保持 running。运行 `create-wechat-layout-request.mjs <run-dir>`；总控只从 current WeChat `08-publish-pack/wechat/final[.vNNN].md` 和 `07-visual/wechat/manifest[.vNNN].json` 派生 request，并把 `format-content` 的 SKILL、固定主题、组件库、validator、wrapper、preview template 和 provider script 路径/哈希全部冻结在 `resource_bindings`。
7. 运行 `python3 <format-content-root>/scripts/provider_contract.py validate-request <request.json>`；通过后由执行它的 Agent 只写 `_layout[/vNNN]/staging/article.html`，再运行同一脚本的 `finalize`。finalize 必须复用原 validator 和 wrapper，要求 errors=0、warnings=0，生成 staging preview 和 canonical result；作者未知时删除身份/署名行但保留 CTA，不允许把独立模式占位符带入总控。
8. 运行 `promote-wechat-layout.mjs <run-dir>`。总控不信任 provider 计数，重新验证安全 HTML、正文块 100% 按序保留、manifest 图片精确集合、代码区外零占位符，以及由绑定 template 重建出的 preview 只嵌入一次 trimmed clean 字节。通过后原字节晋级为 `article[.vNNN].html`、`article-preview[.vNNN].html`，并由总控写 schema v2 `layout-result[.vNNN].json`。
9. package completed 精确绑定 `N+24` 件：五组 manifest/final/metadata/optimization、N 张正文发布图、公众号封面和三件 layout 业务产物。`_compression`、`_layout` controls/candidates/staging 不直接绑定，由 schema v2 血缘递归验收。

package attempt 1 使用固定业务名、`_compression/` 和 `_layout/`；重开 completed package 或从 blocked 重试时 attempt 递增，使用 `.v002`、`images/v002/`、`_compression/v002/` 与 `_layout/v002/`，旧 attempt 不覆盖。重开 completed package 只失效 final QA/final，保留 titles、visual 和 winners。

出口：五个平台发布包、公众号封面和公众号 HTML 齐全，package 的 `N+24` 件 current-attempt 绑定通过。

## 阶段 10：最终 QA

运行 `node scripts/verify-run.mjs <run-dir>`。检查 provider 快照、claims、A/B 隔离、十份终稿、34 标题、五项选择、五套图片、优化血缘、独立封面尺寸与标题、H1、manifest、HTML 和占位符。

- `autonomous`：QA 为 `READY` 时 final 门禁由 orchestrator 批准，run 直接 `completed`。
- `reviewed`：QA 为 `READY` 时等待 final 确认。

两种模式都只生成交接单，不发布。

## 失效与恢复

- topic 变化：research 及其后失效。
- outline 变化：masters 及其后失效。
- 重开 titles 或更改入选版本：titles 门禁恢复 pending，visual 及其后失效。
- visual 重开：visual 门禁、图片、封面、优化、排版和 QA 失效；titles 门禁与五个平台 winner 保留。
- 已决定文件只创建新版本，不覆盖；active 文件只从门禁绑定解析。
- 恢复运行 `inspect-run.mjs`，只继续第一个未完成阶段。
